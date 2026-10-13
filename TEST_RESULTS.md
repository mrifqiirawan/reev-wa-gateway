# Hasil uji v2.7.1

Tanggal: 13 Oktober 2026. Uji lokal; tidak mengakses akun WhatsApp pengguna.

| Pemeriksaan | Hasil |
|---|---|
| npm ci --ignore-scripts --no-audit --no-fund | PASS, 293 paket terpasang dari lockfile |
| npm test | PASS, 24 tes, 0 gagal |
| npm run lint (TypeScript) | PASS |
| npm run build | PASS, dist dibangun ulang |
| Reproduksi DELETE tanpa body dengan header JSON | PASS: ditolak 403 pada middleware asli |
| API client asli: init, reconnect, delete device, delete rule | PASS: JSON diterima langsung dan melalui proxy lokal |
| Permintaan cross-site | PASS: tetap ditolak 403 |
| Logout dari HP (event simulasi 401), badSession (500), QR baru | PASS dengan mock transport |
| Penanda sesi invalid bertahan setelah restart | PASS |
| Penulisan kredensial tertunda sebelum reset | PASS |
| Reconnect biasa mempertahankan auth, reset tidak menghapus admin | PASS |
| Tes auth, proxy, backend restart, webhook dan API existing | PASS |
| Pindai QR/tautkan ulang ke WhatsApp nyata | NOT_RUN: memerlukan HP/akun pengguna |
| Deploy Vercel/VPS pengguna dan QA browser | NOT_RUN: tidak ada akses deployment yang digunakan |

Mock transport menguji perilaku aplikasi, bukan keberhasilan jaringan WhatsApp.
Referensi perilaku auth Baileys: https://github.com/WhiskeySockets/docs/blob/main/advanced/troubleshooting.mdx
