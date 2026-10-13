# Perbaikan v2.7.1 dari v2.7.0

## Penyebab
1. Frontend mengirim Content-Type JSON tetapi POST/DELETE tertentu tidak mempunyai body. Express req.is() tidak menganggap permintaan tanpa body sebagai JSON, sehingga operasi ditolak 403.
2. DisconnectReason.loggedOut/badSession hanya mengubah status menjadi auth_failure. Reconnect memuat lagi kredensial yang sudah ditolak WhatsApp.

## Perubahan
- src/services/api.ts: otomatis mengirim `{}` untuk operasi mutasi tanpa payload; payload yang sudah ada tetap dipakai.
- src/server/baileys.ts: menandai sesi invalid melalui default.invalid, menunggu penulisan kredensial, lalu membersihkan subfolder default saat Minta QR Baru/init berikutnya. Penanda bertahan setelah restart. Akun admin, API key dan gateway_state.json tidak dihapus.
- Middleware keamanan JSON, cross-site dan autentikasi tetap diterapkan.
- Label versi menjadi 2.7.1. Paket memuat dist hasil build baru.

## Memasang pada aplikasi yang sudah berjalan
1. Hentikan backend; simpan salinan source lama, `.env` dan seluruh DATA_DIR secara privat untuk rollback. Jangan bagikan backup sesi/secret.
2. Perbarui source dengan isi paket ini. Pertahankan `.env` lama dan lokasi/volume DATA_DIR lama. Jangan menghapus seluruh folder sessions dan jangan memakai folder sesi kosong sebagai pengganti data produksi.
3. Di direktori proyek backend jalankan `npm ci` lalu `npm run build`.
4. Restart backend menggunakan metode deployment sebelumnya. Jika memakai PM2: `pm2 restart reev-wa-gateway --update-env`. Untuk Docker Compose: `docker compose up -d --build`, dengan volume data lama yang sama.
5. Jika dashboard di Vercel dan backend di VPS, deploy ulang source dashboard ke proyek Vercel yang sama DAN perbarui backend VPS. Pertahankan BACKEND_URL/BACKEND_SHARED_SECRET. Baileys tetap berjalan di backend persisten.
6. Buka ulang dashboard dan lakukan hard refresh (Ctrl+Shift+R). Pastikan versi 2.7.1 tampil.
7. Menu Perangkat → Minta QR Baru (Baileys). Setelah sesi invalid ditandai, klik ini untuk menghapus auth yang ditolak dan meminta QR baru. Bila kredensial v2.7.0 baru pertama kali dideteksi invalid setelah upgrade, tunggu status sesi berakhir, lalu klik sekali lagi.
8. Di HP: WhatsApp → Perangkat tertaut → Tautkan perangkat → pindai QR.

Alternatif manual melalui aplikasi: Hapus sesi (ikon tempat sampah), kemudian Minta QR Baru. Tombol hapus kini mengirim JSON yang benar. Operasi ini memutus sesi WhatsApp saja.

Gangguan internet biasa tidak menghapus auth yang masih valid. Jika pesan JSON tetap muncul, pastikan dashboard baru sudah termuat; permintaan cross-site memang tetap ditolak. Jika muncul masalah izin, pastikan proses backend bisa menulis DATA_DIR.

## Rollback dan batas uji
Kembalikan source lama dan rebuild jika diperlukan, dengan `.env` dan DATA_DIR yang sama. Kredensial yang sudah dicabut dari HP tidak menjadi valid kembali melalui rollback; tetap harus menautkan ulang. Uji WhatsApp nyata dan deployment ke server pengguna belum dijalankan. Lihat TEST_RESULTS.md.
