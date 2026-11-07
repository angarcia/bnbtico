# 09 · Respaldo por código, retirada de Phone Auth, datos de prueba y documentación

Status: needs-triage
Type: task
Blocked by: 05, 06, 07, 08

## Qué

1. **Respaldo** (`spec.md` §5.9 y §4.3): `POST /api/verificacion/respaldo/enviar|verificar` con Twilio Verify desde el worker, topes de 3/día por número, 30/hora global y 1 por 30 s; solo tras 90 s o «No puedo enviar el mensaje»; telemetría de su uso.
2. **Retirada de Phone Auth:** `enable_signup = false`; quitar `[auth.sms]`, `[auth.sms.test_otp]`, `[auth.sms.twilio_verify]`, `rate_limit.sms_sent`, los triggers `handle_phone_confirmed`/`on_auth_user_phone_confirmed` y las migraciones/guías que dependan de ellos (con una migración nueva; `0001_init.sql` no se edita). Configurar lo mismo en el proyecto alojado (guía en `docs/configuracion-supabase.md`).
3. **Administradores:** correo real + TOTP, sin `@admin.bnbtico.invalid`; actualizar `seed_admin` y su prueba.
4. **Datos:** reemplazar los números de prueba y los helpers de `tests/*`, `pnpm datos:prueba` y `scripts/casas-de-prueba.mjs` por usuarios creados con la API de administración o con el endpoint fake. **Borrar los usuarios de prueba de `bnbtico-pruebas` solo con la autorización expresa de Daniel, listando antes qué se borra,** y reinscribir a Daniel y Ana como administradores (API de administración con la sesión de la CLI; no acceder a pruebas.bnbtico.com).
5. **Documentación:** la lista de `spec.md` §11 (incluida la entrada de `docs/decisiones.md`, a partir del Anexo A de `spec.md`, y la actualización de `CLAUDE.md`).

## Primero las pruebas

Respaldo: topes y vencimiento; ningún camino de la app llama ya a Phone Auth; `seed_admin` con correo real; `pnpm db:al-dia --reset` deja la base igual que el repositorio.

## No tocar

Los avisos de suscripción por WhatsApp (`reminders.ts`); la base alojada de producción (aún sin rutas).

## Hecho cuando

No queda código ni configuración de Phone Auth, la documentación refleja el flujo nuevo, y Daniel confirma el borrado y la reinscripción en pruebas.
