# Maquetas: tarjetas flotantes (2026-11-03; segunda vuelta tras las decisiones de Daniel del 2026-11-04)

Capturas reales de la app local (`apps/app`, build de producción + Supabase local, datos del arnés de las e2e con fotos de `design/pantallas/fotos`) con `../maqueta.css` inyectado. La app no se ha tocado. Dos tamaños: `se` (375×667) y `pixel7` (412×839). Script: `apps/app/tests/capturas/flotantes.spec.ts` (no versionado):

```
cd apps/app && pnpm build && pnpm exec vite preview --port 4180 --host 127.0.0.1 &
E2E_PORT=4180 CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm exec playwright test --config tests/capturas/config.ts flotantes
```
(`MAQUETA=0` saca el estado actual, `SOLO=1,3` solo esas pantallas, `DEV=se` un tamaño.)

«Abajo» = tras desplazarse hacia abajo, con las tarjetas escondidas (`html.tabbar-away`, la clase que ya usa la barra de pestañas). «Subiendo» = mismo desplazamiento, al volver a subir: las tarjetas reaparecen sobre el contenido.

Segunda vuelta (decisiones de Daniel en `../README.md`): píldora de abajo con iconos y etiquetas en todas las capturas; en la ficha, dos piezas flotantes (tarjeta clara con los precios y, a 10 px, el botón verde), sin la nota «Precios orientativos…»; tres variantes para «Mapa» y «Ver ficha».

| Captura | Qué se ve |
|---|---|
| `1-explorar-{se,pixel7}` | Mapa a sangre arriba; «Empiece su búsqueda», filtros y «₡ \| $» flotan sobre él como tarjetas translúcidas. Abajo, la píldora con iconos y etiquetas; la activa con pastilla terracota suave. |
| `2-explorar-*-abajo` | Lista bajada: cabecera y píldora escondidas; queda «Mapa» abajo (variante a). |
| `2-explorar-*-subiendo` | Al subir: cabecera y píldora vuelven, sobre las fotos de la lista. |
| `3-ficha-*` | Volver, compartir y favorito como tarjetas sobre la foto. Abajo, la tarjeta de precios «₡55 000 / noche · ≈ $108 / noche» y debajo el botón «Contactar por WhatsApp», cada uno con su sombra. |
| `3b-ficha-*-con-fechas` | Con 3 noches elegidas (22–25) en el calendario de la ficha: la tarjeta dice «≈ ₡165 000 / 3 noches · ≈ $324» (en < 440 px los dólares van sin «/ 3 noches», como hoy). |
| `4-ficha-*-abajo` | Bajando: los botones de arriba se van; precios y WhatsApp se quedan (excepción). |
| `4-ficha-*-subiendo` | Subiendo: los botones vuelven fijos arriba, sobre el texto. |
| `5-mis-casas-*` / `-abajo` | Anfitrión 8777 0001 con 5 pestañas con etiqueta; bajando, la píldora se esconde. |
| `6-cuenta-*` | Cuenta con la píldora sobre la lista. |
| `7-publicar-*` | Paso «¿Dónde está su casa?»: «‹ / Continuar» en una barra flotante que no se esconde (excepción). La cabecera sigue en su sitio (segundo paso). |
| `8-filtros-*` | «Ver 5 casas» en barra flotante; los chips pasan por debajo. |
| `9-calendario-*` / `-panel` | Calendario del anfitrión; con dos días elegidos, el panel de edición flota como tarjeta (la píldora se esconde mientras está abierto, como hoy). |
| `10-boton-{a,b,c}-{se,pixel7}` | Hoja doble: a la izquierda «Mapa» sobre la lista de Explorar (con la cabecera y la píldora a la vista), a la derecha «Ver ficha» sobre el detalle de la casa del anfitrión. (a) tinta al 60 % con desenfoque y texto crema; (b) clara como las demás tarjetas, texto en tinta; (c) verde salvia (`selection`) al 90 % con texto `selectionInk`. Contrastes en `../maqueta.css` (T6). |
