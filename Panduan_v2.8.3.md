# Panduan Upgrade REEV WA Gateway v2.8.3

Khusus VM yang sudah berjalan: `root@103.253.244.29`, service `reev-wa-gateway`, aplikasi aktif `/root/reev-wa-gateway`, staging `/opt/reev-wa-gateway`. Nginx tetap HTTPS port 3000 → backend HTTP 127.0.0.1:3001.

## 1. Upload source ke GitHub

Ekstrak ZIP v2.8.3, lalu upload **isi folder aplikasi** ke root repository https://github.com/mrifqiirawan/reev-wa-gateway.git. Pastikan `package.json`, `server.ts`, `src`, dan `scripts` berada langsung di root repository. Jangan hanya mengunggah ZIP atau membuat folder versi bersarang. Jangan mengunggah `.env` atau sesi.

## 2. Masuk VM

Dari PowerShell:

```powershell
ssh root@103.253.244.29
```

## 3. Ambil source dan build

Pada terminal SSH, salin satu blok utuh:

```bash
cd /opt/reev-wa-gateway &&
git pull --ff-only &&
test "$(node -p "require('./package.json').version")" = "2.8.3" &&
npm ci --no-audit --no-fund &&
npm run lint &&
npm run build
```

Hanya lanjut jika seluruh rangkaian berhasil. Jika Git menolak perubahan lokal/branch, baca pesan error; jangan menghapus perubahan dengan `git reset --hard`. Peringatan deprecated tidak sama dengan kegagalan build.

## 4. Jalankan upgrade

Skrip sudah disertakan, tidak perlu membuat skrip panjang lewat salin-tempel lagi. Pastikan `rsync` tersedia dan disk cukup untuk backup penuh aplikasi aktif:

```bash
command -v rsync || apt-get install -y rsync
df -h /root
du -sh /root/reev-wa-gateway
```

Kemudian:

```bash
cd /opt/reev-wa-gateway &&
bash -n scripts/upgrade-vm-v2.8.3.sh &&
bash scripts/upgrade-vm-v2.8.3.sh
```

Tunggu sampai tampil `UPGRADE BACKEND BERHASIL: v2.8.3`. Simpan lokasi backup yang ditampilkan.

Skrip mempertahankan `.env*`, `sessions`, konfigurasi service, dan Nginx. Source serta hasil build disalin dari `/opt` ke `/root`; dependency diperbarui. Tidak menjalankan `setup-vm.sh`, tidak mengubah port, tidak memerlukan login WhatsApp ulang jika sesi masih valid.

Gateway berhenti sementara selama backup dan pembaruan. Backup penuh disimpan ke `/root/reev-backups/v283-.../application.tar.gz` setelah service berhenti. Jika error tertangkap, skrip mencoba memulihkan backup dan memulai aplikasi lama. Jangan tutup terminal selama proses. Gangguan VM, disk penuh, atau terminal terputus tetap perlu pemeriksaan manual.

## 5. Periksa versi aktif

```bash
curl -fsS http://127.0.0.1:3001/api/health
systemctl status reev-wa-gateway --no-pager
```

Health harus memuat `"success":true` dan `"version":"2.8.3"`. Buka https://103.253.244.29:3000/ dan tekan **Ctrl + F5**. Periksa koneksi perangkat WhatsApp.

## 6. Aktifkan template baru (wajib untuk konfigurasi lama)

Upgrade tidak menimpa template yang sudah disimpan, termasuk `.infoprofil` yang sudah Anda sukai.

1. Buka **Menu, Paket & Point → Menu & fungsi**.
2. Buka `.infotugas`, klik **Gunakan contoh menarik**. Periksa pratinjau.
3. Ulangi untuk `.infonilai`, `.infobintang`, `.infohati`, dan `.infoabsen`.
4. Buka `.bantuan`, klik **Gunakan contoh bantuan menarik**. Sesuaikan nama perintah dengan fungsi yang aktif.
5. Klik **Simpan** di bagian atas. Tunggu pesan bahwa pengaturan tersimpan.
6. Kirim pesan baru untuk setiap perintah melalui nomor siswa yang sudah tertaut.

Jangan ubah `Jalankan fungsi` menjadi `Balasan teks` untuk data siswa. `.bantuan` memang menggunakan `Balasan teks` dan dapat diedit bebas. Nama perintah yang sudah dikustom tetap dipertahankan; contoh bantuan perlu disesuaikan bila nama perintah berbeda.

| Perintah | Jalankan fungsi | Variabel khusus |
|---|---|---|
| `.infotugas` | Tugas belum selesai | `{daftar_tugas}`, `{jumlah_tampil}`, `{catatan}`, `{motivasi}` |
| `.infonilai` | Nilai siswa | `{daftar_nilai}`, `{jumlah_tampil}`, `{catatan}`, `{motivasi}` |
| `.infobintang` | Bintang | `{bintang}`, `{riwayat_bintang}`, `{catatan}`, `{motivasi}` |
| `.infohati` | Hati & pelanggaran | `{hati}`, `{pelanggaran}`, `{daftar_pelanggaran}`, `{catatan}`, `{motivasi}` |
| `.infoabsen` | Kehadiran | `{hadir}`, `{sakit}`, `{izin}`, `{alpa}`, `{total_pertemuan}`, `{kehadiran}`, `{rekap_absen}`, `{catatan}`, `{motivasi}` |
| `.bantuan` | Balasan teks | Teks biasa, tanpa variabel siswa |

Semua fungsi data di atas juga mendukung `{nama}`, `{kelas}`, `{nisn}`, dan `{pesan_asli}`. Tetap cantumkan variabel daftar dan `{catatan}` supaya rincian serta batas data jelas. Variabel daftar berisi kartu informasi yang sudah diformat. Editor mengatur teks di sekelilingnya; format setiap kartu ditentukan Gateway.

Contoh tugas:

```text
🌸 *HAI, {nama}!*
🏫 Kelas {kelas}

📝 *TUGAS BELUM SELESAI*
📋 Ditampilkan: *{jumlah_tampil} tugas*

{daftar_tugas}

ℹ️ {catatan}
💪 {motivasi}

🤖 _Reev Belajar - Informatika_ 💖
```

Data berasal dari semester aktif. Tugas/nilai dibatasi 20 item; bintang/pelanggaran 10 riwayat terbaru sesuai sumber. `{jumlah_tampil}` bukan jumlah keseluruhan. Nilai kosong ditulis Belum tersedia. Persentase absensi dihitung dari Hadir dibagi total Hadir+Sakit+Izin+Alpa yang tercatat; jika belum ada catatan, ditulis Belum tersedia.

Pesan error, akses belum tertaut, atau format sumber yang tidak dikenali tetap menggunakan pesan asli. Rincian panjang tidak dipotong oleh formatter; jika hasil melebihi batas formatter, pesan asli dipertahankan. Pendaftaran dan konfirmasi YA/BATAL tetap mengikuti alur sebelumnya.

## 7. Supabase dan kecepatan

**Tidak ada SQL baru** yang perlu dijalankan pada Supabase REEV Belajar maupun Gateway untuk upgrade dari v2.8.2 ini. Source REEV Belajar tidak diubah. Jangan menjalankan ulang migrasi lama hanya untuk upgrade template.

Pengaturan koneksi dan mode `supabase_rpc` yang sudah bekerja tetap dipertahankan. Formatter bekerja lokal setelah hasil fungsi diterima dan tidak menambah permintaan database, webhook, ataupun layanan AI. Waktu respons nyata tetap bergantung pada database, antrean, jaringan, dan WhatsApp; rilis ini tidak menjanjikan angka latensi produksi.

## 8. Jika pesan masih lama atau upgrade gagal

Jika health masih versi lama, `/opt` mungkin baru dibangun tetapi belum disalin ke aplikasi aktif. Jalankan tahap upgrade setelah build berhasil. Jika health sudah 2.8.3 tetapi pesan masih menggunakan pembungkus `{pesan_asli}`, lakukan tahap aktivasi template dan Simpan. Uji dengan pesan baru, bukan pesan yang sudah pernah diproses.

```bash
journalctl -u reev-wa-gateway -n 60 --no-pager
grep -n 'renderReply(f.action' /root/reev-wa-gateway/src/server/bot-engine.ts
curl -fsS http://127.0.0.1:3001/api/health
```

Sensor data pribadi dan secret sebelum membagikan log. Untuk kegagalan skrip, catat nomor baris dan lokasi backup. Jangan menghapus sessions atau menjalankan setup instalasi baru.

## 9. Pemulihan manual

Hanya jika pemulihan otomatis belum berhasil. Pilih backup percobaan yang sesuai:

```bash
ls -ld /root/reev-backups/v283-*
```

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

Pemulihan mengekstrak snapshot lengkap termasuk dependency dan sesi. File baru di luar arsip dapat tetap ada. State lokal kembali ke waktu backup; bila sudah ada aktivitas baru, tinjau sebelum restore. Backup memuat rahasia dan tidak boleh diunggah ke GitHub.

## 10. Batas verifikasi

Typecheck, build, tes formatter/engine/editor, dan sintaks skrip diuji lokal. Skrip belum dieksekusi pada VM pengguna. Penerimaan WhatsApp nyata perlu diuji setelah upgrade dan aktivasi template.
