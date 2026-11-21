# Validación del cierre de privacidad y abuso (historia #74, segv1-validacion)

Fecha: 2026-11-21. Versión final: `bacb08e` en develop, desplegada en pruebas por el run de CI 44952063840 (calidad,
integración con la suite de base y la e2e completa, informe y despliegue en verde). Base `bnbtico-pruebas`
(`bpxiggdzgzolcazaaboj`) con todas las migraciones hasta `20261120232022`. Producción (`3bstays-prod`) no existe: nada de
este informe vale para ella hasta crearla y repetir la parte alojada.

Evidencia **local**: pruebas automáticas en el Mac y en CI sobre Supabase local. Evidencia **alojada**: lecturas en
`bnbtico-pruebas` con la API de administración (solo lectura, sin secretos) y el despliegue. Una revisión de código no
cuenta como verificación alojada.

## Resultado por hallazgo

| Hallazgo | Estado | Local (pruebas) | Alojado (pruebas) | Pendiente |
|---|---|---|---|---|
| **Coordenadas reversibles** (#68) | ✅ Cerrado | `tests/db/coordenadas-publicas.test.ts`: el cálculo antiguo con el CT ya no da el exacto; punto estable; ubicación nueva → punto nuevo; nadie lo fija a mano; exactas solo dueño y admin aal2. Contrato y e2e de Explorar/ficha | 13 casas publicadas con ubicación: 0 reversibles con la fórmula antigua, 0 con el punto exacto en `listings_public`; `approx_point` no existe | Los puntos publicados antes del 2026-11-20 siguen invertibles en copias guardadas por terceros (no se puede revocar; las casas recibieron un punto nuevo) |
| **Fotos sin aprobar públicas** (#69, D4) | ✅ Cerrado en código y base; ⏳ traslado de las existentes (ver abajo) | `tests/db/fotos-privadas.test.ts` (subida solo al privado; lectura, enumeración y URL firmada solo dueño y admin aal2, también con la ruta; la ficha solo enseña lo público; qué mover; solo service role), `tests/unit/photo-sync.test.ts` (8 casos del movimiento), contratos de fotos y edición, e2e de fotos y edición | Bucket `listings-privadas` privado; sin `listings_photos_public_read`; políticas de subida solo en el privado; `photo_sync_pending`/`set_photo_bucket` solo para service role | Ver «Traslado de las fotos existentes». Copias ya descargadas por terceros y la caché del CDN de Supabase (hasta un año) no se pueden borrar |
| **Carrera en la cuota de contactos** (#70) | ✅ Cerrado | `tests/db/limite-contactos-concurrente.test.ts`: 19 contadas + 3 nuevas a la vez → exactamente 1 con teléfono (antes, las 3); renovación en el límite; doble toque; dos clientes sin esperarse | `create_inquiry` desplegada con el candado por cliente | — |
| **Telemetría sin control** (#71) | ✅ Cerrado en código y despliegue; ❔ comportamiento alojado | `tests/unit/worker.test.ts`: corte al pasar 8192 bytes sin `Content-Length` o con uno falso, sin escribir; 429 sin leer ni escribir; cuenta fuera del isolate; limitador caído → descarta y avisa una vez; config de los 4 entornos. e2e de telemetría con el límite local alto | Desplegado con la vinculación `BEACON_LIMITER` (120/min por IP). Último evento recibido: 2026-11-20 22:28 UTC, **antes** del despliegue de #71: no ha habido visitas desde entonces | Una visita desde el teléfono a pruebas y comprobar que llegan filas nuevas a `events`/`web_vitals`. El límite cuenta por ubicación de Cloudflare, no global (aceptado) |
| **Acceso por código** (#72, #73) | ⚠️ Mitigado; pendiente con el rediseño del inicio de sesión | Sin cambios de código | Auditoría `06-auditoria-otp.md`. Hoy **no hay envío real posible**: las credenciales de Twilio en Supabase son marcadores. 60 s entre códigos al mismo número (antes 5 s), comprobado tras el cambio; tope de 30 envíos/hora | **Aplazado (decisión de Ana, 2026-11-20):** Turnstile de punta a punta (widget, sitekey, captcha exigido en Supabase Auth) y Twilio (Verify solo WhatsApp, países, alerta de gasto), **antes de poner credenciales reales**. Códigos fijos de los dos admins en pruebas: se mantienen (B) hasta Twilio de pago; ninguno en producción |

## Traslado de las fotos existentes (#69)

Tras la migración, todas las fotos que ya existían se dieron por publicadas (estaban en el bucket público) y la
sincronización saca de ahí las que no tocan (borradores, en revisión, ediciones, casas paradas). Antes de la primera
pasada: 30 pendientes, 0 objetos en el privado, 276 en el público.

**Primera pasada (cron de las 22:17 UTC del 2026-11-21): incompleta, con un defecto.** Movió 10 de 30 fotos (30 objetos al
privado) y dejó 20 pendientes. Causa: cada foto costaba 5 subpeticiones y el plan gratuito de Workers corta en **50 por
invocación**. La décima se cortó después de anotarse como privada y antes de borrarse del público: quedó con sus 3 objetos
en los dos buckets, **aún descargable por URL**, y ya no salía como pendiente. Comprobado con SQL en pruebas.

**Corrección (migración `20261121222224_fotos_sincronizar_por_lotes` y `src/server/photo-sync.ts`):** cada pasada respeta
un tope de subpeticiones (45 el endpoint, 25 tras el webhook de pago, 20 el cron, que va al final), anota el lote en una
llamada (`set_photo_buckets`) y borra con una por bucket; `photo_sync_pending` devuelve también las fotos bien anotadas con
restos en el bucket que no toca, así que una pasada cortada en cualquier punto se termina en la siguiente (incluida la
foto a medias de hoy). Pruebas: `tests/db/fotos-privadas.test.ts` (restos y lote), `tests/unit/photo-sync.test.ts` (tope:
20 fotos en dos pasadas sin pasar de 45; con 20 de tope, menos por pasada; limpieza de restos).

**Pendiente:** aplicar la migración en pruebas, desplegar y comprobar que `photo_sync_pending()` llega a 0 y que no queda
ningún objeto en el público de una foto que no toca (a ~5 fotos por hora con el cron; antes si se usa la app como admin).

## Recorridos que se conservan

En CI sobre la versión final (e2e completa, Pixel 7 y escritorio): publicar y revisar fotos, edición de una casa publicada,
ficha SSR con su vista previa e hidratación sin avisos, contacto por WhatsApp, Ingresar y el admin con TOTP. Desde el
teléfono, la guía `docs/pruebas-manuales.md`, apartado «Fotos privadas hasta su aprobación», queda para Daniel.

## Riesgos residuales y responsables

- Copias de puntos y fotos ya publicadas antes del 2026-11-20 (no revocables). Aceptado en el contrato.
- Límite de balizas por ubicación, no global. Aceptado (decisión 2026-11-20). Revisar el umbral con tráfico real (Ana,
  `docs/antes-de-produccion.md`).
- Acceso por código sin captcha: sin coste hoy (sin Twilio real); bloquea poner credenciales reales (Ana, con el rediseño
  del inicio de sesión).
- Producción: repetir la parte alojada de este informe al crear `3bstays-prod` (D5 del contrato).

No sustituye una auditoría exhaustiva ni autoriza el lanzamiento.
