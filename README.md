> Revisi performa v2.8.1: baca [docs/OPTIMASI_RESPONS_v2.8.1.md](docs/OPTIMASI_RESPONS_v2.8.1.md) untuk mode Supabase langsung, antrean paralel, dan pengukuran respons. Bagian konfigurasi webhook di bawah berlaku bila mode webhook aktif.

# REEV WA Gateway 2.8.1

Mulai dari [PANDUAN_VM_v2.8.1.md](PANDUAN_VM_v2.8.1.md) untuk instalasi VM, upgrade, konfigurasi dashboard dan SQL.

# REEV WA Gateway v2.8.0

Mulai upgrade dari **PANDUAN_UPDATE_v2.8.0.md**. Paket ini menambah menu custom, paket/point, dan integrasi REEV Belajar v1.1.0. Login admin dan sesi lama tetap dipakai.

# REEV WA Gateway v2.7.3

Backend Node.js persisten + dashboard React untuk satu sesi WhatsApp Baileys.

**Pembaruan inbox/status dan panduan GitHub/VM: baca [PANDUAN_UPDATE_v2.7.3.md](PANDUAN_UPDATE_v2.7.3.md).**

**Perbaikan QR/sesi: baca [UPGRADE_v2.7.1.md](UPGRADE_v2.7.1.md).**

**Sudah memakai v2.6.0? Baca [UPGRADE_v2.7.0.md](UPGRADE_v2.7.0.md) terlebih dahulu.** Jangan menimpa .env atau menghapus sesi produksi.

Instalasi baru: Node 22.12+ atau 24 → `npm ci` → salin .env.example ke .env dan isi ADMIN_PASSWORD → `npm run build` → `npm start`. Dashboard tersedia di port 3000. Untuk proses persisten gunakan konfigurasi PM2 yang disediakan. Untuk HTTPS gunakan reverse proxy.

API key dapat disalin di menu API & Webhook setelah login. GATEWAY_API_KEY kosong membuat key otomatis yang persisten; env yang diisi mempunyai prioritas. Rotasi key buatan aplikasi membutuhkan password admin. Paket hanya menyertakan `.env.example`; pertahankan `.env` produksi Anda.

Panduan SDK di dashboard dan file `sdk/REEV_GAS.gs` berasal dari sumber yang sama. Gunakan Script Properties di Apps Script. Integrasi Presensi cukup memakai API pengiriman; webhook bersifat opsional.

Validasi lokal: `npm run lint`, `npm test`, `npm run build`. Lihat TEST_RESULTS.md untuk hasil dan batas pengujian. Tidak ada klaim deployment otomatis ke VPS Anda.
