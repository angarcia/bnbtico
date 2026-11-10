#!/usr/bin/env bash
# Ana ejecuta este archivo. Solo base local, sin --linked, start/reset/stop, Git ni despliegues.
set -euo pipefail
bnbtico_script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$bnbtico_script_dir/../.."
pnpm --filter app exec vitest run --project unit \
  tests/unit/airbnb-management-worker.test.ts \
  tests/unit/contract-airbnb-management-fake.test.ts \
  tests/unit/airbnb-worker.test.ts \
  tests/unit/contract-airbnb-fake.test.ts \
  tests/unit/ical-export.test.ts \
  tests/unit/ical-export-worker.test.ts \
  tests/unit/contract-ical-export-fake.test.ts
pnpm db:al-dia
pnpm --filter app db:types
pnpm typecheck
pnpm --filter app exec vitest run --project db \
  tests/db/contract-airbnb-management-postgrest.test.ts \
  tests/db/airbnb-management-permissions.test.ts \
  tests/db/contract-ical-export-postgrest.test.ts \
  tests/db/ical-export-permissions.test.ts
