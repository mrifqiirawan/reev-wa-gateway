# Template balasan v2.8.2

Buka Menu, Paket & Point → Menu & fungsi → buka perintah .infoprofil. Pada Template balasan klik Gunakan contoh menarik, sesuaikan teks, lalu Simpan. Pratinjau memakai siswa sintetis, bukan data produksi. Perubahan disimpan pada kolom text fungsi dalam JSON gw_config yang sudah ada. Tidak ada migrasi SQL baru dan tidak perlu mengubah REEV BELAJAR.

Variabel profil: {nama}, {kelas}, {nisn}, {formatif}, {sumatif}, {dinilai}, {tugas_belum}, {bintang}, {hati}, {pelanggaran}, {kehadiran}, {motivasi}, {pesan_asli}. Nilai desimal menggunakan koma; data kosong tampil Belum tersedia. Motivasi menyesuaikan jumlah tugas yang belum selesai. Gunakan *teks* untuk tebal dan _teks_ untuk miring dalam WhatsApp. Pratinjau menampilkan penanda format sebagai teks.

Untuk tugas, nilai, bintang, hati, kehadiran dan pendaftaran, template memakai {pesan_asli} yang wajib dipertahankan. Tambahkan judul, emoji, pembuka dan penutup sesuai kebutuhan. Variabel rincian terpisah pada fungsi-fungsi tersebut belum tersedia. Pesan YA/BATAL sistem dan pesan error tetap berasal dari sistem. Template kosong memakai pesan asli. Pilihan fungsi menentukan pengambilan data; editor template tidak menjalankan kode JavaScript atau SQL bebas.

Profil berasal dari format teks REEV BELAJAR v1.3.0. Gateway mengekstrak field hanya jika seluruh pola yang dibutuhkan sesuai. Jika format berbeda, bot mengirim pesan asli. Template tidak menyimpan jawaban antar siswa dan tidak menambah permintaan jaringan.

## Upgrade VM yang sudah berjalan

Unggah isi paket ini ke root GitHub repository yang sama. Backup aplikasi aktif dan sessions sebelum mengganti source. Di staging VM jalankan:

```bash
cd /opt/reev-wa-gateway
git pull --ff-only
npm ci --no-audit --no-fund
npm run lint
npm run build
node -p "require('./package.json').version"
```

Versi harus 2.8.2. Gunakan prosedur backup dan penyalinan dari percakapan sebelumnya: aplikasi aktif /root/reev-wa-gateway, sesi ./sessions, Node pada 127.0.0.1:3001, Nginx HTTPS port 3000. Pada script upgrade sebelumnya ganti KEDUA pemeriksaan versi 2.8.1 menjadi 2.8.2 (package.json dan health). Pertahankan .env dan sessions. Jangan menjalankan setup-vm.sh untuk instalasi yang sudah aktif. Sesudah upgrade restart systemd reev-wa-gateway dan muat ulang browser Ctrl+F5.

Pengaturan template baru tidak otomatis mengganti teks yang sudah Anda simpan: pilih contoh lalu Simpan pada setiap fungsi yang ingin diubah. Mode Supabase langsung, pengaturan point, dan optimasi antrean dari revisi sebelumnya tetap tersedia.
