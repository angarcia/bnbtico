# Iconos elegidos · Ana · 2026-11-05

| Tamaño visible | Símbolo |
| --- | --- |
| 96 px | Contorno continuo + BT |
| 64 px | Contorno continuo + BT |
| 48 px | Contorno continuo + BT |
| 32 px | B original más ancha y reforzada |
| 24 px | B original más ancha y reforzada |
| 16 px | B original más ancha y reforzada |

Son las referencias exactas elegidas por Ana en el chat: `02-contorno-bt` de la comparación de marcos, y `02-b-mas-ancha` de microiconos. Las seis versiones nativas sobre crema coinciden byte a byte con los SVG y PNG de esas referencias. La B conserva el trazado aprobado y se ensancha al 180 %; no es otra fuente.

## Archivos

**Acabado predeterminado:** terracota #B44C30 sobre crema #FFFBF2. Los archivos sin carpeta de la raíz son copias de ese acabado.

Cada carpeta de color incluye `icono-<tamaño>.svg`, PNG nativo, PNG `@2x` y `@3x`, además de `iconos-por-tamano.ico` con las seis representaciones nativas elegidas. `manifest.json` registra selección, origen y colores. `seleccion.png` muestra las seis versiones a escala real.

- `crema/`: terracota #B44C30 sobre crema habitual #FFFBF2.
- `crema-sobre-terracota/`: alternativa crema #FFFBF2 sobre terracota #B44C30 para usar sobre fondos oscuros.
- `blanco/`: terracota sobre blanco.
- `transparente/`: terracota sin fondo.
- `negro/` y `oscuro/`: crema #FFFBF2 sobre negro puro y tinta oscura #1C2B2A.
- `crema-transparente/`: crema sin fondo para otros colores oscuros sólidos.
- `blanco-transparente/`: blanco #FFFFFF sin fondo para fotos.

Elija el símbolo por el tamaño al que se ve, no por la resolución física del archivo. Ejemplo: para 16 px visibles en una pantalla 2×, usar `icono-16@2x.png` (32 × 32 px, conserva la B). Los SVG de cada tamaño permiten conservar la misma forma a cualquier densidad.

Para las pestañas del navegador, `favicon.svg` y `favicon.ico` conservan la B del diseño de 16 px en todas las resoluciones físicas. El ICO `iconos-por-tamano.ico` contiene el juego de tamaños diferentes (B hasta 32, BT desde 48).

El contorno se dibuja a tamaño nativo, con bordes alineados a la cuadrícula; no tiene sombra ni desenfoque. Las cuatro composiciones del nombre completo conservan el marco de puntos donde corresponde. Estos son los recursos de diseño definitivos para los tamaños indicados; esta revisión no modifica archivos de la aplicación ni realiza un despliegue.

Regeneración: `NODE_PATH=/ruta/a/node_modules node design/logo/maestro/generar-iconos-elegidos.cjs`, desde la raíz del repo, con sharp instalado.
