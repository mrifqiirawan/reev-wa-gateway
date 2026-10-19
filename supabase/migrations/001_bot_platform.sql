-- Additive migration. May share a Supabase project with REEV Belajar.
begin;
create table public.gw_config(id boolean primary key default true check(id), revision integer not null default 1, config jsonb not null);
create table public.gw_members(phone text primary key check(phone ~ '^\+[1-9][0-9]{7,14}$'), tier text not null default 'standard' check(tier in ('standard','premium','vip')), expires_at timestamptz, blocked boolean not null default false, pending_until timestamptz, created_at timestamptz not null default now());
create table public.gw_usage(phone text references public.gw_members(phone), day date, spent integer not null default 0 check(spent>=0), reserved integer not null default 0 check(reserved>=0), bonus integer not null default 0, primary key(phone,day));
create table public.gw_runs(event_key text primary key check(length(event_key)<=300), phone text not null references public.gw_members(phone), command text not null, day date not null, cost integer not null default 0 check(cost>=0), charged boolean not null default false, state text not null check(state in ('reserved','done','rejected','failed')), reply jsonb, delivery text not null default 'pending' check(delivery in ('pending','sending','sent','delivered','read','failed','unknown')), provider_id text unique, created_at timestamptz not null default now(), updated_at timestamptz not null default now());
create index gw_runs_phone_time on public.gw_runs(phone,created_at desc);
create index gw_runs_time on public.gw_runs(created_at desc);
create table public.gw_audit(id bigint generated always as identity primary key, request_id uuid unique, action text not null, phone text, detail jsonb not null, created_at timestamptz not null default now());
insert into public.gw_config(config) values ($json${"enabled":false,"title":"REEV WA","timezone":"Asia/Makassar","resetHour":2,"presentation":"text","plans":{"standard":{"name":"Standar","price":0,"points":50},"premium":{"name":"Premium","price":15000,"points":250},"vip":{"name":"VIP","price":30000,"points":700}},"categories":[{"id":"belajar","name":"REEV Belajar · Informatika","enabled":true},{"id":"layanan","name":"Layanan","enabled":true}],"commands":[{"id":"info_daftar","command":".infodaftar","title":"Tautkan NISN","category":"belajar","action":"belajar.register","text":"","cost":0,"minTier":"standard","enabled":true},{"id":"info_profile","command":".infoprofil","title":"Profil saya","category":"belajar","action":"belajar.profile","text":"","cost":1,"minTier":"standard","enabled":true},{"id":"info_tasks","command":".infotugas","title":"Tugas saya","category":"belajar","action":"belajar.tasks","text":"","cost":2,"minTier":"standard","enabled":true},{"id":"info_grades","command":".infonilai","title":"Nilai saya","category":"belajar","action":"belajar.grades","text":"","cost":2,"minTier":"standard","enabled":true},{"id":"info_stars","command":".infobintang","title":"Bintang saya","category":"belajar","action":"belajar.stars","text":"","cost":1,"minTier":"standard","enabled":true},{"id":"info_hearts","command":".infohati","title":"Hati saya","category":"belajar","action":"belajar.hearts","text":"","cost":1,"minTier":"standard","enabled":true},{"id":"info_attendance","command":".infoabsen","title":"Kehadiran saya","category":"belajar","action":"belajar.attendance","text":"","cost":1,"minTier":"standard","enabled":true},{"id":"help","command":".bantuan","title":"Panduan singkat","category":"layanan","action":"reply_text","text":"Kirim .menu untuk kategori, .point untuk saldo, dan .paket untuk paket. Untuk REEV Belajar, kirim .infodaftar NISN. Nomor harus diverifikasi guru terlebih dahulu.","cost":0,"minTier":"standard","enabled":true}]}$json$::jsonb);
create function public.gw_period(p_at timestamptz,c jsonb) returns date language sql stable set search_path='' as $$ select ((p_at at time zone (c->>'timezone'))-make_interval(hours=>(c->>'resetHour')::integer))::date $$;
create function public.gw_day(c jsonb) returns date language sql stable set search_path='' as $$ select public.gw_period(now(),c) $$;
create function public.gw_context(p_phone text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c jsonb;m public.gw_members;u public.gw_usage;k text;d date;limit_points integer;
begin
 select config into c from public.gw_config where id;select * into m from public.gw_members where phone=p_phone;
 k:=case when m.tier in ('premium','vip') and m.expires_at>now() then m.tier else 'standard' end;d:=public.gw_day(c);
 select * into u from public.gw_usage where phone=p_phone and day=d;limit_points:=(c->'plans'->k->>'points')::integer;
 return jsonb_build_object('tier',k,'plan',c->'plans'->k,'expires_at',m.expires_at,'blocked',coalesce(m.blocked,false),'pending',coalesce(m.pending_until>now(),false),'day',d,'spent',coalesce(u.spent,0),'reserved',coalesce(u.reserved,0),'bonus',coalesce(u.bonus,0),'remaining',greatest(0,limit_points+coalesce(u.bonus,0)-coalesce(u.spent,0)-coalesce(u.reserved,0)));
end $$;
create function public.gw_save_config(p_config jsonb,p_revision integer) returns integer language plpgsql security definer set search_path='' as $$
declare n integer;
begin
 if jsonb_typeof(p_config)<>'object' or jsonb_typeof(p_config->'commands')<>'array' or jsonb_typeof(p_config->'categories')<>'array' then raise exception 'Konfigurasi tidak valid';end if;
 update public.gw_config set config=p_config,revision=revision+1 where id and revision=p_revision returning revision into n;
 if n is null then raise exception 'Konfigurasi telah berubah. Muat ulang sebelum menyimpan.';end if;
 insert into public.gw_audit(action,detail) values('config',jsonb_build_object('revision',n));return n;
end $$;
create function public.gw_begin(p_event text,p_phone text,p_command text) returns jsonb language plpgsql security definer set search_path='' as $$
declare c jsonb;ctx jsonb;f jsonb;m public.gw_members;d date;n integer:=0;err text;system_cmd boolean;
begin
 if p_event is null or length(p_event)>300 or p_phone !~ '^\+[1-9][0-9]{7,14}$' or length(p_command)>50 then raise exception 'Input invalid';end if;
 select config into c from public.gw_config where id;
 if not (c->>'enabled')::boolean then return jsonb_build_object('disabled',true);end if;
 insert into public.gw_members(phone) values(p_phone) on conflict do nothing;
 select * into m from public.gw_members where phone=p_phone for update;
 if exists(select 1 from public.gw_runs where event_key=p_event) then return jsonb_build_object('duplicate',true);end if;
 ctx:=public.gw_context(p_phone);d:=(ctx->>'day')::date;
 system_cmd:=p_command in ('.menu','.point','.paket','.batal','ya','batal');
 select x into f from jsonb_array_elements(c->'commands') x where x->>'command'=p_command and (x->>'enabled')::boolean and exists(select 1 from jsonb_array_elements(c->'categories') cat where cat->>'id'=x->>'category' and (cat->>'enabled')::boolean);
 if m.blocked then err:='Akses nomor ini dinonaktifkan. Hubungi admin.';
 elsif (select count(*) from public.gw_runs where phone=p_phone and created_at>now()-interval '1 minute')>=12 then return jsonb_build_object('silent',true);
 elsif not system_cmd and f is null then err:='Perintah tidak tersedia. Kirim .menu';
 elsif not system_cmd and array_position(array['standard','premium','vip'],ctx->>'tier')<array_position(array['standard','premium','vip'],f->>'minTier') then err:='Fitur ini memerlukan paket '||(c->'plans'->(f->>'minTier')->>'name')||'. Kirim .paket';
 else n:=case when system_cmd then 0 else (f->>'cost')::integer end;
 if n>(ctx->>'remaining')::integer then err:='Point tidak cukup. Sisa '||(ctx->>'remaining')||'. Kirim .point untuk jadwal reset.';end if;end if;
 if err is not null then
 insert into public.gw_runs(event_key,phone,command,day,state,reply) values(p_event,p_phone,p_command,d,'rejected',jsonb_build_object('text',err));
 return jsonb_build_object('rejected',true,'reply',jsonb_build_object('text',err));end if;
 insert into public.gw_usage(phone,day,reserved) values(p_phone,d,n) on conflict(phone,day) do update set reserved=public.gw_usage.reserved+n;
 insert into public.gw_runs(event_key,phone,command,day,cost,state) values(p_event,p_phone,p_command,d,n,'reserved');
 return jsonb_build_object('run',true,'function',f,'context',ctx,'config',c);
end $$;
create function public.gw_finish(p_event text,p_ok boolean,p_reply jsonb,p_pending boolean default null) returns boolean language plpgsql security definer set search_path='' as $$
declare r public.gw_runs;
begin
 perform 1 from public.gw_members where phone=(select phone from public.gw_runs where event_key=p_event) for update;
 select * into r from public.gw_runs where event_key=p_event for update;
 if r.state is distinct from 'reserved' then return false;end if;
 update public.gw_usage set reserved=reserved-r.cost,spent=spent+case when p_ok then r.cost else 0 end where phone=r.phone and day=r.day;
 update public.gw_runs set state=case when p_ok then 'done' else 'failed' end,charged=p_ok,reply=p_reply,updated_at=now() where event_key=p_event;
 if p_pending is not null then update public.gw_members set pending_until=case when p_pending then now()+interval '5 minutes' else null end where phone=r.phone;end if;
 return true;
end $$;
create function public.gw_claim(p_event text,p_id text) returns boolean language plpgsql security definer set search_path='' as $$
begin
 update public.gw_runs set delivery='sending',provider_id=p_id,updated_at=now() where event_key=p_event and state<>'reserved' and delivery='pending';return found;
end $$;
create function public.gw_delivery(p_id text,p_status text) returns void language plpgsql security definer set search_path='' as $$
declare r public.gw_runs;
begin
 if p_status not in ('sent','delivered','read','failed','unknown') then raise exception 'Status invalid';end if;
 perform 1 from public.gw_members where phone=(select phone from public.gw_runs where provider_id=p_id) for update;
 select * into r from public.gw_runs where provider_id=p_id for update;if not found then return;end if;
 if r.delivery='read' or (r.delivery='delivered' and p_status<>'read') or (r.delivery='failed' and p_status in ('sent','unknown')) then return;end if;
 if p_status='failed' and r.charged then update public.gw_usage set spent=spent-r.cost where phone=r.phone and day=r.day;end if;
 update public.gw_runs set delivery=p_status,charged=case when p_status='failed' then false else charged end,updated_at=now() where event_key=r.event_key;
end $$;
create function public.gw_recover() returns void language plpgsql security definer set search_path='' as $$
declare r public.gw_runs;locked public.gw_runs;
begin
 for r in select * from public.gw_runs where state='reserved' and created_at<now()-interval '2 minutes' loop
 if public.gw_finish(r.event_key,false,jsonb_build_object('text','Proses terputus. Point tidak dipotong; periksa hasil sebelum mengulang.'),null) then
 update public.gw_runs set delivery='unknown',updated_at=now() where event_key=r.event_key;end if;end loop;
 for r in select * from public.gw_runs where state<>'reserved' and delivery='pending' and updated_at<now()-interval '2 minutes' loop
 perform 1 from public.gw_members where phone=r.phone for update;
 select * into locked from public.gw_runs where event_key=r.event_key for update;
 if locked.delivery='pending' and locked.provider_id is null then
 if locked.charged then update public.gw_usage set spent=spent-locked.cost where phone=locked.phone and day=locked.day;end if;
 update public.gw_runs set delivery='failed',charged=false,updated_at=now() where event_key=locked.event_key;end if;end loop;
 update public.gw_runs set delivery='unknown',updated_at=now() where delivery='sending' and updated_at<now()-interval '2 minutes';
end $$;
create function public.gw_member_edit(p_phone text,p_tier text,p_expires timestamptz,p_blocked boolean,p_adjust integer,p_reason text,p_request uuid) returns void language plpgsql security definer set search_path='' as $$
declare c jsonb;d date;old_detail jsonb;detail_value jsonb;
begin
 detail_value:=jsonb_build_object('tier',p_tier,'expires_at',p_expires,'blocked',p_blocked,'adjust',p_adjust,'reason',p_reason);
 perform pg_advisory_xact_lock(hashtextextended(p_request::text,2));
 select detail into old_detail from public.gw_audit where request_id=p_request;
 if found then if old_detail<>detail_value or not exists(select 1 from public.gw_audit where request_id=p_request and phone=p_phone) then raise exception 'Request conflict';end if;return;end if;
 if p_request is null then raise exception 'Request ID required';end if;
 if p_phone !~ '^\+[1-9][0-9]{7,14}$' or p_tier not in ('standard','premium','vip') or (p_tier<>'standard' and (p_expires is null or p_expires<=now())) or p_adjust is null or abs(p_adjust)>1000000 or length(trim(p_reason)) not between 3 and 300 then raise exception 'Input anggota tidak valid';end if;
 select config into c from public.gw_config where id;d:=public.gw_day(c);
 insert into public.gw_members(phone,tier,expires_at,blocked) values(p_phone,p_tier,case when p_tier='standard' then null else p_expires end,p_blocked) on conflict(phone) do update set tier=excluded.tier,expires_at=excluded.expires_at,blocked=excluded.blocked;
 insert into public.gw_usage(phone,day,bonus) values(p_phone,d,p_adjust) on conflict(phone,day) do update set bonus=public.gw_usage.bonus+p_adjust;
 insert into public.gw_audit(request_id,action,phone,detail) values(p_request,'member',p_phone,detail_value);
end $$;
create function public.gw_members_page(p_search text,p_offset integer) returns jsonb language sql security definer set search_path='' as $$
 select jsonb_build_object('total',(select count(*) from public.gw_members where phone like '%'||p_search||'%'),'rows',coalesce((select jsonb_agg(to_jsonb(m)||jsonb_build_object('usage',public.gw_context(m.phone))) from (select * from public.gw_members where phone like '%'||p_search||'%' order by created_at desc limit 25 offset greatest(0,p_offset)) m),'[]'::jsonb)) $$;
create function public.gw_resolve(p_event text,p_status text,p_reason text) returns void language plpgsql security definer set search_path='' as $$
declare r public.gw_runs;
begin
 if p_status not in ('failed','delivered') or length(trim(p_reason)) not between 3 and 300 then raise exception 'Invalid resolution';end if;
 perform 1 from public.gw_members where phone=(select phone from public.gw_runs where event_key=p_event) for update;
 select * into r from public.gw_runs where event_key=p_event for update;
 if r.delivery is distinct from 'unknown' or r.provider_id is null then raise exception 'Hanya pengiriman unknown dapat direkonsiliasi.';end if;
 perform public.gw_delivery(r.provider_id,p_status);
 insert into public.gw_audit(action,phone,detail) values('resolve',r.phone,jsonb_build_object('event',p_event,'status',p_status,'reason',p_reason));
end $$;
do $$declare t text;f text;begin
 foreach t in array array['gw_config','gw_members','gw_usage','gw_runs','gw_audit'] loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated',t);execute format('grant all on public.%I to service_role',t);end loop;
 foreach f in array array['gw_members_page(text,integer)','gw_resolve(text,text,text)','gw_period(timestamptz,jsonb)','gw_day(jsonb)','gw_context(text)','gw_save_config(jsonb,integer)','gw_begin(text,text,text)','gw_finish(text,boolean,jsonb,boolean)','gw_claim(text,text)','gw_delivery(text,text)','gw_recover()','gw_member_edit(text,text,timestamptz,boolean,integer,text,uuid)'] loop
 execute 'revoke all on function public.'||f||' from public,anon,authenticated';execute 'grant execute on function public.'||f||' to service_role';end loop;
end $$;
grant usage,select on public.gw_audit_id_seq to service_role;
commit;
