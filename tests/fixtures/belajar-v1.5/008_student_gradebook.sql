begin;
-- Incremental v1.3.0: preserves existing data and audit.
create or replace function reev_private.mutate(a uuid,op text,p jsonb,req uuid,src text) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;cached reev_private.requests;sid uuid;sem uuid;cid uuid;tid uuid;rid uuid;r jsonb;t public.tasks;v public.violations;st public.star_transactions;cfg public.school_settings;score numeric;total numeric;den numeric;comp jsonb;rub jsonb;i integer;oldphone text;
begin
 if not exists(select 1 from public.profiles where id=a and active and role='teacher') then raise exception 'Akses guru diperlukan';end if;
 if octet_length(p::text)>1048576 then raise exception 'Payload terlalu besar';end if;
 if req is null then raise exception 'ID transaksi wajib';end if;
 perform pg_advisory_xact_lock(hashtextextended(req::text,0));
 select * into cached from reev_private.requests where id=req;
 if found then if cached.actor<>a or cached.payload<>jsonb_build_object('op',op,'p',p) then raise exception 'ID transaksi sudah dipakai';end if;return cached.result;end if;
 perform set_config('reev.actor',a::text,true);perform set_config('reev.source',src,true);
 select * into cfg from public.school_settings where id;
 select id into sem from public.semesters where active;
 -- Settings use a boolean singleton key, never a UUID.
 if op<>'settings' then rid:=coalesce(nullif(p->>'id','')::uuid,gen_random_uuid());end if;
 if op='settings' then
 update public.school_settings set subject=p->>'subject',school=p->>'school',teacher=coalesce(p->>'teacher',''),kktp=(p->>'kktp')::numeric,classical_target=(p->>'classical_target')::numeric,initial_hearts=nullif(p->>'initial_hearts','')::integer,min_hearts=(p->>'min_hearts')::integer,restore_hearts=(p->>'restore_hearts')::boolean,max_stars=(p->>'max_stars')::integer,bonus_enabled=(p->>'bonus_enabled')::boolean,stars_per_percent=(p->>'stars_per_percent')::integer,accent=p->>'accent' where id;
 elsif op='semester' then
 perform pg_advisory_xact_lock(90101);
 if coalesce((p->>'active')::boolean,false) then update public.semesters set active=false where active;end if;
 insert into public.semesters(id,name,active,archived) values(rid,p->>'name',coalesce((p->>'active')::boolean,false),coalesce((p->>'archived')::boolean,false)) on conflict(id) do update set name=excluded.name,active=excluded.active,archived=excluded.archived;
 elsif op='class' then
 insert into public.classes(id,name,kktp,active) values(rid,p->>'name',nullif(p->>'kktp','')::numeric,coalesce((p->>'active')::boolean,true)) on conflict(id) do update set name=excluded.name,kktp=excluded.kktp,active=excluded.active;
 elsif op in ('student','import_students') then
 if sem is null then raise exception 'Aktifkan semester dahulu';end if;
 if op='import_students' and (jsonb_array_length(p->'rows')>500 or jsonb_array_length(p->'rows')<1) then raise exception 'Impor 1–500 baris';end if;
 i:=0;
 for r in select value from jsonb_array_elements(case when op='student' then jsonb_build_array(p) else p->'rows' end) loop
 i:=i+1;sid:=coalesce(nullif(r->>'id','')::uuid,gen_random_uuid());cid:=(r->>'class_id')::uuid;
 if not exists(select 1 from public.classes where id=cid and active) then raise exception 'Kelas tidak aktif pada baris %',i;end if;
 select registered_phone into oldphone from public.students where id=sid;
 if op='import_students' and exists(select 1 from public.students where nisn=r->>'nisn') then raise exception 'NISN duplikat pada baris %',i;end if;
 insert into public.students(id,nisn,name,registered_phone,phone_verified,active) values(sid,r->>'nisn',r->>'name',nullif(r->>'registered_phone',''),coalesce((r->>'phone_verified')::boolean,false),coalesce((r->>'active')::boolean,true)) on conflict(id) do update set nisn=excluded.nisn,name=excluded.name,registered_phone=excluded.registered_phone,phone_verified=excluded.phone_verified,active=excluded.active;
 if oldphone is distinct from nullif(r->>'registered_phone','') or not coalesce((r->>'phone_verified')::boolean,false) or not coalesce((r->>'active')::boolean,true) then delete from public.whatsapp_links where student_id=sid;end if;
 insert into public.class_memberships(student_id,semester_id,class_id) values(sid,sem,cid) on conflict(student_id,semester_id) do update set class_id=excluded.class_id;
 end loop;
 elsif op='task' then
 if sem is null then raise exception 'Aktifkan semester dahulu';end if;
 if exists(select 1 from public.tasks where id=rid) then raise exception 'Asesmen tersimpan bersifat tetap; buat kode baru untuk rubrik berbeda';end if;
 cid:=(p->>'class_id')::uuid;rub:=coalesce(p->'rubric','[]');
 if p->>'kind'='SUMATIF' then
 if jsonb_typeof(rub)<>'array' or jsonb_array_length(rub) not between 1 and 20 then raise exception 'Isi 1–20 aspek rubrik';end if;
 for r in select value from jsonb_array_elements(rub) loop
 if jsonb_typeof(r->'max')<>'number' or not(r ? 'max') or not(r ? 'name') or (r->>'max')::numeric<=0 or coalesce((r->>'weight')::numeric,1)<=0 or length(r->>'name')<1 then raise exception 'Rubrik tidak valid';end if;
 end loop;end if;
 insert into public.tasks(id,code,title,kind,class_id,semester_id,material,due_date,assessment_date,max_score,kktp,classical_target,rubric) values(rid,p->>'code',p->>'title',p->>'kind',cid,sem,coalesce(p->>'material',''),nullif(p->>'due_date','')::date,nullif(p->>'assessment_date','')::date,coalesce((p->>'max_score')::numeric,100),coalesce(nullif(p->>'kktp','')::numeric,(select kktp from public.classes where id=cid),cfg.kktp),coalesce(nullif(p->>'classical_target','')::numeric,cfg.classical_target),rub);
 insert into public.task_targets(task_id,student_id) select rid,m.student_id from public.class_memberships m join public.students s on s.id=m.student_id where m.class_id=cid and m.semester_id=sem and s.active;
 elsif op='grades' then
 tid:=(p->>'task_id')::uuid;select * into t from public.tasks where id=tid for update;
 if not found or not exists(select 1 from public.semesters where id=t.semester_id and not archived) then raise exception 'Tugas tidak tersedia atau semester diarsipkan';end if;
 if jsonb_array_length(p->'rows') not between 1 and 200 then raise exception 'Simpan 1–200 nilai per batch';end if;
 for r in select value from jsonb_array_elements(p->'rows') loop
 sid:=(r->>'student_id')::uuid;
 if not exists(select 1 from public.task_targets where task_id=tid and student_id=sid) then raise exception 'Siswa bukan sasaran tugas';end if;
 comp:=coalesce(r->'components','[]');score:=nullif(r->>'score','')::numeric;
 if t.kind='SUMATIF' and r->>'status'='Dinilai' then
 if jsonb_array_length(comp)<>jsonb_array_length(t.rubric) then raise exception 'Semua aspek harus diisi';end if;
 total:=0;den:=0;
 for i in 0..jsonb_array_length(t.rubric)-1 loop
 if jsonb_typeof(comp->i)<>'number' or (comp->>i)::numeric<0 or (comp->>i)::numeric>(t.rubric->i->>'max')::numeric then raise exception 'Skor aspek di luar rentang';end if;
 total:=total+(comp->>i)::numeric*coalesce((t.rubric->i->>'weight')::numeric,1);den:=den+(t.rubric->i->>'max')::numeric*coalesce((t.rubric->i->>'weight')::numeric,1);
 end loop;score:=round(total/den*100,4);
 elsif t.kind='FORMATIF' and score is not null then
 if score<0 or score>t.max_score then raise exception 'Skor di luar rentang';end if;score:=round(score/t.max_score*100,4);
 end if;
 if r->>'status'='Dinilai' and score is null then raise exception 'Nilai wajib; nol diperbolehkan';end if;
 if r->>'status'<>'Dinilai' then score:=null;comp:='[]';end if;
 insert into public.grades(task_id,student_id,score,components,feedback) values(tid,sid,score,comp,coalesce(r->>'feedback','')) on conflict(task_id,student_id) do update set score=excluded.score,components=excluded.components,feedback=excluded.feedback,updated_at=now();
 update public.task_targets set status=r->>'status' where task_id=tid and student_id=sid;
 end loop;
 elsif op='meeting' then
 if sem is null then raise exception 'Aktifkan semester dahulu';end if;
 insert into public.attendance_meetings(id,class_id,semester_id,date,number,material) values(rid,(p->>'class_id')::uuid,sem,(p->>'date')::date,(p->>'number')::integer,coalesce(p->>'material',''));
 elsif op='attendance' then
 if jsonb_array_length(p->'rows') not between 1 and 200 then raise exception 'Batch kehadiran 1–200 siswa';end if;
 for r in select value from jsonb_array_elements(p->'rows') loop
 sid:=(r->>'student_id')::uuid;
 if not exists(select 1 from public.attendance_meetings m join public.class_memberships c on c.class_id=m.class_id and c.semester_id=m.semester_id join public.semesters se on se.id=m.semester_id where m.id=(p->>'meeting_id')::uuid and c.student_id=sid and not se.archived) then raise exception 'Siswa bukan anggota pertemuan';end if;
 insert into public.attendance_records(meeting_id,student_id,status,note) values((p->>'meeting_id')::uuid,sid,r->>'status',coalesce(r->>'note','')) on conflict(meeting_id,student_id) do update set status=excluded.status,note=excluded.note;
 end loop;
 elsif op in ('star','violation') then
 sid:=(p->>'student_id')::uuid;
 if sem is null or not exists(select 1 from public.students s join public.class_memberships m on m.student_id=s.id where s.id=sid and s.active and m.semester_id=sem) then raise exception 'Siswa/semester tidak aktif';end if;
 perform 1 from public.students where id=sid for update;
 if op='star' then
 if (p->>'amount')::integer not between 1 and cfg.max_stars then raise exception 'Jumlah bintang di luar batas';end if;
 insert into public.star_transactions(id,student_id,semester_id,amount,reason) values(rid,sid,sem,(p->>'amount')::integer,p->>'reason');
 else
 if cfg.initial_hearts is null then raise exception 'Tetapkan hati awal di Pengaturan';end if;
 insert into public.heart_transactions(student_id,semester_id,amount,reason,kind) values(sid,sem,cfg.initial_hearts,'Saldo awal','initial') on conflict(student_id,semester_id) where kind='initial' do nothing;
 insert into public.violations(id,student_id,semester_id,code,description,remedy,due_date) values(rid,sid,sem,p->>'code',p->>'description',coalesce(p->>'remedy',''),nullif(p->>'due_date','')::date);
 insert into public.heart_transactions(student_id,semester_id,amount,reason,violation_id,kind) values(sid,sem,-1,p->>'description',rid,'deduction');
 end if;
 elsif op='reverse_star' then
 select * into st from public.star_transactions where id=(p->>'id')::uuid for update;
 if not found or st.amount<0 then raise exception 'Transaksi bintang tidak sah';end if;
 insert into public.star_transactions(student_id,semester_id,amount,reason,reversal_of) values(st.student_id,st.semester_id,-st.amount,p->>'reason',st.id);
 elsif op='resolve_violation' then
 select * into v from public.violations where id=(p->>'id')::uuid for update;
 if not found or v.status in ('Selesai','Dibatalkan') then raise exception 'Pelanggaran sudah selesai/tidak ditemukan';end if;
 if p->>'status' not in ('Dalam proses','Selesai','Dibatalkan') then raise exception 'Status pemulihan tidak valid';end if;
 if coalesce((p->>'restore')::boolean,false) and (not cfg.restore_hearts or p->>'status'<>'Selesai') then raise exception 'Aktifkan aturan pemulihan dan pilih Selesai';end if;
 update public.violations set status=p->>'status',completion_note=coalesce(p->>'note','') where id=v.id;
 if p->>'status'='Dibatalkan' or coalesce((p->>'restore')::boolean,false) then
 insert into public.heart_transactions(student_id,semester_id,amount,reason,violation_id,kind) values(v.student_id,v.semester_id,1,coalesce(nullif(p->>'note',''),'Koreksi/pemulihan terkonfirmasi'),v.id,case when p->>'status'='Dibatalkan' then 'cancel' else 'restore' end);
 end if;
 elsif op='allowlist' then
 if not exists(select 1 from public.profiles where id=(p->>'profile_id')::uuid and role='teacher' and active) then raise exception 'Akun guru tidak aktif';end if;
 insert into public.teacher_whatsapp_allowlist(phone,profile_id,active) values(p->>'phone',(p->>'profile_id')::uuid,(p->>'active')::boolean) on conflict(phone) do update set profile_id=excluded.profile_id,active=excluded.active;
 elsif op='unlink' then delete from public.whatsapp_links where student_id=(p->>'student_id')::uuid;
 elsif op='profile' then
 perform pg_advisory_xact_lock(90102);
 if not coalesce((p->>'active')::boolean,true) and exists(select 1 from public.profiles where id=(p->>'id')::uuid and role='teacher' and active) and (select count(*) from public.profiles where role='teacher' and active)<=1 then raise exception 'Guru aktif terakhir tidak boleh dinonaktifkan';end if;
 update public.profiles set active=(p->>'active')::boolean,name=p->>'name' where id=(p->>'id')::uuid;
 else raise exception 'Operasi tidak dikenali';end if;
 result:=jsonb_build_object('ok',true,'id',rid);
 insert into reev_private.requests(id,actor,payload,result) values(req,a,jsonb_build_object('op',op,'p',p),result);
 return result;
end$$;

create or replace view public.student_summary with(security_invoker=true) as
 select s.id,s.nisn,s.name,s.active,s.registered_phone,s.phone_verified,s.user_id,m.class_id,c.name class_name,m.semester_id,
 (select avg(g.score) from public.grades g join public.tasks t on t.id=g.task_id where g.student_id=s.id and t.semester_id=m.semester_id and t.kind='FORMATIF') formative,
 (select avg(g.score) from public.grades g join public.tasks t on t.id=g.task_id where g.student_id=s.id and t.semester_id=m.semester_id and t.kind='SUMATIF') summative,
 (select count(*) from public.task_targets tt join public.tasks t on t.id=tt.task_id where tt.student_id=s.id and t.semester_id=m.semester_id and tt.status='Belum') pending,
 (select count(*) from public.grades g join public.tasks t on t.id=g.task_id where g.student_id=s.id and t.semester_id=m.semester_id and g.score is not null) graded,
 coalesce((select sum(amount) from public.star_transactions x where x.student_id=s.id and x.semester_id=m.semester_id),0) stars,
 case when cfg.initial_hearts is null then null else greatest(cfg.min_hearts,coalesce((select sum(amount) from public.heart_transactions x where x.student_id=s.id and x.semester_id=m.semester_id),cfg.initial_hearts)) end hearts,
 (select count(*) from public.violations x where x.student_id=s.id and x.semester_id=m.semester_id and x.status in ('Perlu ditebus','Dalam proses')) violations,
 (select round(100.0*count(*) filter(where x.status='Hadir')/nullif(count(*),0),1) from public.attendance_records x join public.attendance_meetings am on am.id=x.meeting_id where x.student_id=s.id and am.semester_id=m.semester_id) attendance,
 coalesce(c.kktp,cfg.kktp) kktp,
 exists(select 1 from public.whatsapp_links wl where wl.student_id=s.id and wl.phone=s.registered_phone and s.phone_verified) whatsapp_linked,
 (select wl.created_at from public.whatsapp_links wl where wl.student_id=s.id and wl.phone=s.registered_phone and s.phone_verified) whatsapp_linked_at,
 lower(btrim(s.name)) name_sort,
 (select count(*) from public.task_targets tt join public.tasks t on t.id=tt.task_id where tt.student_id=s.id and t.semester_id=m.semester_id and t.kind='FORMATIF') formative_total,
 (select count(*) from public.task_targets tt join public.tasks t on t.id=tt.task_id join public.grades g on g.task_id=tt.task_id and g.student_id=tt.student_id where tt.student_id=s.id and t.semester_id=m.semester_id and t.kind='FORMATIF' and tt.status='Dinilai' and g.score is not null) formative_graded
 from public.students s join public.class_memberships m on m.student_id=s.id join public.classes c on c.id=m.class_id cross join public.school_settings cfg;
create or replace function public.reev_dashboard(period uuid) returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object('students',count(*),'classes',count(distinct class_id),'formative',round(avg(formative),2),'summative',round(avg(summative),2),'pending',coalesce(sum(pending),0),'stars',coalesce(sum(stars),0),'violations',coalesce(sum(violations),0),'hearts',sum(hearts),'attendance',round(avg(attendance),1),'classical',round(100.0*count(*) filter(where formative_total>0 and formative_graded=formative_total and formative>=kktp)/nullif(count(*),0),1)) from public.student_summary where semester_id=period and active $$;
revoke all on function public.reev_dashboard(uuid) from public,anon;grant execute on function public.reev_dashboard(uuid) to authenticated;

-- Read through RLS. Pages keep requests bounded and ordering stable.
create function public.reev_student_tasks(student uuid,period uuid,page_offset integer default 0)
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(q.item order by q.created_at,q.id),'[]'::jsonb) from (
 select t.id,t.created_at,jsonb_build_object('task',to_jsonb(t),'student_id',tt.student_id,'status',tt.status,'grades',to_jsonb(g)) item
 from public.task_targets tt join public.tasks t on t.id=tt.task_id
 left join public.grades g on g.task_id=tt.task_id and g.student_id=tt.student_id
 where tt.student_id=student and t.semester_id=period
 order by t.created_at,t.id limit 200 offset greatest(0,coalesce(page_offset,0))
 ) q $$;
revoke all on function public.reev_student_tasks(uuid,uuid,integer) from public,anon;
grant execute on function public.reev_student_tasks(uuid,uuid,integer) to authenticated;

-- Sort the complete eligible roster before applying the existing 200-row limit.
create function public.reev_task_roster(task uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(q.item order by q.name_sort,q.student_id),'[]'::jsonb) from (
 select lower(btrim(s.name)) name_sort,tt.student_id,
 jsonb_build_object('task_id',tt.task_id,'student_id',tt.student_id,'status',tt.status,
 'students',jsonb_build_object('name',s.name,'nisn',s.nisn),'grades',to_jsonb(g)) item
 from public.task_targets tt join public.students s on s.id=tt.student_id
 left join public.grades g on g.task_id=tt.task_id and g.student_id=tt.student_id
 where tt.task_id=task order by lower(btrim(s.name)),tt.student_id limit 200
 ) q $$;
revoke all on function public.reev_task_roster(uuid) from public,anon;
grant execute on function public.reev_task_roster(uuid) to authenticated;

create function public.reev_class_roster(class_id uuid,period uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(q.item order by q.name_sort,q.student_id),'[]'::jsonb) from (
 select lower(btrim(s.name)) name_sort,m.student_id,
 to_jsonb(m)||jsonb_build_object('students',jsonb_build_object('name',s.name,'nisn',s.nisn)) item
 from public.class_memberships m join public.students s on s.id=m.student_id
 where m.class_id=reev_class_roster.class_id and m.semester_id=period
 order by lower(btrim(s.name)),m.student_id limit 200
 ) q $$;
revoke all on function public.reev_class_roster(uuid,uuid) from public,anon;
grant execute on function public.reev_class_roster(uuid,uuid) to authenticated;

-- Atomic multi-task save, using the same validation and audit as ordinary grading.
create function public.reev_save_student_grades(p jsonb,request_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare a uuid:=auth.uid();cached reev_private.requests;r jsonb;t public.tasks;
 sid uuid;sem uuid;count_rows integer;answer jsonb;current_grade jsonb;current_status text;
begin
 if not exists(select 1 from public.profiles where id=a and active and role='teacher') then raise exception 'Akses guru diperlukan';end if;
 if p is null or request_id is null or octet_length(p::text)>1048576 then raise exception 'Permintaan tidak valid';end if;
 if jsonb_typeof(p->'rows') is distinct from 'array' then raise exception 'Daftar nilai tidak valid';end if;
 count_rows:=jsonb_array_length(p->'rows');
 if count_rows not between 1 and 200 then raise exception 'Simpan 1–200 perubahan tugas per batch';end if;
 sid:=(p->>'student_id')::uuid;sem:=(p->>'semester_id')::uuid;
 if sid is null or sem is null then raise exception 'Siswa dan semester wajib';end if;
 perform pg_advisory_xact_lock(hashtextextended(request_id::text,0));
 select * into cached from reev_private.requests where id=request_id;
 if found then
 if cached.actor<>a or cached.payload<>jsonb_build_object('op','student_grades','p',p) then raise exception 'ID transaksi sudah dipakai';end if;
 return cached.result;end if;
 if (select count(distinct value->>'task_id') from jsonb_array_elements(p->'rows'))<>count_rows then raise exception 'Tugas duplikat atau tidak valid';end if;
 -- Task locks in UUID order also serialize against edits/deletes and regular grade writes.
 for r in select value from jsonb_array_elements(p->'rows') order by value->>'task_id' loop
 select * into t from public.tasks where id=(r->>'task_id')::uuid for update;
 if not found or t.semester_id<>sem then raise exception 'Tugas tidak tersedia pada semester ini';end if;
 if not exists(select 1 from public.semesters where id=sem and not archived) then raise exception 'Semester diarsipkan';end if;
 select status into current_status from public.task_targets where task_id=t.id and student_id=sid;
 if not found then raise exception 'Siswa bukan sasaran tugas';end if;
 select to_jsonb(g) into current_grade from public.grades g where task_id=t.id and student_id=sid;
 -- Prevent overwriting changes made after this student's dialog was opened.
 if not (r ? 'expected_grade') or not (r ? 'expected_status') or not (r ? 'revision')
 or (r->>'revision')::integer is distinct from t.revision
 or r->>'expected_status' is distinct from current_status
 or r->'expected_grade' is distinct from coalesce(current_grade,'null'::jsonb)
 then raise exception 'Nilai atau tugas telah berubah. Tutup dan buka kembali daftar tugas sebelum menyimpan';end if;
 perform reev_private.mutate(a,'grades',jsonb_build_object('task_id',t.id,'rows',jsonb_build_array(
 jsonb_build_object('student_id',sid,'status',r->>'status','score',r->'score','components',r->'components','feedback',r->>'feedback'))),gen_random_uuid(),'website');
 end loop;
 answer:=jsonb_build_object('ok',true,'saved',count_rows);
 insert into reev_private.requests(id,actor,payload,result) values(request_id,a,jsonb_build_object('op','student_grades','p',p),answer);
 return answer;
end $$;
revoke all on function public.reev_save_student_grades(jsonb,uuid) from public,anon;
grant execute on function public.reev_save_student_grades(jsonb,uuid) to authenticated;
notify pgrst,'reload schema';
commit;
