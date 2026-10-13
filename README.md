# REEV WA Gateway v2.7.3

Backend Node.js persisten + dashboard React untuk satu sesi WhatsApp Baileys.

**Pembaruan inbox/status dan panduan GitHub/VM: baca [PANDUAN_UPDATE_v2.7.3.md](PANDUAN_UPDATE_v2.7.3.md).**

**Perbaikan QR/sesi: baca [UPGRADE_v2.7.1.md](UPGRADE_v2.7.1.md).**

**Sudah memakai v2.6.0? Baca [UPGRADE_v2.7.0.md](UPGRADE_v2.7.0.md) terlebih dahulu.** Jangan menimpa .env atau menghapus sesi produksi.

Instalasi baru: Node 22.12+ atau 24 → `npm ci` → salin .env.example ke .env dan isi ADMIN_PASSWORD → `npm run build` → `npm start`. Dashboard tersedia di port 3000. Untuk proses persisten gunakan konfigurasi PM2 yang disediakan. Untuk HTTPS gunakan reverse proxy.

API key dapat disalin di menu API & Webhook setelah login. GATEWAY_API_KEY kosong membuat key otomatis yang persisten; env yang diisi mempunyai prioritas. Rotasi key buatan aplikasi membutuhkan password admin. Paket hanya menyertakan `.env.example`; pertahankan `.env` produksi Anda.

Panduan SDK di dashboard dan file `sdk/REEV_GAS.gs` berasal dari sumber yang sama. Gunakan Script Properties di Apps Script. Integrasi Presensi cukup memakai API pengiriman; webhook bersifat opsional.

Validasi lokal: `npm run lint`, `npm test`, `npm run build`. Lihat TEST_RESULTS.md untuk hasil dan batas pengujian. Tidak ada klaim deployment otomatis ke VPS Anda.
