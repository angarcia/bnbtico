# 10 · Apps nativas: biometría, Google/Apple nativos y protección contra abuso

Status: needs-triage
Type: task
Blocked by: 09 y que exista el proyecto Capacitor

## Qué

Google y Apple nativos con `signInWithIdToken` (nonce correcto; IDs de cliente iOS/Android autorizados en Supabase) y `linkIdentityWithIdToken` para vincular; tokens en Keychain/Keystore mediante un plugin de almacenamiento seguro detrás del adaptador de almacenamiento existente; **bloqueo opcional con Face ID/huella** (§6.6; oculto en web y PWA; pide biometría o código del teléfono tras 1 minuto en segundo plano); abrir WhatsApp desde la app (`wa.me` / esquema `whatsapp://`, `LSApplicationQueriesSchemes` en iOS, filtros de consulta en Android); sustituir Turnstile (no funciona con el origen `capacitor://localhost`) por App Attest (iOS) y Play Integrity (Android) en `POST /api/verificacion`, o por límites más estrictos sin captcha mientras tanto; revisar la guía 4.2 de Apple y anotar el valor nativo de la app.

## Primero las pruebas

En dispositivos reales de gama baja (presupuestos p75): ingreso, A′ completo, bloqueo biométrico, vuelta desde WhatsApp. Sin sesión compartida con la web: documentarlo en las pruebas manuales.

## No tocar

Passkeys (v1.1); la lógica del servidor de A′ (solo cambia el control anti-abuso del endpoint); `MfaApi`.

## Hecho cuando

El flujo completo funciona en iOS y Android reales y la nota de la revisión de Apple está escrita en `docs/antes-de-produccion.md`.
