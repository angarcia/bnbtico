# 09 · Tarjeta de Explorar: fotos 5:4 deslizables a todo el ancho y botón de WhatsApp

Status: ready-for-agent (después del 08: reutiliza la hoja con días)

## Fotos
- `client/listing-card.tsx` y `global.css:277-293`. La tarjeta pasa a **todo el ancho** de la pantalla en el teléfono (sin el `--gutter` lateral); la foto sin esquinas; debajo la parte blanca con el texto y su relleno, y se sigue viendo el borde/sombra de la tarjeta. 32 px entre casas como ahora. Escritorio (3–4 columnas, `38641eb`) sin cambios.
- **Proporción 5:4** (Daniel).
- **Todas las fotos deslizables** en la propia tarjeta: tira horizontal con `scroll-snap` (CSS), contador «1 / N» como `.hero-counter` de la ficha. `PUBLIC_COLUMNS` ya trae todas las fotos.
- Carga: primera foto de la primera tarjeta `eager` + `fetchpriority="high"` (LCP); el resto `lazy`. Las fotos 2+ de cada tarjeta no se piden hasta que el usuario desliza esa tarjeta (patrón de `shared/hero-gallery.tsx`); compruebe que el LCP no empeora (Lighthouse).
- Tocar la foto abre la ficha (la tira está dentro del enlace); deslizar no navega. La transición compartida Explorar ↔ ficha (`6e34a42`) sigue funcionando con la primera foto.
- El corazón sigue arriba a la derecha de la foto.

## Botón de WhatsApp
- A la derecha de la parte blanca, un botón redondo con el logo de WhatsApp (icono nuevo `I.whatsapp` en `shared/icons.tsx`), `aria-label` «Contactar por WhatsApp a <anfitrión>», **fuera del `<a>`** (como el corazón).
- Abre la **misma hoja de contacto** sobre Explorar (trozo diferido, se carga al tocar; nunca en el JS inicial), con las fechas compartidas y los días de esa casa (`listingDaysQuery`). Sin sesión: el mismo flujo de hoy (`contact-flow.ts`, `next=/casa/CT-####?contacto=1`).
- Nunca `wa.me` directo: el número solo lo da `create_inquiry` con el WhatsApp del cliente verificado.

## No tocar
- Lo que muestra la parte blanca (nombre, zona, personas/habitaciones, precio o total del ticket 07).
- Mis casas (`house-card.tsx`) no cambia.
- Presupuesto: zona privada inicial ≤ 150 KB gz sin subir el límite; si no cabe, pare y diga cuánto falta.

## Pruebas
- `explorar.spec.ts:46-54`: el ancho pasa a `viewport` (no `viewport − 32`); `eager`/`lazy` como arriba; deslizar cambia el contador; tocar el botón de WhatsApp abre la hoja con el nombre de esa casa.
- `explorar-mapa.spec.ts:186,194`, `admin-casas.spec.ts:218,253`, `favoritos.spec.ts` (usan `.listing-card`): que sigan.
- Guía `docs/pruebas-manuales.md` (Explorar); `docs/diseno-v1.md`.
