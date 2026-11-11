# 3bstays · biblioteca de logos · 10 noviembre 2026

## Empezar aquí

- Vista general: [VISTA-GENERAL.html](VISTA-GENERAL.html).
- Logo principal transparente: [SVG](logo-predeterminado.svg) y [PNG](logo-predeterminado.png).
- Logo con dominio: [SVG](logo-con-dominio.svg) y [PNG](logo-con-dominio.png).
- Icono, solo B: [SVG](icono.svg) y [PNG](icono.png).
- Guía de marca: [HTML](09-guia-de-marca/3bstays-guia-de-marca.html), con fuentes y licencias en la misma carpeta.

## Organización

| Carpeta | Uso |
| --- | --- |
| 00-maestros | Cinco composiciones SVG: logo, .com, ambos con marco de puntos y símbolo B. Terracota, crema, blanco, tinta y carbón cálido. |
| 01-logos | PNG transparentes de 2400 px; símbolo de 1024 px. |
| 02-web | Logos horizontales en cajas de 160×70, 240×96 y 400×160, a 1×/2×; SVG adaptativos claro/oscuro. |
| 03-iconos | Solo B: 16, 24, 32, 48, 64, 96, 128, 180, 192, 256, 512 y 1024; seis acabados, ICO y favicon adaptativo. |
| 04-apps | App Store 1024 sin alfa; Google Play 512 opaco; Apple Touch 180; PWA 192/512 normal y maskable; catálogo iOS; capas Android por densidad y notificaciones. |
| 05-redes | Perfiles B en 320/400/512/800/1080, terracota sobre crema y crema sobre terracota; portadas Facebook y WhatsApp. |
| 06-escritorio | ICO e ICNS en los dos acabados sólidos. |
| 07-impresion | SVG maestros, EPS CMYK de 100 mm, perfil ICC y PNG RGB de 50/100/200 mm a 300 ppp. |
| 09-guia-de-marca | Reglas de marca, origen, voz, usos y fuentes de la web con licencias. |

## Reglas

Logo aprobado: 3 angular con remate plano, B abierta con asta alta y «stays» en minúsculas. Las tres partes comparten base y la primera «s» se acerca a la B. La variante con dominio usa la misma composición y las letras de .com aprobadas. La B del logo completo tiene un trazo un 29 % más fino que el de la prueba angular original. Para el símbolo independiente y los tamaños de icono se usa el grosor reforzado.

Predeterminado: terracota original #B44C30 con fondo transparente. Crema #FFFBF2 sobre terracota o fondos oscuros; blanco transparente sobre fotografías; tinta #1C2B2A para la versión oscura de pantalla y carbón cálido #2B2926 para merchandising. Todos los iconos llevan solo el símbolo B, sin 3 añadido, BT ni marco. Los fondos de perfiles y apps son deliberados.

Las cajas web son tamaños de archivo, no tamaños mínimos del dibujo visible. Para cabeceras, el SVG maestro mantiene la proporción. Logo: mínimo recomendado 160 px de ancho; con .com y con marco, 240 px. Por debajo, usar B. Los puntos son círculos vectoriales sin sombra ni desenfoque; no usar el marco como favicon.

Los EPS y los PNG de impresión son entregas distintas: EPS vectorial CMYK convertido con Apple Generic CMYK Profile; PNG en RGB con 300 ppp. La imprenta debe ajustar el perfil al material y al proceso. No se promete una equivalencia Pantone. El blanco y el crema requieren tinta clara sobre materiales oscuros.

## Compatibilidad e histórico

Los SVG de partida aprobados están en 00-maestros/fuente. La marca anterior, bnbtico, y sus alias se retiraron del repositorio el 2026-11-11; siguen en el historial de git.

Los generadores están en scripts/: generar-3bstays.cjs (biblioteca) y exportar-3bstays-eps.cjs (EPS CMYK). Necesitan sharp. Los iconos de la app (apps/app/public) se copian a mano desde 03-iconos y 04-apps.

Favicon de pestaña elegido: cuadrado terracota #B44C30 con B crema #FFFBF2 y esquinas redondeadas. Archivos en 03-iconos/favicon-pestana/. Para el móvil/PWA se conserva crema con B terracota, sin recuadro dibujado.
