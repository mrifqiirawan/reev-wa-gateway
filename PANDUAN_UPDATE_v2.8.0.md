# Upgrade REEV WA Gateway v2.8.0

## Yang ditambahkan

- Menu custom melalui `.menu`, kategori berhalaman, dan perintah langsung.
- Pilihan tampilan teks atau tombol daftar WhatsApp (native-flow single-select, perlu uji perangkat).
- Editor kategori, urutan fungsi, perintah, balasan teks, biaya point, paket minimum, dan aktif/nonaktif.
- Standar gratis/50 point; Premium Rp15.000/250 point; VIP Rp30.000/700 point per hari. Semua angka dapat diubah admin; Standar tetap gratis.
- Reset pukul 02.00 Asia/Makassar secara default; jam/zona waktu dapat diubah.
- Keanggotaan per nomor, masa aktif, blokir, penyesuaian point harian dengan alasan dan audit.
- Riwayat penggunaan dan rekonsiliasi pengiriman UNKNOWN.
- Integrasi REEV Belajar v1.1.0: `.infodaftar NISN`, konfirmasi `YA`/`BATAL`, `.infoprofil`, `.infotugas`, `.infonilai`, `.infobintang`, `.infohati`, `.infoabsen`.
- Login dashboard, sesi WhatsApp, API pengiriman, broadcast, inbox dan auto-responder lama dipertahankan.

## Arsitektur

Dashboard tetap memakai login admin bawaan. Backend Node/Baileys tetap berjalan terus di VPS atau komputer yang menyala. Vercel dapat tetap dipakai untuk frontend/proxy; jangan menjalankan socket Baileys di function Vercel.

Data menu, paket, anggota, penggunaan dan audit berada di Supabase dengan tabel berawalan `gw_`. Dapat memakai project Supabase Belajar yang sudah ada, atau project khusus Gateway. Satu database bot digunakan oleh satu instalasi Gateway; ini belum aplikasi multi-tenant.

Gateway memanggil endpoint HTTPS Belajar `/api/gateway-functions` memakai HMAC dengan secret terpisah. Backend Belajar membaca data melalui RPC yang membatasi akses berdasarkan nomor pengirim. Kunci service role berada di environment server, tidak di browser atau konfigurasi menu.

## Sebelum upgrade

1. Backup database Supabase dan folder aplikasi Gateway, termasuk `.env` dan `DATA_DIR`/`sessions`.
2. Simpan backup secara privat: folder sesi berisi kredensial WhatsApp dan login admin.
3. Catat konfigurasi systemd/PM2/Nginx yang sekarang. Pertahankan path `DATA_DIR` yang sama.
4. Jadwalkan penghentian singkat Gateway saat menyalin aplikasi; jangan jalankan dua proses Baileys dengan sesi yang sama.

Paket ini tidak berisi data atau secret produksi. Jangan menimpa `.env` dengan `.env.example`.

## 1. Database

### Supabase REEV Belajar yang sudah berisi data

Jalankan hanya migrasi baru:

`REEV_BELAJAR_v1.1.0/supabase/migrations/006_gateway_functions.sql`

Jangan menjalankan ulang `001_core.sql` sampai `005_indexes.sql` pada project operasional. Migrasi 006 menambah tabel/fungsi, trigger pembatalan konfirmasi, dan dua kolom pada view `student_summary`. Tidak menghapus siswa, nilai, akun, atau tautan lama.

### Database bot Gateway

Pada project Supabase yang dipilih untuk bot, jalankan sekali:

`REEV_WA_Gateway_v2.8.0/supabase/migrations/001_bot_platform.sql`

Migrasi ini dapat dijalankan di project Belajar yang sama setelah migrasi Belajar. Semua tabel/fungsi bot memakai awalan `gw_`; bukan skema instalasi ulang Belajar. Menu custom awalnya **nonaktif** sampai admin mengaktifkannya.

Migrasi menggunakan transaksi. Jika transaksi gagal, periksa pesan SQL; jangan menghapus tabel produksi agar skrip bisa dijalankan.

## 2. Environment Gateway

Tambahkan pada `.env` backend Gateway:

```dotenv
BOT_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
BOT_SUPABASE_SERVICE_ROLE_KEY=ISI_DI_SERVER
BELAJAR_FUNCTION_URL=https://DOMAIN_BELAJAR/api/gateway-functions
BELAJAR_FUNCTION_SECRET=SECRET_ACAK_MINIMAL_32_KARAKTER
```

Gunakan service-role key yang sesuai dengan project `BOT_SUPABASE_URL`. URL tersebut harus URL project hosted Supabase standar, tanpa path/port. Nilai tidak boleh memakai awalan `VITE_`.

`BELAJAR_FUNCTION_URL` harus HTTPS publik port 443, tepat pada `/api/gateway-functions`, tanpa query/fragment/kredensial. Redirect dan alamat jaringan privat ditolak. Untuk Belajar pada VPS yang sama, gunakan domain publik HTTPS yang dikonfigurasi Nginx. Jalur adapter lama `attach-gateway.mjs` tidak digunakan oleh integrasi baru.

Buat secret sendiri di server, misalnya:

```bash
openssl rand -hex 32
```

Simpan hasil ke kedua environment; jangan kirimkan secret di chat.

## 3. Environment dan deploy Belajar

Pertahankan `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `SUPABASE_URL`, dan `SUPABASE_SERVICE_ROLE_KEY` yang lama. Tambahkan:

```dotenv
REEV_GATEWAY_FUNCTION_SECRET=SECRET_YANG_SAMA_DENGAN_GATEWAY
```

- Vercel: unggah source Belajar v1.1.0 ke project yang sama, atur environment server, lalu redeploy. Endpoint integrasi harus dapat dijangkau Gateway; HMAC tetap wajib. Ikuti `docs/DEPLOY.md` untuk konfigurasi dasar.
- VPS: salin source, jalankan `npm ci`, `npm run build`, lalu restart service Belajar yang ada. Server lokal menyertakan route `/api/gateway-functions`.
- Ketika secret baru aktif, webhook lama hanya melayani guru dalam allowlist. Perintah siswa lama seperti `.nilai` tidak bisa melewati biaya point. Perintah guru tetap memiliki otorisasi/konfirmasi lama.
- Integrasi custom tidak membutuhkan global webhook untuk fungsi siswa. Jika global webhook digunakan untuk fungsi guru/status perangkat, pertahankan secret webhook lama terpisah dan hindari fallback auto-responder untuk command guru.

## 4. Upgrade aplikasi Gateway

Di folder aplikasi Gateway yang aktif:

1. Hentikan service/PM2 menggunakan konfigurasi yang sudah ada.
2. Salin source `REEV_WA_Gateway_v2.8.0` ke folder aplikasi. Pertahankan `.env`, `sessions`, dan folder `DATA_DIR` custom. Jangan memakai perintah penghapusan massal pada folder data.
3. Jalankan:

```bash
npm ci
npm run lint
npm test
npm run build
```

4. Mulai ulang service yang sama. Untuk instalasi systemd bernama `reev-wa-gateway`:

```bash
sudo systemctl restart reev-wa-gateway
sudo systemctl status reev-wa-gateway --no-pager
curl http://127.0.0.1:3000/api/health
```

Sesuaikan port jika berbeda. Health menampilkan versi `2.8.0`; health bukan bukti koneksi Supabase atau pengiriman WhatsApp.

Bila memakai frontend/proxy Vercel, deploy source Gateway baru juga ke project frontend lama. Service key bot cukup berada di backend Gateway. `BACKEND_URL` dan `BACKEND_SHARED_SECRET` mengikuti pengaturan lama.

## 5. Aktivasi melalui website

1. Login admin seperti biasa, buka **Menu, Paket & Point → Integrasi**.
2. Periksa indikator database dan kredensial. Indikator kredensial berarti variabel tersedia; bukan tes koneksi live Belajar.
3. Buka **Menu & fungsi**. Tinjau nama bot, kategori, perintah dan biaya.
4. Aktifkan **menu custom untuk pesan masuk**, lalu **Simpan**.
5. Mulai dari mode **Teks & perintah**. Uji `.menu` dari nomor Anda.
6. Setelah alur dasar berhasil, pilih mode **Tombol daftar + perintah**. Uji tombol pada akun/perangkat WhatsApp yang dipakai. Bila pesan/tombol tidak muncul, kembalikan mode teks. Gateway tidak dapat mendeteksi tombol yang disembunyikan oleh klien WhatsApp.

Perintah sistem `.menu`, `.point`, `.paket`, `.batal`, `YA`, dan `BATAL` tidak dapat digunakan sebagai nama fungsi custom. Registrasi harus gratis dan tersedia untuk Standar. Menu kategori menampilkan label paket minimum; pemeriksaan akses tetap dilakukan saat fungsi dieksekusi.

Menu menampilkan maksimal delapan item per halaman, ditambah navigasi berikutnya/kembali. Pilihan tombol berisi ID perintah yang sama dengan input teks. Pengguna boleh langsung mengetik `.infoprofil` tanpa membuka `.menu` terlebih dahulu.

## 6. Penautan siswa

1. Guru membuka Belajar → **Siswa dan Kelas → Edit**.
2. Pastikan NISN benar, nomor WhatsApp benar, siswa aktif, dan **Nomor telah diverifikasi guru** dicentang. Verifikasi dilakukan guru melalui kanal yang tepercaya.
3. Siswa mengirim `.infodaftar 0012345671` menggunakan nomor tersebut. NISN disimpan sebagai teks; nol awal dipertahankan.
4. Bot menampilkan nama/NISN/nomor hanya setelah cocok dengan data terverifikasi. Siswa membalas `YA` dalam lima menit; `BATAL` atau `.batal` membatalkan.
5. Sistem memeriksa ulang data, menyimpan `whatsapp_links`, dan memastikan `registered_phone` serta `phone_verified` sesuai. Satu nomor hanya boleh tertaut pada satu siswa dalam project Belajar tersebut.
6. Pada website Belajar, klik **Segarkan** atau buka kembali direktori siswa untuk melihat label **Tertaut ke WhatsApp** beserta tanggalnya. Pembaruan tampilan memakai fetch ulang, bukan push realtime.
7. Untuk mengganti nomor, guru melepas tautan lama, mengubah/memverifikasi nomor baru, lalu siswa mengulang penautan. Pengguna tidak dapat menimpa tautan siswa lain.

Penautan ini mengautentikasi akses melalui chat. Ia tidak membuat akun Supabase Auth baru dan tidak mengganti login website Belajar menjadi login OTP WhatsApp.

## 7. Paket, pembayaran, dan point

- Paket dibeli/diaktifkan secara manual oleh admin melalui tab **Anggota**. Tidak ada payment gateway, penagihan otomatis, atau perpanjangan otomatis.
- Admin menentukan tanggal/jam berakhir; input tanggal mengikuti zona perangkat admin dan disimpan dalam UTC.
- Premium/VIP kedaluwarsa otomatis diperlakukan sebagai Standar. Penggunaan hari itu tetap diperhitungkan.
- Point adalah kuota harian, tidak terakumulasi. Tidak perlu cron reset: tanggal layanan dihitung di database menurut zona/jam konfigurasi pada setiap akses. Server mati saat 02.00 tidak menyebabkan reset terlewat.
- Point direservasi sebelum eksekusi; fungsi sukses dibebankan satu kali, fungsi gagal melepas reservasi. Pesan duplikat tidak menjalankan fungsi atau memotong point lagi.
- Penolakan pengiriman yang pasti mendapatkan refund satu kali. Timeout pengiriman menjadi **UNKNOWN**, karena pesan mungkin sudah diterima. Operator memeriksa log/provider lalu memilih **Sudah diterima** atau **Gagal / refund**.
- Proses yang terhenti saat masih reservasi dipulihkan setelah dua menit; pemeriksaan dilakukan backend setiap menit. Point dikembalikan dan hasil dicatat tidak pasti. Tidak ada retry pengiriman otomatis.
- Penyesuaian point admin berlaku untuk hari layanan saat ini. Isi angka positif untuk menambah atau negatif untuk mengurangi. Permintaan memiliki ID idempoten dan alasan audit.
- Ada batas 12 perintah per menit per nomor; request berlebih diabaikan sementara. Navigasi gratis tetap masuk batas anti-spam.
- Mengubah zona/jam reset dapat mengubah tanggal layanan aktif. Lakukan ketika layanan sepi. Jangan memakai perubahan zona untuk pemberian bonus; gunakan penyesuaian point.

## Fungsi tambahan

Panel memilih fungsi dari registry yang tersedia. `Balasan teks` dapat dibuat tanpa menulis kode. Fungsi Belajar memiliki aksi tetap dan perintah/kategori/biaya yang dapat diubah. Integrasi bisnis baru memerlukan implementasi handler dalam source, validasi input, otorisasi, dan pengujian sebelum ditambahkan ke registry `src/shared/bot.ts` serta dispatcher `src/server/bot-engine.ts`. Dashboard tidak menjalankan JavaScript/SQL bebas yang ditempel admin.

## Troubleshooting

- **Database belum siap:** cek environment backend, project yang sesuai, dan migrasi `001_bot_platform.sql`.
- **Konfigurasi gagal disimpan setelah admin lain mengubah:** muat ulang, terapkan ulang perubahan, lalu simpan. Revisi mencegah penimpaan tanpa sengaja.
- **Belajar tidak tersedia:** cek domain endpoint, HTTPS publik, environment secret kedua server, dan migrasi 006. Cek log tanpa mempublikasikan secret.
- **NISN tidak cocok:** periksa format teks, nomor, status siswa, status akun bila tertaut ke akun web, dan verifikasi guru. Keberadaan NISN saja tidak memberikan akses.
- **YA tidak menautkan:** konfirmasi kedaluwarsa, perubahan data guru, tautan lain, atau pending sudah dibatalkan. Ulangi registrasi setelah data diperiksa.
- **Dua balasan:** pastikan command custom aktif; Gateway mengonsumsi command miliknya sebelum global webhook/auto-responder. Untuk command guru lama, hindari fallback atau atur forwarding sesuai panduan lama.
- **Tombol tidak muncul:** ubah mode teks. Payload interaktif diuji secara lokal, belum terhadap akun WhatsApp produksi.
- **UNKNOWN:** jangan menekan retry berulang. Periksa hasil nyata lalu rekonsiliasi melalui tab Pemakaian.
- **Nomor belum pernah chat:** alur baru dimulai oleh pengguna yang mengirim `.menu`/`.infodaftar`; ini tidak mengubah atau menjamin hilangnya pembatasan pengiriman WhatsApp.

## Rollback

1. Nonaktifkan menu custom dan hentikan Gateway.
2. Pulihkan source Gateway lama dan lockfile lama; pertahankan `.env`, `DATA_DIR`, dan sesi. Jalankan `npm ci`/build sesuai versi lama, lalu start service.
3. Bila mengembalikan Belajar ke source lama, jalankan build/deploy source lama. Jangan menghapus tabel nilai/akun/tautan.
4. Tabel/fungsi baru bersifat tambahan dan boleh dibiarkan untuk audit/upgrade ulang. Jangan menjalankan migrasi penghapusan data sebagai rollback.
5. Jika tetap memakai Belajar v1.1.0 tetapi ingin kembali ke bot siswa lama, kosongkan `REEV_GATEWAY_FUNCTION_SECRET` dan redeploy. Ini menonaktifkan endpoint custom dan mengaktifkan perilaku webhook lama; lakukan hanya setelah menu custom Gateway dinonaktifkan.

## Batas rilis

Baca `TEST_RESULTS.md`. Tes database memakai PostgreSQL embedded PGlite; bukan verifikasi Supabase hosted, Auth hosted, Nginx/Vercel, atau penerimaan WhatsApp nyata. Komponen UI diuji menggunakan DOM emulasi; uji visual browser dan tombol WhatsApp nyata masih diperlukan setelah pemasangan. Source ini tidak otomatis dideploy ke akun/server Anda.
