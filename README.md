# REEV WA Gateway - WhatsApp API Gateway & Auto-Responder

REEV WA Gateway adalah solusi WhatsApp API Gateway mandiri berkinerja tinggi berbasis protokol **Baileys Multi-Device**, dirancang untuk pengiriman pesan massal otomatis, notifikasi OTP transaksi, dan sistem penerima pesan otomatis (Auto-Responder & Interactive Chatbot).

---

## 🚀 Fitur Utama

- **Baileys Native Socket**: Terhubung langsung ke jaringan resmi WhatsApp tanpa perantara pihak ketiga.
- **Persistent Session Storage**: Sesi login disimpan di folder `./sessions/default` sehingga **tidak perlu scan QR berulang kali** setelah restart.
- **Auto-Responder & Inbound Message Receiver**: Membalas setiap pesan WhatsApp masuk secara otomatis menggunakan aturan kata kunci fleksibel, menu navigasi interaktif, pesan fallback, dan variabel dinamis (`{sender_name}`, `{greeting}`, `{time}`, `{date}`).
- **Pesan Massal (Bulk Broadcast)**: Dilengkapi proteksi jeda acak adaptif (Anti-Ban Rate Limiter) untuk mencegah pemblokiran nomor.
- **Dashboard Analitik**: Memantau tingkat keberhasilan (Delivery Rate), latensi pengiriman, log error, dan riwayat pesan masuk secara real-time.
- **Integrasi Multi-Platform**:
  - Google Apps Script (GAS) untuk otomatisasi Google Sheets & Google Forms.
  - Flutter Dart untuk aplikasi mobile Android & iOS.
  - REST API & cURL untuk sistem backend apapun.
  - Webhook Dispatcher dengan verifikasi tanda tangan HMAC SHA-256.

---

## 💻 Cara Menjalankan di Komputer Lokal

### Prasyarat:
- Node.js versi 20.x atau lebih baru
- NPM atau Bun

### Langkah-langkah:
1. Ekstrak file zip ini ke komputer Anda.
2. Buka terminal di folder proyek:
   ```bash
   cd reev-wa-gateway
   ```
3. Instal dependensi:
   ```bash
   npm install
   ```
4. Jalankan aplikasi dalam mode development:
   ```bash
   npm run dev
   ```
5. Buka browser di `http://localhost:3000`.

---

## ⚡ Panduan Deployment di Vercel (Cloud Hosting)

Aplikasi ini telah dilengkapi dengan berkas `vercel.json` dan Serverless Function `api/index.ts` sehingga siap di-deploy langsung ke Vercel tanpa error 404:

1. Upload seluruh isi proyek ini ke repositori **GitHub** Anda.
2. Masuk ke dashboard [vercel.com](https://vercel.com) &gt; klik **"Add New Project"**.
3. Import repositori GitHub Anda.
4. **Framework Preset**: Pilih **Vite** (Build Command: `npm run build`, Output Directory: `dist`).
5. Klik **"Deploy"**.
6. Selesai! Buka URL Vercel yang diberikan. Login menggunakan kredensial default:
   - **Username:** `admin`
   - **Password:** `admin123`
   *(Dapat diubah di menu Keamanan & Akun)*

---

## 🌐 Panduan Deployment di VPS (Dewaweb, Ubuntu, Debian)

### Opsi A: Menggunakan PM2 (Rekomendasi)
1. Akses server VPS Anda via SSH:
   ```bash
   ssh root@ip-vps-anda
   ```
2. Instal Node.js 20 dan PM2:
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
   sudo apt install -y nodejs git
   sudo npm install -g pm2
   ```
3. Upload proyek ini ke direktori `/var/www/reev-wa-gateway`:
   ```bash
   cd /var/www/reev-wa-gateway
   npm install
   npm run build
   ```
4. Jalankan layanan 24/7 menggunakan PM2:
   ```bash
   pm2 start ecosystem.config.js
   pm2 save
   pm2 startup
   ```
5. Aplikasi kini berjalan di port `3000`. Anda dapat menghubungkannya dengan Nginx Reverse Proxy dan SSL Let's Encrypt.

### Opsi B: Menggunakan Docker Compose
Cukup jalankan satu perintah berikut:
```bash
docker compose up -d --build
```
Sesi WhatsApp akan disimpan secara otomatis di volume Docker `./sessions`.

---

## 📱 Panduan Menghubungkan WhatsApp
1. Buka dashboard di browser Anda.
2. Masuk ke menu **Perangkat & Sesi**.
3. Klik tombol **Hubungkan WhatsApp (Scan QR)**.
4. Buka aplikasi WhatsApp di smartphone Anda &gt; **Perangkat Tertaut** &gt; **Tautkan Perangkat**.
5. Arahkan kamera ke QR Code yang muncul di layar.
6. Status akan otomatis berubah menjadi **CONNECTED**.

---

## 🔐 Keamanan & Lisensi
- Kredensial disimpan secara terenkripsi di folder lokal server Anda.
- Jangan bagikan folder `./sessions` atau file `creds.json` kepada siapa pun.
- Dibuat untuk performa tinggi dan kustomisasi penuh.
