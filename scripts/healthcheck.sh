#!/usr/bin/env bash
set -euo pipefail

URL="${1:-http://localhost:3000/health/ready}"
status=$(curl -s -o /dev/null -w "%{http_code}" "$URL" || echo "000")
if [[ "$status" == "200" ]]; then
  echo "✓ healthy ($URL)"
  exit 0
fi
echo "✗ unhealthy: status=$status ($URL)"
exit 1
