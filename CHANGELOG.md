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
