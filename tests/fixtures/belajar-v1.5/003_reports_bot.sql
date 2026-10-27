begin;
create view public.student_summary with(security_invoker=true) as
 select s.id,s.nisn,s.name,s.active,s.registered_phone,s.phone_verified,s.user_id,m.class_id,c.name class_name,m.semester_id,
 (select avg(g.score) from public.grades g join public.tasks t on t.id=g.task_id where g.student_id=s.id and t.semester_id=m.semester_id and t.kind='FORMATIF') formative,
 (select avg(g.score) from public.grades g join public.tasks t on t.id=g.task_id where g.student_id=s.id and t.semester_id=m.semester_id and t.kind='SUMATIF') summative,
 (select count(*) from public.task_targets tt join public.tasks t on t.id=tt.task_id where tt.student_id=s.id and t.semester_id=m.semester_id and tt.status='Belum') pending,
 (select count(*) from public.grades g join public.tasks t on t.id=g.task_id where g.student_id=s.id and t.semester_id=m.semester_id and g.score is not null) graded,
 coalesce((select sum(amount) from public.star_transactions x where x.student_id=s.id and x.semester_id=m.semester_id),0) stars,
 case when cfg.initial_hearts is null then null else greatest(cfg.min_hearts,coalesce((select sum(amount) from public.heart_transactions x where x.student_id=s.id and x.semester_id=m.semester_id),cfg.initial_hearts)) end hearts,
 (select count(*) from public.violations x where x.student_id=s.id and x.semester_id=m.semester_id and x.status in ('Perlu ditebus','Dalam proses')) violations,
 (select round(100.0*count(*) filter(where x.status='Hadir')/nullif(count(*),0),1) from public.attendance_records x join public.attendance_meetings am on am.id=x.meeting_id where x.student_id=s.id and am.semester_id=m.semester_id) attendance,
 coalesce(c.kktp,cfg.kktp) kktp
 from public.students s join public.class_memberships m on m.student_id=s.id join public.classes c on c.id=m.class_id cross join public.school_settings cfg;
grant select on public.student_summary to authenticated;
create function public.reev_dashboard(period uuid) returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object('students',count(*),'classes',count(distinct class_id),'formative',round(avg(formative),2),'summative',round(avg(summative),2),'pending',coalesce(sum(pending),0),'stars',coalesce(sum(stars),0),'violations',coalesce(sum(violations),0),'hearts',sum(hearts),'attendance',round(avg(attendance),1),'classical',round(100.0*count(*) filter(where formative>=kktp)/nullif(count(*),0),1)) from public.student_summary where semester_id=period and active $$;
revoke all on function public.reev_dashboard(uuid) from public,anon;grant execute on function public.reev_dashboard(uuid) to authenticated;
create function public.reev_task_report(task uuid) returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object('targets',count(*),'participants',count(g.score),'passed',count(*) filter(where g.score>=t.kktp),'not_passed',count(*) filter(where g.score<t.kktp),'classical',round(100.0*count(*) filter(where g.score>=t.kktp)/nullif(count(g.score),0),1)) from public.task_targets tt join public.tasks t on t.id=tt.task_id left join public.grades g on g.task_id=tt.task_id and g.student_id=tt.student_id where tt.task_id=task $$;
revoke all on function public.reev_task_report(uuid) from public,anon;grant execute on function public.reev_task_report(uuid) to authenticated;
create function reev_private.bot_profile(sid uuid,cmd text) returns text language plpgsql stable security definer set search_path='' as $$
declare x public.student_summary;msg text;lines text;sem uuid;
begin
 select id into sem from public.semesters where active;select * into x from public.student_summary where id=sid and semester_id=sem;
 if not found then return 'Belum ada data semester aktif. Hubungi guru.';end if;
 msg:=format('%s (%s) | NISN %s',x.name,x.class_name,x.nisn);
 if cmd='.profil' then return msg||format(E'\nSemester aktif • rata-rata sementara\nFormatif: %s | Sumatif: %s\nDinilai: %s | Belum selesai: %s\nBintang: %s | Hati: %s | Pelanggaran aktif: %s\nKehadiran: %s%%',coalesce(round(x.formative,2)::text,'—'),coalesce(round(x.summative,2)::text,'—'),x.graded,x.pending,x.stars,coalesce(x.hearts::text,'belum diatur'),x.violations,coalesce(x.attendance::text,'—'));
 elsif cmd in ('.nilai','.tugas') then
 select string_agg(line,E'\n') into lines from (select format('%s — %s: %s (%s)%s',t.code,left(t.title,70),coalesce(round(g.score,2)::text,'—'),tt.status,case when t.due_date is null then '' else ' | tenggat '||t.due_date end) line from public.task_targets tt join public.tasks t on t.id=tt.task_id left join public.grades g on g.task_id=tt.task_id and g.student_id=tt.student_id where tt.student_id=sid and t.semester_id=sem and (cmd='.nilai' or tt.status='Belum') order by t.created_at desc limit 20) q;
 elsif cmd='.bintang' then
 msg:=msg||format(E'\nSaldo bintang: %s',x.stars);
 select string_agg(line,E'\n') into lines from (select amount||' • '||left(reason,100) line from public.star_transactions where student_id=sid and semester_id=sem order by created_at desc limit 10)q;
 elsif cmd='.hati' then
 msg:=msg||format(E'\nHati: %s | Pelanggaran aktif: %s',coalesce(x.hearts::text,'belum diatur'),x.violations);
 select string_agg(line,E'\n') into lines from (select code||': '||left(description,80)||' — '||status||' | tebusan: '||left(remedy,80) line from public.violations where student_id=sid and semester_id=sem order by created_at desc limit 10)q;
 elsif cmd='.absen' then
 select string_agg(line,E'\n') into lines from (select ar.status||': '||count(*) line from public.attendance_records ar join public.attendance_meetings am on am.id=ar.meeting_id where ar.student_id=sid and am.semester_id=sem group by ar.status)q;
 end if;
 return msg||E'\n'||coalesce(lines,'Belum ada catatan.')||E'\nMaks. 20 tugas / 10 riwayat terbaru; detail lengkap di website.';
end$$;
create table public.gateway_state(id boolean primary key default true check(id),status text not null,last_event timestamptz not null default now());
alter table public.gateway_state enable row level security;
grant select on public.gateway_state to authenticated;
create policy teacher_read on public.gateway_state for select to authenticated using(reev_private.teacher());
-- Only server service_role may execute event processing. Identity derives from a signed gateway event.
create function public.reev_bot(event_key text,phone text,message text) returns jsonb language plpgsql security definer set search_path='' as $$
declare words text[];cmd text;reply text;teacher uuid;sid uuid;stu public.students;t public.tasks;pending public.pending_confirmations;payload jsonb;tok uuid;oldscore numeric;result jsonb;cnt integer;
begin
 if length(event_key)>300 or length(message)>1000 or phone !~ '^\+[1-9][0-9]{7,14}$' then raise exception 'Event tidak valid';end if;
 perform pg_advisory_xact_lock(hashtextextended(phone,1));
 insert into public.whatsapp_command_logs(event_key,phone,command) values(event_key,phone,left(split_part(message,' ',1),30)) on conflict do nothing;
 if not found then return jsonb_build_object('duplicate',true);end if;
 select count(*) into cnt from public.whatsapp_command_logs l where l.phone=reev_bot.phone and l.created_at>now()-interval '1 minute';
 if cnt>12 then update public.whatsapp_command_logs l set status='ditolak',reason='rate_limit' where l.event_key=reev_bot.event_key;return jsonb_build_object('rate_limited',true);end if;
 begin
 words:=regexp_split_to_array(trim(message),'\s+');cmd:=lower(words[1]);
 select al.profile_id into teacher from public.teacher_whatsapp_allowlist al join public.profiles p on p.id=al.profile_id where al.phone=reev_bot.phone and al.active and p.active and p.role='teacher';
 select s.* into stu from public.whatsapp_links l join public.students s on s.id=l.student_id where l.phone=reev_bot.phone and s.active and s.phone_verified and s.registered_phone=l.phone and (s.user_id is null or exists(select 1 from public.profiles p where p.id=s.user_id and p.active));
 sid:=stu.id;
 if cmd='.menu' then
 reply:='.daftar NISN • .profil • .nilai • .tugas • .bintang • .hati • .absen • .batal';
 if teacher is not null then reply:=reply||E'\nGuru: .nilai NISN KODE SKOR (formatif) | .bintang NISN JUMLAH ALASAN | .pelanggaran NISN KODE ALASAN | .profil NISN. Perubahan wajib KONFIRMASI token.';end if;
 elsif cmd='.batal' then update public.pending_confirmations pc set used_at=now() where pc.phone=reev_bot.phone and used_at is null;reply:='Pratinjau dibatalkan.';
 elsif cmd='.daftar' and cardinality(words)=2 then
 select * into stu from public.students s where nisn=words[2] and active and phone_verified and registered_phone=reev_bot.phone and (s.user_id is null or exists(select 1 from public.profiles p where p.id=s.user_id and p.active));
 if not found then raise exception 'Verifikasi belum cocok. Minta guru memeriksa dan menyetujui nomor Anda.';end if;
 if exists(select 1 from public.whatsapp_links l where l.phone=reev_bot.phone and student_id<>stu.id) then raise exception 'Nomor sudah tertaut. Hubungi guru untuk pelepasan.';end if;
 perform set_config('reev.source','WhatsApp',true);
 insert into public.whatsapp_links(student_id,phone) values(stu.id,reev_bot.phone) on conflict(student_id) do update set phone=excluded.phone,created_at=now();
 reply:='Pendaftaran berhasil. '||stu.name||' | NISN '||stu.nisn||E'\nKirim .menu';
 elsif cmd='konfirmasi' and cardinality(words)=2 and teacher is not null then
 select * into pending from public.pending_confirmations pc where pc.token=words[2]::uuid and pc.phone=reev_bot.phone and pc.actor=teacher and used_at is null and expires_at>now() for update;
 if not found then raise exception 'Konfirmasi tidak valid, kedaluwarsa, atau sudah digunakan.';end if;
 -- Revalidate actor, target, configuration and transaction inside mutation.
 result:=reev_private.mutate(teacher,pending.payload->>'op',pending.payload->'p',pending.token,'WhatsApp');
 update public.pending_confirmations set used_at=now() where token=pending.token;reply:='Tersimpan. Riwayat perubahan tercatat.';
 elsif teacher is not null and ((cmd='.nilai' and cardinality(words)=4) or (cmd in ('.bintang','.pelanggaran') and cardinality(words)>=4)) then
 select * into stu from public.students where nisn=words[2] and active;
 if not found then raise exception 'Siswa tidak ditemukan';end if;
 if cmd='.nilai' then
 select * into t from public.tasks where code=words[3];
 if not found or t.kind<>'FORMATIF' then raise exception 'Gunakan tugas formatif yang sudah dibuat. Sumatif diisi per aspek di website.';end if;
 if not exists(select 1 from public.task_targets where task_id=t.id and student_id=stu.id) or words[4] !~ '^[0-9]+(\.[0-9]+)?$' or words[4]::numeric not between 0 and t.max_score then raise exception 'Sasaran/skor tidak valid';end if;
 select score into oldscore from public.grades where task_id=t.id and student_id=stu.id;
 payload:=jsonb_build_object('op','grades','p',jsonb_build_object('task_id',t.id,'rows',jsonb_build_array(jsonb_build_object('student_id',stu.id,'status','Dinilai','score',words[4]::numeric,'feedback','Perubahan via WhatsApp'))));
 reply:=format('%s | %s\nNilai lama skala 100: %s\nSkor baru: %s / %s',stu.name,t.code,coalesce(oldscore::text,'belum dinilai'),words[4],t.max_score);
 elsif cmd='.bintang' then
 if words[3] !~ '^[0-9]+$' or words[3]::integer not between 1 and (select max_stars from public.school_settings) then raise exception 'Jumlah bintang tidak sah';end if;
 payload:=jsonb_build_object('op','star','p',jsonb_build_object('student_id',stu.id,'amount',words[3]::integer,'reason',array_to_string(words[4:],' ')));
 reply:=stu.name||' + '||words[3]||' bintang: '||array_to_string(words[4:],' ');
 else
 if (select initial_hearts from public.school_settings) is null then raise exception 'Tetapkan hati awal di website';end if;
 payload:=jsonb_build_object('op','violation','p',jsonb_build_object('student_id',stu.id,'code',words[3],'description',array_to_string(words[4:],' ')));
 reply:=stu.name||' • '||words[3]||' • -1 hati: '||array_to_string(words[4:],' ');
 end if;
 update public.pending_confirmations pc set used_at=now() where pc.phone=reev_bot.phone and used_at is null;
 insert into public.pending_confirmations(phone,actor,payload) values(reev_bot.phone,teacher,payload) returning token into tok;
 reply:='Pratinjau: '||reply||E'\nBalas KONFIRMASI '||tok||E'\nBerlaku 5 menit, sekali pakai. .batal untuk batal.';
 elsif cmd in ('.profil','.nilai','.tugas','.bintang','.hati','.absen') and cardinality(words)<=2 then
 if teacher is not null and cardinality(words)=2 then select id into sid from public.students where nisn=words[2] and active;
 elsif sid is null or (cardinality(words)=2 and words[2]<>stu.nisn) then raise exception 'Akses ditolak. Tautkan nomor sendiri melalui .daftar NISN.';end if;
 if sid is null then raise exception 'Identitas belum tersedia';end if;
 reply:=reev_private.bot_profile(sid,cmd);
 else raise exception 'Format/perintah tidak tersedia. Kirim .menu';end if;
 update public.whatsapp_command_logs l set status='berhasil' where l.event_key=reev_bot.event_key;
 exception when others then
 reply:=case when SQLSTATE='P0001' then SQLERRM else 'Perintah tidak dapat diproses. Periksa format atau hubungi guru.' end;
 update public.whatsapp_command_logs l set status='ditolak',reason=case when SQLSTATE='P0001' then left(SQLERRM,180) else SQLSTATE end where l.event_key=reev_bot.event_key;
 end;
 insert into public.wa_outbox(event_key,phone,body) values(reev_bot.event_key,reev_bot.phone,reply);
 return jsonb_build_object('ok',true);
end$$;
revoke all on function public.reev_bot(text,text,text) from public,anon,authenticated;
grant execute on function public.reev_bot(text,text,text) to service_role;
-- Atomically claim one reply. A crashed/timeout send becomes UNKNOWN, never automatically resent.
create function public.reev_claim_reply(key text) returns setof public.wa_outbox language sql security definer set search_path='' as $$update public.wa_outbox set status='sending',updated_at=now() where event_key=key and status='queued' returning *$$;
revoke all on function public.reev_claim_reply(text) from public,anon,authenticated;grant execute on function public.reev_claim_reply(text) to service_role;
revoke all on all functions in schema reev_private from public;
do $$declare t text;begin
foreach t in array array['profiles','school_settings','semesters','classes','students','class_memberships','tasks','task_targets','grades','attendance_meetings','attendance_records','star_transactions','violations','heart_transactions','whatsapp_links','teacher_whatsapp_allowlist','audit_logs','grade_history','whatsapp_command_logs','pending_confirmations','wa_outbox','gateway_state'] loop
execute format('grant all on public.%I to service_role',t);
end loop;end$$;
grant usage,select on public.audit_logs_id_seq,public.grade_history_id_seq to service_role;
commit;
