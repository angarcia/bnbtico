# Publicar v2 · estado previo (Task 0, BASE ac637cb, 2026-10-29)

Definiciones vivas completas: `.superpowers/sdd/plan/live-functions.sql` (pg_get_functiondef tras `pnpm db:reset`; sin `psql` en el host: se usó `docker exec supabase_db_bnbtico psql`).

## 0.1 Ultimas migraciones por función
| Función | Último archivo | Firma viva |
|---|---|---|
| submit_listing | 20261028071444_ubicacion_en_listings.sql | `(p_listing uuid)` |
| review_listing | 20261027202238_fase5_suscripcion.sql | `(p_listing uuid, p_decision text, p_note text)` |
| submit_edit | 20261029123728_editar_casa_ediciones.sql | `(p_listing uuid)` |
| review_edit | 20261029124626_editar_casa_revision.sql | **`(p_listing uuid, p_decision text, p_note text, p_submitted_at timestamptz)`** (4 args, no 3 como dice el brief) |
| save_edit | 20261029123728_editar_casa_ediciones.sql | `(p_listing uuid, p_patch jsonb)` returns listing_edits |
| listing_edit_check | 20261029123728_editar_casa_ediciones.sql | `(l public.listings, e public.listing_edits) returns void` |
| events_name_check | 20261029091243_explorar_fechas_y_zona.sql | ver 0.3 |

## 0.2 Reglas de nombre/descripción dentro de D
- `20261029122021_editar_casa_publicada.sql`: nada relevante (solo el regex de Storage con 480/800/1600).
- `20261029123728_editar_casa_ediciones.sql`:
  - l.148 (`listing_edit_check`): `char_length(t) not between 5 and 60` → «El nombre de la casa debe tener entre 5 y 60 caracteres.»
  - l.149: `d <> '' and char_length(d) not between 80 and 2000` → «La descripción debe tener entre 80 y 2000 caracteres.» (sin «o quedar vacía»; ya admite vacía)
  - l.198 (`save_edit`): nombre `not between 5 and 60`, mismo mensaje.
  - l.203 (`save_edit`): descripción solo `> 2000` → mensaje «…entre 80 y 2000 caracteres.» (no valida el mínimo 80 al guardar).
  - l.125 y l.218: zona > 60 (no tocar; es otra regla).
  - l.317 `submit_edit` llama `listing_edit_check`.
- `20261029124626_editar_casa_revision.sql`: l.48 `review_edit` llama `listing_edit_check`; l.16 `left(…,2000)` es el tope de la nota, no la descripción. Sin reglas propias de nombre.
- Task 2 redefine `listing_edit_check` (l.148-149) y `save_edit` (l.198 y l.203): nombre 5–32; descripción vacía o 80–2000 con mensaje E «…o quedar vacía.». En save_edit hoy no hay mínimo 80: decidir en T2 si se añade (el helper lo exige igual al enviar).

## 0.3 Eventos
- `events_name_check` vigente: page_view, listing_view, whatsapp_tap, inquiry_created, wizard_step, search_help_tap, monthly_filter_tap, search_submit, explore_map_open, map_marker_tap (A ya añadió los tres).
- `src/domain/telemetry.ts` l.67: `name: z.enum([...mismos 10...])`; l.73 `NO_LISTING = {page_view, search_help_tap, monthly_filter_tap, search_submit, explore_map_open}` (los demás exigen casa: listing_view, whatsapp_tap, inquiry_created, wizard_step, map_marker_tap).

## 0.4 Restos en apps/app (`grep MIN_PHOTOS|missingPhotosLabel|photosMissing|ResumeCard|reopenForEdit`)
- `ResumeCard`: **ya no existe** (B lo quitó).
- `reopenForEdit` **sigue vivo** (D NO lo quitó, pese a decisiones.md): `domain/api.ts:101`, `data/postgrest/owner.ts:116`, `data/fake/owner.ts:141`, `tests/contract/owner-listings.contract.ts:121-144`. (`useReopen` no aparece.) No es de E salvo que el plan lo pida; señalarlo.
- `MIN_PHOTOS = 5` en `domain/listing.ts:69`; `MIN_PHOTOS_PUBLISHED = 1` (:80, de D, se queda); `missingPhotosLabel` :275; `photosMissing` :278 (usado en :283 `validateStep`/paso 7).
- Usos de `MIN_PHOTOS`: `data/fake/admin.ts:7,147` (aprobar), `data/fake/owner.ts:14,51` (mensaje «Agregue al menos 5 fotos.»), `client/screens/admin.tsx:14,519,522`, `client/publish/fields.tsx:8,333` (+`missingPhotosLabel` :346, resumen paso 9), `client/publish/photos.tsx:4,15,30`.
- `tests/db/nombre-descripcion.test.ts`: existe; no reescrito aún (revisar en T2).
- Contador del paso 7: **D NO lo cambió a «N de 15»**: `photos.tsx:15` sigue `${n} de ${MIN_PHOTOS}–${MAX_PHOTOS}` con tone short/ok vía `PhotoCounter` de photo-grid.tsx (PhotoGrid cuenta con `{text,tone}`); `photos.tsx:30` línea «Falta N fotos · puede añadirlas al final».

## 0.5 Admin
- `client/screens/admin.tsx` `ReviewForm` (l.496): nota l.519 `<p className="note note-arena small">Faltan fotos: se requieren al menos {MIN_PHOTOS} para aprobar.</p>`; botón Aprobar `disabled={photos < MIN_PHOTOS || …}` l.522. Ya usa **`note-arena`** (B); `global.css:77-78` define `.note-sun` y `.note-arena`.
- D no movió `ReviewForm`/`RevisarScreen` (siguen en admin.tsx: RevisarScreen l.339, ReviewForm l.496); añadió `EditReviewForm` l.765 (revisión de ediciones, l.630).

## 0.6 Tamaños (build con VITE_WA_GUESTS="+506 6000 0000"; gz)
| Entrada | Tamaño / límite |
|---|---|
| Zona privada · JS inicial | 148.69 / 150 KB |
| Búsqueda de Explorar | 3.17 / 6 |
| Mapa de Explorar | 876 B / 2.5 KB |
| Mapa a pantalla completa | 1.08 / 1.5 |
| Leaflet | 42.72 / 44 |
| Mapa de la revisión de una edición | 643 B / 2 |
| Hoja de contacto | 5.08 / 5.5 |
| Pantallas de las pestañas | 21.12 / 24.5 |
| Ficha editable | 3.39 / 5 |
| Reglas y mutaciones de la edición (edit-????????) | 1.85 / 2 |
| Resumen de la edición | 275 B / 500 B |
| Reglas de los formularios | 719 B / 1 KB |
| Editar un dato (D añadió entrada `editar-*`) | 2.18 / 6 |
| Campos del asistente (fields) | 11.23 / 11.5 |
| **Asistente de publicar** | **2.97 / 15** (ya no 14.94) |
| Rejilla de fotos | 4.45 / 4.5 |
| Fotos del asistente | 1.12 / 5 |
| Zona del admin | 9.93 / 12 |
| Favoritos | 1.99 / 4 |
| Actividad | 1.84 / 4 |
| Calendario | 7.98 / 8 |
| Hoja «Cerrar la casa» | 1.12 / 1.5 |
| Promoción y suscripción | 5.49 / 7 |
| Calendario de la ficha | 1.8 / 4 |
| Web Vitals | 3.15 / 5 |
| Service worker | 2.44 / 4 |

Nota: Zona del admin 9.93 (progress.md decía 9.86). Holgura inicial 1.31 KB; Campos 0.27 KB; Rejilla 0.05 KB; Calendario 0.02 KB.

Lista de trozos (nombre sin hash) en dist/client/assets: actividad, admin, approx-map-leaflet, buscar, calendar, calendario, can, casa-editable, chunk-error, close-sheet, concurrency, contact-return, contact-sheet, cuenta, edit, edit-map-leaflet, edit-messages, edit-summary, editar, explore-map-full, explore-map-leaflet, favoritos, fields, filters, house-card, hydrate-listing, image, index, jsx-runtime, leaflet, link, listing-calendar, listing-page, location-leaflet, month-grid, offer, owner, photo-grid, photos, propietario, publicar, queryOptions, resize, review, rolldown-runtime, share-button, start-shell, step-forms, subscription, supabase-data, suscripcion, sw-register, useCanGoBack, useMutation, vitals, whatsapp.
Ojo: `contact-return-*` está en el inicial (tiny). Ya existe `publicar-*` (glob de «Asistente de publicar»).

## 0.7 Rutas y nombres
- `client/shell.tsx`: `flow` (id `_flow`, l.112, FlowFrame) y `privateFlow` (id `_privateFlow`, l.123, `requireSession`, PrivateOutlet; hijo de `flow`); también `adminFlow` (l.142) y `ownerRoutes` (id `_owner`).
- Rutas de D en privateFlow: `/propietario/casas/$id`, `/propietario/casas/$id/enviada`, `/propietario/casas/$id/editar/$campo` (lazy `./screens/editar` → `EditarCampoScreen`), `/propietario/suscripcion`, `/propietario/publicar` (→ `PublicarScreen`), `/propietario/publicar/$id/$paso` (→ `PasoScreen`), `/admin/codigo`. En `flow`: `/cuenta/codigo`, `/cuenta/lista`, `/cuenta/recuperar`, `/ayuda`, `/explorar/buscar`. (`/publicar` y `/publicar/continuar` aún no existen.)
- `type CuentaScreenName = "CuentaScreen" | "CodigoScreen" | "ListaScreen" | "RecuperarScreen" | "AyudaScreen"` (shell.tsx:33).
- `cuenta.tsx`: sin renombres; siguen `useContactMode` (l.55), `ReturnCard` (l.83), `EntryForm` (l.135), `CodeForm` (l.324), `ListaScreen` (l.453).
- `domain/navigation.ts`: `cardLabel(l, edit=null)` l.50: payment_due/inactive → STATUS_CARD_LABELS; luego `editLabel(edit)`; active cerrada → «Cerrada…»; si no `STATUS_CARD_LABELS[l.status]`; borrador = `{text:"Borrador", cls:"state-draft"}` (l.44). E no lo toca.

## 0.8 Documentación
- Siguiente «U» libre en `docs/pruebas-manuales-revision-ux.md`: **U87** (último U86).
- Primera entrada de `docs/decisiones.md`: `## 2026-10-29 · Editar una casa publicada sin sacarla de Explorar (Daniel, ronda de Ana, D)`.

## 0.9 Base verde
`pnpm typecheck && pnpm test && pnpm test:db` (desde apps/app, tras `pnpm db:reset`): typecheck OK; test 80 archivos / 1125 pruebas OK; test:db 32 archivos / 361 pruebas OK.

## Sorpresas
1. `review_edit` tiene 4 parámetros (`p_submitted_at`), no 3.
2. `reopenForEdit` sigue en api/postgrest/fake/contract pese a la decisión de D.
3. El contador del paso 7 sigue «N de 5–15» (D no lo cambió).
4. `save_edit` no comprueba el mínimo 80 de la descripción (solo > 2000); el helper sí al enviar.
5. `sudo`-free: no hay `psql` en el host; usar `docker exec -i supabase_db_bnbtico psql -U postgres -d postgres`.
