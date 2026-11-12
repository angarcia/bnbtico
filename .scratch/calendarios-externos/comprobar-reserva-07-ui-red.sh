#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
pnpm --filter app build
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  pnpm --filter app test:e2e reservation-availability.spec.ts
