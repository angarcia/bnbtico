# Pasada de escritorio · inventario de pantallas y navegación

Status: needs-triage (borrador sin aprobar; en espera desde el 2026-10-27 hasta que el móvil esté definido y probado, ver `docs/decisiones.md`)

Antes de la fase 7 (`docs/plan-implementacion.md`, «Pasada de escritorio»). Objetivo: cada pantalla bien a 1280 y a 1024 px sin cambiar lo que carga el móvil. Aquí solo el inventario y la navegación; las maquetas están en `design/pantallas/escritorio/` (E01–E04) y sus capturas en `.scratch/escritorio/capturas/` (no versionadas).

## Navegación (propuesta, maquetas E01 y E02)

- **Desde 1024 px.** Por debajo (teléfono y tableta en vertical) sigue la columna de 560 px con la barra inferior de siempre.
- **Cliente: barra superior** de 72 px (E01): logo a la izquierda, Explorar · Favoritos · Mi cuenta con icono y nombre (la activa en terracota sobre pastilla blanca, como el admin), a la derecha el selector «₡ | $» e «Ingresar» (sin sesión). Explorar y la ficha ya usan todo el ancho (revisión UX N5) y quien llega de un enlace compartido espera una web normal.
- **Propietario y admin: barra lateral** de 232 px (E02–E04), la del admin del diseño v1 (26–29): logo, Inicio · Mis casas · Calendario · Consultas (contador terracota) · Cuenta; abajo «Buscar una casa» (pasa al modo cliente, como en Cuenta) y el nombre con «WhatsApp verificado». El admin, igual con su etiqueta «Admin» y sus cuatro secciones.
- **En pantallas raíz de escritorio el logo va en la barra**, no en la cabecera de la pantalla; la cabecera queda con el saludo, el título de 34 px y la acción a la derecha («Nueva», «Publicar otra casa»).
- **Pantallas de flujo** (Ingresar, código, asistente, detalle de casa, suscripción, ayuda): conservan su flecha + título, dentro del área de contenido y con la barra a la vista (salvo el asistente y el código, que siguen sin barra: es un flujo que no conviene abandonar a medias).
- **Coste técnico (a medir antes de construir):** la barra ya es un único `<nav class="tabbar">` común (`src/client/chrome.tsx`); pasarla a superior o lateral es sobre todo CSS con `@media (min-width:1024px)`. Lo que necesita marcado nuevo es poco: el logo dentro del `<nav>` (oculto en móvil), «Buscar una casa» y el nombre en la lateral. Objetivo: < 0,5 KB gz más en la zona privada (hoy 142,16 de 150) y nada en la ficha SSR ni en su LCP.

## Inventario (24 pantallas)

Tipos: **R** = reorganizar (columnas o rejilla), **T** = tarjeta centrada de 560–640 px con la barra al lado (basta con CSS), **H** = ya hecha en la revisión UX.

### Cliente (barra superior)

| Pantalla | Ruta | Tipo | Qué cambia en escritorio |
|---|---|---|---|
| Explorar | `/explorar` | H + nav | Ya en 3–4 columnas; se le pone la barra superior (E01). |
| Filtros | `/explorar/filtros` | T | Panel de 640 px centrado (o lateral fijo de Explorar, a decidir con su maqueta); «Ver N casas» al pie del panel, no fijo abajo. |
| Ficha | `/casa/CT-####` | H + nav | Ya en dos columnas desde 1024 px; se le pone la barra superior **solo tras hidratar o en CSS puro**, sin tocar el HTML del servidor ni el LCP. Revisar con cuidado (única ruta SSR). |
| Hoja de contacto | (sobre la ficha) | R | Diálogo centrado de 480 px en vez de hoja desde abajo. |
| Favoritos | `/favoritos` | R | Rejilla de tarjetas como Explorar. |
| Ingresar | `/cuenta` sin sesión | T | Tarjeta de 480 px centrada; la tarjeta «vuelve a <casa>» al lado. |
| Código | `/cuenta/codigo` | T | Igual que Ingresar. |
| Mi cuenta | `/cuenta` | T | Tarjeta de 640 px; la lista y la invitación «¿Tiene una casa en el Caribe?» en dos columnas si caben. |
| Lista / recuperar | `/cuenta/lista`, `/cuenta/recuperar` | T | Tarjeta centrada. |
| Ayuda | `/ayuda` | T | Tarjeta centrada. |
| 404 / 410 | worker | T | Tarjeta centrada (sin barra en el HTML del servidor). |

### Propietario (barra lateral)

| Pantalla | Ruta | Tipo | Qué cambia en escritorio |
|---|---|---|---|
| Inicio | `/propietario` | R | Dos columnas: consultas nuevas y casa a la izquierda; oferta y avisos de pago a la derecha (E02). Con varias casas, una tarjeta por casa en la izquierda. |
| Mis casas | `/propietario/casas` | R | Rejilla de tarjetas con foto arriba, tres casillas de resumen arriba (E03). |
| Detalle de mi casa | `/propietario/casas/$id` | R | Foto y datos a la izquierda; lista de ajustes (compartir, calendario, editar, WhatsApp, «Anuncio visible», suscripción) a la derecha. |
| Asistente (9 pasos) | `/propietario/publicar/…` | T | Tarjeta de 640 px; «Atrás / Continuar» al pie de la tarjeta, no fijos al borde; el mapa del paso 3 y las fotos del 7 pueden usar más ancho. Mantener «una pregunta por pantalla, sin scroll» también a 1024×700. |
| Enviada a revisión | `…/enviada` | T | Tarjeta centrada. |
| Calendario | `/propietario/calendario` | R | Rejilla grande y panel de los días seleccionados **fijo a la derecha** en vez de hoja abajo (E04); sin días seleccionados, el panel explica cómo usarlo (texto a decidir). |
| Consultas | `/propietario/consultas` | R | Lista en dos columnas o tabla ligera; filtros por casa arriba. |
| Promoción y suscripción | `/propietario/suscripcion` | R | Casas a la izquierda; método de pago y tramos de la oferta a la derecha. |
| Cuenta (propietario) | `/cuenta` | T/R | Perfil y tarjeta «Suscripción» en dos columnas. |
| Hoja «Pausar anuncio», confirmaciones | (hojas) | R | Diálogos centrados de 480 px. |

### Admin (barra lateral; diseño 26–29 ya hecho en el lienzo)

| Pantalla | Ruta | Tipo | Qué cambia |
|---|---|---|---|
| Anuncios | `/admin` | R | Según 26 (tabla). |
| Revisar | `/admin/anuncios/$id` | R | Según 27 (decisión en columna fija a la derecha). |
| Casas | `/admin/casas` | R | Según 28. |
| Usuarios | `/admin/usuarios` | R | Según 29. |
| Segundo código | `/admin/codigo` | T | Tarjeta centrada. |

## Reglas para todas

- Lo que carga el móvil no cambia: presupuestos, `size-limit`, Lighthouse y la ficha SSR igual. Todo con `@media (min-width:1024px)` salvo el marcado mínimo de la barra.
- Las barras fijas al borde inferior del móvil (acciones del asistente, panel del calendario, hojas) pasan a su sitio dentro del contenido; nada flotando a 1280 px de ancho.
- Ancho máximo del contenido: 1040 px con barra lateral, 1200 px con la superior.
- Pruebas: Playwright a 1280×800 y 1024×768 además de Pixel 7; capturas de cada pantalla en los dos anchos.

## Pendiente de decidir con Daniel

1. La navegación de arriba (barra superior para el cliente, lateral para propietario y admin) y el corte en 1024 px (tableta en vertical sigue como el móvil).
2. Si el asistente y el código van sin barra también en escritorio.
3. Filtros: panel centrado o columna fija a la izquierda de Explorar.
4. Orden de construcción propuesto: (1) barras y cabeceras; (2) propietario (Inicio, Mis casas, Calendario, Consultas, detalle, suscripción); (3) asistente; (4) cliente (Filtros, Favoritos, hojas como diálogos, cuenta); (5) admin según 26–29. Se programa cuando la fase 5 esté cerrada en `develop` y el sustituto de WhatsApp unido.
