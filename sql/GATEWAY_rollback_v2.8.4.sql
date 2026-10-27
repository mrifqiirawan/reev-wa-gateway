-- HANYA ketika kembali ke Gateway v2.8.3. Jalankan di Supabase GATEWAY.
-- Hapus konfigurasi action baru yang tidak dikenal oleh v2.8.3; tidak membatalkan transaksi siswa.
begin;
do $$ declare c jsonb;begin
 select config into c from public.gw_config where id for update;
 c:=jsonb_set(c,'{commands}',coalesce((select jsonb_agg(x order by n) from jsonb_array_elements(c->'commands') with ordinality as t(x,n) where x->>'action' not in ('belajar.star','belajar.violation')),'[]'::jsonb));
 if not exists(select 1 from jsonb_array_elements(c->'commands') x where x->>'category'='admin_guru') then
 c:=jsonb_set(c,'{categories}',coalesce((select jsonb_agg(x order by n) from jsonb_array_elements(c->'categories') with ordinality as t(x,n) where x->>'id'<>'admin_guru'),'[]'::jsonb));end if;
 update public.gw_config set config=c,revision=revision+1 where id;
 insert into public.gw_audit(action,detail) values('rollback_v284','{"removed":"admin_actions_only"}');
end $$;
commit;
