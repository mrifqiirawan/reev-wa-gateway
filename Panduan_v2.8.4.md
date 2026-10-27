# Panduan Upgrade REEV WA Gateway v2.8.4

Versi ini menambahkan balasan grup, pengaturan nomor admin guru, akses data berdasarkan NISN khusus admin, serta pencatatan bintang/pelanggaran. Source web REEV Belajar tidak perlu diunggah ulang. **Ada dua SQL tambahan**, masing-masing untuk project yang berbeda. Ikuti urutannya di bawah agar bot lama tetap berjalan selama persiapan.

## 1. Siapkan source dan backup database

Ekstrak ZIP v2.8.4. Upload **isi folder aplikasi** ke root repository https://github.com/mrifqiirawan/reev-wa-gateway.git. File `package.json`, `server.ts`, `src`, `sql`, `scripts`, dan `supabase` harus langsung berada pada root repository. Jangan upload `.env`, sesi WhatsApp, atau hanya file ZIP.

Simpan backup database yang tersedia di Supabase sebelum menjalankan SQL tambahan. Backup VM pada skrip upgrade tidak mencakup database Supabase.

Instalasi VM yang dipakai tetap:

| Komponen | Lokasi |
|---|---|
| SSH | `root@103.253.244.29` |
| Staging GitHub | `/opt/reev-wa-gateway` |
| Aplikasi aktif | `/root/reev-wa-gateway` |
| Service | `reev-wa-gateway` |
| Runtime service | `/usr/bin/node` |
| Sesi/config privat | `/root/reev-wa-gateway/sessions` dan `.env` |
| Dashboard Nginx | `https://103.253.244.29:3000/` |
| Backend | `http://127.0.0.1:3001` |

## 2. Jalankan SQL di Supabase REEV BELAJAR terlebih dahulu

Project Belajar yang sebelumnya digunakan: `https://ccrbbfpmlmifetfavndy.supabase.co`.

Buka **SQL Editor → New query**, salin seluruh isi file berikut, lalu Run:

```text
sql/BELAJAR_upgrade_v2.8.4.sql
```

SQL menambah tabel audit event admin dan dua RPC khusus server. Daftar nomor memakai `teacher_whatsapp_allowlist` yang sudah ada. Tidak menghapus siswa, nilai, sesi, atau migrasi lama. SQL dapat dijalankan ulang. Jika pemeriksaan prasyarat gagal, hentikan dan tinjau error; jangan menjalankan skema fresh-install pada database aktif.

Pengujian lokal memakai skema REEV Belajar v1.5.0. Fungsi integrasi dasarnya juga tersedia di v1.3.0. Untuk database yang sudah dimodifikasi di luar paket tersebut, tinjau kecocokan skemanya sebelum memakai SQL.

**Jangan jalankan isi `tests/fixtures` di produksi.** Itu hanya schema untuk pengujian lokal.

## 3. Ambil source dan build pada VM

Dari Windows PowerShell:

```powershell
ssh root@103.253.244.29
```

Pada terminal SSH:

```bash
cd /opt/reev-wa-gateway &&
git pull --ff-only &&
test "$(node -p "require('./package.json').version")" = "2.8.4" &&
npm ci --no-audit --no-fund &&
npm run lint &&
npm run build
```

Lanjut hanya jika semuanya berhasil. Jika Git menolak perubahan lokal, periksa pesannya; jangan langsung memakai `git reset --hard`.

## 4. Jalankan skrip upgrade sederhana

Pastikan rsync dan ruang backup tersedia:

```bash
command -v rsync || apt-get install -y rsync
df -h /root
du -sh /root/reev-wa-gateway
```

Jalankan:

```bash
cd /opt/reev-wa-gateway &&
bash -n scripts/upgrade-vm-v2.8.4.sh &&
bash scripts/upgrade-vm-v2.8.4.sh
```

Tunggu `UPGRADE BACKEND BERHASIL: v2.8.4`. Skrip menghentikan service sementara, mencadangkan aplikasi aktif lengkap, menyalin source/build/dependency, kemudian memeriksa health port 3001. `.env*`, `sessions`, service, dan Nginx tetap dipertahankan. Jangan menjalankan `setup-vm.sh` untuk upgrade ini.

```bash
curl -fsS http://127.0.0.1:3001/api/health
systemctl status reev-wa-gateway --no-pager
```

Health harus memuat `"version":"2.8.4"` dan `"success":true`. Buka dashboard lalu tekan **Ctrl + F5**.

## 5. Setelah backend v2.8.4 aktif, jalankan SQL di Supabase GATEWAY

Gunakan project yang sama dengan `BOT_SUPABASE_URL`, bukan otomatis project Belajar. Buka SQL Editor, lalu jalankan seluruh isi:

```text
supabase/migrations/002_admin_commands.sql
```

SQL menambahkan kategori Admin guru serta `.bintang` dan `.pelanggaran` tanpa menimpa template lama. Aman dijalankan ulang. Jangan jalankan ulang `001_bot_platform.sql`.

Jalankan tahap ini **setelah aplikasi v2.8.4 aktif**, karena v2.8.3 belum mengenali jenis fungsi admin baru. Jika nama perintah/ID sudah ada, SQL mempertahankannya. Periksa pada Menu & fungsi bahwa:

| Perintah | Jalankan fungsi |
|---|---|
| `.bintang` | Admin: tambah bintang |
| `.pelanggaran` | Admin: catat pelanggaran |

Jika ada konflik dengan fungsi custom lama, sesuaikan lewat editor lalu Simpan. Biaya bawaan dua perintah perubahan adalah 0 point. Fungsi informasi tetap mengikuti biaya/paket yang sudah diatur; nomor admin masih tunduk pada blokir, batas permintaan, dan kuota Gateway. Sesuaikan paket/point admin melalui tab Anggota bila diperlukan.

## 6. Isi koneksi dan aktifkan grup

Buka **Environment Variables**. Untuk fitur admin, isi:

| Variabel | Nilai |
|---|---|
| `BELAJAR_SUPABASE_URL` | `https://ccrbbfpmlmifetfavndy.supabase.co` |
| `BELAJAR_SUPABASE_SERVICE_ROLE_KEY` | Service role key project Belajar, hanya di dashboard server |
| `BOT_GROUP_ENABLED` | `true` |

RPC admin selalu memakai koneksi Supabase Belajar langsung. Jadi dua variabel Belajar tersebut tetap wajib untuk admin meskipun fungsi siswa masih memakai mode webhook. Pertahankan mode `BELAJAR_TRANSPORT=supabase_rpc` jika sebelumnya sudah digunakan. Tidak perlu mengganti key Gateway atau melakukan deploy ulang web Belajar.

Klik **Simpan konfigurasi**. Pengaturan berlaku pada pesan baru tanpa restart. Grup default nonaktif sampai `BOT_GROUP_ENABLED=true`. Tambahkan nomor bot ke grup dan pastikan bot diizinkan mengirim pesan. Jika grup hanya mengizinkan admin grup mengirim pesan, bot perlu izin tersebut.

Balasan data di grup terlihat oleh seluruh anggota grup. Aktifkan fitur pada penggunaan grup sekolah yang memang Anda kelola. Bot hanya memproses perintah baru, tidak membalas percakapan umum atau riwayat grup. Auto-responder lama dan webhook umum tidak memproses pesan grup.

## 7. Daftarkan nomor admin guru melalui website Gateway

1. Buka **Menu, Paket & Point → Admin guru**.
2. Isi nomor WhatsApp guru, misalnya format `628...`, `+628...`, atau `08...`.
3. Pilih **akun guru aktif REEV Belajar** yang sesuai.
4. Centang **Aktif sebagai admin bot** lalu klik **Simpan nomor admin**.
5. Untuk mencabut akses, klik **Ubah / nonaktifkan**, lepas centang aktif, lalu Simpan.

Akun siswa tidak dapat dipilih sebagai admin guru. Akun guru harus sudah tersedia di REEV Belajar. Guru tidak perlu menautkan nomor sebagai siswa dengan `.infodaftar`. Nama WhatsApp, status admin grup, atau NISN yang diketik tidak memberikan hak admin.

Pencabutan nomor atau penonaktifan akun guru berlaku pada permintaan baru, termasuk permintaan yang pernah berhasil. Perubahan daftar nomor tercatat dengan sumber Gateway dashboard. Transaksi bintang/pelanggaran mencatat akun guru yang dipilih. Daftar ini juga digunakan integrasi WhatsApp guru lama jika masih aktif.

## 8. Cara memakai perintah

### Siswa

Daftar melalui **chat pribadi bot**:

```text
.infodaftar 0012345678
```

Lanjutkan `YA` sesuai petunjuk. Pendaftaran di grup hanya mendapat arahan ke chat pribadi. `YA`/`BATAL` di grup tidak menautkan akun dan tidak membatalkan konfirmasi pribadi.

Siswa yang telah tertaut dapat mengirim `.infoprofil`, `.infotugas`, `.infonilai`, `.infobintang`, `.infohati`, atau `.infoabsen` di pribadi maupun grup, **tanpa NISN**. Hasilnya hanya data siswa pemilik nomor tersebut. Siswa yang menambahkan NISN mendapat penolakan akses admin.

### Admin guru

Bisa di chat pribadi maupun grup. Selalu tambahkan NISN target:

```text
.infoprofil 0012345678
.infotugas 0012345678
.infonilai 0012345678
.infobintang 0012345678
.infohati 0012345678
.infoabsen 0012345678
```

Template custom yang sudah disimpan tetap digunakan. Identitas serta isi balasan berasal dari NISN target, bukan dari akun guru. Siswa target harus aktif; target tidak wajib sudah menautkan WhatsApp untuk pencarian admin. Tanpa NISN, perintah info tetap mengikuti jalur data pribadi siswa.

Tambah bintang:

```text
.bintang 0012345678#2#Aktif membantu teman saat praktik
```

Catat pelanggaran:

```text
.pelanggaran 0012345678#Belum menyelesaikan tugas#Selesaikan tugas dan laporkan kepada guru
```

Dua perintah tersebut **langsung menyimpan perubahan saat berhasil**, tanpa balasan konfirmasi tambahan. Pisahkan tepat tiga bagian dengan `#`. Jangan masukkan `#` di alasan atau tebusan. Jumlah bintang harus bilangan bulat positif dan mengikuti maksimum pengaturan sekolah. Alasan/tebusan masing-masing maksimal 500 karakter. NISN tetap berupa teks agar nol di depan tidak hilang.

Pelanggaran mendapat kode otomatis `WA-...`, status Perlu ditebus, menyimpan tebusan, dan membuat transaksi pengurangan 1 hati sesuai aturan Belajar. Saldo tampilan tetap mengikuti batas minimum sekolah. Hati awal harus sudah diatur. Siswa harus berada pada semester aktif untuk kedua perubahan tersebut.

Pesan yang sama dengan ID yang sama tidak menulis transaksi dua kali. Namun mengirim pesan baru dengan isi yang sama adalah **transaksi baru**. Jika koneksi timeout atau balasan gagal terkirim, periksa riwayat di website Belajar terlebih dahulu sebelum mengirim ulang. Tidak ada retry otomatis untuk perubahan data.

`.bantuan` lama tidak ditimpa. Untuk memperbaruinya, pilih **Gunakan contoh bantuan menarik**, periksa isi, lalu Simpan.

## 9. Uji sebelum digunakan satu grup penuh

- Dengan nomor siswa, kirim `.infodaftar NISN` di grup. Hanya arahan chat pribadi yang muncul.
- Dari siswa tertaut, kirim `.infoprofil` di grup. Hasil milik siswa tersebut.
- Dari nomor non-admin, kirim `.infoprofil NISN_LAIN` dan `.bintang ...`. Akses harus ditolak.
- Dari admin terdaftar, kirim `.infoprofil NISN` di pribadi dan grup. Hasil harus sesuai target.
- Gunakan akun siswa uji yang Anda siapkan untuk menguji penambahan bintang/pelanggaran. Periksa riwayat, alasan, tebusan, dan pelaku di Belajar. Pengujian ini benar-benar menulis data.
- Nonaktifkan nomor admin lalu uji lagi. Akses harus ditolak.

Jika bot diam pada satu pengirim, identitas WhatsApp mungkin masih berupa LID yang belum memiliki pasangan nomor telepon. Bot tidak menebak nomor dari LID atau pesan kutipan. Coba kirim chat pribadi ke bot, kemudian uji kembali. Jika tetap gagal, periksa log/provider. Jangan mengubah daftar admin menjadi ID grup atau LID.

## 10. Diagnosis

```bash
journalctl -u reev-wa-gateway -n 60 --no-pager
curl -fsS http://127.0.0.1:3001/api/health
```

| Gejala | Pemeriksaan |
|---|---|
| Tab Admin guru gagal dimuat | URL/key Belajar dan SQL Belajar sudah dijalankan pada project yang benar |
| Perintah admin tidak tersedia | Jalankan SQL Gateway; cek jenis fungsi, kategori dan status aktif |
| Admin masih ditolak | Nomor aktual pengirim, status nomor, akun guru aktif, dan project Belajar yang dipakai |
| Point tidak cukup | Atur paket/point guru pada tab Anggota; hak guru tidak menghapus kuota Gateway |
| Grup diam | BOT_GROUP_ENABLED=true, bot anggota grup, izin kirim, pesan baru, identitas pengirim terpetakan |
| Bintang ditolak | Bilangan positif, maksimum sekolah, siswa dan semester aktif |
| Pelanggaran ditolak | Hati awal diatur, alasan dan tebusan lengkap, siswa berada pada semester aktif |
| Timeout admin | Hasil belum pasti; periksa riwayat Belajar sebelum mengulang |

Jangan mengirim secret atau log berisi data siswa tanpa sensor.

## 11. Pemulihan ke v2.8.3

Skrip mencoba memulihkan snapshot aplikasi jika upgrade gagal. Gangguan disk/VM/terminal tetap memerlukan pemeriksaan operator. Simpan lokasi backup `/root/reev-backups/v284-...` yang ditampilkan.

Jika SQL Gateway tahap 5 sudah dijalankan dan Anda kembali ke source v2.8.3, jalankan **`sql/GATEWAY_rollback_v2.8.4.sql` pada database Gateway** agar konfigurasi tidak lagi mengandung jenis fungsi admin yang tidak dikenal oleh v2.8.3. SQL rollback mempertahankan template/info lain dan tidak membatalkan transaksi bintang/pelanggaran.

Jika perlu memulihkan aplikasi secara manual:

```bash
bash <<'REEV_RECOVER'
set -euo pipefail
read -r -p 'Path lengkap application.tar.gz: ' REEV_ARCHIVE </dev/tty
test -f "$REEV_ARCHIVE"
tar -tzf "$REEV_ARCHIVE" >/dev/null
systemctl stop reev-wa-gateway
if tar -xzf "$REEV_ARCHIVE" -C /root; then
  systemctl start reev-wa-gateway
  systemctl status reev-wa-gateway --no-pager
else
  echo 'Ekstraksi gagal. Service tetap dihentikan; periksa arsip dan disk.'
  exit 1
fi
REEV_RECOVER
```

Ekstraksi mengembalikan file dan state lokal ke waktu backup; file baru yang tidak ada dalam arsip dapat tetap ada. SQL tambahan Belajar boleh tetap tersedia karena fungsi baru hanya dapat dipanggil server service-role. Tidak perlu menghapus tabel audit atau menjalankan ulang migrasi lama. Koreksi transaksi siswa dilakukan lewat alur pembatalan/pemulihan Belajar, bukan dengan menghapus database.

## 12. Batas verifikasi

Build, TypeScript, tes DOM, simulator transport Baileys, dan SQL PostgreSQL embedded/PGlite diuji lokal. Ini belum membuktikan pengiriman grup WhatsApp nyata atau migrasi di Supabase hosted pengguna. Skema acuan Belajar v1.5.0 diperiksa; source web Belajar tidak diubah. Jalankan uji operasional setelah memasang versi ini.
