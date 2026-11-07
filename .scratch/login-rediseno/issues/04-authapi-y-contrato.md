# 04 · Nueva `AuthApi`, adaptadores y suite de contrato

Status: ready-for-agent
Type: task
Blocked by: 03

## Qué

Sustituir `start/verify/resend/pending` por la interfaz de `spec.md` §4.6 en `src/domain/api.ts`; adaptador PostgREST/Supabase (`src/data/postgrest/auth.ts`) y fake en memoria (`src/data/fake/auth.ts`); retirar `PendingOtp`, el enfriamiento de 30 s por número y el estado pendiente en `sessionStorage` (conservar solo lo del respaldo). `watchVerification`: consulta al volver a primer plano (`visibilitychange`) y luego con retroceso. Adaptar `client/session.ts` y `shared/contact-flow.ts`/`domain/contact-return.ts` solo en lo que dependa de la interfaz (no su pantalla).

## Primero las pruebas

Suite de contrato única contra el fake y contra PostgREST (`tests/contract/auth.contract.ts`, `tests/db/contract-auth-postgrest.test.ts`): reto → listo; vencido; conflicto; número ya existente entra en su cuenta; nombre ignorado en cuentas existentes; `logout` revoca.

## No tocar

La pantalla `client/sign-in.tsx` (ticket 05); `MfaApi` y el flujo TOTP de administradores; el JS inicial (todo bajo demanda; vigilar `size-limit`).

## Hecho cuando

Contrato en verde contra ambos adaptadores, typecheck y `size-limit` en verde, sin cambios visibles todavía.
