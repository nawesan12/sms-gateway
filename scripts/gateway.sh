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
#   health                               Pega a /health (rápido, no toca DB)
#   doctor                               Diagnóstico completo (config + DB + Redis + devices)
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

# Validación E.164 local: + seguido de 8-15 dígitos. Atajo errores típicos
# (sin +, espacios, paréntesis) sin tener que ir hasta el server.
validate_e164() {
  local phone="$1"
  if [[ ! "$phone" =~ ^\+[1-9][0-9]{7,14}$ ]]; then
    red "✗ Teléfono inválido: '$phone'"
    red "  Formato esperado: E.164 (ej. +5491132111111)"
    red "  - Empieza con + (no 00, no nada)"
    red "  - 8 a 15 dígitos, sin espacios ni guiones"
    exit 1
  fi
}

api() {
  local method="$1"
  local path="$2"
  local body="${3:-}"
  local out exit_code
  if [ -n "$body" ]; then
    out=$(curl -sS --max-time 30 -X "$method" "$API_URL$path" \
      -H "x-bootstrap-token: $BOOTSTRAP_TOKEN" \
      -H "content-type: application/json" \
      -d "$body" 2>&1)
    exit_code=$?
  else
    out=$(curl -sS --max-time 30 -X "$method" "$API_URL$path" \
      -H "x-bootstrap-token: $BOOTSTRAP_TOKEN" 2>&1)
    exit_code=$?
  fi
  if [ $exit_code -ne 0 ]; then
    red "✗ No se pudo contactar el service ($API_URL):"
    red "  $out"
    red ""
    red "Cosas para revisar:"
    red "  - ¿API_URL en scripts/gateway.env está bien escrita y termina sin slash?"
    red "  - ¿El service está despierto? (free plan duerme tras 15 min — esperá ~30s y reintentá)"
    red "  - ¿El deploy en Render terminó OK? Revisá los logs."
    red ""
    red "Tip: probá './scripts/gateway.sh doctor' para un diagnóstico completo."
    exit 1
  fi
  echo "$out"
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
  validate_e164 "$phone"

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
  validate_e164 "$phone"
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

cmd_doctor() {
  require_config

  echo "→ Configuración"
  echo "  API_URL=$API_URL"
  echo "  BOOTSTRAP_TOKEN=${BOOTSTRAP_TOKEN:0:8}…(${#BOOTSTRAP_TOKEN} chars)"
  echo

  # 1. /health (público, no toca DB)
  echo "→ /health (proceso vivo)"
  local health
  if ! health=$(curl -fsS --max-time 30 "$API_URL/health" 2>&1); then
    red "  ✗ No respondió. Posibles causas:"
    red "     - API_URL mal escrita"
    red "     - El service está dormido (free plan tras 15 min) — primer hit puede tardar 30-60s"
    red "     - El deploy falló — revisá los logs en Render"
    exit 1
  fi
  green "  ✓ alive"
  echo "  $(echo "$health" | jq -c .)"
  echo

  # 2. /health/ready (toca DB + Redis + devices)
  echo "→ /health/ready (DB + Redis + devices)"
  local ready
  ready=$(curl -sS --max-time 30 "$API_URL/health/ready" || echo '{}')
  local pg=$(echo "$ready" | jq -r '.checks.postgres // "?"')
  local rd=$(echo "$ready" | jq -r '.checks.redis // "?"')
  local dv=$(echo "$ready" | jq -r '.checks.devices // "?"')

  if [ "$pg" = "ok" ]; then green "  ✓ postgres: ok"
  else red "  ✗ postgres: $pg — revisá DATABASE_URL (¿pegaste el pooler en :6543?)"
  fi

  if [ "$rd" = "ok" ]; then green "  ✓ redis: ok"
  else red "  ✗ redis: $rd — revisá REDIS_URL (¿empieza con rediss:// para Upstash?)"
  fi

  if [ "$dv" = "ok" ]; then green "  ✓ devices: hay al menos 1 device ACTIVO"
  else dim   "  · devices: $dv — sin devices registrados todavía (no es fatal hasta que mandes SMS)"
  fi
  echo

  # 3. Auth check
  echo "→ Auth (BOOTSTRAP_TOKEN válido?)"
  local auth_status
  auth_status=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 30 \
    -H "x-bootstrap-token: $BOOTSTRAP_TOKEN" "$API_URL/v1/admin/users" || echo "000")
  case "$auth_status" in
    200) green "  ✓ token válido (HTTP 200)" ;;
    401|403) red "  ✗ token inválido (HTTP $auth_status) — el BOOTSTRAP_TOKEN no coincide con el del service" ;;
    *) red "  ✗ respuesta inesperada (HTTP $auth_status)" ;;
  esac
  echo

  if [ "$pg" = "ok" ] && [ "$rd" = "ok" ] && [ "$auth_status" = "200" ]; then
    green "Todo OK. Listo para crear clientes."
  else
    red "Hay items en rojo. Mirá los logs del service en Render dashboard."
    exit 1
  fi
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
    doctor) cmd_doctor ;;
    help|-h|--help) cmd_help ;;
    *) red "Subcomando desconocido: $sub"; cmd_help; exit 1 ;;
  esac
}

main "$@"
