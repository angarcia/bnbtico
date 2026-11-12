#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
# Repite únicamente la prueba corregida y las comprobaciones que quedaron sin ejecutar.
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  pnpm --filter app test:e2e ical-export.spec.ts
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  pnpm --filter app test:e2e calendario.spec.ts --grep 'Marcar una reserva|una sola noche|la hoja se cierra|si la base rechaza'
pnpm --filter app size
