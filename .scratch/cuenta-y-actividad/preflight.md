# Cuenta y actividad · estado previo (P0, 2026-10-29, base 58bc77f)

Solo registro; no se cambió código.

## P0.1 Planes anteriores
Todos aterrizaron: B+C (`b988a0f` ocre, `d893026` densidad, `e403cd4`, `6e40143` Actividad con la tarjeta de Mis casas), A (`76544c1`, `8bfe0ba`, `dbd7e07`…), D (`0acfbed`, `9920d6b`, `de1e331`…), E (`58bc77f`, `6c37f8b`…).

## P0.2 Tamaños (gz, `pnpm build && pnpm size`)
| Entrada | Tamaño | Límite | Margen |
|---|---|---|---|
| Pantallas de las pestañas | 21,33 KB | 24,5 KB | 3,17 KB (no hace falta `ProfileForm` diferido de antemano) |
| Promoción y suscripción | 5,49 KB | 7 KB | 1,51 KB |
| Actividad | 1,84 KB | 4 KB | 2,16 KB |
| Hoja de contacto | 5,08 KB | 5,5 KB | 0,42 KB |
| Zona privada · JS inicial | 148,87 KB | 150 KB | 1,13 KB |
| Entrada de publicar | 3,53 KB | 5 KB | 1,47 KB |
| Campos del asistente | 11,11 KB | 11,5 KB | 0,39 KB |
| Rejilla de fotos | 4,44 KB | 4,5 KB | 0,06 KB |
| Ficha editable (D) | 3,39 KB | 5 KB | 1,61 KB |
| Zona del admin | 10,04 KB | 12 KB | 1,96 KB |
| `filters-D2-lcaPr.js` (en el JS inicial, sin entrada propia) | 6 627 B (`gzip -9`) | – | – |

Nombres exactos en `apps/app/.size-limit.json` (los de arriba abreviados): «Pantallas de las pestañas · trozos diferidos (…)», «Promoción y suscripción · trozo diferido (…)», «Actividad · trozo diferido (…)», «Hoja de contacto · trozo diferido (…)», «Zona privada · JS inicial (…)». Entradas añadidas por B/A/D/E: Búsqueda de Explorar, Mapa de Explorar (+ pantalla completa), Leaflet, Mapa de la revisión de una edición, Ficha editable, Editar un dato, Reglas y mutaciones de la edición (`edit-<hash 8>`), Resumen de la edición, Reglas de los formularios, Campos del asistente, Asistente, Entrada de publicar, Rejilla de fotos, Fotos del asistente, Hoja «Cerrar la casa». No hay entrada `house-card-*`. Nota: Hoja de contacto (0,42) y Campos del asistente (0,39) están justas; esta ronda no las toca.

## P0.3 Prueba del ocre
`apps/app/tests/unit/ocre.test.ts`. Patrón: `OCRE = /\b(btn|card|note|tile|badge)-sun\b/g` (**sin `list-item-sun`**: Task 5 debe añadirlo al patrón). Recorre `src/client` y `src/shared`; la clave es `archivo#función` (la última `function Nombre` declarada antes de la coincidencia; `#*` = todo el archivo). Lista `ALLOW` (líneas 9–18): `client/screens/propietario.tsx#PayButton|PayNotice|ActivateButton|CasasScreen`, `client/screens/casa-editable.tsx#PaymentDueNote|StoppedNotice`, `client/screens/suscripcion.tsx#*`, `shared/contact-sheet.tsx#*`. `suscripcion.tsx#*` ya cubre la tarjeta y la fila de Cuenta (`CuentaSubscriptionCard`, fila `list-item` en 454). Si una fila ocre de Cuenta se escribe en `cuenta.tsx`, hay que añadirla (`client/screens/cuenta.tsx#<Función>`).

## P0.4 Entradas a la suscripción
Único `<Link to="/propietario/suscripcion">` con casa: `SubscriptionLink` (`propietario.tsx:48-54`, `hash=pago=CT-…`, sin `?casa=`). Pasan por él:
- `propietario.tsx:58` `PayButton` («Añadir método de pago», `btn btn-sun`), usado en `:90` (dentro de `PayNotice`, 74) y `:206` (tarjeta de Mis casas, `payment_due`).
- `propietario.tsx:67` `ActivateButton` («Activar suscripción», `btn btn-sun`; exportado), usado en `:207` (tarjeta, `inactive`) y `casa-editable.tsx:202` (`StoppedNotice`, testid `stopped-notice`).
- `casa-editable.tsx:176` `SubscriptionCard` (`list-item`, testid `subscription-card`, cabecera «Suscripción» en 173) usa `SubscriptionLink` directamente.
- `casa-editable.tsx:217` `PayNotice` (importado de propietario) / `PaymentDueNote` (149, sin enlace propio) y `:218` `StoppedNotice`.
- `propietario.tsx:111` otro uso de `PayNotice` con `title`.
No pasan por `SubscriptionLink` (todos en `suscripcion.tsx`, la propia pantalla): `Link` en 416 (`CuentaSubscriptionCard`, clase `link small`) y 454 (fila `list-item` de Cuenta «Método de pago»); `PayButton` propio en 76 (etiquetas «Añadir método de pago» y «Cambiar»); `PayNotice` propio en 176. `suscripcion.tsx:273` navega al volver con `pago=ok` con `search: {}` (aquí `scopeFix`). Etiqueta inactiva actual: «Activar suscripción» (enlace). El botón «Reactivar» sigue existiendo, solo dentro de la pantalla de suscripción (`suscripcion.tsx:232`, `btn-primary`).

## P0.5 Actividad
`actividad.tsx`: importa `HouseCardTop` de `../house-card` (línea 12; usado en 127 dentro de `ActivityCard`, `<article className="card house-card activity-card">`). `SingleActivity` **ya no existe**. Funciones: `ActividadScreen` 26, `FiguresSlot` 87, `Figures` 93 (`data-testid="activity-figures"`, `.activity-figures[.lg]`), `ActivityCard` 112, `InquiryCard` 133, `SkeletonActivity` 171. navegacion.spec 114 busca «Casa Cocles · sin fechas · 2 personas» en la consulta.

## P0.6 Pruebas e2e (apps/app/tests/e2e)
- «Reactivar» (botón de suscripcion.tsx, sigue vigente): `suscripcion.spec.ts` 111, 160, 167, 188; `fase5.spec.ts` 16 (comentario), 275, 282 (comentario), 283. (`fase5` 272 y `suscripcion` 144 son el texto del confirm «Puede reactivarla cuando quiera»).
- «Cerrar sesión» (botón de una sola pulsación hoy): `navegacion.spec.ts` 200–201; `cuenta.spec.ts` 92, 113, 162, 222 (220 comentario); `favoritos.spec.ts` 104 (comentario). Cuenta tiene el botón en `cuenta.tsx:656`.
- Línea de resumen: `fase3.spec.ts:175` (`${TITLE} · `); `navegacion.spec.ts:114` («Casa Cocles · sin fechas · 2 personas»); `suscripcion.spec.ts:285` («Ninguno todavía · tarjeta»); `contacto.spec.ts:65` («Propietario de ${TITLE} · WhatsApp verificado», ajena).
- «Activar suscripción» ya cubierto: `editar-casa.spec.ts:145` (href `/propietario/suscripcion#pago=…`, sin `casa`), `estados-suscripcion.spec.ts:159,160,230` (`payLink(...)`): Task 4 cambia estos hrefs.

## P0.7 Documento de pruebas manuales
La ronda de Ana vive en `docs/pruebas-manuales-revision-ux.md` (secciones «Ronda de Ana · densidad…», «Explorar al estilo Airbnb», «Editar una casa publicada», «Publicar v2», todas bajo B). Última fila: **U93**; la próxima libre es **U94**. Task 9 añade la sección de Cuenta y Actividad ahí, antes de «## C. Si algo falla» (línea 217 aprox.), y no usa `docs/pruebas-manuales-mejoras-2026-10-27.md` (última fila M48; no se toca en esta ronda).

## P0.8 Decisiones
Primera entrada de `docs/decisiones.md`: «## 2026-10-29 · Publicar v2: enviar sin fotos, verificar después del paso 1 (Daniel, ronda de Ana, E)». Task 9 pone la suya arriba del todo, fechada 2026-10-29.

## P0.9 Base verde
`pnpm typecheck` verde; `pnpm test` 81 archivos / 1145 pruebas verdes; `pnpm test:db` 33 archivos / 372 pruebas verdes (Supabase local en marcha). Sin rojos previos.

## Para tareas posteriores
- `cuenta.tsx` exporta `SignInForm` (151) y `ListaScreen` (475), y `publicar-entrada` importa `SignInForm` estáticamente: no moverlos ni renombrarlos.
- `filters-*` tiene 6,6 KB gz dentro del JS inicial (148,87/150): no estrenar APIs de zod en trozos diferidos.
- Árbol de trabajo con untracked ajenos (`.agents/`, `.claude/skills/`, `.scratch/ronda-ana-2026-10-28/terracota/`, `skills-lock.json`): no incluir en commits.
