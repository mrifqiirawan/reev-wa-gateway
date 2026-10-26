#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
[ "$(id -u)" = 0 ] || { echo 'Jalankan sebagai root.'; exit 1; }
node -e 'const [a,b]=process.versions.node.split(".").map(Number);if(!((a===22&&b>=12)||a===24))process.exit(1)' || { echo 'Pasang Node 24 LTS terlebih dahulu.'; exit 1; }
# This installer deliberately refuses to overwrite an existing service/environment.
[ ! -e /etc/systemd/system/reev-wa-gateway.service ] || { echo 'Service sudah ada. Ikuti langkah upgrade di panduan.'; exit 1; }
[ ! -e .env ] || { echo '.env sudah ada. Ikuti panduan upgrade, jangan timpa konfigurasi.'; exit 1; }
command -v useradd >/dev/null
id reev-wa >/dev/null 2>&1 || useradd --system --home-dir /var/lib/reev-wa-gateway --shell /usr/sbin/nologin reev-wa
install -d -o reev-wa -g reev-wa -m 700 /var/lib/reev-wa-gateway
npm ci --no-audit --no-fund
npm run build
node --input-type=module <<'JS'
import fs from 'node:fs';import crypto from 'node:crypto';
const password=crypto.randomBytes(24).toString('base64url');
fs.writeFileSync('.env',`NODE_ENV=production\nHOST=127.0.0.1\nPORT=3000\nDATA_DIR=/var/lib/reev-wa-gateway\nADMIN_USERNAME=admin\nADMIN_PASSWORD=${password}\nCOOKIE_SECURE=false\nSESSION_TTL_DAYS=30\n`,{mode:0o600,flag:'wx'});
console.log('\nLogin awal: admin\nPassword awal: '+password+'\nSimpan di pengelola password. Ubah lewat Keamanan & Akun.\n');
JS
chown root:reev-wa .env
chmod 640 .env
REEV_ROOT="$(pwd)"
REEV_NODE="$(command -v node)"
case "$REEV_ROOT:$REEV_NODE" in *' '*|*'"'*) echo 'Path tidak boleh mengandung spasi atau tanda kutip.'; exit 1;; esac
cat > /etc/systemd/system/reev-wa-gateway.service <<EOF
[Unit]
Description=REEV WA Gateway
After=network-online.target
Wants=network-online.target
[Service]
Type=simple
User=reev-wa
Group=reev-wa
WorkingDirectory=$REEV_ROOT
ExecStart=$REEV_NODE --import tsx server.ts
Restart=on-failure
RestartSec=5
UMask=0077
NoNewPrivileges=true
PrivateTmp=true
[Install]
WantedBy=multi-user.target
EOF
systemctl daemon-reload
systemctl enable --now reev-wa-gateway
systemctl --no-pager status reev-wa-gateway
