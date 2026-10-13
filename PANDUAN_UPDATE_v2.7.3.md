# REEV WA Gateway v2.7.3 — Status pengiriman dan hapus log

## Hasil pemeriksaan

Ekspor yang diberikan berisi 42 baris: 18 SENT, 14 READ, 4 DELIVERED, 6 FAILED. Enam FAILED mencatat sesi belum terhubung. Ada penerima lain selain nomor pembanding yang pernah DELIVERED. Karena itu, jangan menyimpulkan semua nomor lain tidak terdaftar atau diblokir.

Temuan kode yang terverifikasi: v2.7.2 menangani status receipt 3/4/5 tetapi mengabaikan status 0 (ERROR). Baileys yang terkunci dalam paket mengirim status 0 beserta messageStubParameters ketika server WhatsApp menolak pesan. Karena sendMessage dapat selesai sebelum event ini, log sebelumnya dapat tertahan SENT. Logger silent juga tidak memberi petunjuk di log aplikasi. Ekspor lama tidak menyimpan kode penolakan sehingga penyebab per nomor belum dapat dipastikan secara retrospektif.

Sumber teknis audit: dependency lokal @whiskeysockets/baileys/lib/Socket/messages-recv.js, fungsi handleBadAck dan events messages.update; socket.js, fungsi onWhatsApp. Versi dependency dipertahankan sesuai lockfile, tidak dinaikkan secara spekulatif.

## Perubahan

- Tangkap NACK/ERROR WhatsApp, simpan FAILED + kode + penjelasan, termasuk bila event tiba sebelum fungsi send selesai.
- Jangan menurunkan DELIVERED/READ oleh event error terlambat. Receipt yang datang setelah FAILED dapat memperbaiki status berdasarkan bukti.
- Cek nomor lewat onWhatsApp sebelum pengiriman berbasis nomor; gunakan alamat hasil lookup. Balasan ke LID asli tetap didukung. Lookup tanpa jawaban dibedakan dari nomor tidak ditemukan.
- Tombol Cek nomor pada log: hanya memeriksa registrasi, tidak mengirim pesan dan tidak membuktikan delivery.
- SENT ditampilkan sebagai belum terkonfirmasi; sesudah lima menit diberi keterangan. Bukan FAILED otomatis dan tidak dikirim ulang otomatis.
- Tampilkan errorMessage meskipun log lama tidak mempunyai errorCode.
- Hapus satu log atau log hasil filter yang sudah dimuat. Maksimum 500 ID per request; jumlah aktual mengikuti data yang dimuat halaman. Tidak mengklaim menghapus seluruh arsip server.
- Konfirmasi sebelum hapus. Antrean dan pengiriman aktif dilindungi; request campuran yang memuat keduanya ditolak seluruhnya. API key integrasi tidak berhak menghapus log; sesi admin wajib.
- Hapus log memengaruhi statistik dan menghapus bahan retry/dekripsi dari log tersebut. Ekspor log dahulu jika perlu. Hapus log tidak menarik pesan di WhatsApp dan tidak menghapus inbox, akun, API key, aturan, atau sesi.

## Pembaruan server

1. Hentikan proses gateway melalui pengelola proses yang digunakan (PM2/systemd/Docker) sebelum membuat backup konsisten.
2. Simpan backup privat folder aplikasi, .env, dan seluruh DATA_DIR (default sessions), termasuk gateway_state.json, admin_auth.json dan sesi perangkat. Jangan upload backup sesi ke GitHub.
3. Salin source rilis ini ke aplikasi, pertahankan .env dan DATA_DIR yang sama. Jangan menghapus sessions atau scan ulang QR sebagai langkah pertama. Tidak ada migrasi database.
4. Pada folder aplikasi jalankan:

```bash
npm ci
npm run lint
npm test
npm run build
```

Gunakan Node sesuai package.json: >=22.12.0 dan <25. Jalankan kembali proses gateway dengan cwd, PORT, environment dan DATA_DIR lama. Untuk PM2, gunakan nama proses yang benar dari `pm2 list`; jangan membuat proses ganda. Untuk Docker, rebuild image dengan volume data lama.

5. Bila frontend menggunakan Vercel, deploy source/frontend versi yang sama dan pertahankan BACKEND_URL serta BACKEND_SHARED_SECRET. Daemon Baileys tetap di backend persisten; mengunggah frontend saja tidak memperbaiki backend.
6. Periksa `/api/health`: versi harus 2.7.3. Refresh keras browser dan pastikan menu menampilkan 2.7.3.

Panduan GitHub/VM lebih panjang dari versi sebelumnya tetap tersedia di PANDUAN_UPDATE_v2.7.2.md sebagai referensi historis; gunakan nama file, versi dan commit 2.7.3 untuk rilis ini.

## Uji penerimaan setelah dipasang

1. Buka Perangkat, pastikan connected. Buka Log, gunakan Cek nomor pada satu nomor bermasalah.
2. Dengan persetujuan penerima, kirim satu pesan uji. Perhatikan status setelah refresh; tidak perlu mencoba semua nomor sekaligus.
3. Bila FAILED 463 muncul: server melaporkan pembatasan akun atau token privasi kontak belum tersedia. Periksa notifikasi pembatasan di WhatsApp utama. Jangan mengulang kirim massal. Kode 463 bukan bukti bahwa penerima memblokir Anda.
4. Bila FAILED 479 muncul: periksa alamat/sesi, sambungkan ulang gateway lalu uji satu pesan. Reset/QR baru hanya jika sesi terbukti bermasalah; backup terlebih dahulu.
5. Bila tetap SENT: belum ada receipt/penolakan yang tertangkap. Bandingkan dengan pengiriman manual dari aplikasi WhatsApp utama ke penerima yang sama, periksa penerima aktif, dan minta balasan bila sesuai. Catat waktu, kode/error baru, dan apakah pesan manual sampai. SENT saja tidak dapat menentukan penyebab.
6. Ekspor log, hapus satu log percobaan, refresh halaman dan restart backend untuk memastikan penghapusan persisten.

Log SENT lama tidak diperbaiki secara otomatis karena receipt/kode lama tidak tersedia. Tidak ada kirim ulang massal atau penghapusan log produksi selama pengerjaan paket ini.

## Batas dan rollback

Pengujian lokal memakai socket sintetis, HTTP backend lokal dan filesystem sementara. Tidak ada akun WhatsApp produksi, uji perangkat nyata, deploy Vercel/VM, atau pengiriman ke nomor pengguna. Paket memperbaiki kehilangan informasi error; tidak menjamin semua masalah delivery eksternal selesai.

Jika perlu rollback, hentikan proses, pulihkan source dan dist versi sebelumnya, gunakan backup DATA_DIR yang sesuai, lalu mulai satu proses. Memulihkan backup dengan antrean dapat menghidupkan kembali pekerjaan; periksa antrean sebelum menyambungkan WhatsApp. Pertahankan data terbaru jika tidak perlu memulihkan backup.
