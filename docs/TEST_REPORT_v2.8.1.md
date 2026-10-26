# Verifikasi REEV WA Gateway 2.8.1

Lingkungan: Node 24.22.1, Linux, instalasi dependency melalui npm ci dari lockfile.

| Pemeriksaan | Status | Bukti/batas |
|---|---|---|
| Dependency install | PASS | npm ci --no-audit --no-fund |
| TypeScript | PASS | npm run lint, tsc --noEmit |
| Build production | PASS | npm run build, Vite |
| Test suite | PASS | npm test, 53 tests, 0 fail |
| Environment API | PASS | Anon ditolak; hanya key allowlist; batas timeout; secret tidak muncul pada GET; nilai tersimpan 0600; update process.env langsung |
| Environment UI | PASS | Happy DOM: perubahan field, secret tersimpan tidak terkirim ulang, check dinonaktifkan sebelum simpan |
| Webhook deadline | PASS | Mock transport/DNS: timeout menghentikan request, DNS tidak menggantung, tanpa retry otomatis |
| Auth, bot, SQL, pesan lama | PASS | Suite bawaan, termasuk pengujian SQL embedded PGlite dan transport mock |
| Installer | PASS parsial | bash -n; tidak dijalankan sebagai pemasangan service dalam VM pengguna |
| Audit paket | PASS | Struktur dan pola secret terpilih; bukan sertifikasi keamanan |
| Visual browser/device | NOT_RUN | Happy DOM menguji perilaku, bukan screenshot browser atau perangkat |
| VM 103.253.244.29 | NOT_RUN | Tidak ada akses SSH yang digunakan |
| Supabase/Vercel pengguna | NOT_RUN | Tidak menghubungi database atau endpoint produksi pengguna |
| Pengiriman WA nyata | NOT_RUN | Tidak mengirim pesan; mock tidak membuktikan penerimaan WhatsApp |

Tidak ada migrasi SQL baru. REEV BELAJAR hanya dibaca untuk memeriksa kontrak integrasi. Arsip sumber Belajar tetap memiliki SHA256 eeb4048e4f3923f66fe06049f6b146fe7a9e9117d781aaeed0fad1cbdf79778a.

## Revisi performa pada versi yang sama

Pengujian tambahan PASS: pemanggilan RPC langsung dengan event/nomor/NISN utuh, tidak mengikuti redirect, tidak retry/fallback otomatis, 32 permintaan bersamaan berbagi satu fetch konfigurasi, pengecekan gw_begin tetap per pesan, deduplikasi tetap aktif, invalidasi cache, batas konkurensi, FIFO per chat, penolakan antrean penuh, kedaluwarsa antrean, dan handler Baileys antarbatch.

Eksperimen lokal 64 pesan sintetis dengan mock I/O 15 ms per tahap:

| Konkurensi | Total penyelesaian | P50 selesai sejak batch masuk | P95 selesai sejak batch masuk |
|---|---|---|---|
| 1 | 5898 ms | 2955 ms | 5624 ms |
| 8 | 747 ms | 382 ms | 747 ms |

Kedua kelompok memakai engine revisi yang sama. Ini hanya eksperimen scheduler dengan mock, bukan pengukuran WhatsApp/Supabase atau klaim percepatan produksi. Script: scripts/benchmark-bot.mjs. Jalur langsung menghilangkan satu lapisan server secara struktural; dampak latensi nyatanya belum diukur.

Batas: tidak ada bukti pengukuran penyebab latensi produksi. Mode langsung, cache, dan antrean mengurangi pekerjaan/perjalanan yang tidak diperlukan; waktu aktual masih bergantung VM, Supabase dan WhatsApp. Konfigurasi runtime dashboard tersimpan pada disk VM, sehingga backup/restore harus menyertakan DATA_DIR. Konfigurasi infrastruktur tetap dikelola installer/service; lihat panduan.
