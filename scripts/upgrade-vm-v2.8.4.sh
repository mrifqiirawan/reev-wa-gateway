#!/usr/bin/env bash
set -Eeuo pipefail
umask 077

OLD=/root/reev-wa-gateway
NEW=/opt/reev-wa-gateway
BACKUP="/root/reev-backups/v284-$(date +%Y%m%d-%H%M%S)-$$"
STOPPED=0
READY=0

fail() {
  local line="$1"
  trap - ERR
  set +e

  echo "Gagal pada baris $line."

  if [ "$STOPPED" = 1 ]; then
    systemctl stop reev-wa-gateway

    if [ "$READY" = 1 ]; then
      echo "Memulihkan backup..."
      if ! tar -xzf "$BACKUP/application.tar.gz" -C /root; then
        echo "Pemulihan gagal. Service tetap dihentikan."
        echo "Jika kembali ke v2.8.3, jalankan sql/GATEWAY_rollback_v2.8.4.sql di database Gateway agar action admin baru tidak menghalangi konfigurasi lama."
  echo "Backup: $BACKUP"
        exit 1
      fi
    fi

    systemctl start reev-wa-gateway
  fi

  echo "Backup: $BACKUP"
  echo "Periksa: journalctl -u reev-wa-gateway -n 60 --no-pager"
  exit 1
}

trap 'fail "$LINENO"' ERR

test -f "$OLD/.env"
test -d "$OLD/sessions"
test -f "$NEW/dist/index.html"
test -d "$NEW/node_modules"
test -f "$NEW/src/shared/reply-template.ts"
grep -q 'renderReply(f.action' "$NEW/src/server/bot-engine.ts"
test "$(systemctl show reev-wa-gateway -p WorkingDirectory --value)" = "$OLD"

cd "$NEW"
test "$(node -p "require('./package.json').version")" = "2.8.4"
/usr/bin/node --import tsx -e 'console.log("Runtime service siap")'

command -v rsync >/dev/null
command -v curl >/dev/null
install -d -m 700 "$BACKUP"
cp -a /etc/systemd/system/reev-wa-gateway.service "$BACKUP/"

echo "Menghentikan Gateway sementara..."
systemctl stop reev-wa-gateway
STOPPED=1

echo "Mencadangkan aplikasi, konfigurasi, dan sesi..."
tar -czf "$BACKUP/application.tar.gz" -C /root reev-wa-gateway
tar -tzf "$BACKUP/application.tar.gz" >/dev/null
READY=1

echo "Memperbarui source dan hasil build..."
rsync -a \
  --exclude='.git/' \
  --exclude='.env*' \
  --exclude='sessions/' \
  --exclude='node_modules/' \
  --exclude='backups/' \
  "$NEW/" "$OLD/"

echo "Memperbarui dependency..."
rsync -a --delete "$NEW/node_modules/" "$OLD/node_modules/"

cd "$OLD"
test "$(node -p "require('./package.json').version")" = "2.8.4"

systemctl start reev-wa-gateway

echo "Menunggu backend pada port 3001..."
HEALTH_OK=0

for ATTEMPT in $(seq 1 30); do
  if curl -fsS --max-time 2 \
    http://127.0.0.1:3001/api/health \
    -o "$BACKUP/health.json" 2>/dev/null; then

    if node -e 'const fs=require("node:fs");const d=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));process.exit(d.success===true&&d.version==="2.8.4"?0:1)' "$BACKUP/health.json"; then
      HEALTH_OK=1
      break
    fi
  fi

  sleep 1
done

test "$HEALTH_OK" = 1
trap - ERR

echo "UPGRADE BACKEND BERHASIL: v2.8.4"
echo "Backup: $BACKUP"
cat "$BACKUP/health.json"
echo
