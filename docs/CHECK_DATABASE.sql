-- READ ONLY. Jalankan pada project Gateway, lalu project Belajar bila berbeda.
select to_regclass('public.gw_config') as gateway_config,
       to_regprocedure('public.gw_begin(text,text,text)') as gateway_begin,
       to_regprocedure('public.reev_gateway_function(text,text,text,text)') as belajar_function;
-- Gateway: gateway_config dan gateway_begin harus non-NULL.
-- Belajar: belajar_function harus non-NULL.
-- Nilai lain boleh NULL jika Gateway/Belajar memakai project berbeda.
-- Jika semua object Gateway belum ada, jalankan supabase/migrations/001_bot_platform.sql.
-- Jika hanya sebagian object ada, periksa riwayat migrasi; jangan drop/reset tabel.
-- Jika fungsi Belajar belum ada, gunakan migrasi 006_gateway_functions.sql dari
-- paket REEV_BELAJAR_v1.3.0, setelah migrasi sebelumnya. Jangan jalankan ulang.
