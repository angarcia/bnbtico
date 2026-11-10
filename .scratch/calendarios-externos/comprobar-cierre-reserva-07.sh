#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
# Reutiliza el último build comprobado: desde entonces solo cambian pruebas, documentación y límites.
# Ana ejecuta; sin Git, base alojada, despliegue ni start/reset/stop.
pnpm typecheck
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  pnpm --filter app test --maxWorkers=1
pnpm --filter app exec vitest run --project db tests/db/contract-reservation-availability-postgrest.test.ts tests/db/airbnb-management-permissions.test.ts
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  pnpm --filter app test:e2e reservation-availability.spec.ts airbnb-management.spec.ts airbnb.spec.ts ical-export.spec.ts
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  pnpm --filter app test:e2e calendario.spec.ts --grep 'Marcar una reserva|una sola noche|la hoja se cierra|si la base rechaza'
pnpm --filter app size
