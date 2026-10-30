# 01 — Explorar y Mis casas: barra que se esconde, tarjetas y botón «Mapa»

Status: resolved

Grupos 1, 2 y 3 de `../spec.md`.

- La barra de abajo se esconde al desplazarse hacia delante y vuelve al desplazarse hacia atrás (decisión del dueño del producto: en **todas** las pantallas con barra: Explorar, Favoritos, Consultas, Mis casas, Cuenta y Calendario). Un solo sitio: `useHidingTabBar` sale de `calendario.tsx` a `apps/app/src/client/hiding-tabbar.ts` y se llama una vez en `TabsFrame` (`chrome.tsx`); se reinicia al cambiar de ruta y no actúa con el mapa o una hoja abiertos. Se conservan los casos del calendario (`ignoreTabBarScroll`, `showTabBar` al cancelar, `.app:has(.cal-panel)`). Solo la barra de abajo (`html.tabbar-away`); las cabeceras se quedan.
- `.map-label` baja con la barra cuando `tabbar-away`, con la misma transición.
- Cada casa de Explorar (`.listing-card`) en una tarjeta: fondo de superficie, sombra suave, esquinas pequeñas (estilo cuadrado), foto a sangre arriba y texto con relleno; más separación entre tarjetas. Mis casas (`.card.house-card`): más separación y el mismo lenguaje.
- El final de la lista deja siempre hueco para «Mapa» (no solo cuando la nota «¿No encuentra…?» es lo último).

## Comments

- 2026-10-30: «Mapa» se esconde al acabarse la lista (una marca sin alto tras la rejilla) en vez de dejar hueco al final. Icono de «Mis casas»: una casa (era el dibujo del pin). La barra ignora el desplazamiento hasta dos fotogramas tras montar (restauración del router), no 150 ms.
