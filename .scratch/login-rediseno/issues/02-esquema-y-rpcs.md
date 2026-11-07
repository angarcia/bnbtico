# 02 · Esquema, RLS y RPCs de verificación

Status: ready-for-agent
Type: task
Blocked by: 01

## Qué

Nueva migración con lo descrito en `spec.md` §4.2 y §4.4: tablas `verification_challenges` y `whatsapp_inbound_events`; índice único parcial de `profiles.phone` verificado; trigger de perfil para cualquier usuario nuevo (sustituye al que exige `phone`); `grant`/`revoke` por columna para que el cliente no pueda escribir `phone` ni `phone_verified_at`; RPCs `claim_verification`, `complete_verification`, `consume_verification`, `require_recent_auth` (con la forma que decidan S1/S2) y `my_login_methods`.

Reglas del repositorio: toda tabla nueva con políticas y prueba de contrato **antes** de cualquier pantalla; la migración en `supabase/migrations/` con `pnpm exec supabase migration new … < /dev/null`; `pnpm db:al-dia`, `pnpm db:types` y, si cambia lo que crea, `scripts/casas-de-prueba.mjs` en el mismo commit; cuidado con `app.allow_status` si se toca `listings`.

## Primero las pruebas (`tests/db`)

RLS y grants; idempotencia por `message_sid`; vencimiento; conflicto de número; unicidad del número verificado; `require_recent_auth` con JWT simulados (con y sin `amr` reciente); el cliente no escribe `phone`.

## No tocar

Phone Auth todavía (se retira en el 09); las RPCs de casas; `is_admin()` y `aal2`; ningún cambio de interfaz.

## Hecho cuando

Pruebas de base en verde, tipos regenerados, `pnpm db:al-dia` aplica la migración sin intervención manual.
