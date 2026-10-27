begin;
create table public.gateway_link_pending(phone text primary key,student_id uuid not null references public.students(id),expires_at timestamptz not null default now()+interval '5 minutes');
create table public.gateway_function_events(event_key text primary key check(length(event_key)<=300),phone text not null,request_hash text not null,result jsonb,created_at timestamptz not null default now());
create index gateway_function_events_phone on public.gateway_function_events(phone,created_at desc);
alter table public.gateway_link_pending enable row level security;
alter table public.gateway_function_events enable row level security;
revoke all on public.gateway_link_pending,public.gateway_function_events from public,anon,authenticated;
grant all on public.gateway_link_pending,public.gateway_function_events to service_role;
create function public.reev_gateway_function(p_event text,p_phone text,p_action text,p_argument text default '') returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.students;pending public.gateway_link_pending;reply text;r jsonb;cached public.gateway_function_events;h text;cmd text;until_time timestamptz;
begin
 if p_event is null or length(p_event)>300 or p_phone !~ '^\+[1-9][0-9]{7,14}$' or length(p_argument)>30 or p_action not in ('register','confirm','cancel','profile','tasks','grades','stars','hearts','attendance') then raise exception 'Input tidak valid';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_phone,1));
 h:=md5(p_phone||':'||p_action||':'||p_argument);
 select * into cached from public.gateway_function_events where event_key=p_event;
 if found then if cached.request_hash<>h then raise exception 'Event berbeda';end if;return cached.result;end if;
 if (select count(*) from public.gateway_function_events where phone=p_phone and created_at>now()-interval '1 minute')>=15 then return jsonb_build_object('ok',false,'text','Terlalu banyak permintaan. Tunggu satu menit.');end if;
 insert into public.gateway_function_events(event_key,phone,request_hash) values(p_event,p_phone,h);
 begin
 if p_action='register' then
 if p_argument !~ '^[0-9]{5,20}$' then raise exception 'Ketik perintah daftar diikuti NISN, contoh: .infodaftar 0012345671';end if;
 select * into s from public.students where nisn=p_argument and active and phone_verified and registered_phone=p_phone and (user_id is null or exists(select 1 from public.profiles p where p.id=students.user_id and p.active));
 if not found then raise exception 'Data belum cocok. Minta guru memeriksa NISN dan memverifikasi nomor WhatsApp Anda di REEV Belajar.';end if;
 if exists(select 1 from public.whatsapp_links where (student_id=s.id and phone<>p_phone) or (phone=p_phone and student_id<>s.id)) then raise exception 'Sudah ada tautan lain. Hubungi guru untuk melepas tautan lama.';end if;
 until_time:=now()+interval '5 minutes';
 insert into public.gateway_link_pending(phone,student_id,expires_at) values(p_phone,s.id,until_time) on conflict(phone) do update set student_id=excluded.student_id,expires_at=excluded.expires_at;
 r:=jsonb_build_object('ok',true,'pending',true,'text',format(E'Konfirmasi REEV Belajar\nNama: %s\nNISN: %s\nNomor: %s\n\nBalas YA untuk menautkan nomor ini. Berlaku 5 menit. Balas BATAL untuk membatalkan.',s.name,s.nisn,p_phone));
 elsif p_action='cancel' then update public.pending_confirmations set used_at=now() where phone=p_phone and used_at is null;delete from public.gateway_link_pending where phone=p_phone;r:=jsonb_build_object('ok',true,'pending',false,'text','Penautan dibatalkan.');
 elsif p_action='confirm' then
 select * into pending from public.gateway_link_pending where phone=p_phone and expires_at>now() for update;
 if not found then raise exception 'Konfirmasi sudah berakhir. Ulangi perintah daftar.';end if;
 select * into s from public.students where id=pending.student_id and active and phone_verified and registered_phone=p_phone and (user_id is null or exists(select 1 from public.profiles p where p.id=students.user_id and p.active)) for update;
 if not found then raise exception 'Verifikasi nomor telah berubah. Hubungi guru.';end if;
 if exists(select 1 from public.whatsapp_links where (student_id=s.id and phone<>p_phone) or (phone=p_phone and student_id<>s.id)) then raise exception 'Tautan sudah berubah. Hubungi guru.';end if;
 perform set_config('reev.source','WhatsApp Gateway',true);
 insert into public.whatsapp_links(student_id,phone) values(s.id,p_phone) on conflict(student_id) do update set phone=excluded.phone,created_at=now();
 update public.students set registered_phone=p_phone,phone_verified=true where id=s.id;
 delete from public.gateway_link_pending where phone=p_phone;
 r:=jsonb_build_object('ok',true,'pending',false,'text','Nomor berhasil ditautkan ke '||s.name||E'.\nKirim .menu untuk membuka REEV Belajar.');
 else
 if p_argument<>'' then raise exception 'Perintah ini hanya menampilkan data Anda sendiri. Kirim tanpa NISN atau argumen tambahan.';end if;
 select st.* into s from public.whatsapp_links l join public.students st on st.id=l.student_id where l.phone=p_phone and st.active and st.phone_verified and st.registered_phone=p_phone and (st.user_id is null or exists(select 1 from public.profiles p where p.id=st.user_id and p.active));
 if not found then raise exception 'Nomor belum tertaut atau akses dinonaktifkan. Gunakan menu Tautkan NISN.';end if;
 cmd:=case p_action when 'profile' then '.profil' when 'tasks' then '.tugas' when 'grades' then '.nilai' when 'stars' then '.bintang' when 'hearts' then '.hati' when 'attendance' then '.absen' end;
 reply:=reev_private.bot_profile(s.id,cmd);r:=jsonb_build_object('ok',true,'text',reply);
 end if;
 exception when others then r:=jsonb_build_object('ok',false,'text',case when SQLSTATE='P0001' then SQLERRM else 'Permintaan tidak dapat diproses. Hubungi guru.' end);
 end;
 update public.gateway_function_events set result=r where event_key=p_event;return r;
end $$;
revoke all on function public.reev_gateway_function(text,text,text,text) from public,anon,authenticated;
grant execute on function public.reev_gateway_function(text,text,text,text) to service_role;
create function reev_private.clear_gateway_pending() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if TG_TABLE_NAME='whatsapp_links' then delete from public.gateway_link_pending where student_id=old.student_id;return old;end if;
 if old.registered_phone is distinct from new.registered_phone or old.nisn is distinct from new.nisn or not new.phone_verified or not new.active then delete from public.gateway_link_pending where student_id=new.id;end if;return new;
end $$;
revoke all on function reev_private.clear_gateway_pending() from public,anon,authenticated;
create trigger clear_gateway_pending after update on public.students for each row execute function reev_private.clear_gateway_pending();
create trigger clear_gateway_pending after delete on public.whatsapp_links for each row execute function reev_private.clear_gateway_pending();
-- Preserve legacy teacher functions, while students cannot bypass Gateway pricing.
create function public.reev_gateway_legacy_teacher(event_key text,phone text,message text) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not exists(select 1 from public.teacher_whatsapp_allowlist a join public.profiles p on p.id=a.profile_id where a.phone=reev_gateway_legacy_teacher.phone and a.active and p.active and p.role='teacher') then return jsonb_build_object('ignored',true);end if;
 if lower(split_part(trim(message),' ',1)) in ('.menu','.daftar') then return jsonb_build_object('ignored',true);end if;
 return public.reev_bot(event_key,phone,message);
end $$;
revoke all on function public.reev_gateway_legacy_teacher(text,text,text) from public,anon,authenticated;
grant execute on function public.reev_gateway_legacy_teacher(text,text,text) to service_role;
-- Extend the existing invoker view without changing its earlier columns.
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
 (select wl.created_at from public.whatsapp_links wl where wl.student_id=s.id and wl.phone=s.registered_phone and s.phone_verified) whatsapp_linked_at
 from public.students s join public.class_memberships m on m.student_id=s.id join public.classes c on c.id=m.class_id cross join public.school_settings cfg;

commit;
