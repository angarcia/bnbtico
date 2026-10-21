# Logo de bnbtico · juego de archivos

Todos los archivos se generan a partir de `design/prototype/assets/bnbtico-original.png` (versión de la **rana**, la de producción), recolorados en los colores de la paleta «Sol y sal» (`design/tokens/tokens.json` 0.2.0). El original no se toca. Son PNG; si en algún momento hace falta SVG, hay que vectorizar la rana a mano (no sale bien automático).

## Colores

| Nombre | Hex | Uso |
|---|---|---|
| terracota | `#D65C3C` | Versión principal sobre fondos claros |
| crema | `#FFFBF2` | Sobre fondos oscuros o verde selva |
| tinta | `#1C2B2A` | Monocromo oscuro (documentos, sellos, impresión en una tinta) |
| blanco | `#FFFFFF` | Sobre fotos o fondos de color ajenos a la paleta |

## Archivos (fondo transparente salvo que se diga)

- `bnbtico-horizontal-{terracota,crema,tinta,blanco}.png` — rana + nombre, 2048 px de ancho. **Cabecera de la app y web** (usar `terracota` sobre crema; `crema` sobre verde/oscuro).
- `bnbtico-simbolo-{color}.png` — solo la rana con la hoja, 1024 px. Avatares, marca de agua, pantalla de carga.
- `bnbtico-nombre-{color}.png` — solo la palabra, 2048 px. Pies de página, documentos.
- `bnbtico-horizontal-sobre-{crema,verde,oscuro}.png` — con fondo plano incluido y margen, para sitios que no admiten transparencia (correo, perfiles sociales, WhatsApp Business).

## Iconos de app y favicon

- `icono-terracota-{1024,512,192,180}.png` — fondo terracota, rana crema. **Icono principal**: 1024 para App Store / Play, 180 para `apple-touch-icon`, 192 y 512 para el `manifest.json` de la PWA.
- `icono-crema-{1024,512,192,180}.png` — alternativa clara (fondo crema, rana terracota).
- `icono-maskable-{512,192}.png` — para `purpose: "maskable"` en el manifest de Android (rana dentro de la zona segura del 80 %).
- `icono-terracota-redondeado-{512,192}.png` — esquinas ya redondeadas, para previsualizaciones o donde el sistema no las recorta.
- `favicon.ico` (16/32/48) y `favicon-{16,32,48}.png`.

## Reglas de uso

- Margen libre alrededor del logo: como mínimo la altura de la cabeza de la rana.
- En la app la rana va a **38 px de alto** en la cabecera (ver tokens, `components.header`).
- No cambiar la proporción, no girar, no poner sombra ni contorno, no usar el logo sobre fotos sin la franja oscura translúcida.
- La versión con el perezoso (mitad superior del original) no se usa.
