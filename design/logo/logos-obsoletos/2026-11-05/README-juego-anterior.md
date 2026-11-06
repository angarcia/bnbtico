# Logo de bnbtico · juego de archivos

> **Biblioteca completa por uso · 2026-11-05:** [Vista general](biblioteca-completa-2026-11-05/VISTA-GENERAL.html), [guía](biblioteca-completa-2026-11-05/LEAME.md) y [logos transparentes](biblioteca-completa-2026-11-05/LOGOS-TRANSPARENTES/). Para web: terracota, negro y crema sin fondo, incluidas las composiciones con puntos. Los fondos opacos se reservan para perfiles y apps. Conserva los maestros del kit aprobado y añade exportaciones por plataforma e imprenta.

> **Kit final vigente:** [kit-final-2026-11-05/](kit-final-2026-11-05/README.md). Predeterminado terracota sobre crema; alternativa crema sobre terracota. B hasta 32 px, contorno con BT desde 48 px.

> **Iconos pequeños elegidos · 2026-11-05:** contorno + BT a 96/64/48 px; B original más ancha y reforzada a 32/24/16 px. [Juego definitivo SVG/PNG/ICO](iconos-elegidos-2026-11-05/README.md). Las alternativas de las carpetas de propuestas quedan como exploraciones; esta elección manda para esos seis tamaños.


> **Revisión de diseño vigente · 2026-11-05 (Ana):** logo sin rana y tipografía aprobada con solo la T elevada. Maestros vectoriales en [maestro/](maestro/README.md) y juego completo BNBTICO / BNBTICO.COM en [unificado-2026-11-05/](unificado-2026-11-05/README.md), incluidas versiones para fotos y fondos oscuros. [Exploraciones anteriores de iconos](propuestas/iconos-compactos-2026-11-05/README.md), superadas por la selección indicada arriba para 16–96 px. Las secciones siguientes documentan el juego anterior y su integración actual en la app; la revisión de estos recursos no sustituye todavía esos iconos ni el original del prototipo.


Todos los archivos se generan a partir de `design/prototype/assets/bnbtico-original.png` (versión de la **rana**, la de producción), con los colores de la app indicados abajo. El original no se toca. Son PNG; si en algún momento hace falta SVG, hay que vectorizar la rana a mano (no sale bien automático).

## Colores

| Nombre | Hex | Uso |
|---|---|---|
| terracota | `#B44C30` | Versión principal sobre fondos claros |
| crema | `#FFFBF2` | Sobre fondos oscuros o verde selva |
| tinta | `#1C2B2A` | Monocromo oscuro (documentos, sellos, impresión en una tinta) |
| blanco | `#FFFFFF` | Sobre fotos o fondos de color ajenos a la paleta |

Decisión final del 2026-11-04 (Ana): después de comparar ambas versiones, los logos terracota y la rana del icono pasan de `#D65C3C` a **`#B44C30`**. Se actualizan también `apps/app/public/logo-horizontal.png`, sus iconos y el favicon. Se conserva el dibujo, la transparencia y la composición originales. Los colores de la interfaz no cambian: `--brand` sigue en `#D65C3C` para el menú, los favoritos y las mezclas del calendario; `--brand-ink` sigue en `#B44C30` para su tinta. Las pruebas de cobre, dorado y selección más profunda no se adoptan.

## Archivos (fondo transparente salvo que se diga)

- `bnbtico-horizontal-{terracota,crema,tinta,blanco}.png` — rana + nombre, 2048 px de ancho. **Cabecera de la app y web** (usar `terracota` sobre crema; `crema` sobre verde/oscuro).
- `bnbtico-simbolo-{color}.png` — solo la rana con la hoja, 1024 px. Avatares, marca de agua, pantalla de carga.
- `bnbtico-nombre-{color}.png` — solo la palabra, 2048 px. Pies de página, documentos.
- `bnbtico-horizontal-sobre-{crema,verde,oscuro}.png` — con fondo plano incluido y margen, para sitios que no admiten transparencia (correo, perfiles sociales, WhatsApp Business).

## Iconos de app y favicon

- `icono-crema-{1024,512,192,180}.png` — **icono principal desde 2026-11-04 (Ana)**: fondo beige `#FFFBF2`, rana y hoja terracota `#B44C30`, sin nombre. 1024 para App Store / Play, 180 para `apple-touch-icon`, 192 y 512 para el manifest de la PWA. Las copias de la app están en `apps/app/public/icons/`.
- `icono-terracota-{1024,512,192,180}.png` — variante inversa conservada: fondo terracota, rana crema.
- `icono-maskable-{512,192}.png` — fondo beige y rana terracota, para `purpose: "maskable"` en el manifest de Android (se conserva la composición dentro de la zona segura del 80 %).
- `icono-terracota-redondeado-{512,192}.png` — esquinas ya redondeadas, para previsualizaciones o donde el sistema no las recorta.
- `favicon.ico` (16/32/48) y `favicon-{16,32,48}.png` — fondo beige y rana terracota `#B44C30`, coherentes con el icono principal.

Los archivos principales son cuadrados y opacos: iOS y Android recortan las esquinas según el sistema. La referencia con esquinas redondeadas representa cómo se verá instalado; no se hornean esas esquinas en el PNG principal.

## Reglas de uso

- Margen libre alrededor del logo: como mínimo la altura de la cabeza de la rana.
- En la app la rana va a **38 px de alto** en la cabecera (ver tokens, `components.header`).
- No cambiar la proporción, no girar, no poner sombra ni contorno, no usar el logo sobre fotos sin la franja oscura translúcida.
- La versión con el perezoso (mitad superior del original) no se usa.

Exploraciones posteriores de tamaño mínimo (pendientes de elección): [B fina, B más ancha y cuadrado solo](propuestas/microiconos-2026-11-05/README.md).
