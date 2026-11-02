# 01 · Cabecera de la ficha: pin, sin «ubicación aproximada», anfitrión y hero 4:3

Status: ready-for-agent

## Qué
1. **Pin pegado al texto.** `apps/app/src/shared/listing-page.tsx:276-278`: hoy `<span className="row gap-6"><I.pin/> texto</span>` con `.row` flex `align-items:center` y `.listing-head > .row{justify-content:center}` (`global.css:73`, `:984-985`). Con dos renglones el icono queda centrado a la izquierda. Debe ir **inline justo antes de la primera palabra**, la línea centrada (`text-align:center`), el icono alineado con la primera línea (`vertical-align`), funcione con uno o dos renglones.
2. **Quitar « · ubicación aproximada»** de esa línea (queda «Playa Negra, Talamanca»). El aviso bajo el mapa (`shared/approx-map.tsx:20`) y la sección «Zona aproximada» **se quedan**.
3. **Bloque de la persona** (`listing-page.tsx:283-294`): nombre en negrita y debajo «Anfitrión · WhatsApp verificado» (si no está verificado, solo «Anfitrión»). Mismo avatar, mismos `hr`.
4. **Hero 4:3 en el teléfono** (`global.css:320`, `.hero{aspect-ratio:1/1}` → `4/3`). Escritorio (`global.css:1006`) sin cambios. Reserve la caja igual que ahora (sin CLS).

## No tocar
- Cabecera centrada como en Airbnb (decisiones 2026-10-29, línea «Cabecera de la ficha…»): nombre 28 px, zona, «N personas · habitaciones · baños», persona en su fila entre dos líneas, luego la descripción.
- Hero de borde a borde, sin esquinas, pegado arriba detrás del notch; botones a `top: calc(12px + env(safe-area-inset-top))`; portada `fetchpriority="high"`, `loading="eager"`, `decoding="sync"`, `sizes="100vw"`, `srcset` 480/800.
- SSR + hidratación sin avisos (`tests/e2e/ficha.spec.ts`), Lighthouse ficha en frío < 2,0 s.
- En iPhone SE (375×667) zona y personas se ven sin scroll (`ficha.spec.ts:~256` y `:292`, U105).

## Pruebas a actualizar
- `tests/e2e/ficha.spec.ts:70-77`: la regex de `host-line` (`/^[A-ZÁÉÍÓÚÑ]{1,2}\s*\p{L}+\s*WhatsApp verificado$/u`) pasa a admitir «Anfitrión · WhatsApp verificado».
- Añadir una e2e: con una zona larga en 375 px, el `top` del pin coincide (±3 px) con el de la primera línea de texto y su `right` queda a ≤ 8 px del inicio del texto.
- `docs/pruebas-manuales.md` C47 y A47 (quitar «ubicación aproximada»), U105/U106 si citan el texto o la foto cuadrada; `docs/diseno-v1.md:22`.
