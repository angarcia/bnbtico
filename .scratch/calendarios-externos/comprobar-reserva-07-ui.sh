#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
# Supabase local existente. Sin Git, despliegue ni base alojada.
pnpm typecheck
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  pnpm --filter app exec vitest run --project unit tests/unit/private-sheets.test.ts tests/unit/contract-reservation-availability-fake.test.ts tests/unit/airbnb-calendar.test.ts --maxWorkers=1
pnpm --filter app build
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  pnpm --filter app test:e2e reservation-availability.spec.ts airbnb-management.spec.ts airbnb.spec.ts ical-export.spec.ts
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  pnpm --filter app test:e2e calendario.spec.ts --grep 'Marcar una reserva|una sola noche|la hoja se cierra|si la base rechaza'
pnpm --filter app size
