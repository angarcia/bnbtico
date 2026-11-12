#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
# Ana ejecuta. Sin Git mutable, base alojada, despliegue ni cambios de límites.
pnpm typecheck
pnpm --filter app build
node .scratch/calendarios-externos/auditar-tamano-07.mjs > /tmp/bnbtico-auditoria-tamano-07-despues.json
pnpm --filter app size
