# 03 · Worker: verificación por código inverso

Status: ready-for-agent
Type: task
Blocked by: 02

## Qué

En `apps/app/src/server`: endpoints `POST /api/verificacion`, `POST /api/verificacion/:id/estado`, `POST /webhooks/whatsapp` y el fake `POST /_pruebas/whatsapp/entrante` (ver `spec.md` §4.3). Interfaz `WhatsAppInbound` con adaptadores `twilio` (firma `X-Twilio-Signature`, parseo de `From`, `Body`, `MessageSid`) y `fake`. Generación del código (`BT-XXXX-XXXX`, alfabeto sin caracteres ambiguos), hash con `VERIFY_CODE_PEPPER`, creación del usuario con correo sintético y generación del enlace de acceso (según S1), límites iniciales de §4.9, Turnstile en la web.

Variables: `WHATSAPP_INBOUND`, `WHATSAPP_VERIFY_NUMBER`, `VERIFY_CODE_PEPPER`; documentar en `wrangler.jsonc` y en `docs/configuracion-supabase.md` (bypass de Access para `/webhooks/whatsapp`).

## Primero las pruebas

Firma válida/inválida/reutilizada; webhook sin código, vencido, repetido; resultado entregado una sola vez y solo con el secreto de dispositivo; límites; el fake responde 404 en producción y exige el secreto de Vault.

## Medir

Peticiones por verificación a `…/estado` con el sondeo propuesto; registrar el resultado para decidir D3.

## No tocar

La interfaz de usuario; `reminders.ts` (usa Twilio para salientes; no mezclar); el cron; los endpoints de pago.

## Hecho cuando

Con el fake, un reto se completa de extremo a extremo (reto → mensaje → cuenta creada → sesión canjeada) en las pruebas del worker, y la firma de Twilio queda cubierta.
