# Verifikasi v2.7.0 — 11 Oktober 2026

| Pemeriksaan | Hasil | Lingkungan |
|---|---|---|
| `npm ci` dari lockfile | PASS | Node 24 lokal |
| `npm run lint` | PASS | TypeScript lokal |
| `npm test` | PASS, 18 tests | Node test runner |
| `npm run build` | PASS | Vite produksi |
| Login → API key tampil/sembunyi → SDK | PASS | Chromium lokal dengan backend nyata, data uji |
| SDK viewport 390/1366 | Diperiksa | Browser lokal |
| Secret key lifecycle, auth scope, rotation, persistence | PASS | Server lokal |
| Offline text/OTP tidak sukses palsu | PASS | Server lokal tanpa WA |
| HMAC byte persis, HTTPS/private DNS guard, status webhook gagal | PASS | Mock transport + request lokal |
| Persistensi login setelah restart proses | PASS | Child process backend produksi |
| Kirim WA/receipt/pairing ke jaringan WhatsApp | NOT_RUN | Memerlukan sesi pengelola |
| Endpoint webhook HTTPS milik pengguna | NOT_RUN | Tidak ada endpoint uji diberikan |
| Deployment VPS 103.253.244.29 | NOT_RUN | Source belum diunggah ke VPS |

Tes tidak mengirim pesan ke nomor nyata. Browser tidak memegang data/kunci produksi. Tidak ada klaim semua kemungkinan kondisi jaringan telah diuji. Tinjau UPGRADE_v2.7.0.md untuk batas bulk/webhook/LID, single-process dan retry.

Vite memberi peringatan NODE_ENV=production dalam .env; build tetap berhasil. NODE_ENV dipakai backend, sedangkan build Vite sudah mode production. Jangan mengganti NODE_ENV menjadi development untuk menjalankan server produksi.
