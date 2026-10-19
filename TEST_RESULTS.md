# Hasil uji REEV WA Gateway v2.8.0

Tanggal: 19 Oktober 2026. Runtime lokal Node 24.19.0. Seluruh data tes sintetis.

| Pemeriksaan | Status | Bukti / lingkup |
|---|---|---|
| `npm run lint` | PASS | TypeScript 5.9.3, seluruh source dan tests |
| `npm test` | PASS | 45 tes, 0 gagal |
| `npm run build` | PASS | Vite 8.3.4; output produksi berhasil |
| Login/cookie/proxy/API pengiriman lama | PASS | Regresi tests v2.7.x tetap berjalan |
| API bot hanya admin, integrasi bearer ditolak, CSRF/logout | PASS | tests/bot-api.test.ts |
| Konfigurasi, perintah sistem, pratinjau, kategori berhalaman | PASS | tests/bot-platform.test.ts |
| Paket minimum, expiry dan blokir | PASS | SQL dieksekusi pada PGlite |
| Reset 01:59:59 → 02:00 Asia/Makassar | PASS | Timestamp eksplisit pada gw_period |
| Reservasi, permintaan bersamaan, dedupe, refund, recovery | PASS | RPC SQL dan Promise.all; PGlite memakai antrean satu koneksi, bukan stress test multi-koneksi PostgreSQL hosted |
| UNKNOWN dan rekonsiliasi/audit satu kali | PASS | tests/bot-platform.test.ts |
| RLS/grants anon dan authenticated | PASS | SQL memakai role nyata pada PostgreSQL embedded |
| Form editor, perubahan point, save/pratinjau dan anggota | PASS | React Testing Library + Happy DOM, request backend disimulasikan |
| Payload menu dan pembacaan ID pilihan | PASS | Builder/parser dan Baileys socket mock; bukan pengiriman WhatsApp nyata |
| Pemeriksaan struktur dan pola secret terpilih | PASS | scripts/release.py audit; bukan sertifikasi keamanan |
| Visual browser desktop/mobile | NOT_RUN | Unduhan browser gagal pada lingkungan eksekusi; tes DOM tidak membuktikan layout visual |
| Supabase hosted, Vercel/Nginx dan server pengguna | NOT_RUN | Tidak memakai kredensial/akses produksi |
| WhatsApp nyata, tombol kategori, penerimaan/read receipt nyata | NOT_RUN | Membutuhkan sesi/perangkat WhatsApp pengguna |
| Payment gateway / perpanjangan otomatis | NOT_APPLICABLE | Aktivasi dan pembayaran manual sesuai konsep |

## Catatan

Kegagalan unduhan browser tidak disamarkan sebagai tes visual. Build dan tes DOM memeriksa kode serta interaksi formulir, bukan tampilan pada perangkat nyata. Sebelum membuka layanan, lakukan checklist pemasangan pada panduan upgrade. Test logs lengkap terdapat pada folder bukti paket gabungan.

## Verifikasi setelah pemasangan

1. Login admin, simpan konfigurasi, logout; pastikan API admin menolak sesi lama.
2. Kirim .menu, buka kategori, .point, dan .paket. Uji mode teks sebelum tombol.
3. Daftar NISN dari nomor salah harus ditolak tanpa menampilkan nama siswa. Dari nomor terverifikasi, preview belum membuat tautan; YA membuat satu tautan dan tampak setelah Segarkan di Belajar.
4. Jalankan fungsi berbiaya; periksa point, penolakan tier, expiry, kegagalan/refund dan pesan duplikat pada lingkungan uji.
5. Uji tombol daftar pada akun/perangkat tujuan. Bila tidak dirender, gunakan mode teks.
6. Pastikan perintah siswa legacy tidak melewati point ketika secret integrasi custom aktif.
