# Laporan pengujian v2.8.4

Tanggal 27 Oktober 2026. Node v24.22.1. Hanya fixture sintetis dan simulator lokal.

| Area | Status | Bukti |
|---|---|---|
| Install lockfile | PASS | npm ci --no-audit --no-fund, 313 paket |
| TypeScript | PASS | npm run lint |
| Build | PASS | npm run build |
| Seluruh tes | PASS | npm test: 81 lulus, 0 gagal |
| Grup | PASS lokal | PN, participantAlt, pemetaan LID, identitas pengirim bukan grup/kutipan, history/fromMe/percakapan biasa diabaikan, kirim ke JID grup, broadcast ditolak |
| Jalur perintah | PASS lokal | Pendaftaran/konfirmasi tetap privat, siswa data sendiri, NISN target lewat RPC admin, balasan memakai template, grup nonaktif tidak mengirim |
| Admin database | PASS PGlite | Skema acuan Belajar v1.5.0: peran anon/authenticated ditolak; nomor tanpa izin ditolak; enam pencarian target; audit guru; maksimum bintang; semester aktif; alasan/tebusan; pengurangan hati; pengulangan ID tidak menulis dua kali; pencabutan guru/nomor memblokir hasil cache |
| Upgrade SQL | PASS PGlite | Dua SQL tambahan dijalankan ulang tanpa menggandakan perintah; template lama tetap utuh; SQL rollback action admin diuji ulang |
| Admin API | PASS lokal | Endpoint baru menolak tanpa cookie admin dan menolak integration key; cross-site PUT 403; input tidak valid 400 |
| Admin editor | PASS DOM | Pilih guru, simpan nomor, nonaktifkan, feedback simpan; transport API disimulasikan |
| Skrip upgrade/panduan | PASS sintaks | bash -n; belum dijalankan di VM |
| WhatsApp nyata / Supabase hosted / VM pengguna | NOT_RUN | Memerlukan pemasangan dan uji operator |
| Browser visual/mobile | NOT_RUN | DOM test bukan verifikasi visual perangkat |

Source dasar v2.8.3 berasal dari ZIP pengguna. Source REEV Belajar v1.5.0 dibaca untuk memeriksa kompatibilitas, tidak diubah. Migrasi dasar 001–006 sama dengan v1.3.0; pengujian akhir juga memuat 007–009 v1.5.0, termasuk definisi mutate yang diperbarui.

Kontrak identitas Baileys diperiksa pada source/types dependency terkunci dan dokumentasi resmi: https://github.com/WhiskeySockets/docs/blob/main/migration/v7.mdx (participantAlt untuk grup dan getPNForLID). Bila pemetaan nomor tidak tersedia, perintah grup tidak diproses.

Mutasi admin tidak memakai retry otomatis. Idempotensi berdasarkan event pesan dalam transaksi database; mengirim pesan baru dengan isi sama adalah event baru. Timeout jaringan tidak membuktikan mutasi gagal. PGlite tidak membuktikan perilaku transaksi lintas beberapa koneksi Supabase produksi; advisory lock dan transaksi tetap digunakan pada server database.

Hak admin berasal dari daftar nomor dan profil guru aktif di Belajar, bukan badge admin grup. Daftar guru berlaku global sesuai peran teacher di schema yang ada. Biaya/kuota/paket Gateway dan status blokir tetap berlaku. Belum ada benchmark latensi produksi pada rilis ini.
