# Optimasi respons WhatsApp, tetap versi 2.8.1

Revisi ini menggantikan paket 2.8.1 sebelumnya. Identifikasi revisi melalui keberadaan src/server/belajar-client.ts dan dokumen ini. Tidak ada perubahan source/ZIP REEV BELAJAR dan tidak ada migrasi baru.

## Temuan dari source

Sebelum revisi, .infodaftar menjalankan pembacaan gw_config, gw_begin, webhook ke endpoint Vercel Belajar, gw_finish, gw_claim, pengiriman WhatsApp, lalu gw_delivery. Endpoint Belajar sendiri hanya memvalidasi HMAC/payload dan memanggil RPC reev_gateway_function. Jadi alur menuju data siswa melewati server perantara yang bisa dihilangkan tanpa menulis ulang aturan bisnis.

Baileys juga menunggu setiap pesan selesai dalam satu batch sebelum memproses pesan berikutnya. Batch lain dapat berjalan bersamaan tanpa penjagaan urutan chat lintas batch. Gateway membaca konfigurasi bot ke Supabase pada setiap perintah meskipun konfigurasi sama.

Temuan ini menjelaskan potensi tambahan waktu, bukan bukti bahwa Vercel atau database pengguna mengalami gangguan tertentu. Belum ada pengukuran langsung dari VM pengguna.

## Perubahan

Mode supabase_rpc menghubungkan backend Gateway langsung ke /rest/v1/rpc/reev_gateway_function di Supabase Belajar. Parameter event, nomor, aksi dan argumen tetap sama. Fungsi SQL yang sudah ada mempertahankan pemeriksaan nomor terverifikasi, NISN, status siswa, konfirmasi YA/BATAL, deduplikasi, serta rate limit. Gateway tetap menjalankan pemeriksaan paket dan point lewat gw_begin. Tidak ada endpoint publik baru untuk membaca data siswa.

Mode lama webhook tetap tersedia dan menjadi default agar upgrade tidak tiba-tiba membutuhkan key baru. Pemilihan mode dilakukan secara eksplisit di dashboard. Mode langsung tidak beralih otomatis ke webhook saat gagal karena hasil transaksi saat timeout bisa belum diketahui. Jangan menghapus REEV_GATEWAY_FUNCTION_SECRET pada Belajar: konfigurasi tersebut juga menjaga pembatasan perintah siswa pada webhook legacy.

Cache konfigurasi hanya menyimpan pengaturan bot selama 5 detik, bukan profil, nilai, NISN, status pendaftaran, atau jawaban siswa. Permintaan bersamaan berbagi satu pembacaan konfigurasi. Perubahan dari menu pengaturan bot menghapus cache langsung. Perubahan eksternal/instans lain dapat memerlukan sampai 5 detik; gw_begin tetap membaca aturan dan status aktif langsung dari database pada setiap transaksi. URL/key database yang berubah membatalkan cache.

Antrean menangani maksimal 8 chat aktif sekaligus. Pesan pada chat WhatsApp yang sama tetap berurutan lintas batch. Maksimal 256 pesan menunggu. Pesan yang menunggu lebih dari 30 detik tidak mulai diproses saat gilirannya tiba. Pemberitahuan antrean padat dibatasi satu per chat per 30 detik dan maksimal 256 chat dalam jendela tersebut. Chat di luar batas pemberitahuan hanya tercatat dalam log. Antrean berada di memori; restart/reconnect dapat membatalkan pekerjaan yang belum diproses. Ini bukan outbox persisten dan bukan jaminan pemrosesan tanpa kehilangan pesan saat VM mati. ID JID adalah identitas antrean; database tetap mengunci transaksi berdasarkan nomor telepon.

## Aktifkan jalur langsung untuk project Anda

Setelah update source, npm ci, npm run build, dan restart satu proses Gateway, buka Environment Variables.

| Variabel | Isi |
|---|---|
| BELAJAR_TRANSPORT | supabase_rpc, pilih Supabase RPC langsung |
| BELAJAR_SUPABASE_URL | https://ccrbbfpmlmifetfavndy.supabase.co |
| BELAJAR_SUPABASE_SERVICE_ROLE_KEY | Service role key project ccrbbfpmlmifetfavndy, bukan anon key |
| BOT_SUPABASE_URL | Pertahankan project tempat tabel gw_* berada |
| BOT_SUPABASE_SERVICE_ROLE_KEY | Pertahankan key yang sesuai project tabel gw_* |
| BOT_DB_TIMEOUT_MS | Mulai dengan 12000 |

Service role key disimpan lewat kolom rahasia dashboard dan hanya digunakan oleh backend. Jangan menaruh key dalam source atau chat. Jika Gateway dan Belajar memakai project berbeda, gunakan pasangan URL/key masing-masing. Jika sama, nilainya boleh sama tetapi tetap isi kedua pasangan agar tujuan setiap koneksi jelas.

Klik Simpan konfigurasi lalu Periksa koneksi. Pada mode langsung, pemeriksaan Belajar membaca tabel gateway_function_events dengan limit=0, tanpa mengambil data siswa atau menjalankan transaksi. Hasil OK membuktikan koneksi dan akses tabel tersebut, bukan keberhasilan setiap RPC bisnis.

BELAJAR_FUNCTION_URL dan BELAJAR_FUNCTION_SECRET tidak digunakan oleh perintah bot saat mode langsung aktif. Biarkan nilai lama tersimpan untuk rollback. WEBHOOK_TIMEOUT_MS tetap mengatur webhook umum, sedangkan permintaan RPC langsung mengikuti BOT_DB_TIMEOUT_MS.

Jalur langsung tidak memerlukan deploy ulang Belajar jika migrasi 006 sudah terpasang dan konfigurasi pembatasan legacy tetap aktif.

## SQL: cukup periksa, jangan jalankan ulang migrasi

Jalankan pada SQL Editor project Belajar:

```sql
select to_regprocedure('public.reev_gateway_function(text,text,text,text)') as fungsi_belajar,
       to_regclass('public.gateway_function_events') as tabel_event;
```

Keduanya harus non-NULL. Jika tidak ada, jalankan migrasi 006_gateway_functions.sql dari paket Belajar setelah memastikan migrasi sebelumnya sudah lengkap. Jangan jalankan ulang bila object sudah ada. Query NISN sudah memakai kolom unique pada skema Belajar yang disertakan, sehingga revisi ini tidak menambahkan indeks duplikat.

Gateway tetap membutuhkan migrasi 001_bot_platform.sql yang sama seperti sebelumnya. Tidak ada SQL baru yang harus dijalankan untuk optimasi ini.

## Ukur hasil pada VM

Buka Environment Variables → Waktu respons bot → Muat pengukuran. Statistik memuat maksimal 500 pengukuran terakhir untuk setiap tahap sejak proses hidup. Tidak menyimpan NISN, nomor, isi pesan, atau secret. Sampel mencakup proses gagal; jumlah sampel per tahap dapat berbeda. Statistik bersifat indikatif, bukan jejak lengkap setiap pesan.

| Tahap | Arti |
|---|---|
| incoming.queue_wait | Waktu antre sebelum mulai memproses pesan |
| incoming.process | Waktu handler setelah antre, sampai pencatatan hasil; tidak mencakup perjalanan dari ponsel siswa menuju VM |
| gateway.config | Pembacaan pengaturan bot, akan lebih jarang setelah cache aktif |
| gateway.gw_begin | Pemeriksaan akses, kuota, dan reservasi point |
| belajar.supabase_rpc | Pemanggilan langsung fungsi Belajar |
| belajar.webhook | Pemanggilan lewat Vercel pada mode lama |
| gateway.gw_finish / gateway.gw_claim | Penyimpanan hasil dan klaim pengiriman |
| whatsapp.send | Pengiriman ke provider beserta pencatatan lokal; bukan waktu siswa membaca/menerima |
| gateway.gw_delivery | Pencatatan status pengiriman di database Gateway |
| disk.persist | Penulisan state lokal ke disk; proses ini masih sinkron |

Uji dari beberapa nomor siswa yang sudah berhak, tanpa mengirim perintah massal tak terkendali. Jalankan .infodaftar NISN, tunggu konfirmasi, lalu YA. Gunakan .infoprofil untuk pengukuran berikutnya. Jangan menjalankan benchmark terhadap data produksi dengan NISN acak. Bandingkan P50/P95 untuk jumlah sampel dan kondisi jaringan yang sebanding.

Jika belajar.supabase_rpc tinggi, periksa region VM versus database, status project Supabase, beban query dan koneksi. Jika incoming.queue_wait tinggi, kapasitas sedang penuh. Jika whatsapp.send tinggi, periksa koneksi WA serta kondisi akun/provider. Jika disk.persist tinggi, ukuran gateway_state.json dan kinerja disk VM perlu ditangani; revisi ini tidak menghapus log atau mengubah durabilitas state demi angka benchmark.

Batas 8 proses bukan jaminan kapasitas tertentu. Jumlah siswa terdaftar berbeda dari jumlah siswa yang mengirim bersamaan. Mengirim lebih paralel tidak menghilangkan batas layanan WhatsApp, VM atau database.

## Update dan rollback

Ikuti backup dari PANDUAN_VM_v2.8.1.md. Unggah source revisi ini ke repository yang sama, lalu pada direktori repository VM:

```bash
git pull --ff-only
npm ci --no-audit --no-fund
npm run build
```

Jika systemd dari installer sebelumnya:

```bash
systemctl restart reev-wa-gateway
systemctl status reev-wa-gateway --no-pager
```

Jika PM2, gunakan ini sebagai pengganti perintah systemd, bukan keduanya:

```bash
pm2 restart reev-wa-gateway --update-env
pm2 save
```

Untuk kembali ke jalur lama tanpa mengganti source, pilih BELAJAR_TRANSPORT=webhook dan pastikan URL/secret lama masih benar. Tidak ada rollback SQL.

## Uji lokal

npm run lint, npm run build, dan npm test memeriksa implementasi. Eksperimen scheduler lokal tersedia:

```bash
node --import tsx scripts/benchmark-bot.mjs
```

Eksperimen tersebut memakai 64 pesan sintetis dengan jeda mock 15 ms per tahap. Kedua mode memakai engine revisi yang sama, lalu membandingkan concurrency 1 dan 8. Angkanya bukan kecepatan aktual WhatsApp/Supabase dan bukan perbandingan produksi sebelum/sesudah.

Rujukan mekanisme RPC: https://supabase.com/docs/guides/database/functions dan https://supabase.com/docs/guides/api. Temuan alur serta aturan bisnis berasal dari source Gateway dan Belajar yang diberikan pengguna.
