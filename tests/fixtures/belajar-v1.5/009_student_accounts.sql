begin;
-- Private provisioning only. Auth creation still uses the official Admin API.
create function public.reev_pending_student_account(student uuid) returns uuid
language plpgsql security definer set search_path='' as $$
declare s public.students; u auth.users;
begin
 select * into s from public.students where id=student;
 if not found or not s.active then raise exception 'Siswa tidak aktif/tidak ditemukan'; end if;
 if s.user_id is not null then return s.user_id; end if;
 select * into u from auth.users where lower(email)=s.nisn||'@siswa.reev.invalid';
 if not found then return null; end if;
 if u.raw_app_meta_data->>'reev_student_id' is distinct from s.id::text then
  raise exception 'Email sudah digunakan akun lain; perlu rekonsiliasi pengelola';
 end if;
 return u.id;
end $$;
create function public.reev_attach_student_account(student uuid, account uuid) returns void
language plpgsql security definer set search_path='' as $$
declare s public.students; u auth.users;
begin
 select * into s from public.students where id=student for update;
 if not found or not s.active then raise exception 'Siswa tidak aktif/tidak ditemukan'; end if;
 if s.user_id is not null then
  if s.user_id=account then return; end if;
  raise exception 'Siswa sudah memiliki akun lain';
 end if;
 select * into u from auth.users where id=account;
 if not found or u.email is distinct from s.nisn||'@siswa.reev.invalid'
 or u.raw_app_meta_data->>'reev_student_id' is distinct from s.id::text then
  raise exception 'Identitas Auth tidak cocok';
 end if;
 if exists(select 1 from public.profiles where id=account and (role<>'student' or not active)) then raise exception 'Profil akun tidak cocok'; end if;
 insert into public.profiles(id,name,role) values(account,s.name,'student') on conflict(id) do nothing;
 update public.students set user_id=account where id=student;
end $$;
revoke all on function public.reev_pending_student_account(uuid),public.reev_attach_student_account(uuid,uuid) from public,anon,authenticated;
grant execute on function public.reev_pending_student_account(uuid),public.reev_attach_student_account(uuid,uuid) to service_role;
-- A managed login remains tied to its NISN. Correct it with a coordinated Auth migration.
create function reev_private.protect_login_nisn() returns trigger language plpgsql security definer set search_path='' as $$
begin
 if old.nisn is distinct from new.nisn and old.user_id is not null and exists(
 select 1 from auth.users where id=old.user_id and raw_app_meta_data->>'reev_student_id'=old.id::text
 ) then raise exception 'NISN menjadi identitas login. Hubungi pengelola untuk koreksi NISN dan email Auth bersamaan.'; end if;
 return new;
end $$;
create trigger protect_login_nisn before update on public.students for each row execute function reev_private.protect_login_nisn();
revoke all on function reev_private.protect_login_nisn() from public,anon,authenticated;
commit;
