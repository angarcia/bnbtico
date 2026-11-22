## Estado al 2026-11-21

| Historia | Estado |
|---|---|
| #67 Contrato de privacidad | Hecha. Contrato aprobado con D1–D5 (`.scratch/seguridad-2026-11-17/01-contrato-privacidad.md`). D4 aplicada: el bucket ya no se enumera. |
| #68 Coordenadas | Hecha y desplegada en pruebas. El punto público se guarda con un desplazamiento aleatorio; 0 casas reversibles en pruebas. |
| #69 Fotos sin aprobar | Hecha y desplegada en pruebas, con dos ajustes de Ana: cada foto vive en un solo bucket, y la mueve un endpoint del worker en vez de `pg_net`. **Corrección pendiente de desplegar:** la primera pasada en pruebas chocó con el tope de 50 subpeticiones del plan gratuito y dejó una foto a medias (`065342d`). |
| #70 Cuota de contactos | Hecha y desplegada. |
| #71 Telemetría | Hecha y desplegada (8192 bytes; 120/min por IP con la vinculación de Workers). Falta ver llegar balizas en pruebas tras una visita. |
| #72 Auditoría OTP | Hecha (`06-auditoria-otp.md`). Hoy no se puede enviar ningún código real: las credenciales de Twilio en Supabase son marcadores. |
| #73 Remediación OTP | Paso 1 hecho en pruebas: 60 s entre códigos al mismo número. Pasos 2 y 3, aplazados (abajo). |
| #74 Validación | Informe en `.scratch/seguridad-2026-11-17/08-validacion.md`. Cerrable: la corrección de #69 está desplegada (`24ab399`) y `photo_sync_pending()` está en 0 en pruebas, sin restos en ningún bucket (2026-11-22). |

## Aplazado

- **Turnstile de punta a punta**: widget en Cloudflare (no existe), sitekey en GitHub y captcha exigido en Supabase Auth, en ese orden. Va con el **rediseño del inicio de sesión**, y **antes de poner credenciales reales de Twilio** (decisión de Ana, 2026-11-20).
- **Twilio**: Verify solo con WhatsApp, países permitidos y alerta de gasto. Se hace al configurarlo, con la misma condición.
- **Códigos fijos de los dos admins en pruebas**: se mantienen (opción B) hasta tener Twilio de pago. En producción, ninguno.
- **Producción (`3bstays-prod`)**: nace con el contrato y con la remediación OTP aplicados. Al crearla se repite la parte alojada de la validación.
- **Umbral de 120 balizas/min**: revisar con tráfico real (`docs/antes-de-produccion.md`).

## Riesgos residuales aceptados

- Copias de puntos y fotos publicadas antes del 2026-11-20: no se pueden revocar.
- El límite de balizas cuenta por ubicación de Cloudflare, no de forma global.
