# REEV WA Gateway v2.7.2 — Perbaikan dan panduan GitHub / Ubuntu

Target GitHub: https://github.com/mrifqiirawan/reev-wa-gateway
Target VM: `ssh root@103.253.244.29`

Source diperbaiki dan diuji lokal. Repository remote, metode deployment aktual, kredensial SSH, dan pengiriman WhatsApp nyata belum diverifikasi. Panduan utama di bawah untuk PM2 satu instance, sesuai ecosystem.config.cjs dalam paket. Jangan jalankan langkah PM2 jika aplikasi sebenarnya dikelola Docker/systemd.

## 1. Diagnosis yang dapat dipastikan dari source

| Temuan v2.7.1 | Perbaikan v2.7.2 |
|---|---|
| Inbox hanya menerima @s.whatsapp.net dan membuang @lid | Terima keduanya. Nomor diambil dari remoteJidAlt atau mapping Baileys bila tersedia; jika tidak, tampilkan ID WhatsApp, bukan nomor palsu. |
| Hanya notify, teks biasa/extended text/caption gambar | Append dicatat tanpa auto-reply; unwrap ephemeral/view-once; dukung caption video/dokumen serta penanda media tanpa caption. |
| ID transport baru dipasang setelah sendMessage selesai | ID transport dibuat dan disimpan sebelum sendMessage sehingga receipt cepat dapat dicocokkan. |
| Penyelesaian kirim selalu menulis SENT | Pertahankan DELIVERED/READ yang sudah diterima; abaikan receipt duplikat/lebih rendah. |
| Hanya mendengarkan messages.update | Tambahkan message-receipt.update dan pelepasan listener saat reconnect. |
| Tidak ada getMessage untuk lookup setelah reconnect/restart | Baileys dapat mengambil teks pesan keluar dari log yang dipersist untuk retry protokol. |

Pada contoh pengguna, nomor berakhiran **6892 sudah READ**. Nomor lain yang SENT belum memiliki receipt tercatat. Perbedaan 9–16 ms dengan 500–900 ms bukan bukti penerimaan; itu hanya durasi fungsi kirim. Pesan mungkin belum sampai, receipt mungkin belum diterima, atau sebelumnya terlewat oleh aplikasi. Jangan menyimpulkan penerima memblokir nomor berdasarkan SENT saja.

SENT tetap berarti proses sendMessage selesai, DELIVERED berarti receipt penerimaan, READ berarti receipt baca. Read receipt tidak selalu tersedia. Perbaikan tidak memaksa status lama menjadi DELIVERED dan tidak mengirim ulang semua SENT. Pesan masuk yang dahulu dibuang hanya muncul jika WhatsApp mengirimkannya kembali melalui event yang ditangani; tidak ada impor seluruh riwayat chat. Grup/status/reaction/control tidak termasuk inbox pribadi. Tidak ada pengunduhan berkas media.

Rujukan resmi:
- https://github.com/WhiskeySockets/baileys.wiki-site/blob/main/docs/migration/to-v7.0.0.md
- https://github.com/WhiskeySockets/baileys.wiki-site/blob/main/docs/socket/receiving-updates.md

## 2. Unggah pembaruan ke GitHub dari Windows PowerShell

Unduh ZIP hasil perbaikan ke Downloads. Jalankan blok berikut satu per satu. Gunakan Git yang telah terpasang; autentikasi GitHub melalui dialog Git Credential Manager saat diminta. Jangan memasukkan token/password ke URL atau ke source.

### A. Ekstrak ke folder baru dan clone repository

```powershell
$ErrorActionPreference = 'Stop'
$releaseZip = Join-Path $HOME 'Downloads\REEV_WA_Gateway_v2.7.2.zip'
$releaseDir = Join-Path $HOME ('Desktop\reev-release-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
Expand-Archive -LiteralPath $releaseZip -DestinationPath $releaseDir
$sourceDir = Join-Path $releaseDir 'REEV_WA_Gateway_v2.7.2'
$repoDir = Join-Path $releaseDir 'reev-wa-gateway-git'
git clone https://github.com/mrifqiirawan/reev-wa-gateway.git $repoDir
if ($LASTEXITCODE -ne 0) { throw 'Clone gagal. Periksa akses GitHub.' }
Set-Location $repoDir
$targetBranch = (git branch --show-current).Trim()
if (-not $targetBranch) { throw 'Branch aktif tidak ditemukan.' }
git status --short
```

Clone baru mengikuti default branch repository; tidak mengasumsikan main/master. Jika repository benar-benar kosong, Git dapat memakai branch awal lokal. Jangan menggunakan folder kerja lama yang memiliki perubahan belum disimpan.

### B. Salin source dan periksa berkas yang akan masuk Git

```powershell
robocopy $sourceDir $repoDir /E /XD node_modules dist sessions .git /XF .env .env.local .env.production
if ($LASTEXITCODE -ge 8) { throw 'Penyalinan source gagal.' }
Set-Location $repoDir
git status --short
git diff --stat
$trackedPrivate = git ls-files -- '.env' '.env.*' 'sessions/**' '*.pem' '*.key'
$trackedPrivate = $trackedPrivate | Where-Object { $_ -ne '.env.example' }
if ($trackedPrivate) { throw 'Repository sudah melacak file privat. Hentikan dan tangani sebelum push.' }
git add .gitignore .dockerignore .env.example package.json package-lock.json server.ts src tests scripts api sdk deploy Dockerfile docker-compose.yml ecosystem.config.cjs index.html metadata.json tsconfig.json vercel.json vite.config.ts README.md CHANGELOG.md TEST_RESULTS.md UPGRADE_v2.7.0.md UPGRADE_v2.7.1.md PANDUAN_UPDATE_v2.7.2.md
if ($LASTEXITCODE -ne 0) { throw 'Git add gagal.' }
git diff --cached --stat
git diff --cached --name-only
```

Pastikan daftar tidak memuat `.env`, folder sesi, database operasional, private key, backup, atau `node_modules`. `.env.example` adalah template dan boleh masuk. Jika Git mendeteksi secret yang sudah tracked, `.gitignore` tidak menghapusnya dari riwayat; tangani kebocoran/rotasi secara terpisah sebelum melanjutkan.

### C. Commit dan push

```powershell
git commit -m "fix: LID inbox and reliable receipt tracking v2.7.2"
if ($LASTEXITCODE -ne 0) { throw 'Commit gagal atau tidak ada perubahan; periksa git status.' }
git push origin $targetBranch
if ($LASTEXITCODE -ne 0) { throw 'Push gagal. Jangan force push; periksa pesan Git.' }
git rev-parse HEAD
```

Catat SHA hasil perintah terakhir untuk pembaruan VM. Jika push ditolak karena remote berubah, jalankan `git pull --rebase origin $targetBranch`, selesaikan konflik yang ditampilkan, periksa ulang diff, kemudian push. Jangan memakai `--force`. Bila branch dilindungi, buat branch `fix/wa-v2.7.2`, push branch itu, lalu ajukan/merge pull request melalui GitHub sebelum memperbarui VM dari branch utama.

## 3. Identifikasi aplikasi Ubuntu

Di PowerShell:

```powershell
ssh root@103.253.244.29
```

Setelah masuk Ubuntu, gunakan Bash:

```bash
pm2 list
pm2 describe reev-wa-gateway
node --version
npm --version
command -v git rsync tar curl
```

Catat **exec cwd** dari `pm2 describe`. Periksa bahwa hanya satu instance menggunakan sesi WhatsApp ini. Versi runtime proyek: Node >=22.12 dan <25; uji lokal menggunakan Node 24.19.0. Jangan mengganti runtime yang sudah memenuhi batas ini tanpa kebutuhan.

Jika PM2 tidak menampilkan aplikasi, hentikan langkah PM2 di sini dan lihat bagian Docker. Jangan membuat proses baru yang bersaing menggunakan sesi sama.

## 4. Perbarui VM dengan staging, backup, lalu restart

Metode ini berlaku baik folder aktif berasal dari Git clone maupun ekstraksi ZIP. Source baru diambil ke staging dari GitHub, lalu disalin ke **cwd lama** sehingga konfigurasi proses dan DATA_DIR tetap sama. Metadata `.git` folder aktif tidak diubah; pembaruan berikutnya gunakan metode staging ini kembali, jangan mencampurnya dengan `git pull` di folder aktif yang kini memiliki perubahan hasil salinan.

### A. Tentukan lokasi yang benar

Ganti APP_DIR dengan exec cwd yang ditemukan, dan REVISION dengan SHA commit yang sudah di-push. Contoh path bukan jaminan lokasi server Anda.

```bash
set -euo pipefail
APP_DIR='/ganti/dengan/exec-cwd-dari-pm2'
REVISION='ganti-dengan-SHA-commit-GitHub'
APP_DIR=$(realpath "$APP_DIR")
cd "$APP_DIR"
test -f server.ts
test -f package.json
```

Cari DATA_DIR efektif tanpa menampilkan secret lain:

```bash
PM2_DATA_DIR=$(pm2 jlist | node -e '
let s=""; process.stdin.on("data",d=>s+=d); process.stdin.on("end",()=>{
 const apps=JSON.parse(s).filter(p=>p.name==="reev-wa-gateway");
 if(apps.length!==1) throw Error("Harus tepat satu proses PM2");
 process.stdout.write(apps[0].pm2_env.DATA_DIR || "");
});')
if [ -n "$PM2_DATA_DIR" ]; then
  DATA_DIR=$(DATA_DIR="$PM2_DATA_DIR" node --import dotenv/config -e 'process.stdout.write(require("path").resolve(process.env.DATA_DIR || "sessions"))')
else
  DATA_DIR=$(env -u DATA_DIR node --import dotenv/config -e 'process.stdout.write(require("path").resolve(process.env.DATA_DIR || "sessions"))')
fi
test -d "$DATA_DIR"
printf 'APP_DIR=%s\nDATA_DIR=%s\n' "$APP_DIR" "$DATA_DIR"
```

Periksa hasilnya sesuai penyimpanan produksi Anda. Jika PM2 memakai konfigurasi environment atau dotenv khusus di luar konfigurasi paket, sesuaikan DATA_DIR berdasarkan konfigurasi tersebut. Jangan memakai folder data baru/kosong untuk upgrade.

### B. Siapkan dan uji source sebelum downtime

```bash
STAGE=$(mktemp -d /tmp/reev-v272.XXXXXX)
git clone https://github.com/mrifqiirawan/reev-wa-gateway.git "$STAGE/source"
git -C "$STAGE/source" checkout --detach "$REVISION"
cd "$STAGE/source"
node -e 'if(require("./package.json").version!=="2.7.2") process.exit(1)'
npm ci
npm run lint
npm test
npm run build
```

Untuk repository private, gunakan autentikasi GitHub yang telah dikonfigurasi pada VM atau deploy key **read-only**. Password akun GitHub biasa tidak dipakai untuk Git HTTPS. Jangan menyalin private key atau token ke chat. Jika dependency/build/test gagal, jangan hentikan aplikasi aktif.

### C. Backup ketika aplikasi sudah berhenti

Jeda pemanggilan gateway dari aplikasi presensi/broadcast selama pemeliharaan. Pastikan tidak ada pengiriman aktif. Variabel di bawah melanjutkan shell SSH yang sama.

```bash
umask 077
BACKUP_DIR="/root/reev-backups/$(date +%Y%m%d-%H%M%S)"
case "$BACKUP_DIR/" in "$APP_DIR/"*|"$DATA_DIR/"*) echo 'Backup harus di luar source/data'; exit 1 ;; esac
mkdir -p "$BACKUP_DIR"
printf '%s\n' "$APP_DIR" > "$BACKUP_DIR/app-path.txt"
printf '%s\n' "$DATA_DIR" > "$BACKUP_DIR/data-path.txt"
pm2 stop reev-wa-gateway
# Snapshot lengkap source, dist, .env, dependencies dan data internal.
tar -czf "$BACKUP_DIR/app-full.tar.gz" -C "$APP_DIR" .
# Snapshot eksplisit data, termasuk bila DATA_DIR berada di luar APP_DIR.
tar -czf "$BACKUP_DIR/data-full.tar.gz" -C "$DATA_DIR" .
tar -tzf "$BACKUP_DIR/app-full.tar.gz" >/dev/null
tar -tzf "$BACKUP_DIR/data-full.tar.gz" >/dev/null
printf 'Backup privat: %s\n' "$BACKUP_DIR"
```

Backup dapat besar karena mencakup node_modules untuk rollback tanpa mengunduh lockfile lama yang bermasalah. Simpan backup di luar APP_DIR/DATA_DIR. Jika backup gagal, source belum berubah: jalankan `pm2 restart reev-wa-gateway`, perbaiki ruang disk/izin, lalu ulangi langkah backup. Jangan lanjut jika arsip tidak valid.

### D. Salin source tanpa menimpa data produksi

```bash
cd "$APP_DIR"
EXCLUDES=(--exclude='.git/' --exclude='.env' --exclude='.env.*' --exclude='sessions/' --exclude='node_modules/' --exclude='dist/')
case "$DATA_DIR" in
  "$APP_DIR") echo 'DATA_DIR tidak boleh sama dengan root source'; exit 1 ;;
  "$APP_DIR"/*) DATA_REL=${DATA_DIR#"$APP_DIR"/}; EXCLUDES+=(--exclude="/$DATA_REL/") ;;
esac
rsync -a "${EXCLUDES[@]}" "$STAGE/source/" "$APP_DIR/"
# Hanya dua direktori hasil build/dependensi yang diselaraskan dengan delete.
rsync -a --delete "$STAGE/source/node_modules/" "$APP_DIR/node_modules/"
rsync -a --delete "$STAGE/source/dist/" "$APP_DIR/dist/"
printf '%s\n' "$REVISION" > "$APP_DIR/DEPLOYED_REVISION.txt"
pm2 restart reev-wa-gateway --update-env
pm2 save
pm2 status
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
pm2 logs reev-wa-gateway --lines 60 --nostream
```

Sesuaikan port curl jika PORT produksi bukan 3000. Health harus menampilkan versi **2.7.2**. Health hanya membuktikan backend hidup, bukan koneksi WhatsApp atau penerimaan pesan. Jika halaman publik dilayani terpisah oleh Nginx/Vercel, pastikan frontend-nya juga dibangun/deploy dari commit yang sama. Lakukan Ctrl+Shift+R pada browser.

Jangan menekan **Hapus Sesi** atau menautkan ulang QR sebagai langkah upgrade rutin. Kredensial valid akan dimuat dari DATA_DIR lama. Jika koneksi belum kembali, periksa menu Perangkat/log dahulu.

## 5. Uji penerimaan sesudah upgrade

Lakukan pengujian dengan nomor milik Anda/nomor yang bersedia menjadi penerima uji.

1. Pastikan versi 2.7.2 dan perangkat connected; akun admin serta API key lama masih berfungsi.
2. Dari HP lain, kirim teks unik ke nomor WA gateway. Tunggu polling 10 detik atau klik refresh inbox. Identitas boleh berupa nomor atau ID WhatsApp jika mapping belum tersedia.
3. Kirim gambar tanpa caption serta pesan teks dengan disappearing messages aktif. Inbox harus mencatat penanda gambar/teks. Media tanpa teks tidak memicu auto-reply.
4. Jika aturan aktif, kirim `menu`; periksa hanya satu balasan dan satu item inbox per pesan.
5. Kirim satu pesan uji melalui gateway. Lihat HP penerima serta status gateway. Bila receipt tiba, status harus maju SENT → DELIVERED → READ, atau langsung READ. Baca receipt dapat tidak tersedia, jadi READ bukan syarat semua pesan.
6. Restart PM2 satu kali, pastikan sesi/inbox/log tetap ada. Jangan kirim ulang massal SENT lama hanya untuk mengganti status.

Jika HP menerima pesan tetapi gateway tetap SENT, catat waktu, ID pesan dari ekspor log, versi aplikasi, dan apakah hanya penerima tertentu yang mengalami masalah. Jika HP tidak menerima, periksa koneksi nomor pengirim/penerima, validitas nomor, dan indikator pada WhatsApp utama. Jangan menganggap build lokal membuktikan transport langsung sudah pulih.

## 6. Rollback source (data terbaru tetap dipertahankan)

Gunakan backup dari langkah 4C. Di shell baru, isi ulang APP_DIR, DATA_DIR, BACKUP_DIR dengan lokasi yang sudah dicatat. Jeda pengiriman upstream, lalu:

```bash
set -euo pipefail
pm2 stop reev-wa-gateway
ROLLBACK_STAGE=$(mktemp -d /tmp/reev-rollback.XXXXXX)
tar -xzf "$BACKUP_DIR/app-full.tar.gz" -C "$ROLLBACK_STAGE"
EXCLUDES=(--exclude='.git/' --exclude='.env' --exclude='.env.*' --exclude='sessions/' --exclude='node_modules/' --exclude='dist/')
case "$DATA_DIR" in
  "$APP_DIR") echo 'Periksa lokasi data'; exit 1 ;;
  "$APP_DIR"/*) DATA_REL=${DATA_DIR#"$APP_DIR"/}; EXCLUDES+=(--exclude="/$DATA_REL/") ;;
esac
rsync -a "${EXCLUDES[@]}" "$ROLLBACK_STAGE/" "$APP_DIR/"
rsync -a --delete "$ROLLBACK_STAGE/node_modules/" "$APP_DIR/node_modules/"
rsync -a --delete "$ROLLBACK_STAGE/dist/" "$APP_DIR/dist/"
printf 'rollback dari %s\n' "$BACKUP_DIR" > "$APP_DIR/DEPLOYED_REVISION.txt"
pm2 restart reev-wa-gateway --update-env
curl --fail --silent --show-error http://127.0.0.1:3000/api/health
```

Tidak ada migrasi skema yang wajib dibalik. Arsip data untuk pemulihan darurat; jangan mengekstrak snapshot data lama di atas data aktif hanya untuk rollback kode karena pesan/akun terbaru dapat tertimpa. Jangan menjalankan `npm ci` dari lockfile v2.7.1 untuk rollback; node_modules cadangan sudah tersedia.

## 7. Jika deployment ternyata Docker Compose

Jangan menjalankan jalur PM2 bersamaan. Gunakan direktori Compose lama dan project name lama agar named volume `reev_sessions` tetap sama. Catat image lama (`docker compose images`), volume (`docker inspect`), `.env`, dan konfigurasi sebelum perubahan. Backup volume ketika service berhenti; lokasi DATA_DIR container dari paket adalah `/app/sessions`. Source dapat dibangun lebih dulu di staging untuk mengecek dependency. Salin source baru ke direktori Compose lama dengan mempertahankan `.env`, kemudian `docker compose build` dan `docker compose up -d`, tanpa `down -v` atau menghapus volume. Detail backup/rollback Docker perlu menyesuaikan nama container, project dan volume aktual yang belum tersedia pada permintaan ini.

## 8. Batas pengujian

PASS: instalasi npm ci, TypeScript, build, 27 pengujian otomatis termasuk receipt cepat, LID, pesan terbungkus/media, append, deduplikasi inbox, autentikasi dan restart backend. Transport WA pada pengujian memakai mock dan data sintetis. NOT_RUN: pengiriman nyata ke nomor pengguna, UI pada browser produksi, push GitHub dan deploy VM pengguna. Panduan tidak berarti server sudah diperbarui.
