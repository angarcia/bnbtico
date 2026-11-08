#!/usr/bin/env bash
# Ana ejecuta este archivo. No publica, no usa --linked y no arranca/resetea/para Supabase.
set -euo pipefail
bnbtico_script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$bnbtico_script_dir/../.."
if [ ! -d apps/app/node_modules/ical.js ]; then
  echo 'Falta el lector independiente de pruebas. Ejecute: pnpm --filter app add -D -E ical.js@2.2.1'
  exit 1
fi
pnpm --filter app exec vitest run --project unit \
  tests/unit/ical-export-worker.test.ts \
  tests/unit/ical-export.test.ts \
  tests/unit/contract-ical-export-fake.test.ts \
  tests/unit/contract-airbnb-fake.test.ts \
  tests/unit/sw-routes.test.ts \
  tests/unit/worker-config.test.ts
pnpm db:al-dia
pnpm --filter app db:types
pnpm typecheck
pnpm --filter app exec vitest run --project db \
  tests/db/contract-ical-export-postgrest.test.ts \
  tests/db/ical-export-permissions.test.ts
