# bnbtico · biblioteca completa · 5 noviembre 2026

[Guía de marca · PDF de 15 páginas](09-guia-de-marca/bnbtico-guia-de-marca.pdf) y [versión editable HTML](09-guia-de-marca/bnbtico-guia-de-marca.html).

Pantalla: tinta de la marca #1C2B2A en las versiones oscuras. Merchandising: carbón cálido #2B2926. Ambos transparentes. El nombre antiguo «negro-transparente» se conserva como alias de la tinta para no romper rutas; para imprimir use carbon-calido-transparente.

Regla general: los logos y sus maestros son transparentes por defecto. Los fondos sólidos están separados para perfiles de redes, iconos de instalación y otros usos que los necesiten. En los logos con puntos, el interior también es transparente.

**Logo predeterminado: BNBTICO en terracota #B44C30, sin marco y con fondo completamente transparente. Se ve el fondo de la pantalla por detrás.** Las versiones con marco de puntos también tienen el interior transparente. Los fondos sólidos se reservan para perfiles e iconos.

**Abra VISTA-GENERAL.html para revisar. EMPEZAR-AQUI contiene los archivos de uso habitual. Los cuatro SVG principales son terracota transparente; LOGOS-TRANSPARENTES reúne las cuatro composiciones en terracota, negro y crema, en SVG y PNG sin fondo.** Los numerosos archivos de las otras carpetas son tamaños, colores y formatos del mismo sistema aprobado; no son propuestas nuevas.

Se reutilizan los maestros y 350 archivos ya creados. Cuatro composiciones: BNBTICO, BNBTICO.COM, cuadrado de puntos con BNBTICO y cuadrado de puntos con BNBTICO.COM. Símbolos: contorno continuo + BT, y B original ensanchada y reforzada. Sin rana; solo la T sobresale en altura. Los puntos son círculos geométricos, sin sombras ni desenfoque.

| Carpeta | Contenido y tamaños |
|---|---|
| 00-maestros-svg | Símbolos BT y B en SVG y PNG, con los acabados identificados por carpeta |
| 01-logos | Cuatro logos SVG/PNG en los acabados aprobados; PNG de 4096 px en los tres principales |
| 02-iconos-pequenos | Selección ya aprobada: 16,24,32,48,64,96 px, SVG y PNG 1×/2×/3×, favicon e ICO |
| 03-web | Horizontales 160×70,200×80,240×96,320×128,400×160; cuadrados 70,96,160,240,320,400. PNG 1×/2×/3× y SVG siempre transparentes (terracota, negro, crema y blanco). Variante automática claro/oscuro también transparente |
| 04-apps | App Store 1024; Google Play 512; PWA 192/512 normal y maskable; apple-touch 180; catálogo iOS; capas para Icon Composer; Android adaptativo, monocromo y launcher en cinco densidades; notificaciones |
| 05-redes | Cada composición y símbolo en 320,400,800 px; Instagram, Facebook, LinkedIn, X y YouTube; mismos colores |
| 06-escritorio | ICO 16–256; ICNS y fuentes iconset 16–1024; seis acabados opacos |
| 07-impresion | 60 EPS CMYK, PDF vectorial de 60 páginas y perfil ICC; PNG RGB a 300 ppp de 50/100/200 mm de ancho |
| 08-vistas | Comparativas aprobadas y muestras de revisión |
| 09-guia-de-marca | Guía de 15 páginas, PDF y fuente HTML, fuentes Figtree/Outfit y licencias |

## Web sin fondo / perfiles con fondo

Para web, usar 03-web/ o LOGOS-TRANSPARENTES/: letras y marco de puntos sin ninguna placa crema ni fondo. El crema es el color de la página, no un rectángulo incluido en el logo. Los cuatro SVG de EMPEZAR-AQUI también son transparentes. Los acabados con fondo de 01-logos/ y los iconos de 04-apps/05-redes/ son para perfiles (Instagram, Facebook y otras redes), instalación y usos con fondo deliberado.

## Colores y fondos

- **Logo predeterminado:** terracota #B44C30 transparente. Para perfiles e instalación, terracota sobre crema #FFFBF2.
- **Alternativa:** crema sobre terracota. También crema sobre negro, tinta #1C2B2A o verde #2F5D45.
- **Fondos claros:** terracota transparente o sobre blanco.
- **Fotos:** blanco transparente, sin placa. Colocarlo en una parte de la foto suficientemente oscura; ninguna tinta fija puede contrastar con todas las fotos.
- **Merchandising:** carbón cálido #2B2926 transparente. El crema sobre soporte oscuro precisa tinta clara o base blanca según material.

## Tamaño visible y nitidez

B hasta 32 px; contorno + BT desde 48 px. El favicon usa siempre el dibujo de B de 16 px, incluso en pantallas de mayor densidad. Elegir por tamaño visible: 16@2x mide 32 píxeles físicos, pero sigue siendo el dibujo de 16 px. En los catálogos iOS se respeta el tamaño en puntos; Android launcher conserva BT a 48 dp aunque cambie la densidad.

Para mantener detalle, usar SVG en la web. Las cuatro composiciones completas se conservan sin engordarlas. En cabeceras estrechas, preferir BNBTICO sin marco; para un icono pequeño, usar los símbolos adaptados. Los cuadrados con muchos puntos y texto son para usos amplios: las exportaciones de 70/96 px están disponibles, pero los iconos BT/B son más legibles a esos tamaños. No ampliar una captura o miniatura para valorar nitidez: abrir el SVG o el PNG nativo.

## Instalación y recortes

Los iconos de tienda no tienen máscara ni sombra incorporada. App Store: PNG sRGB sin canal alfa. Google Play: PNG RGBA de 512 px, fondo opaco y menos de 1024 KB. PWA y avatares mantienen el contorno dentro del círculo seguro; Android incluye capas de 108 dp a cinco densidades, fondo de color y monocromo Android 13+. No usar el PNG de Google Play como capa adaptativa.

Los recursos para Icon Composer son capas PNG/SVG separadas; **no constituyen un proyecto .icon compilado**. El catálogo AppIcon.appiconset ofrece los PNG clásicos para Xcode. El montaje final y la validación en Xcode/Android Studio se hacen al integrar la app. Los fragmentos webmanifest y res son recursos para la integración nativa posterior. Por petición final de Ana, los PNG/ICO de las rutas existentes de las dos apps y las maquetas ya se sustituyen localmente por la marca nueva; también portada, imagen de compartir y prototipo. Los originales están en ../logos-obsoletos/2026-11-05/. No se ha desplegado.

## Imprenta

SVG digital en sRGB; escala sin pérdida. EPS y PDF contienen geometría vectorial y colores CMYK convertidos con el perfil **Generic CMYK Profile.icc**, incluido. PDF con OutputIntent ICC; no se declara PDF/X certificado. El carbón cálido #2B2926 tiene su conversión CMYK ICC; si se imprime a una tinta, el proveedor debe igualar la mezcla o el hilo al tono aprobado. Se incluye un índice de páginas y equivalencias de color en paginas-y-colores.json. Cada página mide 100 mm de ancho y puede escalarse.

El perfil definitivo de impresión depende del papel, tinta y proceso: la imprenta puede reconvertir los vectores con su perfil. PNG **no admite CMYK**: todos los PNG de imprenta siguen siendo RGB con etiqueta 300 ppp; para CMYK use EPS/PDF. No se entregan JPG. En digital el tamaño en píxeles manda; 72 ppp es metadato, no un límite de calidad.

## Referencias oficiales consultadas

- [Apple: App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons/)
- [Google Play: icon design specifications](https://developer.android.com/distribute/google-play/resources/icon-design-specifications)
- [Android: adaptive icons](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive)
- [MDN: PWA icons y zona segura](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons)
- [YouTube: imagen de perfil](https://support.google.com/youtube/answer/10456525)

inventario.json recoge dimensiones, hashes y procedencia; verificacion.json recoge las comprobaciones finales. Las fuentes de generación están en design/logo/maestro/.

## Sustituciones en el repositorio

Los originales anteriores están fuera del paquete vigente, en design/logo/logos-obsoletos/2026-11-05/, con rutas y hashes de los 53 reemplazos. Se preservan las rutas públicas usadas por código y maquetas; el PNG original del prototipo se conserva intacto en el archivo y su HTML apunta al SVG nuevo. 35 pruebas de prototipo correctas y revisión visual en teléfono de prototipo, portada y maqueta. Las dependencias de las apps no están instaladas y la compilación no se pudo ejecutar por falta de acceso al registro de paquetes. No se ha desplegado.

## Perfiles y portadas posteriores

Los archivos preparados después de la biblioteca se organizan en [redes-sociales](../redes-sociales/README.md): BT sin recuadro para perfil circular de Instagram y portadas de Facebook/WhatsApp Business. La B para el perfil del correo está en [05-redes/predeterminado/b-reforzada-512.png](05-redes/predeterminado/b-reforzada-512.png). Los ZIP de entrega son copias locales y no se versionan.
