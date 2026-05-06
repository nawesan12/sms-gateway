#!/usr/bin/env bash
# =============================================================
# build-and-push.sh — buildea la imagen y la pushea a múltiples
# registries Docker. Funciona en Linux, macOS y Git Bash (Windows).
#
# Uso:
#   ./scripts/deploy/build-and-push.sh [path/to/accounts.json]
#
# Default: scripts/deploy/accounts.json
# Variables de entorno requeridas:
#   - una password env por cada cuenta, definida en accounts.json
#     ej: DOCKER_PASSWORD_MAIN, DOCKER_PASSWORD_ACME
#
# Ejemplo:
#   export DOCKER_PASSWORD_MAIN=...
#   export DOCKER_PASSWORD_ACME=...
#   ./scripts/deploy/build-and-push.sh
# =============================================================
set -euo pipefail

cd "$(dirname "$0")/../.."

CONFIG="${1:-scripts/deploy/accounts.json}"
if [[ ! -f "$CONFIG" ]]; then
  echo "✗ Config no encontrada: $CONFIG"
  echo "  Copiá scripts/deploy/accounts.example.json y completalo."
  exit 1
fi

if ! command -v jq >/dev/null 2>&1; then
  echo "✗ Falta 'jq' (parser JSON). Instalalo:"
  echo "    Linux: apt install jq · macOS: brew install jq · Windows (Git Bash): choco install jq"
  exit 1
fi

if ! command -v docker >/dev/null 2>&1; then
  echo "✗ Falta 'docker'. Instalá Docker Desktop o el daemon."
  exit 1
fi

IMAGE_NAME=$(jq -r '.image' "$CONFIG")
IMAGE_TAG=$(jq -r '.tag' "$CONFIG")
COUNT=$(jq '.registries | length' "$CONFIG")

if [[ "$COUNT" == "0" ]]; then
  echo "✗ No hay registries configurados en $CONFIG"
  exit 1
fi

# Hash corto del git para tag adicional
GIT_SHA=$(git rev-parse --short HEAD 2>/dev/null || echo "nogit")
LOCAL_TAG="${IMAGE_NAME}:${IMAGE_TAG}"

echo "════════════════════════════════════════════════════════"
echo " Build local: $LOCAL_TAG  (git: $GIT_SHA)"
echo "════════════════════════════════════════════════════════"

# Build una sola vez (la imagen es idéntica para todas las cuentas).
# Si querés multi-arch (linux/amd64 + arm64), descomentá la línea de buildx
# Por defecto buildeamos amd64 (compatible con Render).
docker buildx inspect default >/dev/null 2>&1 || docker buildx create --use --name smsgw-builder

echo "→ docker buildx build (linux/amd64) ..."
docker buildx build \
  --platform linux/amd64 \
  --tag "$LOCAL_TAG" \
  --tag "${IMAGE_NAME}:${GIT_SHA}" \
  --load \
  .

echo "✓ build OK"

# Iterar registries
for ((i=0; i<COUNT; i++)); do
  NAME=$(jq -r ".registries[$i].name"        "$CONFIG")
  REG=$(jq  -r ".registries[$i].registry"    "$CONFIG")
  USR=$(jq  -r ".registries[$i].username"    "$CONFIG")
  PWVAR=$(jq -r ".registries[$i].passwordEnv" "$CONFIG")
  REPO=$(jq -r ".registries[$i].repo"        "$CONFIG")

  PWD_VAL="${!PWVAR-}"
  if [[ -z "$PWD_VAL" ]]; then
    echo "─── [$NAME] SKIP — variable $PWVAR no está seteada ───"
    continue
  fi

  echo
  echo "─────────────────────────────────────────────────────────"
  echo " [$NAME] Push → ${REG}/${REPO}"
  echo "─────────────────────────────────────────────────────────"

  echo "$PWD_VAL" | docker login "$REG" --username "$USR" --password-stdin

  REMOTE_LATEST="${REG}/${REPO}:${IMAGE_TAG}"
  REMOTE_SHA="${REG}/${REPO}:${GIT_SHA}"

  docker tag "$LOCAL_TAG" "$REMOTE_LATEST"
  docker tag "$LOCAL_TAG" "$REMOTE_SHA"

  echo "→ push $REMOTE_LATEST"
  docker push "$REMOTE_LATEST"
  echo "→ push $REMOTE_SHA"
  docker push "$REMOTE_SHA"

  docker logout "$REG" >/dev/null 2>&1 || true
  echo "✓ [$NAME] OK"
done

echo
echo "════════════════════════════════════════════════════════"
echo " Listo. Imágenes pusheadas con tags: $IMAGE_TAG, $GIT_SHA"
echo "════════════════════════════════════════════════════════"
