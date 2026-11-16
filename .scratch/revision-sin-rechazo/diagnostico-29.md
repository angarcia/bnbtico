# Historia 29 · Por qué las casas rechazadas se quedaban en las listas

Fecha: 2026-11-16. Diagnóstico leyendo el código de `develop` (`00e10a0`). Las pruebas que lo cubren están escritas pero **no se han ejecutado**: ver «Validación».

## Dónde aparecía una casa rechazada (antes del cambio)

| Vista | ¿Aparece? | Estado que enseña | Acciones | Código |
|---|---|---|---|---|
| Mis casas (lista) | Sí, siempre | Etiqueta «Rechazada» + «Nota de 3bstays: …» | Ninguna | `listOwn` sin filtro de estado (`data/postgrest/owner.ts`); orden `ACTION_RANK.rejected = 0` (`domain/navigation.ts`) |
| Mis casas (detalle, también por enlace guardado) | Sí | «Anuncio rechazado» + motivo | Ninguna | `getOwn` sin filtro; `propietario.tsx` |
| Pestañas del anfitrión | Cuenta como casa | — | — | `useListingsCount` → `tabsFor` (una rechazada sola da «Mi casa») |
| Calendario y calendarios externos | No se ofrece | — | — | `hasCalendar`, `suspended` |
| Admin → Anuncios → «Rechazados» | Sí, las 50 últimas | «Rechazada» + motivo | Solo lectura | `REJECTED_SHOWN = 50` (`domain/review.ts`, `data/postgrest/admin.ts`) |
| Admin → Casas | Sí (no está publicada) | «Rechazada» | Solo «Eliminar casa» | `admin-houses.ts` |
| Ficha pública / Explorar | No | Enlace «no activo» | — | `listing_link_state` |

Caché persistida: la de TanStack Query se descarta en cada despliegue (`buster: __BUILD_ID__`, `client/persist.ts`). Una tarjeta retirada no vuelve por la caché tras desplegar el filtro. La pista local del número de casas solo se usa mientras llega la lista.

## Causa

El rechazo no tenía salida para el anfitrión. No podía corregir la casa (`can("edit")` solo admite borrador y cambios pedidos) ni descartarla (`listings_owner_delete` solo deja borrar un borrador nunca revisado). Además, el orden de «Mis casas» la ponía la primera, al nivel de «Cambios pedidos». **No es una regresión:** el comportamiento es el diseñado antes de la historia 27.

## Distinción de estados

- **Cambios pedidos** (`changes`): conserva la nota, «Corregir y reenviar» y el mismo anuncio. No se oculta (criterio 3). Lo cubre el contrato de admin «pedir cambios guarda el motivo… al reenviar, el mismo anuncio vuelve a la cola».
- **Rechazada** (`rejected`): sin acciones. Es la que se retira de Mis casas.
- **Eliminada** (`deleted_at`): RLS ya la oculta a todos, también al admin por REST.
- **Bloqueada** (`admin_hold = 'blocked'`): sigue en Mis casas con su aviso; no cambia.

## Relación con la historia 27

Es **trabajo cubierto por la 27** (su criterio 4: ocultar los rechazos anteriores de Mis casas y conservar el motivo en Admin). No es un caso distinto. Se implementa allí, una sola vez:

- `listOwn` y `getOwn` filtran `status <> 'rejected'`, en PostgREST y en el fake (`shownToOwner`). RLS y grants no cambian.
- Admin recupera el motivo en Anuncios → «Rechazados», ahora sin tope de 50, y en `admin_actions` (`listing.reject`).
- **Contadores y última casa:** las casillas y las pestañas se calculan con la lista ya filtrada. Un anfitrión cuya única casa era rechazada vuelve a la vista de cliente (aprobado por Ana el 2026-11-16).
- `review_listing` ya no admite `reject`, así que no se crean rechazos nuevos.

## Decisión pendiente (no se ejecuta)

No se borra ni caduca ningún rechazo. Borrarlos perdería el historial que pide la 27: motivo, fotos y la línea de `admin_actions`, y con un borrado físico `target_listing_id` pasaría a `null`. Si se quiere un plazo de retención, hay que decidirlo aparte en `docs/decisiones.md`. Otro punto abierto: el trigger todavía deja que el dueño devuelva un rechazo a borrador con un `update` directo, aunque la app no lo ofrece.

## Validación

Comandos para Ana, desde `apps/app`:

```bash
pnpm db:al-dia
```

```bash
pnpm typecheck && pnpm test
```

```bash
pnpm test:db
```

```bash
pnpm test:e2e tests/e2e/admin.spec.ts tests/e2e/calendario.spec.ts
```

Recorrido manual: `docs/pruebas-manuales.md` A71, D27–D29, D36–D37 y X8. Cubre el rechazo antiguo, cambios pedidos, recargar y reabrir la app, y el historial en Admin.
