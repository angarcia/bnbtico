#!/usr/bin/env bash
# Solo repite el tamaño aprobado y el recorrido cuya captura se corrigió. Ana ejecuta.
set -euo pipefail
bnbtico_script_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
cd "$bnbtico_script_dir/../.."
pnpm --filter app size
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  pnpm --filter app test:e2e airbnb-management.spec.ts --grep "cancelar no desconecta"
