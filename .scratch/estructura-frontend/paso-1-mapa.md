# Paso 1 · Mapa de carpetas por área (borrador para Ana, 2026-11-22)

Sale de leer las importaciones reales de los 101 archivos de `apps/app/src/client/` (lista de quién importa a quién, generada del código). Aplica la propuesta aprobada ([propuesta.md](propuesta.md) §3.1) con **cuatro ajustes** que pide el código; van marcados con ⚠ y necesitan su visto bueno.

## Ajustes a la propuesta aprobada

1. ⚠ **`publicar/` y `propietario/` son una sola área, `propietario/`, con subcarpetas.** Están entrelazadas: «Editar» usa los campos, el mapa y las fotos de publicar; «Mis casas» abre publicar, la casa y la suscripción; `asistir.tsx` usa calendario, editar, publicar y la casa; `owner.ts` y `editor-port.ts` los usan 18 y 11 archivos de los dos lados. Separarlas obligaría a llenar `comun/` de piezas que solo usa el anfitrión. Bulletproof React lo dice así: si dos funcionalidades no pueden vivir sin importarse, son una.
2. ⚠ **La ficha (`casa.tsx`, `hydrate-listing.tsx`) va con `explorar/`.** La ficha del cliente usa las mismas consultas que Explorar, Buscar y Filtros (`queries.ts`). La parte que pinta el servidor sigue en `shared/`.
3. ⚠ **`desktop.ts` y `supabase-data.ts` pasan de `client/` a `shared/`.** Hoy `shared/` ya los importa (`listing-page`, `site-top-bar`, `contact-flow`, `fx`…), lo que rompe la regla «`shared/` no importa `client/`».
4. ⚠ **`ScreenHeader` sale de `chrome.tsx`** a `comun/screen-header.tsx`. Lo usan las pantallas de todas las áreas, y `chrome.tsx` (los marcos de pestañas y de flujo) es del arranque e importa `actividad`. Si no se separa, todas las áreas importarían `app/`.

En este paso **no se renombra ningún archivo**, solo se mueve. Así se conservan los nombres de los trozos que vigila `.size-limit.json` (`publicar-*`, `supabase-data-*`…) y el historial de Git. La regla de idiomas (carpetas en español, código en inglés) se aplica a los archivos nuevos y a los que se toquen después.

## Destino de cada archivo

**`client/app/`**: arranque y rutas. Puede importar todas las áreas.
`main`, `start-shell`, `shell`, `chrome` (sin `ScreenHeader`), `persist`, `query-policy`, `sw-register`, `update-banner`, `vitals`, `legacy-storage`, `lazy-screens`, `cuenta-search`, `owner-search`.

**`client/explorar/`**: catálogo público.
Pantallas: `explorar`, `explorar-escritorio`, `buscar`, `filtros`, `favoritos`, `casa`, `que-es-3bstays` (+ su `.css`).
Piezas: `queries`, `listing-card`, `card-strip`, `card-whatsapp`, `explore-map`, `explore-map-full`, `explore-map-leaflet`, `map-preview`, `search-help`, `hydrate-listing`, `favorites-sync`.

**`client/propietario/`**: todo lo del anfitrión.
- Raíz: `propietario`, `casa-editable`, `actividad`, `asistir`, `owner`, `edit`, `editor-port`, `editor-query`, `editor-status`, `save-queue`, `house-card`, `house-picker`, `delete-house`, `owner-ui`, `inquiries`.
- `publicar/`: lo que hoy está en `client/publish/` (26 archivos) más `publicar`, `publicar-entrada` y `editar`.
- `calendario/`: `calendario`, `mark-sheet`, `panel-dias`, `close-sheet`, `reservation-calendar`, `calendar-days`, `airbnb`, `airbnb-calendar-row`, `ical-export-card`, y la pantalla `airbnb`.
- `suscripcion/`: `suscripcion` y `billing`.

**`client/cuenta/`**: `cuenta`, `cuenta-profile`, `cuenta-codigo`, `cuenta-lista`, `cuenta-ayuda`, `cuenta-navigation`, `support`.

**`client/admin/`**: `admin` (consultas), `admin-*` (7 pantallas), `edit-map-leaflet`.

**`client/comun/`**: lo que usan dos o más áreas.
`session`, `account`, `own-listings-query`, `listing-keys`, `listing-cache`, `offer-query`, `publish-promo`, `sign-in`, `whatsapp-dialog`, `turnstile`, `token-gate`, `code-input`, `confirm-sheet`, `router-buttons`, `router-rows`, `screen-header`, `hiding-chrome`, `motion`, `chunk-error`, `support-numbers`.

**`shared/ui/`**: los componentes comunes de la historia 07.
`button`, `card`, `choice`, `field`, `closed-field`, `overlay`, `overlay-stack`, `dismiss`, `combobox`, `stepper`, `structure`, `icons`.
El resto de `shared/` (ficha, mapa, calendario de la ficha, contacto, moneda…) no se mueve.

## Lo que queda cruzado y cómo se resuelve

| Importación | Problema | Solución |
|---|---|---|
| `comun/listing-cache` → `propietario/suscripcion/billing` (`billingQuery`, para invalidar) | `comun/` importaría un área | Invalidar por la clave sin importar la consulta: la clave de `billing` pasa a `listing-keys` (que ya es común) |
| `cuenta/cuenta-profile` → `app/lazy-screens` (`suscripcionScreen`, para precargar) | Un área importaría `app/` | Excepción con motivo: precargar la pantalla de otra área es composición de rutas. Alternativa: pasar la precarga por el contexto del router (más cambio) |
| `comun/publish-promo` → `offer-query` | — | Resuelto al poner `offer-query` en `comun/` |
| `app/chrome` → `propietario/inquiries` y `propietario/actividad` | — | Permitido: `app/` compone las áreas |

Las demás importaciones ya respetan las reglas con este reparto.

## Reglas nuevas en `tests/unit/architecture.test.ts`

1. `shared/` no importa `client/`.
2. `shared/ui/` solo importa React (y `react-dom`), `domain/` y otros archivos de `shared/ui/`. Hoy ya es así: `structure` usa `domain/status-label` e `icons` usa `domain/listing`.
3. Un área (`explorar`, `propietario`, `cuenta`, `admin`) no importa otra ni `app/`. Solo puede importar `comun/`, `shared/`, `domain/` y `data/`.
4. `comun/` no importa áreas ni `app/`.
5. Lista `EXCEPCIONES` con motivo, y una prueba que falla si una excepción ya no hace falta (como en `consistencia.test.ts`).

Primero se escribe la regla (falla con el árbol de hoy) y después se mueve hasta que pase.

## Qué más se toca

- Las rutas relativas de importación de todos los archivos movidos y de sus importadores.
- Unos 45 archivos de pruebas y scripts que importan de `src/client/` o `src/shared/`.
- `consistencia.test.ts`: sus rutas de excepción (`CLASS_EXCEPTIONS`, archivos de `src/`).
- `architecture.test.ts`: las rutas de sus reglas actuales (`client/editor-query.ts`, `client/screens/`…).
- Las guías: `docs/architecture.md` (piezas y carpetas) y `docs/componentes.md` (rutas de importación de los ejemplos).
- No cambian las URL, los nombres de los trozos ni el comportamiento.

## Orden de commits (cada uno con typecheck y pruebas unitarias en verde)

1. Reglas nuevas en la prueba (marcadas como pendientes) y `desktop.ts`/`supabase-data.ts` a `shared/`.
2. `shared/ui/`.
3. `comun/` (con `ScreenHeader` y la clave de `billing`).
4. `admin/`, `cuenta/`, `explorar/`, `propietario/`, un commit cada una.
5. `app/`, activar las reglas, guías actualizadas. Después, `size`, la hidratación de la ficha y la e2e completa una vez.
