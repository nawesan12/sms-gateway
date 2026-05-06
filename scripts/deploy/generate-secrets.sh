#!/usr/bin/env bash
# Genera los 3 secrets requeridos. Imprime al stdout listo para
# pegar en Render/Docker compose.
set -euo pipefail

if ! command -v openssl >/dev/null 2>&1; then
  echo "✗ Falta openssl"
  exit 1
fi

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT

openssl genrsa -out "$TMP/p.pem"  2048 2>/dev/null
openssl rsa    -in  "$TMP/p.pem" -pubout -out "$TMP/pub.pem" 2>/dev/null

JWT_PRIV=$(base64 < "$TMP/p.pem"   | tr -d '\n')
JWT_PUB=$(base64  < "$TMP/pub.pem" | tr -d '\n')
ENC=$(openssl rand -base64 32 | tr -d '\n')
TOKEN=$(openssl rand -hex 24)

cat <<EOF
# ╭──────────────────────────────────────────────────────────╮
# │ Secrets generados · COPIALOS A RENDER (sync: false)      │
# │ Cada uno DEBE ir como env var del servicio API y Worker  │
# │ que requieran MASTER_ENCRYPTION_KEY_B64.                 │
# ╰──────────────────────────────────────────────────────────╯
JWT_PRIVATE_KEY_B64=$JWT_PRIV
JWT_PUBLIC_KEY_B64=$JWT_PUB
MASTER_ENCRYPTION_KEY_B64=$ENC
ADMIN_BOOTSTRAP_TOKEN=$TOKEN
EOF
