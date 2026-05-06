#!/usr/bin/env bash
set -euo pipefail

echo "→ Running prisma migrate deploy..."
npx prisma migrate deploy
echo "✓ Migrations applied"
