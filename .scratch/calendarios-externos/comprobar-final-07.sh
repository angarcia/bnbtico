#!/usr/bin/env bash
# Ana ejecuta este archivo; sin Git ni base alojada. Supabase local ya debe estar disponible.
set -euo pipefail
bnbtico_script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$bnbtico_script_dir/../.."
pnpm typecheck
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  pnpm --filter app test --maxWorkers=1
pnpm --filter app build
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  pnpm --filter app test:e2e airbnb-management.spec.ts airbnb.spec.ts ical-export.spec.ts
pnpm --filter app size
