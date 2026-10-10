# REEV WA Gateway - Baileys Native Engine, Zero-Dummy Cleanup & Export ZIP

Rencana ini menetapkan langkah integrasi soket Baileys langsung (`@whiskeysockets/baileys`) untuk menghubungkan nomor WhatsApp fisik Anda secara nyata via QR scan, membersihkan seluruh riwayat log dan pesan dummy agar aplikasi mulai dari kondisi bersih (zero-state) di lingkungan produksi, serta membungkus seluruh project menjadi file ZIP lengkap yang dapat diunduh langsung untuk kebutuhan GitHub, local development, maupun VPS hosting (Dewaweb/Linux).

> [!IMPORTANT]
> **Keputusan Kunci yang Dikonfirmasi:**
> - **Zero-Dummy Cleanup**: Riwayat log pesan keluar, inbox, dan error dimatikan dari seed palsu (dimulai dari `0` pesan). Starter template aturan auto-responder (salam dinamis & menu bantuan) tetap disediakan agar bot langsung siap pakai begitu nomor WhatsApp Anda tersambung.
> - **Baileys Real Socket Engine**: Mengintegrasikan library Baileys resmi (`@whiskeysockets/baileys`, `pino`) dengan penyimpanan sesi multi-file persisten (`useMultiFileAuthState`) pada folder `./sessions`. QR code yang ditampilkan di dashboard adalah string autentikasi live dari server WhatsApp Web resmi.
> - **Ekspor ZIP Komplit**: Menyediakan endpoint dan tombol unduh langsung di dashboard (`/api/export/project-zip`) yang mengemas seluruh source code, file konfigurasi, `Dockerfile`, `docker-compose.yml`, `ecosystem.config.js`, dan panduan instalasi.
> - **Mengenai Opsi Publikasi (Publish) Gratis di AI Studio**:
>   - Fitur *Publish* di Google AI Studio dapat digunakan secara gratis untuk menjalankan dashboard dan gateway.
>   - *Catatan Teknis Arsitektur*: Layanan cloud serverless gratis umumnya memiliki mekanisme *scale-to-zero* (mesin istirahat saat tidak ada traffic HTTP selama beberapa menit). Protokol WhatsApp Baileys membutuhkan soket TCP yang terus terjaga 24 jam. Oleh karena itu, gateway ini dapat diuji dan digunakan langsung di sini secara gratis, namun untuk kebutuhan bisnis skala besar 24/7 tanpa putus, paket ZIP yang kami sediakan dapat Anda pasang di VPS (Dewaweb/Ubuntu) dengan PM2 atau Docker.

---

## 1. Overview & Core Concept

- **Apa yang Dikerjakan**:
  1. Menghubungkan engine WhatsApp resmi menggunakan soket Baileys asli.
  2. Menghapus semua data dummy riwayat pesan keluar, log, dan inbox sehingga aplikasi bersih dan siap pakai untuk produksi nyata.
  3. Mempertahankan template aturan auto-responder awal (salam dinamis `{greeting}`, menu `1`, `2`, `3`, dan fallback) yang siap disesuaikan oleh pengguna.
  4. Menyediakan bundle file ZIP lengkap yang berisi seluruh file proyek siap upload ke GitHub atau dijalankan di server lokal/VPS.
  5. Menambahkan tombol unduh ZIP langsung di antarmuka navigasi dan SDK Center.

---

## 2. User Experience & Visual Design

### A. Alur Kerja Pengguna
1. **Device Pairing dengan Nomor WhatsApp Asli**:
   - Membuka menu *Perangkat & Sesi*.
   - Mengklik *Tambah Perangkat Baru* atau *Hubungkan Baileys*.
   - Server Baileys memicu soket ke WhatsApp dan memancarkan QR Code resmi.
   - Buka WhatsApp di smartphone Anda &gt; *Perangkat Tertaut* &gt; Scan QR Code.
   - Status berubah menjadi `CONNECTED` dengan nomor telepon dan nama profil WhatsApp Anda yang asli.
2. **Kondisi Data Bersih (Production Zero-State)**:
   - Tab *Log Error & Pengiriman* dan *Pesan Masuk (Inbox)* menampilkan antarmuka bersih (*empty state* elegan dengan petunjuk cara kirim pesan pertama).
   - Metrik di Dashboard analitik menampilkan data riil berbasis pengiriman pesan yang benar-benar Anda lakukan.
3. **Download ZIP Proyek**:
   - Di Header top bar dan tab *Panduan & SDK*, tersedia tombol **"Download Full Project (ZIP)"**.
   - Sekali klik langsung mengunduh arsip `reev-wa-gateway-production.zip` yang berisi seluruh source code lengkap, file Docker, PM2, dan dokumentasi README.

---

## 3. Key Technical Decisions & Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                   REEV WA GATEWAY - REAL BAILEYS ENGINE                │
├────────────────────────────────┬───────────────────────────────────────┤
│         KLIEN EKSTERNAL        │              REEV SERVER              │
│                                │                                       │
│  ┌──────────────────────────┐  │   ┌────────────────────────────────┐  │
│  │ Google Apps Script (GAS) │──┼──>│ Express REST API Engine        │  │
│  │ Mobile App (Flutter)     │  │   │  • /api/messages/send          │  │
│  │ cURL / Postman           │  │   │  • /api/export/project-zip     │  │
│  └──────────────────────────┘  │   └───────────────┬────────────────┘  │
│                                │                   │                   │
│                                │   ┌───────────────▼────────────────┐  │
│  ┌──────────────────────────┐  │   │ Baileys Multi-File Auth Engine │  │
│  │ Admin Dashboard React    │<─┼──>│  • useMultiFileAuthState       │  │
│  │ (#020618 Neon Blue Dark) │  │   │  • makeWASocket({ ... })       │  │
│  └──────────────────────────┘  │   │  • messages.upsert auto-reply  │  │
│                                │   │  • sessions/<id>/creds.json    │  │
│                                │   └───────────────┬────────────────┘  │
└────────────────────────────────┴───────────────────┼───────────────────┘
                                                     ▼
                                     ┌────────────────────────────────┐
                                     │ WhatsApp Web Official Socket   │
                                     │ (Koneksi Nyata ke Server WA)   │
                                     └────────────────────────────────┘
```

- **Penyimpanan Sesi Asli**: Menggunakan `useMultiFileAuthState('./sessions/default')` bawaan Baileys untuk persistensi kredensial enkripsi Noise.
- **Handling Pesan Masuk Asli (`messages.upsert`)**: Ketika seseorang mengirim pesan WhatsApp ke nomor yang tersambung, event listener Baileys menangkap pesan tersebut, memproses aturan kata kunci, mengganti tag dinamis (`{sender_name}`, `{greeting}`), lalu memanggil `sock.sendMessage()` untuk membalas otomatis.
- **Pembuatan File ZIP**: Mengemas seluruh project menggunakan script zip otomasi, mengecualikan `node_modules` dan `.git` agar ukuran file ringan (~3 MB).

---

## 4. Verification & Testing Plan

1. **Verifikasi Instalasi Dependensi**:
   - Memastikan paket `@whiskeysockets/baileys` dan `pino` terpasang dengan baik.
2. **Uji Coba Baileys Lifecycle**:
   - Menguji inisialisasi socket dan generasi QR string resmi WhatsApp.
   - Menguji event `connection.update` saat terhubung dan `messages.upsert` saat menerima pesan masuk.
3. **Verifikasi Zero-Dummy Data**:
   - Memastikan tabel log dan inbox tidak lagi menampilkan data dummy palsu.
   - Memastikan aturan auto-responder default tetap tersedia untuk menyambut pesan pertama.
4. **Verifikasi Generator File ZIP**:
   - Menguji endpoint `GET /api/export/project-zip` mengembalikan file `.zip` yang valid dan dapat diekstrak secara lokal.
5. **Kompilasi & Linting**:
   - Menjalankan `compile_applet` dan `lint_applet` untuk memastikan seluruh aplikasi lulus build tanpa error.
