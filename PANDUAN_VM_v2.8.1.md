> Revisi performa v2.8.1: baca [docs/OPTIMASI_RESPONS_v2.8.1.md](docs/OPTIMASI_RESPONS_v2.8.1.md) untuk mode Supabase langsung, antrean paralel, dan pengukuran respons. Bagian konfigurasi webhook di bawah berlaku bila mode webhook aktif.

# REEV WA Gateway 2.8.1: pemasangan dan perbaikan .infodaftar

## Temuan dan batas perbaikan

Versi 2.8.0 membatasi deliverWebhook selama 10 detik dalam kode. Jalur .infodaftar memanggil endpoint REEV BELAJAR melalui fungsi yang sama. Pesan timeout membuktikan deadline Gateway tercapai, bukan membuktikan .env salah. Penyebab lambat di VM/Belajar belum diukur secara langsung. DNS, koneksi keluar, cold start Vercel, waktu RPC Supabase, atau gangguan server tujuan masih perlu diperiksa.

Versi 2.8.1 memakai default 30 detik, membatasi DNS dalam deadline, menyediakan pengaturan 1–60 detik, dan menampilkan kode HTTP untuk kegagalan tujuan. Menaikkan timeout tidak mempercepat database atau memperpanjang batas platform Vercel. Tidak ada retry otomatis: timeout tidak memastikan transaksi tujuan gagal. Periksa status pendaftaran sebelum mengulang.

File REEV BELAJAR tidak diubah. Kontrak payload, HMAC, dan SQL tetap sama. Menu baru Environment Variables menyimpan konfigurasi runtime di DATA_DIR/environment.json dengan izin 0600, hanya melalui sesi admin. Secret tidak dikirim balik dalam respons GET. File ini berisi secret dalam plaintext privat, bukan enkripsi at rest. Backup DATA_DIR harus diperlakukan sebagai rahasia.

## 1. Unggah source ke GitHub

Ekstrak paket, lalu unggah ISI folder aplikasi ke https://github.com/mrifqiirawan/reev-wa-gateway.git. package.json, server.ts, src, scripts, dan supabase harus berada pada root repository. Sertakan package-lock.json dan .env.example. Jangan unggah node_modules, .env, sessions atau backup VM. Panduan lama tetap tersedia sebagai referensi; untuk instalasi ini gunakan panduan 2.8.1.

## 2. Periksa VM sebelum memasang

Perintah berikut untuk Debian/Ubuntu dengan systemd. Jalankan dari terminal komputer:

```bash
ssh root@103.253.244.29
cat /etc/os-release
node --version
command -v node
systemctl status reev-wa-gateway --no-pager || true
command -v pm2 >/dev/null && pm2 list
ss -ltnp | grep ':3000' || true
```

Jangan menjalankan dua proses Gateway dengan sesi WhatsApp yang sama. Bila aplikasi lama aktif, lakukan backup dan hentikan proses lama pada bagian upgrade sebelum mengaktifkan aplikasi baru. Sistem operasi lain memerlukan penyesuaian installer; jangan menjalankan apt pada distribusi non-Debian.

## 3. Instalasi pertama pada VM

Pasang utilitas:

```bash
apt-get update
apt-get install -y ca-certificates curl git xz-utils
```

Jika Node belum tersedia/versinya tidak cocok, pasang Node 24 dari distribusi resmi. Blok berikut memeriksa checksum dan mendukung x86_64/aarch64. Tidak diperlukan bila Node 24 sudah terpasang secara global.

```bash
bash <<'SH'
set -euo pipefail
case "$(uname -m)" in
  x86_64) REEV_ARCH=x64 ;;
  aarch64) REEV_ARCH=arm64 ;;
  *) echo 'Arsitektur belum didukung panduan ini'; exit 1 ;;
esac
REEV_TMP=$(mktemp -d)
cd "$REEV_TMP"
curl -fsSLO https://nodejs.org/dist/latest-v24.x/SHASUMS256.txt
REEV_ARCHIVE=$(awk -v arch="$REEV_ARCH" '$2 ~ ("linux-" arch "\\.tar\\.xz$") {print $2}' SHASUMS256.txt)
[ -n "$REEV_ARCHIVE" ]
curl -fsSLO "https://nodejs.org/dist/latest-v24.x/$REEV_ARCHIVE"
grep " $REEV_ARCHIVE$" SHASUMS256.txt | sha256sum -c -
tar -xJf "$REEV_ARCHIVE" -C /usr/local --strip-components=1
node --version
npm --version
SH
```

Clone dan jalankan installer:

```bash
git clone https://github.com/mrifqiirawan/reev-wa-gateway.git /opt/reev-wa-gateway
cd /opt/reev-wa-gateway
bash scripts/setup-vm.sh
```

Jika GitHub meminta autentikasi, gunakan kredensial GitHub Anda pada VM. Jangan menaruh token pada URL repository atau mengirimkannya melalui chat.

Installer memasang dependency sesuai lockfile, membangun frontend, membuat pengguna service reev-wa, menghasilkan password awal, menyiapkan penyimpanan /var/lib/reev-wa-gateway, dan mengaktifkan systemd. Simpan password yang tampil. Installer menolak menimpa .env/service lama. Akun yang sudah ada dalam DATA_DIR tetap berlaku; password hasil installer tidak mengganti akun tersebut.

## 4. Buka dashboard tanpa domain melalui SSH tunnel

Pada terminal BARU di komputer Anda, biarkan koneksi ini terbuka:

```bash
ssh -N -L 3300:127.0.0.1:3000 root@103.253.244.29
```

Buka http://localhost:3300 di browser komputer. Login admin dengan password installer, kemudian ubah akun/password melalui Keamanan & Akun. Port 3000 hanya mendengarkan loopback, sehingga http://103.253.244.29:3000 memang tidak dapat dibuka dari internet. Tidak perlu membuka port 3000 di firewall. SSH tunnel cukup untuk dashboard, pairing, dan pemanggilan fungsi Belajar dari VM. Akses balasan/integrasi dari server lain ke Gateway memerlukan HTTPS publik pada bagian 9.

## 5. Isi Environment Variables di dashboard

| Variabel | Nilai dan lokasi sumber |
|---|---|
| BOT_SUPABASE_URL | Project URL Supabase yang menyimpan tabel gw_* |
| BOT_SUPABASE_SERVICE_ROLE_KEY | Service role key project tersebut, server only |
| BELAJAR_FUNCTION_URL | https://DOMAIN-BELAJAR/api/gateway-functions, bukan /api/webhook |
| BELAJAR_FUNCTION_SECRET | Minimal 32 karakter acak, sama dengan REEV_GATEWAY_FUNCTION_SECRET di Vercel Belajar |
| WEBHOOK_TIMEOUT_MS | Mulai dengan 30000; maksimum 60000 |
| BOT_DB_TIMEOUT_MS | Mulai dengan 12000; maksimum 20000 per permintaan |
| TZ | Asia/Makassar, Asia/Jakarta, atau Asia/Jayapura sesuai kebutuhan |

Secret dapat dibuat dengan pengelola password. Isi di dashboard dan Vercel, jangan masukkan ke GitHub. Klik Simpan konfigurasi lalu Periksa koneksi. Perubahan berlaku pada permintaan baru tanpa restart. Nilai dashboard mengungguli nilai .env. Kosongkan kolom biasa atau gunakan Hapus nilai untuk secret jika ingin menonaktifkan integrasi. Penghapusan menyimpan nilai kosong, bukan memulihkan nilai lama .env.

Pemeriksaan Gateway membaca gw_config dan menampilkan durasi. Pemeriksaan Belajar mengirim event tidak valid dengan HMAC yang benar: HTTP 400 membuktikan endpoint dapat dijangkau dan lolos pemeriksaan signature menurut kontrak source v1.3.0. Pemeriksaan ini tidak memanggil RPC Belajar, tidak menautkan siswa, dan tidak membuktikan database Belajar sehat.

Variabel infrastruktur tidak ditawarkan sebagai editor bebas: DATA_DIR/HOST/PORT terkait filesystem dan service; NODE_ENV terkait mode build. Installer mengaturnya. ADMIN_USERNAME/ADMIN_PASSWORD hanya bootstrap; perubahan akun dilakukan melalui Keamanan & Akun. SESSION_TTL_DAYS dan COOKIE_SECURE memerlukan restart. GATEWAY_API_KEY opsional, aplikasi dapat menghasilkan dan mengelolanya lewat fitur lama; key yang dipaksakan oleh .env tetap memerlukan perubahan server. BACKEND_URL dan BACKEND_SHARED_SECRET hanya untuk arsitektur proxy Vercel Gateway; kosongkan untuk VM standalone ini. Menu baru bukan editor environment sistem operasi tanpa batas.

## 6. Konfigurasi REEV BELAJAR, tanpa mengubah source

Di Vercel project REEV BELAJAR, Settings → Environment Variables, periksa:

| Variabel Belajar | Nilai |
|---|---|
| REEV_GATEWAY_FUNCTION_SECRET | Sama persis dengan BELAJAR_FUNCTION_SECRET Gateway |
| SUPABASE_URL | URL project database Belajar |
| SUPABASE_SERVICE_ROLE_KEY | Service role key project Belajar |

Pertahankan VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY dan konfigurasi lain yang sudah berjalan. Redeploy project setelah mengubah environment. Pastikan endpoint tidak terhalang deployment protection. Jangan melemahkan HMAC. Jika memakai integrasi webhook guru/status, pertahankan konfigurasi WEBHOOK_SECRET, GATEWAY_URL, GATEWAY_API_KEY dan GATEWAY_DEVICE_ID sesuai arsitektur yang sudah dipakai. Secret webhook lama berbeda fungsi dari secret endpoint gateway-functions.

Project database Gateway dan Belajar boleh sama. Jika berbeda, jangan tertukar antara service role key dan URL project.

## 7. SQL yang perlu dijalankan

**Tidak ada SQL migrasi baru untuk upgrade 2.8.0 ke 2.8.1.** Jalankan query baca berikut dalam SQL Editor Supabase untuk pemeriksaan:

```sql
select to_regclass('public.gw_config') as gateway_config,
       to_regprocedure('public.gw_begin(text,text,text)') as gateway_begin,
       to_regprocedure('public.reev_gateway_function(text,text,text,text)') as belajar_function;
```

Pada project Gateway, dua kolom pertama harus non-NULL. Pada project Belajar, kolom ketiga harus non-NULL. Jika project sama, ketiganya harus non-NULL.

Jika Gateway benar-benar belum memiliki object gw_*, jalankan seluruh file supabase/migrations/001_bot_platform.sql dari paket Gateway melalui SQL Editor. Jika fungsi Belajar belum ada, jalankan supabase/migrations/006_gateway_functions.sql dari paket REEV_BELAJAR_v1.3.0 setelah memastikan migrasi sebelumnya sudah terpasang. File tersebut sudah ada dalam paket Belajar; tidak dibuat ulang atau diubah dalam rilis ini. Kedua migrasi memakai CREATE TABLE/FUNCTION, sehingga jangan jalankan ulang pada instalasi yang sudah lengkap. Bila hanya sebagian object tersedia, periksa riwayat migrasi/error terlebih dahulu; jangan menghapus tabel atau data.

## 8. Uji alur WhatsApp

Periksa Perangkat & Sesi lalu sambungkan WhatsApp jika belum tersambung. Buka Menu, Paket & Point dan pastikan bot serta perintah .infodaftar aktif. Pastikan guru telah memasukkan NISN dan memverifikasi nomor siswa di Belajar sesuai aturan aplikasi.

Dari nomor siswa yang berhak, kirim:

```text
.menu
.infodaftar NISN_SISWA
YA
.infoprofil
```

Ganti NISN_SISWA dengan NISN sebenarnya, pertahankan nol di depan. Setelah .infodaftar, tunggu balasan permintaan konfirmasi sebelum mengirim YA. Hindari rule legacy yang menduplikasi perintah yang ditangani bot baru.

| Hasil | Tindakan |
|---|---|
| Timeout | Lihat durasi pemeriksaan, log VM dan function Vercel; periksa database/network. Naikkan timeout hanya bila proses normal memang memerlukan waktu lebih lama |
| HTTP 401 | Cocokkan secret, redeploy Belajar, periksa deployment protection |
| HTTP 404 | Pastikan domain production dan path /api/gateway-functions |
| HTTP 503 | Periksa environment Supabase dan migrasi Belajar serta log function |
| Database Gateway gagal | Cocokkan project URL/service key, periksa tabel/RPC serta status Supabase |
| NISN/nomor ditolak | Periksa data siswa dan verifikasi nomor di Belajar |

Log operasional:

```bash
systemctl status reev-wa-gateway --no-pager
journalctl -u reev-wa-gateway -n 100 --no-pager
curl -fsS http://127.0.0.1:3000/api/health
```

Health hanya menunjukkan server hidup, bukan bukti WA terkirim atau database sehat.

## 9. Opsional: HTTPS publik dengan domain

Gunakan domain/subdomain yang A record-nya menuju 103.253.244.29. Domain belum diberikan, sehingga contoh berikut meminta domain Anda. Jangan memakai contoh domain tanpa menggantinya. Pastikan firewall provider mengizinkan 80/443 dan SSH tetap terbuka.

```bash
apt-get install -y nginx certbot python3-certbot-nginx
read -r -p 'Domain Gateway (tanpa https://): ' REEV_DOMAIN
[[ "$REEV_DOMAIN" =~ ^[a-zA-Z0-9.-]+$ ]] || exit 1
cat > /etc/nginx/sites-available/reev-wa-gateway <<EOF
server {
  listen 80;
  server_name $REEV_DOMAIN;
  client_max_body_size 10m;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host \$host;
    proxy_set_header X-Forwarded-Proto \$scheme;
    proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
    proxy_read_timeout 100s;
  }
}
EOF
ln -sfn /etc/nginx/sites-available/reev-wa-gateway /etc/nginx/sites-enabled/reev-wa-gateway
nginx -t && systemctl reload nginx
certbot --nginx -d "$REEV_DOMAIN"
cd /opt/reev-wa-gateway
sed -i 's/^COOKIE_SECURE=.*/COOKIE_SECURE=true/' .env
systemctl restart reev-wa-gateway
```

Sesudah COOKIE_SECURE=true, gunakan https://DOMAIN untuk dashboard; sesi baru membutuhkan HTTPS. Jika Belajar memanggil API Gateway untuk webhook/guru, atur GATEWAY_URL Belajar ke URL HTTPS ini dan cocokkan API key. Tidak perlu memasang dashboard Gateway di Vercel untuk instalasi standalone ini.

## 10. Upgrade VM lama tanpa kehilangan sesi

Identifikasi dulu lokasi aplikasi, DATA_DIR aktif, serta manager proses lama. Jangan menebak lokasi sesi dari lokasi clone baru. Untuk PM2 gunakan pm2 describe reev-wa-gateway dan periksa .env lama secara privat. Untuk systemd gunakan systemctl cat reev-wa-gateway. Jangan membagikan output yang berisi secret.

Backup aplikasi dan DATA_DIR saat service lama sudah berhenti. Contoh untuk instalasi lama PM2 dengan sesi lokal; sesuaikan dua path yang diminta:

```bash
read -r -p 'Path absolut aplikasi lama: ' REEV_OLD
read -r -p 'Path absolut DATA_DIR lama: ' REEV_DATA
[ -d "$REEV_OLD" ] && [ -d "$REEV_DATA" ] || exit 1
pm2 stop reev-wa-gateway
install -d -m 700 /root/reev-backups
REEV_BACKUP="/root/reev-backups/gateway-$(date +%Y%m%d-%H%M%S).tar.gz"
tar -czf "$REEV_BACKUP" "$REEV_OLD" "$REEV_DATA"
chmod 600 "$REEV_BACKUP"
tar -tzf "$REEV_BACKUP" >/dev/null
```

Jika sebelumnya systemd, gunakan systemctl stop nama-service-lama, bukan PM2. Untuk mempertahankan PM2 dan path lama, perbarui source dari GitHub setelah backup. Pastikan tidak ada perubahan source lokal yang belum dicatat. Contoh repo yang sudah sinkron:

```bash
cd "$REEV_OLD"
git status --short
git pull --ff-only
npm ci --no-audit --no-fund
npm run build
pm2 restart reev-wa-gateway --update-env
pm2 save
```

Pertahankan .env dan DATA_DIR lama; menu baru akan menulis environment.json di DATA_DIR tersebut. Tidak perlu menjalankan setup-vm.sh untuk jalur ini. Untuk systemd yang sudah ada, ganti pm2 restart dengan systemctl restart nama-service-lama. Jika direktori lama bukan clone Git, unggah source hasil ekstraksi ke direktori baru, pasang dependencies/build, lalu arahkan manager ke direktori baru sambil mempertahankan DATA_DIR absolut dan konfigurasi lama. Jangan menghapus direktori lama sebelum uji berhasil.

Untuk instalasi systemd dari installer rilis ini, pembaruan berikutnya:

```bash
cd /opt/reev-wa-gateway
systemctl stop reev-wa-gateway
install -d -m 700 /root/reev-backups
tar -czf "/root/reev-backups/gateway-$(date +%Y%m%d-%H%M%S).tar.gz" /opt/reev-wa-gateway /var/lib/reev-wa-gateway
git pull --ff-only
npm ci --no-audit --no-fund
npm run build
systemctl restart reev-wa-gateway
```

Rollback: hentikan service, kembalikan source serta konfigurasi dari backup yang dipilih, jalankan npm ci dan build sesuai source lama, lalu hidupkan satu proses saja. Tidak ada rollback SQL untuk rilis ini karena schema tidak berubah. Jangan memulihkan data transaksi lama sembarangan setelah operasi baru berlangsung.

## Rujukan runtime

Node 24 dipilih karena cocok dengan engines aplikasi (>=22.12 <25). Dokumentasi resmi: https://nodejs.org/en/download dan https://github.com/nodejs/Release. Service menggunakan systemd Restart=on-failure: https://www.freedesktop.org/software/systemd/man/latest/systemd.service.html.
