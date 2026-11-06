# Logos y marca de bnbtico

## Archivos vigentes: empezar aquí

| Necesidad | Carpeta o archivo |
| --- | --- |
| Logo principal transparente | [BNBTICO terracota](biblioteca-completa-2026-11-05/logo-predeterminado.svg) |
| Ver las composiciones y colores | [Vista general](biblioteca-completa-2026-11-05/VISTA-GENERAL.html) |
| Guía de marca para compartir | [PDF](biblioteca-completa-2026-11-05/09-guia-de-marca/bnbtico-guia-de-marca.pdf) y [HTML editable](biblioteca-completa-2026-11-05/09-guia-de-marca/bnbtico-guia-de-marca.html) |
| Biblioteca por uso y tamaños | [Guía de archivos](biblioteca-completa-2026-11-05/LEAME.md) |
| Perfil circular de Instagram: BT sin recuadro | [PNG 1080 × 1080](redes-sociales/perfil-bt-sin-marco/instagram-bt-terracota-crema-1080.png) |
| Perfil de WhatsApp: BT con recuadro | [PNG 800 × 800](biblioteca-completa-2026-11-05/05-redes/predeterminado/simbolo-bt-800.png) |
| Perfil de correo: B reforzada | [PNG 512 × 512](biblioteca-completa-2026-11-05/05-redes/predeterminado/b-reforzada-512.png) |
| Portadas de Facebook y WhatsApp Business | [Archivos y descripción](redes-sociales/portadas-2026-11-05/LEAME.md) |
| Imprenta y merchandising | [Vectores CMYK y PNG de impresión](biblioteca-completa-2026-11-05/07-impresion/) |
| Fuentes de la web y licencias | [Figtree y Outfit](biblioteca-completa-2026-11-05/09-guia-de-marca/recursos/fuentes/) |

La **biblioteca completa** es la entrega de referencia. Los perfiles y portadas preparados posteriormente están en `redes-sociales/`. No hace falta recorrer las carpetas de propuestas para elegir un archivo.

## Reglas aprobadas

- Predeterminado: **BNBTICO en terracota #B44C30, sin marco ni fondo**. Debe verse la página o la fotografía por detrás, también dentro de los marcos de puntos.
- Cuatro composiciones: BNBTICO, BNBTICO.COM y ambas dentro del cuadrado de puntos. Mismos trazados, sin rana y con solo la T elevada.
- Pantallas: tinta de marca #1C2B2A para las versiones oscuras; crema #FFFBF2 sobre fondos oscuros; blanco transparente sobre fotografías.
- Merchandising: carbón cálido #2B2926 transparente. Los nombres antiguos «negro» se conservan como alias; elegir el acabado explícito para el soporte.
- Iconos pequeños: B reforzada a 16/24/32 px visibles; contorno continuo + BT a 48/64/96. El BT sin recuadro es una adaptación para perfiles circulares, no sustituye el favicon.
- Los fondos sólidos se incluyen cuando el soporte los necesita, como perfiles y aplicaciones. No hay sombras ni desenfoque en el logo.

## Organización y procedencia

| Carpeta | Estado y función |
| --- | --- |
| `biblioteca-completa-2026-11-05/` | **Vigente**: maestros exportados, logos, iconos, web, apps, redes, escritorio, imprenta y guía de marca. |
| `redes-sociales/` | **Vigente**: portadas y perfiles posteriores; también conserva nombres de archivo compatibles. |
| `maestro/` | Fuentes vectoriales, referencias originales y scripts de generación/verificación. Leer su README antes de regenerar. |
| `iconos-elegidos-2026-11-05/` | Fuentes de la selección aprobada, reutilizadas en la biblioteca. |
| `kit-final-2026-11-05/`, `unificado-2026-11-05/`, `negro-y-fotos-2026-11-05/` | Entregas intermedias conservadas para trazabilidad y regeneración. Para uso nuevo, elegir la biblioteca completa. |
| `bnbtico-actualizado/` | Exportaciones y nombres compatibles de la revisión inicial. Para uso nuevo, elegir la biblioteca completa. |
| `propuestas/` | Exploraciones anteriores, no una selección de logos vigentes. |
| `logos-obsoletos/` y `historico/` | Originales antiguos, incluidas las ranas; no usar en entregas nuevas. |
| `personalizado/` | Puntero al archivo de versiones antiguas. |

Las rutas se conservan para que sigan funcionando las referencias del código, las maquetas y los archivos entregados en este chat. Los PNG/ICO de la raíz son alias compatibles de la marca vigente: `horizontal` y `nombre` contienen las letras sin rana; `simbolo` contiene BT con contorno. `*-tinta.png` usa tinta de pantalla #1C2B2A.

La aplicación vigente está en `apps/app`; sus imágenes, portada, favicon y PWA usan los sustitutos nuevos. El prototipo usa `assets/bnbtico.svg`. Los originales se conservan con hashes en [logos-obsoletos](logos-obsoletos/2026-11-05/LEAME.md). La tabla de sustituciones documenta también la antigua app Next, retirada del árbol versionado; no debe restaurarse para usar los logos.

Los ZIP de entrega se conservan localmente y se excluyen de Git: duplican recursos ya versionados. El ZIP de biblioteca contiene esa biblioteca; los perfiles y portadas posteriores se encuentran por separado en los enlaces de arriba. No se despliega ni se hace commit al preparar estos archivos.
