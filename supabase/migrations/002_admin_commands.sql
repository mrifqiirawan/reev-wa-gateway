-- Jalankan di Supabase GATEWAY, setelah 001. Aman dijalankan ulang; tidak menimpa template lama.
begin;
do $$ declare c jsonb;item jsonb;changed boolean:=false;begin
 select config into c from public.gw_config where id for update;
 if c is null then raise exception 'Konfigurasi Gateway belum tersedia';end if;
 if not exists(select 1 from jsonb_array_elements(c->'categories') x where x->>'id'='admin_guru') then
 c:=jsonb_set(c,'{categories}',(c->'categories')||'[{"id":"admin_guru","name":"Admin guru","enabled":true}]'::jsonb);changed:=true;end if;
 for item in select x from jsonb_array_elements('[{"id":"admin_star","command":".bintang","title":"Admin: tambah bintang","category":"admin_guru","action":"belajar.star","text":"","cost":0,"minTier":"standard","enabled":true},{"id":"admin_violation","command":".pelanggaran","title":"Admin: catat pelanggaran","category":"admin_guru","action":"belajar.violation","text":"","cost":0,"minTier":"standard","enabled":true}]'::jsonb) x loop
 if not exists(select 1 from jsonb_array_elements(c->'commands') x where x->>'command'=item->>'command' or x->>'id'=item->>'id') then
 c:=jsonb_set(c,'{commands}',(c->'commands')||jsonb_build_array(item));changed:=true;end if;
 end loop;
 if changed then update public.gw_config set config=c,revision=revision+1 where id;insert into public.gw_audit(action,detail) values('upgrade_v284','{"added":"admin_commands"}');end if;
end $$;
commit;
