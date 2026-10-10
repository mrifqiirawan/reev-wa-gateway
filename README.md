# REEV WA Gateway 2.6.0 — Perbaikan sesi, password, dan deployment

Paket ini memperbaiki tiga masalah pada versi 2.5.0: login hilang saat refresh/restart, password lama masih diterima, dan QR tidak mengikuti status koneksi. Tampilan React tetap dipertahankan.

**Arsitektur Vercel: browser → Vercel (frontend + proxy `/api/*`) → backend Node.js permanen → WhatsApp/Baileys.**

Baileys dijalankan pada satu backend yang selalu aktif. Vercel dalam paket ini tidak menjalankan socket Baileys atau menyimpan file sesi. Vercel Functions memiliki batas durasi eksekusi; memindahkan file ke `/tmp` saja tidak menyelesaikan kontinuitas koneksi dan sesi.

## Pilih cara menjalankan

| Mode | Website | Backend/Baileys | Penyimpanan |
|---|---|---|---|
| Lokal | `http://localhost:3000` | Komputer yang sama | Folder `sessions` |
| VPS/hosting Node.js | Domain HTTPS hosting | Satu proses Node.js permanen | `DATA_DIR` pada disk persisten |
| Vercel | Domain Vercel | VPS/hosting Node.js terpisah | `DATA_DIR` pada backend |

Nama provider tidak menjamin kompatibilitas. Untuk Dewaweb, Hostinger, atau provider lain, pilih paket yang **mengizinkan proses Node.js terus aktif, koneksi keluar ke WhatsApp, dan disk persisten**. Hosting PHP/static saja tidak cukup. Jangan menjalankan PM2 cluster atau beberapa replika terhadap sesi Baileys yang sama. Backend di komputer lokal dapat dihubungkan melalui HTTPS tunnel milik Anda, tetapi komputer dan tunnel harus terus hidup; `localhost` pada `BACKEND_URL` Vercel bukan komputer Anda.

## 1. Lokal — Windows, macOS, Linux

Prasyarat: Node.js 22.12+ atau Node.js 24, npm, dan Git jika dibutuhkan instalasi dependensi.

1. Ekstrak paket, buka terminal pada folder yang memuat `package.json`.
2. Salin `.env.example` menjadi `.env` (File Explorer, `cp .env.example .env`, atau PowerShell `Copy-Item .env.example .env`).
3. Isi `ADMIN_PASSWORD` dengan password Anda minimal 8 karakter. Biarkan `COOKIE_SECURE=false`, `BACKEND_SHARED_SECRET` kosong, dan `DATA_DIR=./sessions`.
4. Jalankan:

```sh
npm ci
npm run build
npm start
```

Buka `http://localhost:3000`, login dengan `ADMIN_USERNAME` dan password yang Anda tentukan. Mode pengembangan: `npm run dev`.

`npm run preview` hanya menampilkan hasil build statis dan **tidak menjalankan backend**; gunakan `npm start` untuk aplikasi lengkap.

## 2. Backend untuk Vercel

1. Upload kode pada VPS/hosting Node.js. Salin `.env.example` menjadi `.env`.
2. Isi konfigurasi backend:

```dotenv
NODE_ENV=production
PORT=3000
DATA_DIR=/lokasi/persisten/reev-sessions
ADMIN_USERNAME=admin
ADMIN_PASSWORD=ISI_PASSWORD_ANDA_MINIMAL_8_KARAKTER
SESSION_TTL_DAYS=7
COOKIE_SECURE=true
BACKEND_SHARED_SECRET=ISI_SECRET_ACAK_YANG_SAMA_DENGAN_VERCEL
GATEWAY_API_KEY=ISI_SECRET_INTEGRASI_JIKA_DIPAKAI
```

Gunakan direktori milik user proses Node.js yang dapat ditulis; jangan memakai filesystem sementara atau folder release yang selalu ditimpa deployment. Buat secret acak sendiri:

```sh
node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
```

3. Instal, build, lalu jalankan **satu** instance:

```sh
npm ci
npm run build
npm install -g pm2
pm2 start ecosystem.config.cjs
pm2 save
```

Pada Linux, jalankan `pm2 startup` dan ikuti perintah yang ditampilkan agar proses hidup lagi setelah reboot. PM2 config memakai `.cjs` karena project memakai ES module.

4. Hubungkan domain backend ke proses port 3000 melalui reverse proxy HTTPS. Contoh blok Nginx tersedia di `deploy/nginx.conf.example`; pasang sertifikat valid sesuai layanan hosting. Pastikan firewall tidak membuka port backend mentah secara tidak perlu.
5. Buka `https://gateway.example.com/api/health`. Respons harus JSON dengan `success: true`, `service: reev-backend`. Endpoint ini hanya memeriksa proses HTTP; scan WhatsApp diperiksa terpisah.

Saat `BACKEND_SHARED_SECRET` diisi, API backend (selain health) harus diakses melalui proxy Vercel. Ini sengaja mencegah jalur langsung melewati konfigurasi proxy.

## 3. Deploy frontend dan proxy ke Vercel

1. Push paket ke repository Anda, tanpa `.env`, `sessions`, atau `node_modules`. Import repository pada Vercel.
2. Root Directory adalah folder yang berisi `package.json` dan `vercel.json`.
3. Framework Preset: **Vite**. Install: `npm ci`. Build: `npm run build`. Output: `dist`. Pilih Node.js 22.x atau 24.x.
4. Isi Environment Variables Vercel:

| Nama | Nilai |
|---|---|
| `BACKEND_URL` | Origin HTTPS backend, misalnya `https://gateway.example.com`, tanpa `/api` |
| `BACKEND_SHARED_SECRET` | Secret yang persis sama dengan `.env` backend |

Aktifkan variabel pada environment yang dipakai (Production dan/atau Preview), lalu **redeploy**. Jangan memberi awalan `VITE_` pada secret. `BACKEND_URL` tidak boleh menunjuk ke URL frontend Vercel sendiri karena akan membuat loop.

5. Buka domain Vercel dan login. Browser memakai cookie pada domain Vercel sendiri, sehingga tidak bergantung pada third-party cookies atau CORS ke backend.
6. Buka Perangkat → Minta QR Baru. Saat QR tampil, scan melalui WhatsApp → Perangkat tertaut. Status diperbarui setiap 2,5 detik di halaman perangkat. Inisialisasi mempunyai timeout dan pesan gagal; QR bukan gambar contoh.

**Tanpa backend permanen, fitur WhatsApp pada deployment Vercel belum dapat beroperasi.** Proxy mengembalikan pesan konfigurasi 503 atau koneksi 502, bukan login palsu atau spinner tanpa informasi.

## 4. Hosting mandiri tanpa Vercel

Ikuti pemasangan backend, tetapi kosongkan `BACKEND_SHARED_SECRET` dan `BACKEND_URL`. Website dan API disajikan dari domain yang sama. Gunakan `COOKIE_SECURE=true` untuk HTTPS; `false` hanya saat pengujian HTTP lokal. Jangan mengandalkan auto-sleep dari hosting untuk bot yang harus menerima pesan terus-menerus.

### Docker

Isi `.env` dahulu, lalu:

```sh
docker compose up -d --build
docker compose logs -f
```

Compose memetakan port ke `127.0.0.1:3000` dan memakai volume `reev_sessions` pada `/app/sessions`. Pasang reverse proxy HTTPS di host. Jangan menggunakan `docker compose down -v` jika ingin mempertahankan data. Container berjalan sebagai user `node`. Dockerfile/Compose disediakan, tetapi image Docker tidak dibangun pada sesi perbaikan ini.

## 5. Cara kerja sesi dan password

- Cookie `reev_session` memakai HttpOnly, SameSite=Lax, dan Secure jika dikonfigurasi. Masa sesi default 7 hari, dapat diatur 1–90 hari. Refresh/tab ditutup tidak menghapus sesi selama cookie masih ada dan belum kedaluwarsa.
- Token acak disimpan sebagai hash di `DATA_DIR/admin_auth.json`. Password memakai scrypt + salt, bukan plaintext. File ditulis atomik sebelum respons sukses.
- Ganti password/username melalui Pengaturan Keamanan. Password baru minimal 8 karakter; spasi pada password tidak dipangkas diam-diam.
- Perubahan kredensial mencabut semua sesi lain dan memberi cookie baru pada browser yang melakukan perubahan. Password lama tidak diterima lagi.
- Logout mencabut sesi di server. Jika backend offline, UI menampilkan kegagalan logout agar pengguna tidak mengira sesi sudah dicabut.
- Kegagalan verifikasi akibat gangguan backend menampilkan tombol coba lagi, tidak menghapus cookie atau membuat autentikasi lokal palsu.
- `ADMIN_PASSWORD` hanya digunakan pada inisialisasi pertama. Mengubah env setelah akun terbentuk tidak mengubah password aktif.
- Maksimum 20 sesi admin aktif; sesi paling lama dapat tergeser. Login dibatasi 20 percobaan/menit per proses untuk akun tunggal ini.

### Upgrade dari 2.5.0

Hentikan proses lama, backup folder `sessions`, lalu gunakan folder tersebut sebagai `DATA_DIR` pada kode baru. File legacy `admin_auth.json` berisi username/password akan dimigrasikan ke hash tanpa mereset akun. Folder WhatsApp `default` tetap dipakai. Token browser versi lama tidak dimigrasikan: login satu kali setelah upgrade. Jika perubahan password lama hanya tersimpan di browser dan tidak pernah tersimpan pada backend, password itu tidak dapat dianggap sebagai kredensial server; gunakan kredensial backend lalu ubah kembali melalui menu keamanan.

Jangan menghapus `admin_auth.json` untuk troubleshooting rutin karena itu mereset akun dan seluruh sesi. Jika file rusak atau disk tidak dapat ditulis, server gagal dengan pesan log, tidak diam-diam kembali ke password default.

### Backup

Stop proses backend, salin seluruh `DATA_DIR` ke backup privat, lalu start lagi. Backup memuat kredensial admin dan kunci sesi WhatsApp; jangan upload ke repository publik. Untuk restore, hentikan backend, pulihkan folder yang sama beserta izinnya, dan start satu instance. Tombol ekspor metadata perangkat bukan backup kunci sesi. ZIP project yang diunduh dari aplikasi mengecualikan data sesi dan file env.

## 6. API integrasi

Atur `GATEWAY_API_KEY` di backend. Kirim `Authorization: Bearer <GATEWAY_API_KEY>` serta `Content-Type: application/json` ke endpoint pengiriman. Kunci ini hanya diberi akses pada `/api/messages/send`, `/api/messages/send-otp`, dan `/api/messages/bulk`; halaman admin tetap memerlukan cookie. Gunakan domain Vercel pada mode proxy. Jangan menanam kunci rahasia di aplikasi mobile publik; gunakan server aplikasi Anda sebagai perantara.

Playground memakai sesi admin aktif. Teks contoh kunci pada UI adalah placeholder, bukan generator kunci aktif.

## 7. Pengujian dan batas cakupan

```sh
npm run lint
npm test
npm run build
```

Hasil saat paket disiapkan: **16 tes lulus**, pemeriksaan TypeScript lulus, build Vite lulus. Tes mencakup login, cookie, perubahan password, restart proses backend nyata, pencabutan sesi, kegagalan disk, migrasi kredensial lama, proteksi API, proxy Vercel, respons backend offline, dan siklus QR menggunakan socket pengujian. Tidak ada akun WhatsApp yang ditautkan atau pesan nyata yang dikirim dalam pengujian. Routing pada infrastruktur Vercel dan perilaku cookie pada domain deployment harus diperiksa setelah deploy; pengujian proxy dilakukan secara lokal.

Fokus rilis ini adalah tiga masalah yang diminta dan jalur deployment. **Fitur warisan berikut belum menjadi implementasi produksi penuh**: broadcast bulk dan retry log masih menyimulasikan status pengiriman; tes webhook masih membuat payload tanpa HTTP dispatch nyata; label delivered pada beberapa alur belum berasal dari receipt WhatsApp. Log/inbox dan pengaturan auto-responder/webhook masih berada di memori dan dapat hilang saat restart. Jangan memakai status fitur tersebut sebagai bukti pesan sudah diterima. Rilis ini tidak mengklaim audit menyeluruh atas seluruh fitur gateway.

Paket mendukung satu sesi WhatsApp utama. Label tambah perangkat tidak berarti implementasi multi-account paralel.

## 8. Pemeriksaan setelah deployment

1. Login, refresh, tutup/buka tab pada domain yang sama: tetap masuk selama cookie belum kedaluwarsa.
2. Ubah password, logout, pastikan password lama ditolak dan password baru diterima; uji browser lain juga.
3. Restart backend tanpa menghapus `DATA_DIR`: sesi login tetap valid dan sesi WhatsApp yang sudah tertaut dipulihkan otomatis.
4. Minta QR, scan, tunggu status connected; uji kirim satu pesan yang Anda izinkan melalui Quick Send.
5. Hentikan backend sesaat: website menampilkan pesan koneksi gagal. Hidupkan lagi dan coba ulang.

| Gejala | Pemeriksaan |
|---|---|
| 503 saat membuka Vercel | Isi kedua env Vercel dan redeploy |
| 502 | URL backend/sertifikat, proses aktif, firewall; jangan gunakan localhost atau URL Vercel sendiri |
| 403 dari backend | Secret proxy harus sama; akses via Vercel pada mode proxy |
| Login langsung kembali keluar di lokal | Gunakan COOKIE_SECURE=false pada HTTP localhost; jangan berpindah localhost ke 127.0.0.1 |
| Password lama masih berlaku sesudah deploy | Pastikan semua domain menunjuk backend/DATA_DIR yang sama, bukan instance versi lama |
| QR timeout | Periksa jaringan keluar backend ke WhatsApp dan log PM2; klik sambungkan ulang |
| auth_failure | Hapus sesi perangkat melalui UI lalu minta QR dan tautkan ulang |
| Sesi hilang setelah redeploy backend | DATA_DIR berada pada disk sementara atau ikut ditimpa release |

Referensi platform: https://vercel.com/docs/functions/limitations dan https://vercel.com/docs/project-configuration
