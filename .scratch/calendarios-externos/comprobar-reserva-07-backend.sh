#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
# Solo entorno local: no inicia, reinicia ni para Supabase; no opera sobre Git o la base alojada.
shopt -s nullglob
bnbtico_reservation_migrations=(supabase/migrations/*_proteger_reserva_calendario.sql)
if [[ ${#bnbtico_reservation_migrations[@]} -eq 0 ]]; then
  pnpm exec supabase migration new proteger_reserva_calendario < /dev/null
  bnbtico_reservation_migrations=(supabase/migrations/*_proteger_reserva_calendario.sql)
  [[ ${#bnbtico_reservation_migrations[@]} -eq 1 ]]
  cp .scratch/calendarios-externos/proteger-reserva-calendario.sql "${bnbtico_reservation_migrations[0]}"
fi
[[ ${#bnbtico_reservation_migrations[@]} -eq 1 ]]
pnpm db:al-dia
pnpm --filter app db:types
pnpm typecheck
pnpm --filter app exec vitest run --project unit tests/unit/contract-reservation-availability-fake.test.ts
pnpm --filter app exec vitest run --project db tests/db/contract-reservation-availability-postgrest.test.ts tests/db/contract-airbnb-management-postgrest.test.ts tests/db/contract-calendar-postgrest.test.ts
