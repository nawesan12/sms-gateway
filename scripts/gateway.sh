#!/usr/bin/env bash
# =============================================================================
# scripts/gateway.sh — CLI para administrar clientes del SMS Gateway
#
# Configuración (leído de env vars o de scripts/gateway.env):
#   API_URL         — base URL del service (sin slash final)
#   BOOTSTRAP_TOKEN — token de operador (x-bootstrap-token)
#
# Uso:
#   ./scripts/gateway.sh <subcomando> [args]
#
# Subcomandos:
#   client create <phone> [tokens]      Crea/regenera link para un cliente
#   client list                          Lista todos los clientes con saldos
#   client balance <userId>              Muestra el saldo de un cliente
#   client topup <userId> <amount> [reason]
#                                        Suma tokens al saldo de un cliente
#   client regen <phone>                 Regenera link (invalida el anterior)
#   client tx <userId> [page] [pageSize] Historial de transacciones
#   health                               Pega a /health
#   help                                 Muestra esta ayuda
# =============================================================================

set -euo pipefail

# --- Cargar config ----------------------------------------------------------
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CONFIG_FILE="$SCRIPT_DIR/gateway.env"

if [ -f "$CONFIG_FILE" ]; then
  # shellcheck disable=SC1090
  source "$CONFIG_FILE"
fi

API_URL="${API_URL:-}"
BOOTSTRAP_TOKEN="${BOOTSTRAP_TOKEN:-}"

# --- Helpers ---------------------------------------------------------------
red()    { printf '\033[31m%s\033[0m\n' "$*" >&2; }
green()  { printf '\033[32m%s\033[0m\n' "$*"; }
dim()    { printf '\033[2m%s\033[0m\n' "$*"; }

require_config() {
  if [ -z "$API_URL" ] || [ -z "$BOOTSTRAP_TOKEN" ]; then
    red "✗ Falta configuración. Definí API_URL y BOOTSTRAP_TOKEN en:"
    red "    scripts/gateway.env"
    red "  o exportalas como variables de entorno."
    red ""
    red "Ejemplo (scripts/gateway.env):"
    red "  API_URL=https://sms-gateway-XXXX.onrender.com"
    red "  BOOTSTRAP_TOKEN=9ef85a6cf8ef505bbe56d08d0a57d6aae14da1d1cfb20342"
    exit 1
  fi
}

require_jq() {
  if ! command -v jq >/dev/null 2>&1; then
    red "✗ Necesitás 'jq' para parsear las respuestas. Instalalo con:"
    red "    brew install jq    # macOS"
    red "    apt install jq     # Debian/Ubuntu"
    exit 1
  fi
}

api() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  if [ -n "$body" ]; then
    curl -sS -X "$method" "$API_URL$path" \
      -H "x-bootstrap-token: $BOOTSTRAP_TOKEN" \
      -H "content-type: application/json" \
      -d "$body"
  else
    curl -sS -X "$method" "$API_URL$path" \
      -H "x-bootstrap-token: $BOOTSTRAP_TOKEN"
  fi
}

# --- Subcomandos ------------------------------------------------------------
cmd_client_create() {
  local phone="${1:-}"
  local tokens="${2:-0}"
  if [ -z "$phone" ]; then
    red "Uso: $0 client create <phone> [tokens]"
    exit 1
  fi
  require_config; require_jq

  local body
  if [ "$tokens" -gt 0 ]; then
    body=$(jq -nc --arg p "$phone" --argjson t "$tokens" \
      '{phoneE164:$p, initialTokens:$t, role:"ADMIN"}')
  else
    body=$(jq -nc --arg p "$phone" '{phoneE164:$p, role:"ADMIN"}')
  fi

  local res
  res=$(api POST /v1/admin/auth/access-link "$body")

  if [ "$(echo "$res" | jq -r '.success')" != "true" ]; then
    red "✗ Error:"
    echo "$res" | jq .
    exit 1
  fi

  green "✓ Cliente creado/actualizado:"
  echo "$res" | jq '.data | {phoneE164, userId, balance, link}'
  dim ""
  dim "Compartile el campo 'link' al cliente para que ingrese al panel."
}

cmd_client_list() {
  require_config; require_jq
  local res
  res=$(api GET /v1/admin/users)
  if [ "$(echo "$res" | jq -r '.success')" != "true" ]; then
    red "✗ Error:"
    echo "$res" | jq .
    exit 1
  fi
  echo "$res" | jq '.data[] | {userId:.id, phoneE164, role, balance:.tokenBalance.amount, lastIssued:.accessTokenIssuedAt}'
}

cmd_client_balance() {
  local user_id="${1:-}"
  if [ -z "$user_id" ]; then
    red "Uso: $0 client balance <userId>"
    exit 1
  fi
  require_config; require_jq
  api GET "/v1/admin/users/$user_id/tokens/balance" | jq .
}

cmd_client_topup() {
  local user_id="${1:-}"
  local amount="${2:-}"
  local reason="${3:-manual top-up via gateway.sh}"
  if [ -z "$user_id" ] || [ -z "$amount" ]; then
    red "Uso: $0 client topup <userId> <amount> [reason]"
    exit 1
  fi
  require_config; require_jq

  local body
  body=$(jq -nc --argjson a "$amount" --arg r "$reason" \
    '{amount:$a, reason:$r}')

  local res
  res=$(api POST "/v1/admin/users/$user_id/tokens/top-up" "$body")
  if [ "$(echo "$res" | jq -r '.success')" != "true" ]; then
    red "✗ Error:"
    echo "$res" | jq .
    exit 1
  fi
  green "✓ Top-up aplicado:"
  echo "$res" | jq .data
}

cmd_client_regen() {
  local phone="${1:-}"
  if [ -z "$phone" ]; then
    red "Uso: $0 client regen <phone>"
    exit 1
  fi
  require_config; require_jq
  local body
  body=$(jq -nc --arg p "$phone" '{phoneE164:$p}')
  local res
  res=$(api POST /v1/admin/auth/access-link "$body")
  if [ "$(echo "$res" | jq -r '.success')" != "true" ]; then
    red "✗ Error:"
    echo "$res" | jq .
    exit 1
  fi
  green "✓ Link regenerado (el anterior ya no funciona):"
  echo "$res" | jq '.data | {phoneE164, link}'
}

cmd_client_tx() {
  local user_id="${1:-}"
  local page="${2:-1}"
  local size="${3:-50}"
  if [ -z "$user_id" ]; then
    red "Uso: $0 client tx <userId> [page] [pageSize]"
    exit 1
  fi
  require_config; require_jq
  api GET "/v1/admin/users/$user_id/tokens/transactions?page=$page&pageSize=$size" \
    | jq '.data'
}

cmd_health() {
  require_config
  curl -sS "$API_URL/health" | (command -v jq >/dev/null && jq . || cat)
}

cmd_help() {
  sed -n '2,22p' "$0" | sed 's/^# \{0,1\}//'
}

# --- Router ----------------------------------------------------------------
main() {
  local sub="${1:-help}"
  shift || true
  case "$sub" in
    client)
      local action="${1:-}"
      shift || true
      case "$action" in
        create)  cmd_client_create  "$@" ;;
        list)    cmd_client_list    "$@" ;;
        balance) cmd_client_balance "$@" ;;
        topup)   cmd_client_topup   "$@" ;;
        regen)   cmd_client_regen   "$@" ;;
        tx)      cmd_client_tx      "$@" ;;
        *)       red "Acción 'client' desconocida: $action"; cmd_help; exit 1 ;;
      esac
      ;;
    health) cmd_health ;;
    help|-h|--help) cmd_help ;;
    *) red "Subcomando desconocido: $sub"; cmd_help; exit 1 ;;
  esac
}

main "$@"
