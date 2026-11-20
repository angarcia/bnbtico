# Diagnóstico · estadísticas de contacto de la casa (2026-11-20)

Fase 1 de «Unificar clics de WhatsApp y consultas en las estadísticas de la casa». Solo lectura del código en `64f5ebd`
(igual que `origin/develop`). No se consultaron datos. Lo que se decidió después está en `docs/decisiones.md` (2026-11-20).

## Dónde se calcula (antes del cambio)

- Pantalla: `StatsCard` (`apps/app/src/client/screens/casa-editable.tsx`) leía `activityQuery` (`owner.ts`, `staleTime`
  30 s, persistida en IndexedDB como `own-activity`); solo con la casa activa y sin modo admin. Escritorio «clic», móvil
  «toque». Otro consumidor: `HouseFigures` de `suscripcion.tsx` (visitas y consultas). `listingStatsQuery` no la usa
  ninguna pantalla. Actividad ya no enseña cifras.
- RPCs vigentes (`20261030233129_admin_casas_acciones.sql`): `owner_activity()` (security definer, solo
  `owner_id = auth.uid()` y no eliminadas; devolvía `views`, `whatsapp_taps`, `inquiries`) y `owner_listing_stats(uuid)`
  (dueño o `is_admin()` aal2; ajena → «No encontramos ese anuncio.»; `views`, `inquiries`). Ambas: `revoke public, anon`,
  `grant authenticated`. Una casa ajena no expone nada.
- `create_inquiry` vigente: `20261112224100_consultas_sin_texto.sql` (4 argumentos) + envoltorio de 5 argumentos.
  Recorridas las 8 versiones de las migraciones.

## Tabla por contador

| | Visitas | Clics/toques en WhatsApp | Consultas |
|---|---|---|---|
| Fuente | `events.name='listing_view'` | `events.name='whatsapp_tap'` | filas de `inquiries` |
| Disparador | La ficha se monta (`listing-page.tsx`, efecto al montar), salvo vista previa o casa en la lista local de casas propias | Móvil: abrir la hoja desde la ficha o desde la tarjeta de Explorar (también en escritorio). Ficha de escritorio: cada envío del formulario, antes de validar. El envío automático al volver de verificar no la manda | `create_inquiry`: fila nueva si no hay otra del mismo cliente y casa con `created_at` de menos de 7 días; si la hay, `UPDATE` (datos, `updated_at=now()`, `owner_opened_at=null`) |
| Deduplicación | Ninguna (cada montaje, recarga, Atrás) | Ninguna, por toque, sin límite | 7 días desde la creación por cliente y casa; tope de 20 casas distintas en 24 h (error) |
| Ventana | `created_at > now() - 30 días` | igual | `inquiries.created_at` en 30 días; `updated_at` no cuenta |
| Zona horaria | Ninguna: 30×24 h móviles sobre `timestamptz` | igual | igual |
| Escritura | Baliza `sendBeacon`/`fetch keepalive` a `POST /events`; el worker valida forma, origen (solo si llega `Origin`) y 8 KB; inserta con la service role tras responder; un fallo solo queda en el log `beacon_write_failed`; no comprueba que la casa exista | igual | RPC con sesión, cuenta activa, WhatsApp verificado, casa activa, no propia, disponible y sin noches ocupadas |
| Retención | El cron diario borra lo de más de 90 días | igual | Sin recorte |
| Lo que NO acredita | Personas únicas; cuenta al dueño en otro teléfono, al admin y a bots con JS; se puede inflar | Que se abriera WhatsApp, que se enviara un mensaje o que hubiera sesión. En el móvil es «hoja abierta». Cuenta al dueño y los envíos rechazados | Que el mensaje se enviara. Repetir en 7 días cuenta 1. Incluye `source='support'` |

`inquiry_created` (baliza tras cada `create_inquiry` correcto, nueva o reutilizada) no lo lee ninguna estadística.

## Ejemplos

| Caso | Qué se registra |
|---|---|
| Abre la hoja (móvil o tarjeta de Explorar) y cancela | `listing_view` si vino por la ficha + 1 `whatsapp_tap`; ninguna consulta |
| Continúa sin sesión | Toque; va a Ingresar sin llamar a la RPC. Si abandona el código: 1 toque, 0 consultas. Si verifica: la hoja se envía sola, +1 consulta, `inquiry_created`, `wa.me` |
| Continúa con sesión | 1 toque, +1 consulta, `inquiry_created`, `wa.me` |
| Mismo cliente y casa a los 3 días | +1 toque, `UPDATE` de la misma fila, consultas igual |
| A los 8 días de crear la primera | +1 toque y fila nueva: 2 consultas si la primera sigue en la ventana (los 7 días se miden por `created_at`) |
| Falla el registro (sin red, noches ocupadas, tope, no disponible, casa propia) | El toque ya contó (en escritorio, uno por reintento); ninguna consulta |
| Falla la baliza | Se pierde en silencio; la consulta no depende de ella |
| La consulta cruza los 30 días | Sale del contador cuando `created_at` pasa de 30 días, aunque se renovara |
| «Creada hace 25 días y actualizada hoy» | Con la regla vigente `updated_at - created_at` es siempre ≤ 7 días: escribir hoy, pasados 7 días de la creación, crea una fila nueva. Una fila así solo existe si `updated_at` se tocó a mano |

## Por qué 16 clics pueden convivir con 1 consulta (causas posibles; sin datos no se atribuyen)

1. En el móvil el toque cuenta abrir la hoja, no enviarla.
2. Sin sesión, quien no termina la verificación suma toque y no consulta.
3. El mismo cliente repitiendo en 7 días: N toques, 1 consulta.
4. Errores (noches ocupadas, personas, sin red, tope); en escritorio, cada reintento.
5. Toques del propietario o del admin (la RPC rechaza al dueño).
6. Toques en la tarjeta de Explorar que no llegan a la ficha.
7. Desfase de ventanas entre un toque y una consulta.
8. Sin deduplicar ni limitar, y falsificable por POST.

## Alternativas que se valoraron

| | Pros | Contras |
|---|---|---|
| A (elegida). «Consultas»: `inquiries.created_at` en 30 días | Única con garantías, infalsificable, ya deduplicada, estable | No cuenta las repeticiones en 7 días; una renovada no revive en la ventana |
| B. Personas distintas con `updated_at` en 30 días | Cuenta a quien volvió a escribir | Sin fecha inmutable; cambia lo que ve el admin |
| C. Eventos `inquiry_created` en 30 días | Incluye repeticiones | Sin deduplicar, falsificable, se recorta a 90 días, puede perder balizas |
| D. Dos cifras con nombre honesto | Conserva el embudo | Contradice una sola métrica e invita a sumar |

Pendiente aparte (no decidido): «Visitas» no se deduplica ni filtra al admin.
