# 05 · «Ver ficha» flotante en el detalle de la casa del anfitrión

Status: ready-for-agent

## Qué
En `client/screens/propietario.tsx:318-330` (`CasaPropietarioScreen`), «Ver ficha» es hoy un enlace de texto en la cabecera (`.header-action`). Pasa a un **botón flotante** abajo y centrado, con el **mismo aspecto que «Mapa» de Explorar** (`styles/global.css:416-422`: alto 48, `padding:0 20px`, `border-radius:6px`, fondo `rgba(28,43,42,.92)`, texto `#FFFBF2` 500 15px, sombra, `gap:8px`) e icono de ojo a la izquierda (añada `I.eye` a `shared/icons.tsx` con el mismo trazo que los demás). Texto «Ver ficha». Sigue siendo un `<Link to="/casa/$publicId">` y solo con `can(l,"share")`.
- Comparta los estilos visuales con `.map-label` mediante una clase común (p. ej. `.float-pill` con lo visual; `.map-label` conserva su posición y su lógica de esconderse). No duplique valores.
- Posición: `position:fixed; left:50%; transform:translateX(-50%); bottom:calc(16px + env(safe-area-inset-bottom))` (esta pantalla no tiene barra de pestañas).
- **No debe tapar información:** añada al contenido de esa pantalla un `padding-bottom` de alto del botón + 32 px, para que lo último se pueda leer por encima.
- Quite «Ver ficha» de la cabecera.

## No tocar
- «Mapa» de Explorar: comportamiento (baja con la barra, `html.tabbar-away`, se va al final de la lista, `LABEL_ZONE`), aspecto y pruebas (`explorar-mapa.spec.ts:40,84`).
- Esquinas 6 px (decisión 2026-10-29, no píldora redonda).
- Resto de la cabecera y acciones del detalle.

## Pruebas
- E2E nueva: en el detalle de una casa activa sale el botón «Ver ficha» con el fondo de «Mapa» (compare `getComputedStyle` background y border-radius con `.map-label`), lleva a `/casa/CT-####`, y el último elemento de la pantalla queda por encima del botón al hacer scroll al final.
- `tests/unit/contrast.test.ts` si lista estilos de botones.
- Guía `docs/pruebas-manuales.md` A77/A78; `docs/diseno-v1.md:37`.

## Al rehacerlo tras la reversión (2026-11-04)
- Hechos antes: 01, 07, 08, 02, 03, 12 y 10. El 10 añadió el modo admin de la ficha editable (puerto `EditorPort`; `/admin/casas/$id` también tiene «Ver ficha» en la cabecera). **Alcance:** el detalle de la casa del anfitrión (`CasaPropietarioScreen`); en el modo admin, el mismo botón flotante solo si sale gratis del mismo componente (dígalo); si no, déjelo como está.
- Referencia del primer intento: `git show 6a0d6c2` (revísalo; allí el botón compartía la regla visual con `.map-label` vía `.float-pill`).
- Presupuesto: zona privada ~145,1 de 150 KB; el trozo «Pantallas de las pestañas» está a 25,09 de 25,2 KB (casi sin margen): si no cabe, pare y diga cuánto.
