#!/usr/bin/env bash
# Ana ejecuta este archivo en la copia actualizada. No toca la base alojada ni Git.
set -euo pipefail
bnbtico_script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$bnbtico_script_dir/../.."
pnpm dev:vars
pnpm typecheck
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  pnpm --filter app exec vitest run --project unit tests/unit/private-sheets.test.ts --maxWorkers=1
pnpm --filter app build
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  pnpm --filter app test:e2e airbnb-management.spec.ts airbnb.spec.ts ical-export.spec.ts
