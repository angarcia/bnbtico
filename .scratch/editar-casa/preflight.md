# Pre-vuelo · Editar una casa publicada (2026-10-29)

Hecho sobre `develop` en 76544c1, antes de tocar código.

## 1. Estado del árbol

- B+C (densidad-y-tarjetas) completo: tareas 1–11 con sus commits (362f5de … cf384bb) y el arreglo de la verificación final 2c56cea.
- A (explorar-airbnb) completo: tareas 1–11 (691361a … 8bfe0ba) y la verificación final 76544c1.
- Árbol limpio en lo versionado. Sin seguimiento y ajenos al plan: `.agents/`, `.claude/skills/`, `.scratch/ronda-ana-2026-10-28/terracota/`, `skills-lock.json`.

## 2. Tamaños (`VITE_WA_GUESTS="+506 6000 0000" pnpm build && pnpm size`)

| Entrada | Medido (gz) | Límite |
|---|---|---|
| Zona privada · JS inicial | 148.35 KB | 150 KB |
| Búsqueda de Explorar | 3.17 KB | 6 KB |
| Mapa de Explorar | 876 B | 2.5 KB |
| Mapa de Explorar a pantalla completa | 1.08 KB | 1.5 KB |
| Leaflet · trozo compartido | 42.72 KB | 44 KB |
| Hoja de contacto | 5.06 KB | 5.5 KB |
| Pantallas de las pestañas | 20.99 KB | 24.5 KB |
| Asistente de publicar | 13.75 KB | 15 KB |
| Fotos del asistente | 4.97 KB | 5 KB |
| Zona del admin | 8.1 KB | 12 KB |
| Favoritos | 1.97 KB | 4 KB |
| Actividad | 1.84 KB | 4 KB |
| Calendario | 7.96 KB | 8 KB |
| Hoja «Cerrar la casa» | 1.12 KB | 1.5 KB |
| Promoción y suscripción | 5.47 KB | 7 KB |
| Calendario de la ficha | 1.8 KB | 4 KB |
| Web Vitals | 3.15 KB | 5 KB |
| Service worker | 2.32 KB | 4 KB |

Margen: JS inicial 1.65 KB; pestañas 3.51 KB; publicar 1.25 KB; fotos 0.03 KB (no cabe nada); admin 3.9 KB.

Prefijos de trozos en `dist/client/assets/*.js`:
`actividad admin approx-map-leaflet buscar calendar calendario can chunk-error close-sheet concurrency contact-return contact-sheet cuenta explore-map-full explore-map-leaflet favoritos filters house-card hydrate-listing image index inquiry jsx-runtime leaflet link listing-calendar listing-page location-leaflet month-grid offer owner photos propietario publicar queryOptions resize review rolldown-runtime share-button start-shell subscription supabase-data suscripcion sw-register useCanGoBack useMutation vitals whatsapp`

Nota: ya existe un trozo `can-*` (lo comparten varias pantallas); `domain/can.ts` crece poco en la tarea 1.

## 3. Lo que dejó B+C

- `cardLabel(l: Pick<Listing, "status" | "available" | "reopenAt">, edit: EditState = null): CardLabel` en `src/domain/navigation.ts`. Devuelve `{ text, cls }` (no `{ label, badge }`).
- `EditState = "unsent" | "review" | "changes" | null` (en `navigation.ts`, «la rellena el plan D»). Ojo: B usa `"unsent"` donde D usa `"open"`. La tarea 1 cambia el parámetro a `Pick<ListingEdit, "status"> | null` y quita `EditState`.
- Clases de la etiqueta: **`state-*`**, no `badge-*`: `state-ok` (Activa), `state-draft` (Borrador; también «Edición sin enviar»), `state-review` (En revisión, Cambios pedidos; también «Edición en revisión» y «Cambios pedidos en la edición»), `state-pay` (Pendiente de pago, ocre), `state-off` (Inactiva, Cerrada), `state-bad` (Rechazada). Así que para `editLabel`: open → `state-draft`, review → `state-review`, changes → `state-review` (la de «Cambios pedidos», no ocre).
- Prioridad de `cardLabel`: pago (`payment_due`, `inactive`) > edición > Cerrada > estado. Las pruebas de la edición ya existen en `tests/unit/navigation.test.ts` (l.89–103, con `"unsent"`).
- Tarjeta: `HouseCardTop` en `src/client/house-card.tsx` (trozo propio `house-card-*`), prop `edit?: EditState`; la etiqueta se pinta en `<span className="state …">` sobre la foto. La usan `OwnerCard` (`propietario.tsx` l.194, sin `edit`) y `actividad.tsx` l.127. `Detail` (`propietario.tsx` l.302) llama a `cardLabel(l)` directamente.
- `casasView(1)` devuelve `"list"` (siempre lista; `"none"` con 0).
- El interruptor «Anuncio visible» y `CloseSheet` ya no están en `Detail` (`close-sheet.tsx` lo usa el Calendario).
- Notas que no son dinero: `note note-arena` (`.note-arena` en `global.css` l.78) y el bloque `card-arena` (cambios pedidos/rechazo en `Detail`).
- `--gutter: 16px` existe (`global.css` l.23).
- Siguen en `propietario.tsx`: `PayNotice`, `SubscriptionLink`, `StatsLine`, `ShareButtonInline`, `ShareListItem`, `SkeletonCard` (exportado), `NotFoundCard` (exportado), `useOwnListing` (exportado), `useUserId` (exportado). También `PayButton`, `ActivateButton`, `PaymentDueNote`, `NoticeCard`, `OwnerCard`.
- `Detail` todavía tiene «Editar la ficha · vuelve a revisión» con `useReopen` (solo para `active`, no mira `can(l, "reopen")`) y la nota «Estuvo publicada. Está editándola…»: los quita una tarea posterior de este plan.

## 4. Lo que dejó A

- Trozos nuevos: `buscar-*`, `explore-map-leaflet-*`, `explore-map-full-*`.
- Entradas nuevas de size-limit: «Búsqueda de Explorar» (6 KB), «Mapa de Explorar» (2.5 KB), «Mapa de Explorar a pantalla completa» (1.5 KB) y «Leaflet · trozo compartido» renombrada para incluir Explorar.
- A no toca las pantallas del propietario: `git diff 2c56cea..HEAD --stat -- apps/app/src/client/screens/propietario.tsx apps/app/src/client/house-card.tsx apps/app/src/domain/navigation.ts` sale vacío.

## 5. E y F

- E no ha llegado: `TITLE_MAX = 60` (`TITLE_MIN = 5`, `TITLE_LENGTH_ERROR` existe), no hay `MIN_PHOTOS_TO_APPROVE` (está `MIN_PHOTOS = 5`).
- F no ha llegado: `suscripcionSearch` en `shell.tsx` solo acepta `pago=ok`, no `?casa=`. El bloque de la suscripción sigue enlazando a `/propietario/suscripcion#pago=CT-####`.

## 6. Numeración

- Siguiente prueba manual libre en `docs/pruebas-manuales-revision-ux.md`: **U83** (la última es U82).
- Última migración: `supabase/migrations/20261029091243_explorar_fechas_y_zona.sql`.

## 7. Línea base

- `pnpm typecheck`: limpio.
- `pnpm test`: 77 archivos, 1084 pruebas en verde.
