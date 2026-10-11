# Upgrade REEV WA Gateway 2.6.0 → 2.7.0

Paket ini memperbarui kode; belum mengubah VPS http://103.253.244.29:3000.
Jalankan satu instance PM2. Jangan menjalankan instance lama dan baru bersamaan dengan sesi WA yang sama.

## 1. Backup sebelum mengganti kode

Di server: catat direktori aplikasi dan DATA_DIR yang digunakan. Stop aplikasi `pm2 stop reev-wa-gateway`, lalu salin seluruh folder aplikasi, `.env`, dan seluruh DATA_DIR ke lokasi backup privat. DATA_DIR mungkin berada di luar folder aplikasi. Untuk Docker, backup volume `reev_sessions` juga. Jangan menghapus volume/sesi.

## 2. Ganti source

Ekstrak paket v2.7.0 ke folder baru. Salin `.env` produksi dan DATA_DIR lama ke folder baru, atau arahkan DATA_DIR ke lokasi absolut yang sama. `.env` dalam paket hanya TEMPLATE KOSONG, jangan menimpa konfigurasi lama dengan template tersebut. Pastikan pengguna proses memiliki akses tulis DATA_DIR.

- Akun dan sesi login lama dipertahankan melalui admin_auth.json.
- Pairing WhatsApp lama dipertahankan melalui DATA_DIR/default.
- Log/rule/webhook v2.6 yang hanya hidup di memori tidak bisa dipulihkan setelah proses lama berhenti. Simpan aturan yang diperlukan sebelum stop. v2.7 menyimpannya di gateway_state.json.
- Jika GATEWAY_API_KEY lama sudah diisi, pertahankan nilainya; dashboard akan membaca key tersebut.
- Jika kosong, v2.7 membuat key acak otomatis di DATA_DIR/integration_key.json.

Di direktori baru:

```bash
npm ci
npm run lint
npm test
npm run build
```

Untuk PM2: setelah memastikan backup, hapus hanya entri proses lama dengan `pm2 delete reev-wa-gateway`, jalankan `pm2 start ecosystem.config.cjs` dari folder baru, lalu `pm2 save`. Menghapus entri PM2 tidak menghapus file sesi.

Jika memakai Docker, ikuti volume existing; jangan membuat proyek Compose dengan nama baru tanpa memetakan volume lama. Port Compose bawaan terikat localhost untuk reverse proxy.

## 3. Konfigurasi .env untuk VPS standalone

- NODE_ENV=production; PORT=3000; DATA_DIR=./sessions atau path absolut lama.
- ADMIN_USERNAME dan ADMIN_PASSWORD hanya membuat akun pada instalasi pertama. Password akun lama diubah melalui Pengaturan Keamanan.
- SESSION_TTL_DAYS=30 (1–90). Cookie lama mempertahankan expiry saat diterbitkan.
- COOKIE_SECURE=false untuk HTTP sementara; true setelah HTTPS aktif.
- TZ=Asia/Makassar untuk WITA.
- GATEWAY_API_KEY kosong = dikelola aplikasi; diisi = dikelola env.
- BACKEND_SHARED_SECRET dan BACKEND_URL kosong untuk standalone. Keduanya untuk mode proxy Vercel, bukan syarat Apps Script.
- Jangan beri awalan VITE_ pada secret. Semua secret berada di backend.

Gunakan domain HTTPS/reverse proxy sebelum penggunaan nyata. HTTP dapat mengekspos password, cookie, dan key dalam transit. Script Properties tidak mengenkripsi koneksi HTTP.

## 4. Uji sebagai admin

1. Login dan buka Perangkat; pastikan connected. Versi ini mendukung satu perangkat `device_primary`.
2. API & Webhook → Tampilkan / Salin Key. Pada HTTP ada fallback salin dan dialog salin manual bila diblokir browser.
3. Kirim ke nomor Anda sendiri. `sent` berarti diterima transport WhatsApp, bukan bukti delivered/read.
4. Putuskan koneksi pada sesi uji terpisah: pengiriman harus gagal, tidak sukses palsu.
5. Webhook opsional untuk presensi. Jika digunakan, URL harus HTTPS publik port 443. Simpan konfigurasi lalu Test. Lihat HTTP status yang nyata.
6. Panduan SDK → ikuti petunjuk Script Properties dan jalankan tesReevWA.
7. Restart PM2, pastikan key/config/login tersimpan.

## Webhook contract

POST JSON `{id,event,timestamp,deviceId,data}`. Header `X-REEV-Signature: sha256=<hex HMAC-SHA256 atas byte JSON mentah>`. Verifikasi sebelum memproses; deduplikasi event id pada receiver. Event: message.received, message.sent, message.delivered (data.status delivered/read), message.failed, device.status. Pengiriman tidak mengikuti redirect; timeout 10 detik. Tidak ada durable retry webhook otomatis pada versi ini. Tes mengirim event webhook.test.

## Batas yang perlu diketahui

- Baileys adalah integrasi WhatsApp tidak resmi; kompatibilitas sesi bergantung pada WhatsApp/Baileys. Bukan Meta Cloud API.
- Otomatis balas hanya pesan personal dengan JID nomor telepon; grup dan identitas LID tanpa pemetaan tidak dibalas agar tidak salah penerima.
- Regex dinonaktifkan; gunakan exact/contains/starts_with. Menu balasan berupa teks, bukan tombol interaktif WhatsApp.
- Bulk dipersistenkan dan dikirim serial, jeda 4–8 detik; maksimal 500 kontak per permintaan. Pesan yang terputus saat sending ditandai hasil tidak pasti dan tidak diulang otomatis.
- Server JSON ditujukan untuk satu proses. Belum ada rotasi/arsip log otomatis atau janji skala multi-sekolah besar.
- Tidak ada jaminan exactly-once lintas jaringan. Timeout harus diperiksa sebelum retry.

## Rollback

Stop v2.7; kembalikan folder aplikasi dan backup DATA_DIR sebelum upgrade; jalankan konfigurasi PM2 lama. Perubahan setelah backup dapat hilang. Jangan memakai sesi yang sama pada dua proses. Simpan salinan data v2.7 sebelum rollback.
