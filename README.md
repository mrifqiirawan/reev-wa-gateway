# REEV WA Gateway v2.7.0

Backend Node.js persisten + dashboard React untuk satu sesi WhatsApp Baileys.

**Sudah memakai v2.6.0? Baca [UPGRADE_v2.7.0.md](UPGRADE_v2.7.0.md) terlebih dahulu.** Jangan menimpa .env atau menghapus sesi produksi.

Instalasi baru: Node 22.12+ atau 24 → `npm ci` → isi ADMIN_PASSWORD di .env → `npm run build` → `npm start`. Dashboard tersedia di port 3000. Untuk proses persisten gunakan konfigurasi PM2 yang disediakan. Untuk HTTPS gunakan reverse proxy.

API key dapat disalin di menu API & Webhook setelah login. GATEWAY_API_KEY kosong membuat key otomatis yang persisten; env yang diisi mempunyai prioritas. Rotasi key buatan aplikasi membutuhkan password admin. `.env` paket berisi template tanpa secret asli.

Panduan SDK di dashboard dan file `sdk/REEV_GAS.gs` berasal dari sumber yang sama. Gunakan Script Properties di Apps Script. Integrasi Presensi cukup memakai API pengiriman; webhook bersifat opsional.

Validasi lokal: `npm run lint`, `npm test`, `npm run build`. Lihat TEST_RESULTS.md untuk hasil dan batas pengujian. Tidak ada klaim deployment otomatis ke VPS Anda.
