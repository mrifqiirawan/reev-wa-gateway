# v2.7.2 — Inbox LID dan receipt pengiriman

- Terima personal chat PN dan LID; gunakan remoteJidAlt/mapping bila tersedia. LID tanpa nomor tetap dicatat dan balasan diarahkan ke JID asli.
- Normalisasi pesan ephemeral/view-once, caption, dan penanda media. Grup/status/control tidak dimasukkan.
- Catat append tanpa balasan otomatis; deduplikasi tersimpan berdasarkan remoteJid + ID pesan.
- Simpan ID pesan sebelum transport berjalan agar receipt cepat tidak hilang; berlaku pada single send, OTP, auto-reply, bulk.
- Terima messages.update dan message-receipt.update; status monoton, tidak turun dari READ/DELIVERED ke SENT.
- getMessage mengambil isi log tersimpan untuk permintaan retry protokol Baileys, bukan retry massal pesan SENT.
- Penjelasan status/latensi pada riwayat, identitas LID pada inbox, waktu inbox Asia/Makassar.
- Lockfile diregenerasi karena jiti 2.7.1 mengembalikan 404. Perubahan transitive: jiti 2.7.0; electron-to-chromium 1.5.453; p-queue 9.3.5; postcss 8.5.30; strtok3 10.4.1. Dependensi langsung tetap pada versi resolusi semula, Baileys 7.0.0-rc14.
- Tidak ada migrasi/reset sesi atau perubahan akun/API key. Pesan historis yang tidak pernah dicatat tidak dijamin dapat dipulihkan.

# v2.7.1 — Perbaikan sesi WhatsApp dan JSON

- POST/DELETE tanpa parameter kini mengirim body JSON `{}`.
- Sesi revoked/badSession ditandai persisten dan dibersihkan saat pengguna meminta QR baru.
- Reconnect biasa mempertahankan kredensial yang masih valid.
- Penulisan kredensial dituntaskan sebelum sesi dimuat ulang/dihapus.
- Tambahan regresi API client → proxy → backend dan siklus sesi Baileys.

# v2.7.0

- API key server persisten, tampil/salin admin, rotasi dengan password; key env tetap didukung.
- Fallback clipboard HTTP dan origin cURL aktual.
- Webhook simpan persisten, POST HTTPS nyata, raw-body HMAC, timeout, DNS private-address guard, status/error aktual.
- GAS SDK tunggal untuk unduhan dan tampilan; Script Properties, normalisasi nomor, event.range, trigger khusus Form, hasil tidak pasti tanpa retry buta.
- SDK Node server-side; hilangkan link Flutter unduhan yang sebelumnya 404 dan contoh penanaman key di aplikasi mobile.
- Pengiriman offline gagal jujur; status sent berbeda delivered/read; receipt Baileys mengubah status.
- Broadcast antrean nyata, retry nyata, simulator tidak menambah log pengiriman palsu; statistik waktu dari log sebenarnya.
- State tersimpan atomik di DATA_DIR/gateway_state.json.
- Contoh env standalone dan panduan upgrade/rollback.

Lihat TEST_RESULTS.md untuk ruang lingkup verifikasi dan batas deployment.
