# Hasil uji v2.7.2

Tanggal: 13 Oktober 2026. Lingkungan: Linux, Node v24.19.0.

| Pengujian | Hasil | Bukti / batas |
|---|---|---|
| npm ci | PASS | 293 packages; lockfile awal gagal jiti 2.7.1 404 lalu diregenerasi |
| npm run lint | PASS | TypeScript --noEmit |
| npm run build | PASS | Vite 8.3.4; dist dibangun ulang |
| npm test | PASS | 27 tests, 0 fail |
| Pesan LID tanpa mapping/PN alternatif/gagal mapping | PASS | tests/messages-v272.test.ts, mock socket |
| Wrapped text, media, append, exclusion, socket lama | PASS | tests/messages-v272.test.ts |
| ID sebelum receipt cepat, dua sumber receipt, status tidak turun | PASS | tests/messages-v272.test.ts |
| Lookup isi pesan untuk retry Baileys | PASS | lookup mock; retry protokol nyata NOT_RUN |
| Deduplikasi inbox dan auto-reply LID, persist sebelum kirim | PASS | tests/inbox-v272.test.ts, API lokal dan mock transport |
| Session/cookie/admin/QR/proxy regresi | PASS | tes lama tetap berjalan, termasuk restart proses backend |
| Kirim/terima WhatsApp nyata | NOT_RUN | Tidak menggunakan sesi WA pengguna |
| GitHub / VM Ubuntu / browser produksi | NOT_RUN | Panduan diberikan; tidak ada push, SSH, deploy, atau uji UI produksi |

Tidak mengubah semua SENT menjadi DELIVERED. Bug source dapat diperbaiki tanpa membuktikan penyebab spesifik pesan historis yang tidak memiliki receipt.
