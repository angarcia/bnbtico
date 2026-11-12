#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
pnpm --filter app exec vitest run --project unit tests/unit/contract-reservation-availability-fake.test.ts
