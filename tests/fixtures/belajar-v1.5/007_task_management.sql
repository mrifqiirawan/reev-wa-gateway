begin;
-- Incremental upgrade: no existing task or grade is removed by this migration.
alter table public.tasks add column revision integer not null default 1;

-- DELETE must use OLD identifiers to retain grade history.
create or replace function reev_private.audit() returns trigger language plpgsql security definer set search_path='' as $$
declare o jsonb;n jsonb;a uuid;src text;
begin
 o:=case when TG_OP='INSERT' then null else to_jsonb(old) end;n:=case when TG_OP='DELETE' then null else to_jsonb(new) end;
 a:=nullif(current_setting('reev.actor',true),'')::uuid;src:=coalesce(nullif(current_setting('reev.source',true),''),'bootstrap');
 insert into public.audit_logs(actor,source,action,entity,old_data,new_data) values(a,src,TG_OP,TG_TABLE_NAME,o,n);
 if TG_TABLE_NAME='grades' then insert into public.grade_history(task_id,student_id,old_data,new_data,actor,source) values(coalesce(new.task_id,old.task_id),coalesce(new.student_id,old.student_id),o,n,a,src);end if;
 return new;
end$$;

create function public.reev_manage_task(op text,p jsonb,request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid(); t public.tasks; cached reev_private.requests;
 r jsonb; rub jsonb; maximum numeric; result jsonb;
begin
 if not exists(select 1 from public.profiles where id=a and active and role='teacher') then
  raise exception 'Akses guru diperlukan'; end if;
 if op not in ('task_update','task_delete') or op is null then raise exception 'Operasi tidak dikenali'; end if;
 if p is null or octet_length(p::text)>1048576 or request_id is null then raise exception 'Permintaan tidak valid'; end if;
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
 select * into cached from reev_private.requests where id=request_id;
 if found then
  if cached.actor<>a or cached.payload<>jsonb_build_object('op',op,'p',p) then raise exception 'ID transaksi sudah dipakai'; end if;
  return cached.result;
 end if;
 select * into t from public.tasks where id=(p->>'id')::uuid for update;
 if not found then raise exception 'Asesmen tidak ditemukan; segarkan halaman'; end if;
 if not exists(select 1 from public.semesters where id=t.semester_id and not archived) then
  raise exception 'Semester diarsipkan; buka arsip sebelum mengubah asesmen'; end if;
 if (p->>'revision')::integer is distinct from t.revision then
  raise exception 'Asesmen telah berubah. Tutup dialog, segarkan, lalu coba lagi'; end if;
 perform set_config('reev.actor',a::text,true);
 perform set_config('reev.source','website',true);
 if op='task_delete' then
  if p->>'confirm_code' is distinct from t.code then raise exception 'Ketik kode asesmen dengan tepat untuk menghapus'; end if;
  delete from public.grades where task_id=t.id;
  delete from public.task_targets where task_id=t.id;
  delete from public.tasks where id=t.id;
 else
  -- Class, semester and kind remain fixed so existing target membership stays intact.
  if (p ? 'class_id' and p->>'class_id' is distinct from t.class_id::text)
   or (p ? 'semester_id' and p->>'semester_id' is distinct from t.semester_id::text)
   or (p ? 'kind' and p->>'kind' is distinct from t.kind) then
   raise exception 'Kelas, semester, dan jenis asesmen tidak dapat dipindahkan'; end if;
  rub:=coalesce(p->'rubric',t.rubric);
  maximum:=coalesce(nullif(p->>'max_score','')::numeric,t.max_score);
  if (rub is distinct from t.rubric or maximum is distinct from t.max_score)
   and exists(select 1 from public.grades where task_id=t.id and score is not null) then
   raise exception 'Sudah ada nilai; rubrik dan skor maksimum tidak dapat diubah'; end if;
  if t.kind='SUMATIF' then
   if jsonb_typeof(rub) is distinct from 'array' then raise exception 'Rubrik tidak valid'; end if;
   if jsonb_array_length(rub) not between 1 and 20 then raise exception 'Isi 1–20 aspek rubrik'; end if;
   for r in select value from jsonb_array_elements(rub) loop
    if jsonb_typeof(r->'name') is distinct from 'string' or length(btrim(r->>'name'))<1
     or jsonb_typeof(r->'max') is distinct from 'number' or (r->>'max')::numeric<=0
     or jsonb_typeof(r->'weight') is distinct from 'number' or (r->>'weight')::numeric<=0 then
     raise exception 'Rubrik tidak valid'; end if;
   end loop;
  elsif rub<>'[]'::jsonb then raise exception 'Formatif tidak menggunakan rubrik'; end if;
  update public.tasks set code=btrim(p->>'code'),title=btrim(p->>'title'),
   material=coalesce(p->>'material',''),due_date=nullif(p->>'due_date','')::date,
   assessment_date=nullif(p->>'assessment_date','')::date,max_score=maximum,
   kktp=coalesce(nullif(p->>'kktp','')::numeric,t.kktp),
   classical_target=coalesce(nullif(p->>'classical_target','')::numeric,t.classical_target),
   rubric=rub,revision=revision+1 where id=t.id;
 end if;
 result:=jsonb_build_object('ok',true,'id',t.id);
 insert into reev_private.requests(id,actor,payload,result)
 values(request_id,a,jsonb_build_object('op',op,'p',p),result);
 return result;
end $$;
revoke all on function public.reev_manage_task(text,jsonb,uuid) from public,anon;
grant execute on function public.reev_manage_task(text,jsonb,uuid) to authenticated;
commit;
