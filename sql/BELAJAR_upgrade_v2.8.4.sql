-- Jalankan HANYA di project Supabase REEV BELAJAR. Upgrade tambahan, tidak menghapus data.
begin;
do $$ begin
 if to_regprocedure('reev_private.mutate(uuid,text,jsonb,uuid,text)') is null or to_regprocedure('reev_private.bot_profile(uuid,text)') is null or to_regclass('public.teacher_whatsapp_allowlist') is null then
 raise exception 'Prasyarat integrasi Belajar belum tersedia. Jangan jalankan migrasi fresh pada database aktif.';end if;
end $$;
create table if not exists public.reev_gateway_admin_events(
 event_key text primary key check(length(event_key)<=300),phone text not null,chat text not null,
 actor uuid not null references public.profiles(id),action text not null,request_hash text not null,
 result jsonb not null,created_at timestamptz not null default now()
);
create index if not exists reev_gateway_admin_events_phone on public.reev_gateway_admin_events(phone,created_at desc);
alter table public.reev_gateway_admin_events enable row level security;
revoke all on public.reev_gateway_admin_events from public,anon,authenticated;
grant all on public.reev_gateway_admin_events to service_role;

-- Only the authenticated Gateway server may manage WhatsApp administrators.
create or replace function public.reev_gateway_admin_settings(p_op text,p_phone text default null,p_profile uuid default null,p_active boolean default true)
returns jsonb language plpgsql security definer set search_path='' as $$
declare oldrow jsonb;newrow jsonb;
begin
 if p_op='list' then
 return jsonb_build_object('teachers',coalesce((select jsonb_agg(x) from (select id,name from public.profiles where role='teacher' and active order by name limit 500) x),'[]'::jsonb),
 'admins',coalesce((select jsonb_agg(x) from (select a.phone,a.profile_id,a.active,p.name,p.active as teacher_active from public.teacher_whatsapp_allowlist a join public.profiles p on p.id=a.profile_id order by a.phone limit 500) x),'[]'::jsonb));
 elsif p_op='save' then
 if p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$' or p_profile is null or p_active is null then raise exception 'Nomor dan akun guru tidak valid';end if;
 if not exists(select 1 from public.profiles where id=p_profile and role='teacher' and (active or not p_active)) then raise exception 'Pilih akun guru aktif';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_phone,284));
 select to_jsonb(a) into oldrow from public.teacher_whatsapp_allowlist a where phone=p_phone;
 insert into public.teacher_whatsapp_allowlist(phone,profile_id,active) values(p_phone,p_profile,p_active)
 on conflict(phone) do update set profile_id=excluded.profile_id,active=excluded.active;
 select to_jsonb(a) into newrow from public.teacher_whatsapp_allowlist a where phone=p_phone;
 insert into public.audit_logs(actor,source,action,entity,old_data,new_data) values(null,'Gateway dashboard','gateway_admin_save','teacher_whatsapp_allowlist',oldrow,newrow);
 return jsonb_build_object('ok',true);
 else raise exception 'Operasi tidak valid';end if;
end $$;

create or replace function public.reev_gateway_admin(p_event text,p_phone text,p_action text,p_argument text,p_chat text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare actor_id uuid;s public.students;cached public.reev_gateway_admin_events;h text;parts text[];nisn_value text;reply text;r jsonb;payload jsonb;req uuid;tx uuid;cmd text;
begin
 if p_event is null or length(p_event) not between 1 and 300 or p_phone is null or p_phone !~ '^\+[1-9][0-9]{7,14}$' or p_chat is null or p_chat !~ '^[0-9]+(:[0-9]+)?@(s\.whatsapp\.net|lid)$|^[0-9]+(-[0-9]+)?@g\.us$' or p_argument is null or length(p_argument)>1100 or p_action is null or p_action not in ('profile','tasks','grades','stars','hearts','attendance','star','violation') then raise exception 'Parameter admin tidak valid';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_phone,284));
 -- Revalidate every request, including cached events. Group admin badges grant no access.
 select p.id into actor_id from public.teacher_whatsapp_allowlist a join public.profiles p on p.id=a.profile_id where a.phone=p_phone and a.active and p.active and p.role='teacher' for share of a,p;
 if actor_id is null then return jsonb_build_object('ok',false,'text','🔒 Perintah dengan NISN atau perubahan data hanya untuk nomor admin guru terdaftar. Siswa: kirim perintah info tanpa NISN untuk data sendiri.');end if;
 perform pg_advisory_xact_lock(hashtextextended(p_event,285));
 h:=md5(jsonb_build_array(p_phone,p_action,p_argument,p_chat)::text);
 select * into cached from public.reev_gateway_admin_events where event_key=p_event;
 if found then if cached.request_hash<>h or cached.actor<>actor_id then raise exception 'ID pesan telah digunakan untuk permintaan lain';end if;return cached.result;end if;
 if (select count(*) from public.reev_gateway_admin_events where phone=p_phone and created_at>now()-interval '1 minute')>=20 then return jsonb_build_object('ok',false,'text','Terlalu banyak perintah admin. Tunggu satu menit.');end if;
 begin
 if p_action in ('star','violation') then
 parts:=string_to_array(p_argument,'#');
 if cardinality(parts)<>3 then raise exception 'Format: .bintang NISN#jumlah#alasan atau .pelanggaran NISN#alasan#tebusan. Isi tidak boleh memuat # tambahan.';end if;
 parts[1]:=btrim(parts[1]);parts[2]:=btrim(parts[2]);parts[3]:=btrim(parts[3]);nisn_value:=parts[1];
 else nisn_value:=btrim(p_argument);end if;
 if nisn_value !~ '^[0-9]{5,20}$' then raise exception 'NISN wajib 5–20 digit, termasuk nol di depan';end if;
 select * into s from public.students where nisn=nisn_value and active;
 if not found then raise exception 'Siswa aktif tidak ditemukan';end if;
 if p_action in ('star','violation') then
 req:=gen_random_uuid();tx:=gen_random_uuid();
 if p_action='star' then
 if parts[2] !~ '^[0-9]{1,4}$' or parts[2]::integer not between 1 and 1000 or length(parts[3]) not between 1 and 500 then raise exception 'Jumlah harus bilangan bulat positif (maksimal mengikuti pengaturan sekolah). Alasan 1–500 karakter.';end if;
 payload:=jsonb_build_object('id',tx,'student_id',s.id,'amount',parts[2]::integer,'reason',parts[3]);
 else
 if length(parts[2]) not between 1 and 500 or length(parts[3]) not between 1 and 500 then raise exception 'Alasan dan tebusan wajib 1–500 karakter';end if;
 payload:=jsonb_build_object('id',tx,'student_id',s.id,'code','WA-'||replace(tx::text,'-',''),'description',parts[2],'remedy',parts[3]);
 end if;
 -- Existing transactional rules handle active semester, maximum stars, hearts and audit actor.
 perform reev_private.mutate(actor_id,p_action,payload,req,'WhatsApp Gateway');
 reply:=case when p_action='star' then format(E'⭐ *BINTANG TERSIMPAN*\n👤 %s\n🆔 NISN %s\n✨ Tambahan: %s bintang\n📝 Alasan: %s',s.name,s.nisn,parts[2],parts[3])
 else format(E'📋 *PELANGGARAN TERCATAT*\n👤 %s\n🆔 NISN %s\n📝 Alasan: %s\n🌱 Tebusan: %s\n❤️ Pengurangan: 1 hati\nKode: %s',s.name,s.nisn,parts[2],parts[3],payload->>'code') end;
 reply:=reply||E'\n\n🤖 _Reev Belajar - Informatika_ 💖';
 else
 cmd:=case p_action when 'profile' then '.profil' when 'tasks' then '.tugas' when 'grades' then '.nilai' when 'stars' then '.bintang' when 'hearts' then '.hati' when 'attendance' then '.absen' end;
 reply:=reev_private.bot_profile(s.id,cmd);
 end if;
 r:=jsonb_build_object('ok',true,'text',reply);
 exception when others then r:=jsonb_build_object('ok',false,'text',case when SQLSTATE='P0001' then SQLERRM else 'Perintah belum tersimpan. Periksa data/pengaturan Belajar atau hubungi pengelola.' end);
 end;
 insert into public.reev_gateway_admin_events(event_key,phone,chat,actor,action,request_hash,result) values(p_event,p_phone,p_chat,actor_id,p_action,h,r);
 return r;
end $$;
revoke all on function public.reev_gateway_admin_settings(text,text,uuid,boolean),public.reev_gateway_admin(text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.reev_gateway_admin_settings(text,text,uuid,boolean),public.reev_gateway_admin(text,text,text,text,text) to service_role;
commit;
