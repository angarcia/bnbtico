# Guía de pruebas manuales de 3bstays

## Comprobación de logos · 2026-11-10

En móvil y escritorio, comprobar la cabecera de admin o página no encontrada y el aviso de giro: debe verse 3bstays sin placa de fondo, sin deformación ni recorte. Abrir la portada local con /?pronto=1 y comprobar el logo blanco sobre la foto. Revisar favicon, instalación PWA, apple-touch y recorte circular: solo el símbolo B abierto con asta alta. Contrastar claro/oscuro y comprobar las portadas de redes en la nueva biblioteca. No confundir la sustitución visual con el cambio de dominios o del copy de producto.

Fecha: 2026-10-30. Guía nueva, escrita desde cero tras los rediseños de la UI (revisión UX del 26 al 30 de octubre, publicar v2, edición dato a dato, ronda de Ana del 30 de octubre y acciones del admin en Casas). **Sustituye a todas las guías anteriores** (`docs/pruebas-manuales-fase-*.md`, `-revision-ux.md`, `-mejoras-2026-10-27.md`), que quedan como histórico. Los textos entre «» son los de la app, comprobados contra el código, las pruebas automáticas y un recorrido real de las 188 pantallas en un teléfono de 390 × 844.

Se prueba **desde el teléfono**, en `https://pruebas.3bstays.com`. Marque cada casilla; si algo falla, anote su código (C12, A40, D7, X3…) y siga (ver la sección 6).

| Parte | Quién | Códigos |
|---|---|---|
| 1. Preparación | Daniel | P1–P10 |
| 2. Cliente (visitante y con cuenta) | Cualquiera | C1–C105 |
| 3. Anfitrión | Cualquiera | A1–A147 |
| 4. Admin | Daniel o Ana | D1–D86 |
| 5. Recorridos de punta a punta | Varias cuentas | X1–X8 |

**Orden recomendado** (cada parte necesita datos de la anterior):

1. Preparación (1).
2. Anfitrión: publicar dos o tres casas hasta enviarlas (3.1–3.10).
3. Admin: entrar con el segundo código y decidirlas (4.1–4.5).
4. Cliente, con casas ya activas (2).
5. Anfitrión: gestionar las casas (3.11–3.19).
6. Admin: ediciones, Casas, editar casas, ficha y seguridad (4.6–4.10).
7. Recorridos de punta a punta (5).

---

## 1. Preparación

### 1.1 Entorno

- **App:** `https://pruebas.3bstays.com` (rama `develop`, worker `3bstays-pruebas` en Cloudflare, Supabase `bnbtico-pruebas`). Está protegida con Cloudflare Access: la primera vez pide el correo y un PIN de un solo uso. Sin Access quedan `/casa/*`, `/_purge/*`, `/assets/*`, `/fonts/*`, `/icons/*`, `/webhooks/*` y `/_pruebas/*`, así que una ficha se puede abrir sin PIN.
- **Desde la red corporativa (VPN):** `https://3bstays-pruebas.ana-garcia-saiz.workers.dev`. Es el mismo worker y la misma base, sin Access. Única diferencia: la purga de la ficha apunta a `pruebas.3bstays.com`, así que en `workers.dev` una ficha puede salir vieja unos minutos después de un cambio.
- **No se usa** `pruebas.bnbtico.com`: era la app vieja de Vercel y se apaga (decisión 2026-11-11).
- **Portada:** `/?pronto=1`. En pruebas, `/` lleva a Explorar desde 1024 px. En móvil lleva a 3Btico sin sesión y a Explorar con sesión.
- **App instalada:** después de cada despliegue, ciérrela y vuelva a abrirla para tomar la versión nueva.

### 1.2 Cuentas

Twilio Verify no manda SMS reales en pruebas: todo número que se use tiene que estar dado de alta como número de prueba, con el código fijo `123456`.

| Cuenta | Número | Papel |
|---|---|---|
| «Cliente Prueba» | `8888 1234` (+506) | Cliente que ya existe |
| Propietaria «Yorleny Prueba» | `8777 0001` (+506) | Dueña de las casas de prueba |
| Libre | `8888 9999` (+506) | Para registros nuevos; si ya se usó, añada otro |
| Admin | Daniel `+1 778 347 9837`, Ana `+1 778 347 8492` | País «Estados Unidos / Canadá (+1)» |

- **Añadir un número de prueba:** Supabase → `bnbtico-pruebas` → Authentication → Sign In / Providers → Phone → «Test Phone Numbers and OTPs». Escriba `<número sin +>=123456`, separado por comas, sin borrar los que hay.
- **Añadir un admin:** después de que cree su cuenta, en el SQL Editor: `select seed_admin('+<código><número>');`.
- **Segundo factor del admin:** se hace con una app de autenticación (Google Authenticator, 1Password…). Se vincula la primera vez que se entra a «Revisión de anuncios · admin» (D2–D6), y **quien escanee el QR primero se queda con el factor**.

### 1.3 Antes de empezar (Daniel)

- [ ] **P1** `gh run list --branch develop -L 1` → el último despliegue está en verde.
- [ ] **P2** `pnpm exec supabase migration list` → ninguna migración solo en «Local». Si hay alguna, aplicarla con `pnpm exec supabase db push`.
- [ ] **P3** GitHub → Settings → Secrets and variables → Actions → están `WA_GUESTS` y `WA_OWNERS`. Sin ellas no salen «¿No encuentra lo que busca?» ni Ayuda (C43–C45, C96, A143).
- [ ] **P4** Stripe en modo de prueba: los secretos del worker están puestos. Sin ellos, «Añadir método de pago» falla (503).
- [ ] **P5** Reloj de pruebas (A124–A139, X6). El worker tiene `TEST_CLOCK_SECRET`. En Vault, `select vault.create_secret('on','3bstays_test_clock');` si no existe; sin él, el reloj responde 409, y sin el secreto del worker, 404.
- [ ] **P6** Avisos por WhatsApp (opcional). Requisitos del número que los recibe:
  - está en `WHATSAPP_ALLOWLIST`, el secreto de GitHub en E.164 separado por comas;
  - se unió al sandbox de Twilio (`join <dos-palabras>`, dura 3 días);
  - escribió «hola» al sandbox en las últimas 24 h.

  Si no, el aviso se omite (`skipped`) y solo se ve en la app.
- [ ] **P7** Hay plazas de la oferta de lanzamiento: Cuenta → «quedan N de 50 plazas». Con 0 plazas, una casa aprobada queda «Pendiente de pago» en vez de «Activa».
- [ ] **P8** Fotos para subir: 4 a 6 fotos horizontales en el teléfono, y un PDF o un GIF para probar el rechazo.
- [ ] **P9** Una segunda persona o un segundo teléfono para los recorridos de la parte 5: cliente y propietaria a la vez. Si no, cambie de cuenta con Cuenta → «Cerrar sesión».
- [ ] **P10** Anote en la sección 7 el teléfono y el navegador que usa, por ejemplo iPhone 13 con Safari o Pixel 7 con Chrome.

### 1.4 Datos útiles

- **Tarjeta de prueba de Stripe:** `4242 4242 4242 4242`, vencimiento `12/30`, CVC `123`. Se guarda como «Visa ···· 4242 · vence 12/30». No hay cobro real.
- **Reloj de pruebas** (terminal; `$TEST_CLOCK_SECRET` es el secreto del worker):
  ```
  curl -X POST https://3bstays-pruebas.ana-garcia-saiz.workers.dev/_pruebas/oferta/CT-#### \
    -H "authorization: Bearer $TEST_CLOCK_SECRET" -H "content-type: application/json" \
    -d '{"diasRestantes":7}'
  ```
  Deja la casa con N días de oferta y manda al momento los avisos que toquen (90, 30, 7 y 0). Cada aviso sale una sola vez por casa: repetir el mismo número da `queued:0`. Con `-1` la casa queda en «Pendiente de pago». Para repetir el plan hace falta otra casa activa con oferta.
- **Cron:** cada hora, al minuto 17. Los avisos salen de 08:00 a 17:59, hora de Costa Rica; con el reloj de pruebas salen al momento.
- **Consultas SQL de diagnóstico** (SQL Editor de `bnbtico-pruebas`):
  - Avisos: `select l.public_id, r.days_before, r.status, r.sent_at from subscription_reminders r join listings l on l.id = r.listing_id order by r.queued_at;`
  - Pagos: `select provider, type, result, received_at from payment_events order by received_at desc limit 5;`
  - Errores del navegador: `select build, message, count(*) from client_errors group by 1,2 order by 3 desc limit 10;`
  - Decisiones del admin: `select action, reason, created_at from admin_actions order by created_at desc limit 10;`
- **Lo que no hay en v1** (no es un fallo que falte):
  - verificación de identidad (solo la línea de Cuenta «Pronto podrá verificar también su identidad (opcional).»);
  - chat interno, reservas y pagos entre cliente y propietario;
  - reseñas de casas y valoraciones de clientes;
  - aviso automático por WhatsApp de las decisiones del admin.

### 1.5 Casas de prueba

Sembradas el 2026-10-30 en `bnbtico-pruebas` por los mismos caminos que la app (script y créditos de las fotos en `.scratch/datos-prueba/`; fotos de Wikimedia Commons). Además de Crystal Jungle Villa solo existen estas. Dueños: **Yorleny Prueba** `8777 0001` y **Marco Prueba** `8777 0002` (código `123456`). Use cada casa para lo que dice su fila: así una prueba no estropea otra (sobre todo CT-1056, reservada para el reloj de pruebas).

| CT | Nombre | Dueño | Estado | Zona (provincia) | Fotos | Qué sirve para probar |
|---|---|---|---|---|---|---|
| CT-1040 | Crystal Jungle Villa | Daniel | Activa | Playa Negra (Limón) | 5 | Casa que ya existía; ficha y favoritos (C46–C55, C69–C74) |
| CT-1047 (a) | Casa Cocles frente al mar | Yorleny | Activa | Cocles (Limón) | 8 | Ficha completa con piscina, frente al mar, wifi, aire (C46–C55); filtros de características (C22–C30); consulta con fechas del cliente (C86–C92, A108–A112, X1); favorito; 3 noches ocupadas y una con precio especial (C31–C42, A94–A107) |
| CT-1048 (b) | Cabaña Manzanillo con rancho | Yorleny | Activa | Manzanillo (Limón) | 6 | Acepta mensual con ₡900 000 (C22–C23: total de una estancia de 30 noches o más con el mes prorrateado); mascotas y Rancho/BBQ; consulta con una estancia larga (C31–C42, C86–C92) |
| CT-1049 (c) | Loft Puerto Viejo cerca de todo | Yorleny | Activa | Puerto Viejo (Limón) | 4 | Mensual «Precio a negociar con el anfitrión» (C46–C55); aire, wifi, cargador eléctrico; consulta sin fechas; 0 habitaciones (estudio) |
| CT-1050 (d) | Habitación Playa Chiquita | Marco | Activa | Playa Chiquita (Limón) | 3 | Habitación con baño compartido, ₡25 000 (C4–C9, C46–C55, A21–A26); casa de otro dueño |
| CT-1051 (e) | Habitación privada en Cahuita | Marco | Activa | Cahuita (Limón) | 4 | Habitación con baño privado y «Niños pequeños gratis» (C22–C30) |
| CT-1052 (f) | Villa Punta Uva en la selva | Yorleny | Activa | Punta Uva (Limón) | 8 | 10 personas, ₡180 000, descripción larga de 14 líneas («Ver más», C46–C55); parqueo de pago; noches ocupadas el mes próximo y precios especiales con ★ (C31–C42, A94–A107); consulta de grupo; favorito |
| CT-1053 (g) | Apartamento Limón centro | Marco | Activa | «Barrio Roosevelt» escrita a mano, Otra… (Limón) | 3 | Zona propuesta con la marca del admin (D20–D27); parqueo gratis; búsqueda por Limón (C31–C42) |
| CT-1054 (h) | Casa Playa Negra tranquila | Yorleny | Activa, pausada hasta 2026-11-20 | Playa Negra (Limón) | 4 | «Pausar la casa» (A94–A107): no sale en Explorar pero su ficha abre; debe verse como no disponible (C56–C63, C86–C92); favorito |
| CT-1055 (i) | Casa Santa Teresa cerca del mar | Marco | Activa | Santa Teresa, Otra… (Puntarenas) | 5 | Otra provincia: sale en Explorar después de las de Limón (C30, C31–C42) |
| CT-1056 (j) | Casa Jaguar Puerto Viejo | Yorleny | Activa con oferta de lanzamiento (12 meses) | Puerto Viejo (Limón) | 5 | Para el reloj de pruebas (A124–A139, X6): cambiar sus días de oferta; no tocarla en otras pruebas |
| CT-1057 (k) | Cabina Hone Creek | Yorleny | Borrador incompleto | Hone Creek (Limón) | 0 | Sin fotos ni precio: «Falta: fotos y precio», «Seguir publicando» (A57–A65, A42–A49) |
| CT-1058 (l) | Cabaña Hone Creek con jardín | Yorleny | En revisión | Hone Creek (Limón) | 5 | Aprobar casa nueva (D28–D44, X1) |
| CT-1059 (m) | Casa Playa Bite con hamaca | Yorleny | En revisión | Playa Bite (Limón) | 3 | Pedir cambios y rechazar (D28–D44, X2) |
| CT-1060 (n) | Cabina Playa Grande Cahuita | Yorleny | Cambios pedidos | Playa Grande (Limón) | 4 | Nota «Necesitamos una foto del baño.»; «Corregir y reenviar» (A66–A76, X2) |
| CT-1061 (o) | Casa Siquirres vista al río | Yorleny | Rechazada | Siquirres (Limón) | 3 | Nota «Las fotos no corresponden a la casa.»; sin reenviar (A66–A76) |
| CT-1062 (p) | Casa Playa Chiquita jardín | Yorleny | Pendiente de pago | Playa Chiquita (Limón) | 4 | Oferta terminada (reloj en -1): «Añadir método de pago» con Stripe de prueba (A113–A139, X6); su enlace público no funciona (C64–C68) |
| CT-1063 (q) | Cabaña Pocora junto al río | Yorleny | Inactiva | Pocora (Limón) | 3 | Suscripción parada por la propietaria; «Activar suscripción» (A113–A123); enlace parado (C64–C68) |
| CT-1064 (r) | Casa Cocles con terraza | Marco | Activa, pausada por el admin | Cocles (Limón) | 4 | Pausa «Confirme que las fotos son de esta casa.»; el dueño la sigue editando (D58–D78, A66–A76); no sale al público |
| CT-1065 (s) | Casa Guápiles con piscina | Yorleny | Activa, bloqueada por el admin | Guápiles (Limón) | 3 | Bloqueo «Publica un teléfono dentro de las fotos.»; dueño sin editar, enlace 410 (D58–D78, C64–C68) |
| CT-1066 (t) | Casa Punta Uva bambú | Yorleny | Activa con cambios pendientes | Punta Uva (Limón) | 4 (+1 nueva) | Nombre y descripción enviados a revisión («Casa Punta Uva Bambú Lodge») más 1 foto nueva: aprobar y pedir cambios dato a dato (D45–D57, A81–A93) |

Consultas del cliente `8888 1234` (pestaña «Consultas» de Yorleny, A108–A112): a CT-1047 (19 al 22 de noviembre, 3 personas), CT-1048 (29 de noviembre al 29 de diciembre, 30 noches, 2 personas), CT-1052 (14 al 18 de diciembre, 8 personas) y CT-1049 (sin fechas). Favoritos del cliente: CT-1047, CT-1052, CT-1054.

Límites a tener en cuenta: Yorleny tiene 1 borrador (CT-1057) de los 5 permitidos. Las 15 casas aprobadas llevan oferta de lanzamiento 12 meses (plazas 5 a 19; CT-1040 tiene la 4), salvo CT-1062 (oferta terminada a propósito). El contador «quedan N de 50 plazas» baja en consecuencia.

Para volver a sembrar (p. ej. después de gastar CT-1056 o de decidir CT-1058/CT-1059), pídaselo a Claude: el script salta las casas que ya existen por nombre.

---

## 2. Cliente (visitante y cliente con cuenta)

Se prueba desde el teléfono en `https://pruebas.3bstays.com` (la portada, en `/?pronto=1`). Hace falta, creadas antes en la parte Anfitrión o por un admin: **al menos 5 casas activas en Limón** en dos o más zonas; entre ellas una con «Acepta alquiler mensual» y precio al mes, otra con mensual a negociar, una con piscina y frente al mar, una con descripción larga (más de 8 líneas), una con días ocupados y un precio distinto en el calendario y una con varias fotos. Además, **una casa con la suscripción parada por el propietario** (enlace que ya no funciona), **una en revisión** y **una pausada con «Pausar la casa»**; apunte sus `CT-####`. Cuentas (código `123456`, +506): `8888 1234` (cliente que ya existe), `8888 9999` (libre: registro nuevo) y `8777 0001` (propietaria Yorleny Prueba, dueña de las casas). Empiece los recorridos «sin cuenta» con la sesión cerrada o en una pestaña privada.

### 2.0 Acabado compartido de botones y notas (2026-11-05)

Revisar en 390 × 844 y 375 × 667. Estos controles comprueban la tanda 1; no acreditan los cambios de estructura de las tandas siguientes.

- [ ] **C0a** En Publicar casa y Filtros, Continuar y Ver N casas muestran fondo verde claro, texto verde, sombra suave y ningún borde permanente; texto e icono siguen centrados y el área táctil mide al menos 44 × 44 px.
- [ ] **C0b** En un editor sin cambios efectivos, Guardar sigue desactivado de verdad: fondo `#F2F1ED`, texto `#898D88`, sin sombra ni borde. Hacer un cambio válido lo activa; deshacerlo vuelve a desactivarlo. No se guarda nada al tocar un desactivado.
- [ ] **C0c** Las notas informativas tienen fondo neutro claro, texto normal y borde suave; los errores y avisos conservan su color funcional. Pagos y Activar suscripción siguen dorados; WhatsApp mantiene su identificación.
- [ ] **C0d** Con teclado, el foco sigue siendo visible en acciones y enlaces. Revisar nombres largos y ambos tamaños móviles: no hay texto recortado, solapamientos ni cambios de tamaño al pulsar.

### 2.1 Portada

- [ ] **C1** Abra `/?pronto=1` → se ve «MUY PRONTO», el título «Alquile en el Caribe de Costa Rica, directo con quien lo recibe», la foto «PLAYA NEGRA · PUERTO VIEJO DE TALAMANCA» y, al bajar, «Qué es 3bstays», «Dónde empezamos» y «Cómo funciona» en tres pasos; sin barra de pestañas.
- [ ] **C2** Mire la tarjeta «¿Tiene una casa en el Caribe?» y toque «Publicar mi casa» → dice «Las primeras 50 casas: 12 meses gratis. Después, ₡2 900 al mes por casa, sin comisiones ni permanencia.» y el botón lleva al asistente de publicar (`/publicar`), no a WhatsApp.
- [ ] **C3** Abra `/` (sin `?pronto=1`) → en pruebas lleva directo a Explorar («Explorar casas»), no a la portada.

### 2.2 Explorar sin cuenta: lista y tarjetas

- [ ] **C4** Abra `/explorar` sin sesión → arriba, a todo el ancho y pegado al borde, el mapa; encima flotan como tarjetas claras translúcidas (se ve el mapa difuminado detrás, sombra suave, esquinas redondeadas, a 12 px de los bordes) la píldora «Empiece su búsqueda» y, debajo, el botón de filtros a la izquierda y «₡ | $» a la derecha, sin logo ni botón «Ingresar»; abajo, la barra flotante en forma de píldora con «Explorar», «Favoritos» e «Ingresar» (en ese orden), cada una con icono y nombre, y la elegida sobre una pastilla terracota suave.
- [ ] **C5** Mire la línea de resultados y las tarjetas → la línea dice «N casas en Limón» (con una sola, «1 casa en Limón») y N coincide con las tarjetas; cada tarjeta es una por fila, a todo el ancho, con foto, nombre, zona, iconos y texto de personas, dormitorios y baños según el tipo de alojamiento y precio «₡95 000 / noche», un corazón arriba a la derecha de la foto, el contador «1 / N» abajo a la derecha de la foto (si la casa tiene más de una) y, en la última fila junto al precio, un botón con el logo de WhatsApp y marco cuadrado de esquinas suaves. El tipo de alojamiento se muestra centrado a la derecha del nombre y la ubicación va debajo. Las características se muestran encima del precio.
- [ ] **C6** Baje por la lista → la búsqueda, los filtros y «₡ | $» (ya no hay «Solo alquiler mensual») salen por arriba y la barra de abajo por abajo; suba un poco → vuelven todos a la vez, flotando sobre las fotos de la lista; arriba del todo siempre están a la vista; la barra de abajo no tapa la última tarjeta. Con la cabecera escondida, toque donde estaban la búsqueda, los filtros o «₡ | $» → no se abre nada de la cabecera (el toque va a la lista de debajo).
- [ ] **C7** Al final de la lista → la tarjeta «¿Tiene una casa en el Caribe?» con «Publíquela gratis 12 meses. Quedan N de 50 plazas.» y el botón «Publicar mi casa gratis», que abre el asistente de publicar sin pedir cuenta; vuelva con Atrás y Explorar sigue donde estaba.
- [ ] **C8** Toque una tarjeta lejos del principio de la lista y luego la flecha «Volver a Explorar» de la ficha → Explorar vuelve al mismo punto del desplazamiento y con esa tarjeta a la vista.
- [ ] **C9** Toque el corazón de una tarjeta sin sesión → se rellena al instante, su nombre pasa a «Quitar de favoritos», no abre la ficha y no pide cuenta.
- [ ] **C9a** Deslice con el dedo la foto de una tarjeta hacia la izquierda → pasa a la foto 2 (encaja sola, sin quedarse a medias) y el contador dice «2 / N»; la página no se mueve de lado ni se abre la ficha; siga deslizando hasta la última y vuelva → el contador sigue la foto. Una casa con una sola foto no tiene contador ni se desliza. Toque la foto (sin deslizar) → abre la ficha y la foto «vuela» hasta la de arriba de la ficha.
- [ ] **C9b** Con DevTools (Red, filtro «storage»), cargue Explorar → solo se pide la primera foto de cada tarjeta; deslice una tarjeta → se piden entonces su foto 2 y su foto 3, y no las de las demás tarjetas.
- [ ] **C9c** Sin sesión, toque el botón de WhatsApp de una tarjeta → se queda en Explorar y sube la misma hoja de la ficha, «Escríbale a <nombre>» con el nombre de esa casa (no abre WhatsApp directamente); con llegada y salida en la búsqueda, la hoja las trae y dice el total; con alguna noche ocupada en esas fechas no deja continuar, como en la ficha; «Continuar» lleva a verificar el WhatsApp y, al volver, la ficha de esa casa con la hoja abierta. Cierre la hoja → Explorar sigue donde estaba. El botón no abre la ficha ni marca el favorito.

### 2.3 Moneda ₡ | $ y tipo de cambio

- [ ] **C10** En la fila de chips toque «$» → los precios pasan a dólares («$118 / noche»), aparece la nota «Dólares solo para orientarle: ≈ ₡… por US$1 (tipo de referencia del … ). Los anfitriones fijan sus precios en colones.»; recargue → sigue en dólares; toque «₡» → vuelven los colones y la nota se va.
- [ ] **C11** En móvil, con «$» elegido abra una ficha → la barra de abajo muestra las dos monedas a la vez (colones a la izquierda, «≈ $… / noche» a la derecha) y no hay selector ₡ | $ en la ficha; en Favoritos (con una casa guardada) el selector está arriba, al extremo derecho de la fila del contador, y los precios siguen la moneda elegida.
- [ ] **C12** Si la nota de dólares termina con una atribución (p. ej. «· Rates By Exchange Rate API»), toque el enlace → abre la web de la fuente en otra pestaña; si no hay atribución, la nota no tiene ningún enlace.

### 2.4 Barra de abajo y botón «Mapa»

- [ ] **C13** Baje con el dedo por Explorar → la barra de abajo «3Btico · Explorar · Favoritos · Ingresar» (plana, pegada al borde y a todo el ancho, con la línea fina arriba) sale por abajo; suba un poco → vuelve; arriba del todo siempre está a la vista; repita en Favoritos (con alguna casa; la tarjeta de arriba con el logo y «₡ | $» también sale y vuelve) e Ingresar → se comporta igual y un movimiento muy corto no la hace parpadear.
- [ ] **C14** Con el mapa ya fuera de la pantalla, siga bajando por la lista → aparece el botón flotante «Mapa» (tarjeta clara, texto e icono oscuros, como las demás tarjetas) a 12 px sobre la barra y baja junto con ella hasta cerca del borde cuando la barra se esconde; arriba del todo (con el mapa a la vista) no hay botón «Mapa».
- [ ] **C15** Siga bajando hasta el final de la lista → el botón «Mapa» desaparece antes de llegar a «Publicar mi casa gratis» y no tapa ese botón ni la nota «¿No encuentra lo que busca?»; suba otra vez → «Mapa» vuelve a salir.
- [ ] En móvil, las tarjetas «¿Tiene una casa en el Caribe?» y «¿No encuentra lo que busca?» dejan 3 px de margen lateral al final de Explorar. Revise a 320 px que sus botones quepan.

#### 3Btico

- [ ] **3B1** En una ventana privada de 320 px, abra la raíz de la app → entra a 3Btico. La primera pestaña muestra el logo horizontal de 3bstays debajo de su icono y las demás muestran «Explorar», «Favoritos» e «Ingresar» con sus iconos. Toque 3Btico → aparece el logotipo completo en la cabecera y puede leer el contenido hasta el final sin que la barra lo tape.
- [ ] Con la pestaña de 3bstays visible, compruebe a 320 px que las etiquetas de Explorar, Favoritos e Ingresar se leen en una sola línea y quedan alineadas con el logo horizontal.
- [ ] En móvil, compruebe a 320 px que el logo de la cabecera de 3Btico está alineado a la izquierda, que el contenido deja 12 px de margen a cada lado y que las tarjetas y botones caben en la pantalla.
- [ ] **3B2** Recorra la barra con Tab y un lector de pantalla → cada enlace tiene un nombre distinto, el foco se ve y solo el enlace actual se anuncia como página actual. Abra 3Btico con Enter. Pruebe Explorar, Favoritos e Ingresar desde su barra. «Aquí» lleva a Explorar. «Publicar mi casa» y el enlace dorado del final abren el asistente existente. El enlace del final siempre se muestra. Si hay una oferta disponible, indica los meses gratis.
- [ ] **3B3** Compruebe que los meses gratis coinciden con la oferta disponible en la app. Si ya no hay plazas, se ve el precio mensual y desaparece el enlace de los meses gratis.
- [ ] **3B4** Ingrese con una cuenta sin casas → entra a Explorar y conserva 3Btico. Abra 3Btico desde la barra. Repita con una cuenta con al menos una casa, incluido un borrador → entra a Explorar, la pestaña desaparece y su enlace directo vuelve a Explorar. Cierre sesión desde Cuenta → llega a 3Btico. Con 3Btico abierto sin sesión, ingrese desde otra pestaña → la primera pasa a Explorar. Compruebe que el viajero conserve 3Btico.

#### Marco de escritorio

- [ ] Abra Calendario a 1024 y 1280 px. Marcar una reserva, Pausar la casa, Conectar con Airbnb, la ayuda y la leyenda quedan a la izquierda. El calendario ocupa la columna más ancha, a la derecha. El selector de moneda está solo arriba a la derecha en la barra compartida. Cambie de moneda y compruebe que Calendario y Explorar muestran la misma selección. Desplácese por los meses y compruebe que los días de la semana y el título del mes quedan debajo de la barra superior.

- [ ] A 1024 y 1280 px, compare los márgenes exteriores de Explorar, Favoritos, Mis casas, Cuenta, Calendario y una ficha pública. El marco usa los mismos márgenes a ambos lados. Compruebe también que el mapa ampliado respeta esos márgenes y que los formularios centrados se leen con comodidad.

- [ ] A 1440 px, compruebe que el contenido de Favoritos, Mis casas, Cuenta, Calendario, Ayuda y una ficha no pasa de unos 1230 px y queda centrado. El logo de la barra superior empieza a la misma altura que el contenido. A 1280 px, márgenes iguales que antes. Explorar sigue a todo el ancho con el mapa.

- [ ] En escritorio, Favoritos, Mis casas, Cuenta, Calendario y «No encontramos esta página» muestran su título arriba a la izquierda, sin repetir el logo debajo de la barra. En el móvil, esos títulos siguen ocultos como antes.

- [ ] En escritorio, abra una ficha desde un enlace (pestaña nueva), una ficha inexistente (`/casa/CT-99999`), Ayuda, «Promoción y suscripción» e Ingresar desde un flujo (por ejemplo, Mis casas sin sesión). Todas llevan la barra superior. En la ficha, la barra aparece sin que la foto baje al terminar de cargar; con sesión muestra sus pestañas y sin sesión «Ingresar». Ayuda y la suscripción se leen en una columna de unos 720 px. En el móvil, la ficha sigue sin barra superior.

- [ ] En escritorio, abra `/explorar/buscar` y compruebe que lleva a Explorar con la misma búsqueda.

- [ ] En escritorio, abra una ficha con precio al mes. El título, el tipo, la zona y la capacidad van a la izquierda. Las características son una lista con icono y texto, sin cajas, y «Alquiler mensual» aparece bajo el precio del panel derecho, no entre ellas. La foto no lleva la flecha de volver (la barra superior lleva a Explorar). Sin sesión, el botón dice «Escribir a [anfitrión] por WhatsApp», debajo hay un aviso de verificación y otro de pagos en tinta, y «Personas» muestra «Opcional» hasta elegir un número. Al bajar, el panel queda fijo bajo la barra superior. En el móvil, la ficha y la hoja de contacto siguen como antes.

- [ ] En escritorio, Mis casas: bajo el título, el resumen va en pastillas («2 activas», «1 en revisión») y «Añadir casa» a la derecha. Las tarjetas miden lo mismo, con la foto 4:3 y las acciones al pie, y «Calendario» y «Consultas» llevan su nombre. En el detalle de una casa, «Editar» va en gris y se pone verde al pasar por la fila.

- [ ] En escritorio, Calendario: un mes cabe en pantalla con casillas bajas. Los días pasados van sin fondo ni precio. Los días al precio base no muestran precio y los que lo cambian lo muestran en terracota. Bajo la leyenda, «Precio base: ₡… por noche» en la moneda elegida. Cambie el precio de un día y compruebe que aparece en su casilla. En el móvil, cada casilla sigue con su precio.

- [ ] En escritorio, Cuenta del anfitrión: «Mi perfil», «Promoción y suscripción», «Método de pago» y «Sus casas» tienen el mismo tamaño de título, la cuota («₡0 / mes») va al tamaño del texto y «Parar suscripción» es texto terracota alineado a la izquierda.

- [ ] En escritorio, en claro y en oscuro: la pestaña actual de la barra va en arena con el texto terracota y es la única marcada. En «₡ | $», la moneda elegida va en un botón claro sobre gris neutro. «Ingresar» es un botón con contorno. Con casas, «Consultas» lleva el texto a 1280 px o más y el contador sigue visible. Los botones secundarios (por ejemplo «Seguir publicando» o «Empezar otro») llevan contorno, y un botón desactivado se ve gris, distinto del principal verde.

- [ ] En escritorio, en el detalle de una casa activa, «Ver ficha» está en la cabecera, a la derecha del nombre, y ya no flota sobre las filas. Edite Ubicación a 1280 px y compruebe que nada la tapa. En el móvil, «Ver ficha» sigue flotando abajo.

- [ ] Abra Nombre, Precio, Ubicación y Suscripción desde el detalle de una casa en escritorio. Cada vista se abre a la derecha. Al desplazarse, la barra superior sigue fija y el resumen de la casa permanece visible a la izquierda. Use Volver para recuperar la lista de datos. Guarde un cambio y compruebe que vuelve al detalle con el dato actualizado.

- [ ] Abra el detalle de una casa activa desde Mis casas a 1024 y 1280 px. La barra superior permanece visible. La foto, las estadísticas, Compartir y WhatsApp de esta casa quedan a la izquierda. Los datos editables y Suscripción quedan a la derecha. Repita con un borrador y compruebe que «Seguir publicando» queda a la derecha. En móvil, el contenido sigue en una columna.

- [ ] Abra Mis casas con cuatro o más casas a 1024 y 1280 px. Compruebe que aparecen tres tarjetas por fila y que la segunda fila empieza a la izquierda.

- [ ] En escritorio, compruebe que el botón Filtros aparece al elegir Lugar. Ábralo desde Explorar. El cuadro aparece sobre el mapa y las casas. Cierre con Escape y compruebe que el foco vuelve al botón. Abra otra vez, cambie el tipo de alojamiento y pulse «Ver casas». El cuadro se cierra y Explorar muestra los resultados filtrados.

- [ ] Use los botones cuadrados del mapa para acercar y alejar. Amplíe el mapa y vuelva a reducirlo. La búsqueda permanece visible y el mapa conserva su posición y zoom. Abra la tarjeta de una casa con Enter desde un marcador de precio.

- [ ] En Explorar, compruebe que los filtros rápidos «Qué necesitan» aparecen después de elegir Lugar y aprovechan todo el ancho del mapa debajo de la búsqueda. Si hace falta, continúan en otra fila sin desbordarse. Deben mostrar solo las características de las casas de esa zona. Cambie de lugar y compruebe que se actualizan sin mostrar las opciones del anterior. Active y desactive una con teclado y compruebe los resultados. Quite el lugar y compruebe que los filtros rápidos desaparecen.

- [ ] En escritorio, cambie de «₡» a «$» en la barra superior. Compruebe que cambian los precios de las tarjetas y del mapa. Abra Favoritos, una ficha con precio mensual y el contacto. Compruebe que usan la misma moneda y que la preferencia se conserva al recargar. Vuelva a colones desde la barra.

- [ ] En una ventana de 1440 px de ancho o más, alterne entre Explorar con resultados y Favoritos. Compruebe que la línea inferior de la barra superior empieza y termina en los mismos puntos y que el logo y el selector de moneda mantienen su posición.

- [ ] En Explorar, a 1024 y 1280 px, la barra superior llega a ambos bordes. Lugar, Fechas y Personas quedan en una sola fila sobre el mapa, con el selector de moneda en la barra superior. El botón Filtros queda justo a la izquierda de Lugar. Recorra los controles con Tab y abra Lugar y Fechas con Enter. Ajuste Personas con los botones − y + en la propia barra y compruebe que los resultados cambian de inmediato. El panel aparece debajo de la fila sin cambiar de página. Fechas muestra dos meses lado a lado. Al aplicar, compruebe que se actualizan los valores y los resultados. Escape cierra el panel y devuelve el foco al campo. Hacer clic fuera cierra el panel. Compruebe que en escritorio el mapa se puede desplazar y ampliar dentro de su caja, y que al pulsar un precio se resalta el marcador y aparece la tarjeta pequeña de la casa. Pulse otro precio para cambiar de tarjeta, el fondo del mapa para cerrarla y la tarjeta para abrir la ficha.

- [ ] En Explorar, con cuatro o más resultados a 1280 × 800, compruebe que se muestran dos casas por fila a la derecha. Desplácese por los resultados y compruebe que el mapa y sus controles permanecen fijos a la izquierda. El mapa ocupa todo el alto entre la barra superior y el borde inferior de la ventana. Ensanche y estreche la ventana sin bajar de 1024 px. La barra, el mapa y las tarjetas deben aprovechar el ancho disponible sin desplazamiento horizontal. Durante la carga, los espacios de las tarjetas siguen la misma cuadrícula.
- [ ] En Explorar de escritorio, abra una tarjeta desde un precio del mapa y pulse la X de la esquina superior derecha. Compruebe que la tarjeta se cierra, el mapa conserva su posición y el foco vuelve al marcador.
- [ ] Compare tarjetas de resultados con títulos de distinta longitud y con distintas capacidades. Compruebe que tienen la misma altura y que el botón de WhatsApp queda dentro de cada tarjeta, alineado con el precio.

- [ ] **E1** Abra `/` sin sesión a 1280 × 800. Explorar abre primero y la barra superior muestra el logotipo, Explorar, Favoritos e Ingresar. Recorra los enlaces con Tab y Mayús+Tab. Active el logotipo con Enter para abrir «Qué es 3bstays» y compruebe el foco, el estado activo, el texto y el botón dorado. El logotipo de la barra no se repite encima de la tarjeta. Compruebe Favoritos e Ingresar desde la misma barra y repita a 1024 px.
- [ ] **E2** Con sesión, abra `/que-es-3bstays` directamente. Debe llegar a Explorar y el logotipo debe llevar a Explorar. Cierre sesión desde Cuenta y compruebe que el logotipo vuelve a abrir la pantalla informativa. Abra la pantalla sin sesión e ingrese en otra pestaña del mismo navegador. La pantalla informativa debe pasar a Explorar.
- [ ] **E3** Con una cuenta con casas, abra Mi casa o Mis casas desde la barra superior de Explorar. Compruebe la barra y recorra Mis casas, Calendario, Consultas, Cuenta y Explorar con teclado. Al volver a Explorar, la barra sigue arriba y el mapa y los resultados caben debajo. Reduzca la ventana por debajo de 1024 px y compruebe que reaparece la barra móvil. En Admin, compruebe su navegación habitual.

### 2.5 Mapa de Explorar

- [ ] **C16** Mire el mapa de arriba (antes de «N casas en Limón») → burbujas de **precio** (p. ej. «₡42 000»), ninguna escondida debajo de la búsqueda ni de los filtros, el crédito «Leaflet | © OpenStreetMap» abajo a la derecha, sin botones de zoom, y arrastrar con el dedo desplaza la página, no el mapa; si dos casas están muy juntas van en una sola burbuja «N casas».
- [ ] **C17** Toque el mapa pequeño → mapa completo con buscador y filtros arriba, sin flecha de salida, atribución visible y una sola salida inferior «Ver lista · N casas» con icono de lista, sobre la barra de pestañas. Con teclado, el foco empieza en esa salida; los marcadores no quedan tapados por los controles.
- [ ] **C18** En el mapa grande toque una burbuja de precio → se resalta y aparece una tarjeta compacta con foto cuadrada, nombre, zona, «₡… / noche» y corazón; toque un punto vacío → la tarjeta se quita; vuelva a elegir la burbuja y toque la tarjeta → abre la ficha, y Atrás regresa al mapa.
- [ ] **C19** Toque una burbuja «N casas» del mapa grande → el mapa se acerca a esas casas sin abrir ninguna ficha.
- [ ] **C20** Toque «Ver lista · N casas» o use Atrás del teléfono → cierra el mapa, conserva la posición de la lista y devuelve el foco a Mapa o a su caja. Abrirlo por URL directa y sin resultados también permite salir; filtros, grupos y atribuciones siguen funcionando.
- [ ] **C21** Con «$» abra el mapa → las burbujas muestran dólares («$75»); con llegada y salida en la búsqueda, cada burbuja lleva la misma cifra que la tarjeta de su casa (el total, p. ej. «₡180 000», sin «por 4 noches») y la tarjeta compacta del mapa dice «≈ ₡180 000 por 4 noches».

### 2.6 Total de la estancia, Filtros y características

- [ ] **C22** Busque llegada y salida a 4 noches (p. ej. «23–27 nov») → cada tarjeta dice «**≈ ₡180 000** por 4 noches» (la cifra en negrita) en vez de «/ noche»: la suma de las 4 noches, con el precio especial del calendario en las noches que lo tengan (CT-1047 a); la noche de la salida no cuenta; en ninguna parte dice «total a pagar». Con «$» el total sale en dólares redondeados («≈ $350 por 4 noches»). Quite las fechas → vuelven los «₡45 000 / noche».
- [ ] **C23** Busque una estancia de 35 noches → la casa con precio al mes (CT-1048 b, ₡900 000) dice «≈ ₡1 050 000 por 35 noches» (mes × 35 / 30); la de mensual a negociar (CT-1049 c) y las que no aceptan mensual, la suma de sus 35 noches. Abra un enlace viejo `/explorar?mensual=1` (o `?modo=monthly`, `?desde=…`) → Explorar normal, sin error ni chip mensual.
- [ ] **C24** Abra Filtros → el orden de «Su búsqueda» es Zona, Fechas, Personas, Tipo de alojamiento y Dormitorios. Zona y Fechas tienen el valor a la derecha. Las tres opciones del tipo caben en una fila a 320 px, con icono sobre el texto y check en la seleccionada. Dormitorios no aparece por defecto. Seleccione Completo, marque 2+ dormitorios y después Habitación → el contador se oculta y se descarta el mínimo. Toque Cualquiera → sigue oculto; vuelva a Completo → aparece sin mínimo. Personas permanece visible. Limpiar vuelve a Cualquiera y oculta Dormitorios. Un enlace con `beds=3` sin `tipo=completo` ignora ese mínimo.
- [ ] **C25** En móvil, abra Filtros sin zona y compruebe que «Qué necesitan» no aparece. Elija una zona con Wifi y sin Cargador EV, vuelva a Filtros y compruebe que aparece Wifi y no Cargador EV. Cambie a una zona con características distintas y compruebe que la lista se actualiza. Repita en el cuadro de escritorio.
- [ ] **C26** Marque «Piscina» y «Frente al mar» → el botón se actualiza solo («Ver 1 casa»); tóquelo → Explorar muestra solo esa casa y el botón de filtros trae la insignia «2» (nombre accesible «Filtros (2 activos)»). Reabra Filtros y ponga zona, fechas, personas, dormitorios y precios. Toque «Limpiar» → se borran esas selecciones, vuelve a «Todas las provincias» y «Cualquiera» en el tipo, y se actualiza «Ver N casas», manteniendo abierta la pantalla. Toque «Ver N casas» → vuelve a Explorar con el resultado limpio.
- [ ] **C27** En Filtros use «+» y «−» en Personas y Dormitorios. «Personas» muestra la cantidad elegida y «Dormitorios» llega hasta «4+». Con «2+», «Ver N casas» cuenta las casas con dos o más dormitorios. Al bajar a «–» se quita ese filtro y se desactiva «−». Aplique y vuelva a abrir Filtros → se conservan las dos cantidades.
- [ ] **C28** Escriba un mínimo mayor que el máximo (p. ej. 50.000 y 44000) → aparece «El precio mínimo no puede ser mayor que el máximo.» y «Ver N casas» se desactiva; corríjalo → el aviso se va y el botón se activa.
- [ ] **C29** Escriba un rango válido (mínimo 40000, máximo 90000) y toque «Ver N casas» → Explorar muestra solo casas con ese precio por noche. Abra Filtros con dólares seleccionados → los campos usan $, sin la nota del tipo de cambio.
- [ ] **C30** Con casas aprobadas en más de una provincia (p. ej. CT-1055 en Puntarenas), abra Explorar sin zona → la línea dice «N casas», sin «en Limón», y salen primero todas las de Limón y después las de otras provincias. Abra Filtros → la fila «Zona» de «Su búsqueda» dice «Todas las provincias» y no hay pastillas de provincia. En «Tipo de alojamiento» las opciones «Cualquiera · Completo · Habitación» caben en una fila, con iconos de lista, casa y cama, y check en la seleccionada y está marcado «Cualquiera»; toque «Habitación» → «Ver N casas» cuenta solo las habitaciones (CT-1051); toque «Ver N casas» → Explorar las muestra y el botón de filtros trae la insignia «1». «Alojamiento completo» deja fuera las habitaciones. Un enlace viejo `/explorar?prov=Puntarenas` sigue enseñando solo las de Puntarenas.

### 2.7 Búsqueda: ¿Dónde?, ¿Cuándo?, ¿Quiénes?

- [ ] **C31** Toque la píldora «Empiece su búsqueda» → abre «Buscar casas» a pantalla completa, sin barra de abajo, con «¿Dónde?» abierto, el campo «Busque una zona» con el teclado y la nota «Le mostramos las casas de la zona y las que están a 5 km o menos.».
- [ ] **C32** Escriba las primeras letras de una zona (p. ej. «coc») → la lista de «Zonas con casas» se filtra sin importar tildes ni mayúsculas y muestra el cantón y la provincia («Talamanca, Limón»); escriba «zzz» → «Todavía no hay casas en esa zona.».
- [ ] **C32a** En móvil estrecho, revise que la sección abierta y las sugerencias no estén sobre tarjetas blancas; las cerradas tienen borde fino y chevrón. Vuelva a abrir ¿Dónde? con una zona elegida → dorado suave y check, con nombre completo. Con una lista larga, recórrala con flechas → la opción activa queda visible sin mover el campo; Enter la elige. Con red lenta se muestra «Cargando zonas…» y, si falla sin datos guardados, «No pudimos cargar las zonas.» con «Reintentar».
- [ ] **C33** Elija una zona → «¿Dónde?» se pliega con su nombre y se abre «¿Cuándo?» solo; vuelva a abrir «¿Dónde?» y toque «Quitar» junto al campo → la zona se borra y la fila dice «Añadir zona».
- [ ] **C34** En «¿Cuándo?» toque una llegada y una salida → mientras falta la salida el pie dice «Elija la salida»; con las dos muestra las fechas («29 nov – 2 dic») y «3 noches», con «Le mostramos las casas libres esas noches.»; los días pasados no se pueden elegir y no se puede pasar de hoy + 365 como salida.
- [ ] **C35** Toque «Quitar fechas» → las fechas se borran y el pie vuelve a «Elija la llegada»; elija otras y toque «Siguiente» → se abre «¿Quiénes?», y «Siguiente» se ve siempre encima de la barra de botones sin desplazar la página.
- [ ] **C36** En «¿Quiénes?» toque «Una persona más» cuatro veces → muestra 4 y, plegada, dice «4 personas»; «Una persona menos» baja hasta «–» y se desactiva; el máximo es 50 y ahí «Una persona más» se desactiva; debajo dice «Las fechas y las personas van en el mensaje de WhatsApp que le preparamos para el anfitrión.».
- [ ] **C37** Con zona, fechas y 4 personas toque «Buscar» → vuelve a Explorar arriba del todo; la píldora dice «<Zona> · <fechas> · 4 personas» y la línea «N casas en <Zona> y alrededores · <fechas>».
- [ ] **C38** En ese resultado compruebe que todas las casas caben 4 personas, que ninguna tiene una noche ocupada entre la llegada y la salida y que aparecen también casas de zonas a 5 km o menos de la elegida.
- [ ] **C39** Toque la píldora de nuevo → la búsqueda se abre con zona, fechas y personas puestas; toque «Borrar todo» y «Buscar» → Explorar vuelve a «Empiece su búsqueda» y conserva las características que hubiera marcadas.
- [ ] **C40** Abra la búsqueda, elija una zona y toque la ✕ («Cerrar la búsqueda») → vuelve a Explorar sin aplicar nada.
- [ ] **C41** En «¿Cuándo?» elija una estancia larga (llegada y salida a 35 noches) → el pie dice las fechas y «35 noches» (no hay «Desde» ni «Elija desde cuándo»); «Buscar» deja fuera las casas con alguna noche ocupada en esas 35 y las tarjetas dicen «por 35 noches».
- [ ] **C42** Desde Filtros toque la fila «Fechas» de «Su búsqueda» → abre la búsqueda con «¿Cuándo?» abierto; cambie la fecha, toque «Buscar» y vuelva a Filtros → la fila muestra las fechas nuevas.

### 2.8 Sin resultados y «¿No encuentra lo que busca?»

- [ ] **C43** En Explorar con resultados baje hasta el final → después de la tarjeta de publicar hay la nota «¿No encuentra lo que busca? Cuéntenos qué necesita por WhatsApp y le ayudamos a encontrar casa.» con el botón «Escribir a 3bstays por WhatsApp».
- [ ] **C44** Toque «Escribir a 3bstays por WhatsApp» → abre WhatsApp (línea de clientes) con el mensaje «Hola, estoy buscando casa en 3bstays.», «Zona: Limón.» y, si hay filtros, líneas como «Personas: 12.», «Necesito: Piscina.», «Precio por noche: hasta ₡80 000.» (nunca «Busca alquiler mensual.»), terminando en «Fechas: » para que usted la escriba.
- [ ] **C45** Fuerce cero resultados (50 personas en la búsqueda y «Piscina» en Filtros) → la línea dice «0 casas en Limón», sale el recuadro «No hay casas con esos filtros» con la misma nota y botón de WhatsApp y el enlace «Quitar filtros»; tóquelo → vuelve la lista completa de Limón y el recuadro desaparece.

### 2.9 Ficha de una casa (sin cuenta)

- [ ] **C46** Abra una ficha desde una tarjeta → arriba la foto apaisada (5:4, algo más ancha que alta) a todo el ancho, pegada arriba, con el contador «1 / N»; sobre ella, a la izquierda la flecha «Volver a Explorar» y a la derecha «Compartir ficha» y el corazón «Guardar en favoritos»; deslice la foto → pasan las demás y el contador cambia («2 / 5»).
- [ ] **C47** Mire bajo la foto → todo centrado: título, el pin y «<Zona>, <Cantón>» (sin «ubicación aproximada»; si la zona ocupa dos renglones, el pin va pegado a la primera palabra, a la altura del primer renglón), «N personas · N dormitorio(s) · N baño(s)» (en una Habitación, CT-1050 o CT-1051, la etiqueta de arriba dice solo «Habitación» y la línea «N personas · 1 dormitorio · baño compartido» o «baño privado», sin número de baños); entre dos líneas, las iniciales, el primer nombre en negrita y debajo «Anfitrión · WhatsApp verificado» (con el WhatsApp sin verificar, solo «Anfitrión»); luego la descripción.
- [ ] **C48** En una casa con descripción larga toque «Ver más» → se abre «Descripción» a pantalla completa con todos los párrafos y Atrás del teléfono la cierra sin salir de la ficha; en una descripción corta no hay «Ver más».
- [ ] **C49** Mire las características → un mosaico con icono por cada una que tenga la casa (Wifi, Piscina, Parqueo, Frente al mar, Mascotas…); en una casa con mensual, la primera casilla, a dos columnas, es «Alquiler mensual» con el precio debajo, más pequeño («₡900 000 / mes», o «A negociar» si no tiene precio).
- [ ] **C50** En «DISPONIBILIDAD» mire el calendario → cada noche libre trae su precio completo, las ocupadas solo el número y rayadas, los días pasados tachados y la leyenda «Disponible» / «Ocupado»; una noche con precio distinto muestra esa cifra.
- [ ] **C51** Toque «Mes siguiente» y «Mes anterior» → cambia el mes (se puede ver hasta unos doce meses; «Mes anterior» está desactivado en el mes actual); con «$» elegido en Explorar los precios del calendario salen en dólares. Toque un día libre y luego otro posterior → llegada y salida en terracota y la banda clara entre las dos (como en «¿Cuándo?»; el verde de los libres se sigue viendo debajo), debajo el total orientativo, p. ej. «≈ ₡285 000 por 3 noches · 13–16 dic» y, junto a la leyenda, «Quitar fechas», que las quita; con la llegada sola dice «Ahora elija la salida.». El calendario no cambia de alto con fechas o sin ellas.
- [ ] **C51b** En la casa con noches ocupadas: un día ocupado no se puede tocar como llegada; con la llegada elegida, el primer día ocupado sí vale de salida; una salida que deja noches ocupadas en medio no se acepta y sale «Hay noches ocupadas entre esas fechas.» (la llegada se queda). Busque en Explorar unas fechas que atraviesen esas noches y abra la ficha → el calendario abre en el mes de la llegada, sin banda, con «Hay noches ocupadas entre esas fechas.»; la barra sigue con el precio por noche y en la hoja «Continuar» (o «Abrir WhatsApp») no se puede tocar hasta elegir otras fechas o quitarlas.
- [ ] **C52** Baje hasta «ZONA APROXIMADA» → hay un mapa con una zona (no un punto exacto) y debajo «Ubicación aproximada. La dirección exacta la comparte el anfitrión.»; al final, «Publicada por <nombre> · WhatsApp verificado. Sin comisiones: fechas, precio y pago los acuerda directamente con el anfitrión. 3bstays no procesa pagos.».
- [ ] **C53** Mire la barra fija de abajo sin fechas → una sola línea: colones a la izquierda («₡95 000 / noche»), dólares a la derecha («≈ $186 / noche»), el botón «Contactar por WhatsApp» y «Precios orientativos: el precio final lo acuerda con el anfitrión.»; sin «Mensual», también en las casas con mensual. Elija 3 noches en el calendario → la cifra pasa al total, p. ej. «≈ ₡285 000 / 3 noches» y «≈ $559» (en un teléfono ancho, «≈ $559 / 3 noches»), sin que la barra cambie de alto. Con 30 noches o más en una casa con mensual aparece debajo p. ej. «Mensual: ₡900 000 / mes» y «≈ $1 765 / mes» (o «Mensual: precio a negociar con el anfitrión», sin dólares del mes) y la barra crece un poco.
- [ ] **C54** Toque «Compartir ficha» → en el teléfono se abre la hoja nativa de compartir con el enlace `…/casa/CT-####`; si el navegador no tiene hoja nativa, el botón pasa un momento a «Enlace copiado».
- [ ] **C55** Toque el corazón de la ficha → pasa a «Quitar de favoritos» y la casa aparece en Favoritos; vuelva a tocarlo → desaparece de Favoritos.

### 2.10 Hoja «Contactar por WhatsApp» sin cuenta

- [ ] **C56** En una ficha toque «Contactar por WhatsApp» → sube una hoja «Escríbale a <nombre>» con «Anfitrión de <casa> · WhatsApp verificado», casillas «Llegada» y «Salida» («Elegir fecha»), «Personas (opcional)» con «−» y «+», «Su mensaje» y el botón «Continuar».
- [ ] **C57** Mire «Su mensaje» → es solo lectura (no se puede escribir en él): «Hola, vi <casa> en 3bstays y me interesa. ¿Está disponible? Gracias.», con «Podrá añadir lo que quiera en WhatsApp antes de enviarlo.» debajo.
- [ ] **C58** Toque «Llegada» → se abre el calendario de rango de «¿Cuándo?», con los días ocupados de la casa apagados como llegada (y un rango que atraviese noches ocupadas da «Hay noches ocupadas entre esas fechas.»); elija llegada y salida → se cierra, las casillas dicen p. ej. «9 dic» y «13 dic», encima del mensaje sale el total, p. ej. «≈ ₡380 000 por 4 noches · 9–13 dic» y el mensaje pasa a «…¿Está disponible del 9 al 13 de diciembre? Gracias.». Cierre la hoja → el calendario de la ficha y la barra tienen esas mismas fechas y ese total; cambie las fechas en la ficha y abra la hoja → las mismas.
- [ ] **C59** Toque «+» tres veces en «Personas (opcional)» → el mensaje añade «para 3 personas»; siga tocando «+» → se detiene en la capacidad de la casa; «−» baja hasta dejarlo vacío («–»).
- [ ] **C60** Busque una estancia de 35 noches y abra la hoja de una casa con alquiler mensual → casillas «Llegada» y «Salida» con esas fechas (nunca una sola «Desde») y el mensaje «Hola, vi <casa> en 3bstays y me interesa. ¿Está disponible del <día> de <mes> al <día> de <mes>? Gracias.»; nunca «Me interesa alquilar por meses desde…».
- [ ] **C61** Haga una búsqueda con fechas y 4 personas en Explorar y abra una ficha → el calendario abre en el mes de la llegada con esas fechas marcadas y el total, la barra con «≈ ₡… / N noches»; su hoja arranca con esas fechas, el mismo total y esas personas (si caben en la casa).
- [ ] **C62** Mire el texto bajo el botón → «Para escribirle necesita verificar su WhatsApp con un código. Lo que escribió se guarda.», «<nombre> verá su nombre y su WhatsApp.» y «Por su seguridad, nunca envíe dinero antes de confirmar la casa. 3bstays no procesa ni pide pagos.».
- [ ] **C63** Toque «Cerrar» (la ✕) o el fondo oscuro, y luego «Contactar por WhatsApp» otra vez → la hoja se cierra, el foco vuelve al botón y, al reabrir, conserva lo que había escrito.

### 2.11 Enlaces de fichas no disponibles

- [ ] **C64** Abra el enlace de la casa con la suscripción parada → «Este enlace ya no está activo», «El anfitrión paró la suscripción de este anuncio, así que el enlace ya no muestra la ficha ni permite contactarlo desde 3bstays.», «Si ya habló con el anfitrión por WhatsApp, puede seguir esa conversación por su cuenta.» y el botón «Ver otras casas en el Caribe», que lleva a Explorar.
- [ ] **C65** Abra el enlace de la casa en revisión → «Este enlace ya no está activo» con «Este anuncio no está disponible en este momento.» (si en cambio está en «Pendiente de pago»: «Este anuncio está fuera del catálogo hasta que el anfitrión regularice su suscripción.»).
- [ ] **C66** Abra `/casa/CT-9999` → «Este enlace no existe», «Revise que el enlace esté completo. Si se lo pasaron por WhatsApp, pida que se lo envíen de nuevo.» y «Ver otras casas en el Caribe».
- [ ] **C67** Abra la ficha de la casa pausada con «Pausar la casa» → insignia «No disponible por ahora», botón gris «No disponible por ahora» que no se puede tocar, «Calendario no disponible» y «Vuelve a estar disponible el <fecha>»; esa casa no sale en Explorar.
- [ ] **C68** Con la cuenta propietaria `8777 0001`, abra la ficha de una de sus casas, toque «Contactar por WhatsApp» y «Abrir WhatsApp» → aparece «Esta es su propia casa.» y no se abre WhatsApp.

### 2.12 Favoritos

- [ ] **C69** Sin cuenta ni casas guardadas, toque la pestaña «Favoritos» → «Toque el corazón de una casa para guardarla aquí.», el botón «Explorar casas» y la nota «Compare y escriba directo».
- [ ] **C70** Guarde dos casas (una desde Explorar, otra desde su ficha) y abra Favoritos → «2 casas · guardadas en este teléfono» a la izquierda, «₡ | $» alineado al extremo derecho y dos tarjetas como las de Explorar. En un teléfono angosto, el contador puede ocupar dos líneas y el selector queda a la derecha.
- [ ] **C71** Toque el corazón de una tarjeta de Favoritos → la casa sale de la lista y el contador baja a «1 casa · guardada en este teléfono».
- [ ] **C72** Toque «Enviar WhatsApp» en una tarjeta → abre la ficha con la hoja «Escríbale a <nombre>» ya abierta, sin enviar nada todavía; una casa que dejó de estar disponible muestra «No disponible por ahora» en lugar del botón.
- [ ] **C73** Estando en Favoritos con casas guardadas, toque «Ingresar» e inicie sesión con `8888 1234` → vuelve a Favoritos, el contador pasa a «N casas guardadas» (sin «en este teléfono») y las casas de antes siguen ahí; con la misma cuenta en otro teléfono se ven las mismas casas.
- [ ] **C74** Cierre la sesión y abra Favoritos → las casas siguen guardadas en el teléfono («… guardadas en este teléfono»).

### 2.13 Ingresar y registro

- [ ] **C75** Toque la pestaña «Ingresar» → «Entre con su WhatsApp», el selector de país («+506» con «Costa Rica (+506)»), «Número de WhatsApp», «Recibir código por WhatsApp», el enlace «No tengo acceso a mi WhatsApp», la fila «¿Quiere publicar su casa gratis?» y «Al continuar acepta los Términos. 3bstays nunca le pedirá pagos.».
- [ ] **C76** Toque «Recibir código por WhatsApp» con el número vacío → «Escriba su número de WhatsApp.»; escriba «123» → «Ese número no parece válido para el país elegido.».
- [ ] **C77** Toque «+506» para ver los países → incluye Estados Unidos / Canadá (+1), Nicaragua, Panamá, México, Colombia, Venezuela, Argentina, España, Alemania, Francia, Italia, Reino Unido, Países Bajos, Suiza y «Otro país»; con «Otro país» el campo pide «Escriba el número completo con «+» y el código de su país.».
- [ ] **C78** Escriba `8888 9999` (libre) y toque «Recibir código por WhatsApp» → «Es su primera vez en 3bstays», «Díganos su nombre para crear su cuenta. Le mandamos el código al +506 8888 9999.»; con el nombre vacío dice «Escriba su nombre.» y el foco queda en el campo; escriba «Ana Prueba» y siga.
- [ ] **C79** En «Introduzca el código» → «Se lo enviamos por WhatsApp al +506 8888 9999.», «Código de 6 dígitos», «Verificar y continuar», «¿No llegó? Puede pedir otro en 0:30.» con cuenta regresiva, «Abrir WhatsApp para buscar el mensaje» y «Cambiar número»; sin barra de abajo.
- [ ] **C80** Escriba `000000` y toque «Verificar y continuar» → «Ese código no es correcto o caducó.»; recargue la página → el número pendiente sigue en pantalla.
- [ ] **C81** Cuando la cuenta regresiva llegue a 0:00 toque «Pedir otro código» → aparece «Le enviamos otro código por WhatsApp.» y la cuenta vuelve a empezar; «Cambiar número» vuelve al primer paso.
- [ ] En móvil, la pantalla «Introduzca el código» alinea la cabecera y el formulario a 12 px del borde, igual que Ingresar y 3bstays. Compruebe a 320 px que caben las seis casillas.
- [ ] En escritorio, revise «Introduzca el código» a 1024 y 1280 px. El formulario queda centrado y aprovecha más ancho. Las seis casillas y «Verificar y continuar» se ven completos y el foco es visible.
- [ ] **C82** Escriba `123456` → llega a «¡Listo! Su cuenta está creada» con «¿Tiene una casa para alquilar?», «Sí, quiero publicarla», «No, busco casa» y «Añadir un correo de recuperación».
- [ ] **C83** Toque «No, busco casa» → llega a Explorar y la barra de abajo ahora dice «Explorar · Favoritos · Cuenta» (ya no «Ingresar»).
- [ ] **C84** Cierre la sesión y entre otra vez con `8888 9999` → no pide el nombre, `123456` entra directo a Explorar y no vuelve a salir «¡Listo! Su cuenta está creada».
- [ ] **C85** Toque «No tengo acceso a mi WhatsApp» → «Recuperar mi cuenta» con «Use el correo que añadió y confirmó en su perfil…», el campo «Correo confirmado», «Recuperar con mi correo», «La recuperación por correo se activa cuando confirme uno en su perfil.» y «¿No tiene un correo confirmado?» con «Escribir a 3bstays por WhatsApp», que abre Ayuda.

### 2.14 Contactar al propietario, con y sin cuenta

- [ ] **C86** Sin sesión, en una ficha toque «Contactar por WhatsApp», elija fechas y personas y toque «Continuar» → pantalla «Escribirle a <nombre>» con la tarjeta de la casa (foto, nombre y «<nombre> · WhatsApp verificado») y «Un paso y le escribe a <nombre>»; no ofrece «No tengo acceso a mi WhatsApp» y la flecha «Volver» regresa a la ficha.
- [ ] **C87** Escriba `8888 1234`, toque «Recibir código por WhatsApp» y luego `123456` → vuelve a la ficha con la hoja abierta y lo mismo escrito, «Abriendo WhatsApp…» y se abre WhatsApp sola, sin segundo toque, con el número del propietario (`wa.me/50687770001`) y el enlace público de esa casa en la primera línea, una línea en blanco y luego «Hola, vi Casa Playa Negra en 3bstays y me interesa. ¿Está disponible del 9 al 13 de diciembre para 3 personas? Gracias.» para esa casa y fechas.
- [ ] **C88** Vuelva con Atrás desde WhatsApp → la ficha se ve con la hoja cerrada y el botón «Contactar por WhatsApp»; lo escrito se borró.
- [ ] **C89** Repita desde cero con un número nuevo (cierre sesión y use uno que no tenga cuenta) → pide «Es su primera vez en 3bstays» y el nombre y, tras el código, abre WhatsApp directo, **sin** pasar por «¡Listo! Su cuenta está creada».
- [ ] **C90** Deje pasar más de 30 minutos en la pantalla del código y entre → la ficha vuelve con la hoja abierta y el mensaje por defecto, no abre WhatsApp sola y hay que tocar «Abrir WhatsApp».
- [ ] **C91** Con sesión de `8888 1234` toque «Contactar por WhatsApp» → la hoja muestra «Abrir WhatsApp» (no «Continuar») y no trae el aviso de verificar el WhatsApp.
- [ ] **C92** Con sesión, elija fechas y 3 personas y toque «Abrir WhatsApp» → el botón pasa un instante a «Abriendo WhatsApp…» y se abre `wa.me` con el número de la casa y el enlace público de esa ficha (`/casa/CT-####`, sin parámetros) en la primera línea. Tras una línea en blanco aparece «Hola, vi <casa> en 3bstays y me interesa. ¿Está disponible del … para 3 personas? Gracias.»; sin red aparece «Sin conexión. Revise su internet e intente de nuevo.» y no se abre nada; con una casa que se cerró mientras tanto, «Esta casa no está disponible para consultas.».

### 2.15 Cuenta del cliente

- [ ] En el popup de escritorio, introduzca un número de prueba sin cuenta. En el paso del nombre, use la flecha de arriba a la izquierda para volver al número dentro de la misma ventana. Compruebe que la X de arriba a la derecha cierra el popup.

- [ ] En escritorio y sin sesión, pulse «Ingresar» entre el selector de moneda y «Ayuda por WhatsApp» en Explorar y Favoritos. Compruebe que se abre la ventana de WhatsApp sobre la pantalla actual. Pida el código y compruebe que aparece en la misma ventana con la flecha de regreso y la X. Al verificar desde Favoritos, debe regresar a Favoritos.

- [ ] **C93** Con sesión de `8888 1234` toque la pestaña «Cuenta» → sin flecha ni título visible; tarjeta con iniciales, nombre, el número en su propia línea («+506 8888 1234»), «WhatsApp verificado» y debajo «Pronto podrá verificar también su identidad (opcional).»; no hay nada más sobre identidad.
- [ ] En móvil, el título y el formulario de Ingresar empiezan a 12 px del borde, igual que la cabecera y las tarjetas de 3bstays. Cuenta tiene 3 px de margen lateral con sesión. Revise que el formulario de ingreso y la tarjeta de perfil quepan a 320 px.
- [ ] **C94** Mire la lista de Cuenta → «¿Quiere publicar su casa gratis?» (con «Gratis 12 meses · quedan N de 50 plazas»), «Ayuda por WhatsApp» («Línea de 3bstays para clientes»); abajo «Términos y privacidad», la atribución de OpenStreetMap y «Cerrar sesión»; no hay suscripción ni método de pago. El acceso único es Editar junto al perfil; no hay una segunda fila Mi perfil en la lista.
- [ ] **C95** Toque «Editar» → aparece «Mi perfil» con «Nombre», «Descripción (opcional)» y «Correo de recuperación (opcional)»; «Guardar cambios» está desactivado hasta que cambie algo (solo espacios no cuenta); escriba «ana@» y guarde → «Ese correo no parece válido.»; con «ana@ejemplo.com» → «Cambios guardados.» y el botón queda «Guardado»; toque «Listo».
- [ ] **C96** Toque «Ayuda por WhatsApp» → «Ayuda por WhatsApp», «3BSTAYS · ATENCIÓN A CLIENTES», «Para cualquier duda o problema con su cuenta, una casa o un anfitrión, escríbanos por WhatsApp…», el número de la línea de clientes («canal separado del de anfitriones») y «Abrir WhatsApp», que abre `wa.me` con «Hola, estoy buscando casa en 3bstays y necesito ayuda con: ».
- [ ] **C97** Toque «Cerrar sesión» → sube «¿Cerrar sesión?» con «Tendrá que recibir un código nuevo para volver a entrar.» y «Cerrar sesión» / «Cancelar»; «Cancelar» la cierra y sigue con sesión; confirme → vuelve a «Ingresar», la barra dice «Ingresar» y al recargar no hay sesión.
- [ ] **C98** Con sesión de cliente, abra `/propietario/casas` y `/propietario/calendario` → ambas llevan a Explorar (un cliente sin casas no ve las pantallas del propietario); abra `/admin` → «Segundo código», «Esta sección es solo para el equipo de 3bstays», «Si busca una casa, vuelva a Explorar.» y «Ir a Explorar».
- [ ] **C99** Sin sesión, abra a mano `/propietario/casas` → lleva a «Ingresar» y, tras el código con `8777 0001`, vuelve a «Mis casas»; la pantalla del código dice «Después de verificar vuelve adonde estaba.».

### 2.16 PWA, sin red y versión nueva

- [ ] **C100** Instale la app (Chrome en Android o Safari en iPhone con «Añadir a pantalla de inicio») → icono de fondo crema `#FFFBF2` con BT y contorno terracota `#B44C30`, sin rana; nombre «3bstays» debajo. En Android, compruebe que el recorte del sistema no corta el contorno ni las letras. La app abre en Explorar a pantalla completa, sin barra del navegador.
- [ ] **C101** Con Explorar ya visitado, active el modo avión y cierre y abra la app → el shell sale al instante, Explorar muestra las casas que ya había visto y se puede abrir una ficha ya vista; las pestañas «Explorar», «Favoritos» e «Ingresar» cambian sin recargar.
- [ ] **C101a** Cambiar de pestaña no deja rastro (2026-11-03): en Favoritos toque «Explorar» en la barra (o «Explorar casas», o el logo) y haga «Atrás» → no vuelve a Favoritos: sale de la app; en Explorar abra una ficha y haga «Atrás» → vuelve a Explorar donde estaba.
- [ ] **C102** Sin red, abra una ficha que no había visitado → aparece «No pudimos cargar esta casa» con «Intentar de nuevo» e «Ir a Explorar»; con red, «Intentar de nuevo» la recarga.
- [ ] **C103** Después de un despliegue nuevo, cierre y vuelva a abrir la app instalada → aparece la franja «Hay una versión nueva» con el botón «Actualizar»; tóquelo → la app se recarga y la franja desaparece.
- [ ] **C103a** Solo en vertical (2026-11-03): con la app instalada, gire el teléfono → la app no se gira. En el navegador del teléfono, en Explorar con un filtro puesto o en una ficha a media página, gire el teléfono → una capa con el fondo de la app, el logo y «Gire el teléfono para usar 3bstays» lo tapa todo y no deja tocar nada (con VoiceOver o TalkBack solo se lee el aviso); vuelva a vertical → el aviso desaparece y la pantalla sigue igual, sin recargar (mismo filtro, mismo punto de la ficha). En una tableta en horizontal y en el ordenador no sale nunca.

### 2.17 Rutas desconocidas y tamaños

- [ ] **C104** Abra `/no-existe` → «No encontramos esta página» con la barra de abajo visible y el botón «Ir a Explorar», que lleva a Explorar.
- [ ] **C105** En un teléfono de 320–360 px de ancho o con la letra grande, abra una ficha y su hoja de contacto → la barra de precios cabe entera, no tapa el final de la ficha y la hoja se desplaza hasta «Abrir WhatsApp» sin que nada se corte.
- [ ] En móvil, compruebe que la hoja de contacto por WhatsApp deja 12 px a cada lado al abrirla desde una tarjeta o desde la ficha.
- [ ] En una ficha pública disponible a 1024 y 1280 px, compruebe que el formulario «Escríbale a…» aparece abierto en la columna derecha. Cambie fechas y personas, revise el mensaje y compruebe que el calendario de la ficha y el formulario comparten las fechas. Sin sesión, verifique que «Continuar» conserva el borrador al verificar WhatsApp. En móvil, el formulario se abre desde el botón de contacto.

## 3. Anfitrión

Recorrido de quien publica y administra casas, desde el teléfono en `https://pruebas.3bstays.com`. Necesita: la cuenta propietaria `8777 0001` («Yorleny Prueba», código 123456) o su propio número de prueba; un número libre (`8888 9999`) para publicar sin cuenta; 4 a 6 fotos horizontales en la galería del teléfono (y un PDF o GIF para probar el rechazo); un segundo número de otro país (+1) solo para ver el selector de país. Lo marcado «(tras D-aprobar)» espera a que el admin apruebe, pida cambios o rechace; `(terminal)` y `(escritorio)` se hacen desde el Mac.

### 3.1 Empezar a publicar sin cuenta

- [ ] **A1** Sin sesión, abra `/?pronto=1` y toque «Publicar mi casa» → cabecera «Publicar casa» con la X arriba a la derecha, ocho tramos de progreso y «1 de 4» debajo, sin el rótulo «Su casa», «Tenga a mano:» con «Fotos horizontales, si ya las tiene», «El precio por noche» y «Unos 10 minutos», «¿Qué es?» con las tarjetas «Alojamiento completo» y «Habitación», y «Continuar».
- [ ] En móvil, compruebe a 320 px que el asistente de publicación deja 12 px a cada lado de la cabecera, el contenido y la barra de botones. El mapa del segundo paso llega a ambos bordes.
- [ ] **A2** Toque «Continuar» sin elegir nada → «Elija Alojamiento completo o Habitación.».
- [ ] En «Añadir casa → ¿Qué es?», compruebe que «Alojamiento completo» y «Habitación» tienen un borde ocre claro antes de elegir. Tras elegir, el borde queda en la opción sin seleccionar.
- [ ] **A3** Toque «Cerrar» → vuelve a Explorar, sin cuenta ni borrador creados.
- [ ] **A4** En Explorar, baje hasta el final de la lista y toque «Publicar mi casa gratis» (tarjeta «¿Tiene una casa en el Caribe?») → el mismo paso 1; lo mismo desde la pestaña «Ingresar» con la fila ocre «¿Quiere publicar su casa gratis?» («Gratis 12 meses · quedan N de 50 plazas»).
- [ ] **A5** Elija «Habitación» y toque «Continuar» → «¿Dónde está su casa?» (progreso «2 de 4», sin el rótulo «Su casa»), todavía sin cuenta: la dirección es `/publicar/nueva/2`. Siga con ubicación, personas, características, nombre y descripción como en 3.3–3.6 (todo se guarda en el teléfono); al tocar «Continuar» en nombre y descripción → `/publicar/verificar` con «Para subir las fotos, verifique su WhatsApp» (2026-11-04: el código se pide antes de las fotos, no tras el paso 1).
- [ ] **A5b** Sin cuenta, a medias (p. ej. en personas), toque «Cerrar» → Explorar. Vuelva a «Publicar mi casa» → el tipo sigue elegido y, al continuar, lo escrito sigue ahí (se guarda 7 días en el teléfono).

### 3.2 Verificar el WhatsApp y entrar al asistente

- [ ] En escritorio, complete el primer paso sin sesión y pulse «Continuar». La ventana «Para subir las fotos, verifique su WhatsApp» se abre sobre el formulario. Ciérrela con Escape o la X, compruebe que se conservan los datos y vuelva a abrirla. Pida el código y compruebe que el campo de seis dígitos recibe el foco en la misma ventana. Pruebe «Volver al número» y el reenvío cuando termine la espera. Complete la verificación para llegar a Precio y Fotos.

- [ ] **A6** En la pantalla de verificación revise → «Lo que ya escribió se guarda. Le enviamos un código por WhatsApp: así nadie más puede publicar en su nombre.», selector «+506» con «Costa Rica (+506)» elegido y «Otro país» al final, «¿Su número no es de Costa Rica? Toque +506 para elegir su país.», «No tengo acceso a mi WhatsApp» y «Al continuar acepta los Términos. 3bstays nunca le pedirá pagos.».
- [ ] **A7** Toque «Recibir código por WhatsApp» sin escribir número → «Escriba su número de WhatsApp.».
- [ ] **A8** Escriba `123` y pida el código → «Ese número no parece válido para el país elegido.».
- [ ] **A9** Con la segunda cuenta, elija «Estados Unidos / Canadá (+1)» → el campo cambia a «Sin el código de país»; elija «Otro país» → la ayuda dice «Escriba el número completo con «+» y el código de su país.».
- [ ] **A10** Con el número libre `8888 9999` en +506 → «Es su primera vez en 3bstays» y «Díganos su nombre para crear su cuenta. Le mandamos el código al +506 8888 9999.»; sin nombre, «Escriba su nombre.».
- [ ] **A11** Escriba un nombre y toque «Recibir código por WhatsApp» → «Introduzca el código», «Se lo enviamos por WhatsApp al +506 8888 9999.», «¿No llegó? Puede pedir otro en 0:30.», «Abrir WhatsApp para buscar el mensaje» y «Cambiar número».
- [ ] **A12** Escriba `000000` → «Ese código no es correcto o caducó.».
- [ ] **A13** Escriba `123456` → «Verificar y continuar» lleva directo a «Fotos», sin pasar por «¡Listo! Su cuenta está creada»; en Mis casas la casa ya tiene el nombre, la zona, las personas y las características que escribió antes del código.
- [ ] **A14** Cierre sesión (3.18) y repita con `8777 0001`, que ya existe → no pide nombre; tras el código sigue en el asistente (o, si ya tiene un borrador, ver A61).

### 3.3 Asistente: ubicación (pantalla 2)

- [ ] En escritorio, abra «Publicar» sin sesión y compruebe que los datos iniciales aparecen juntos antes de verificar el WhatsApp. Con sesión, retome un borrador desde un enlace antiguo de ubicación, capacidad, características o precio. Desde «Revisar y enviar», pulse una fila de ubicación o precio y compruebe que abre el grupo correspondiente y que «Continuar» vuelve al resumen.

- [ ] En el primer paso de escritorio, elija Habitación. Compruebe que Personas y «Baño de la habitación» ocupan columnas iguales y que «Personas» queda a la izquierda de su contador en la misma fila. El título del baño lleva su icono y las opciones Privado y Compartido se reparten el ancho en dos partes iguales.

- [ ] En escritorio, el campo «Zona» queda cerca del mapa desde que se abre el formulario. Al marcar un punto, compruebe que aparece la ubicación y que «Zona» sigue accesible.

- [ ] En escritorio, compruebe que «¿Qué es?» muestra opciones compactas con el botón de interrogación dentro del borde derecho de cada opción. Abra y cierre cada explicación con clic o teclado. Compruebe que consultar la ayuda no cambia el tipo seleccionado.

- [ ] En escritorio, desde Mis casas abra «Añadir casa». Compruebe que la barra superior de pestañas sigue visible. En la cabecera del asistente, la X queda a la izquierda de «Publicar casa» y «Atrás», «Continuar» y, al final, «Enviar a revisión» aparecen a la derecha en la misma fila. Recorra varios pasos con teclado y compruebe que puede volver a Mis casas desde la barra superior.

- [ ] En escritorio, recorra «Añadir casa» y compruebe que se muestran los títulos de cada pantalla, incluido «Revisar y enviar», sin barra de progreso ni contador de etapas. En móvil, compruebe que se mantienen ambos indicadores.

- [ ] En el primer paso de escritorio, compruebe que Personas, Dormitorios y Baños quedan en tres columnas si hay espacio y se reparten en dos cuando se estrecha la ventana. Cada etiqueta queda arriba y su icono aparece junto al número en la fila de los botones − y +. Los botones conservan el foco visible y un área de 44 × 44 px.

- [ ] En escritorio (1280 × 800), entre con sesión y abra «Añadir casa». La columna izquierda muestra «¿Qué es?», «¿Cuántos caben?» y «Características», en ese orden. El mapa aparece a la derecha. Alterne Habitación y Alojamiento completo para comprobar que cambian los controles de capacidad. Complete ambas columnas y pulse «Continuar» para abrir Precio y Fotos. Use «Atrás» y compruebe que se conservaron los datos, incluidas las características. En móvil, compruebe que los pasos aparecen por separado.

- [ ] **A15** En «¿Dónde está su casa?» revise → mapa alto con el campo «Busque un pueblo, playa o barrio» flotando arriba, «+»/«−» abajo a la izquierda, botón «Usar mi ubicación» abajo a la derecha, debajo una sola línea «Los clientes solo ven la zona, no su dirección.» y la lista «Zona» con «Marque el punto en el mapa» y «Otra…»; en un teléfono pequeño, sin scroll.
- [ ] En móvil, el mapa del segundo paso llega a ambos bordes y mide al menos 224 px de alto. Compruebe que puede marcar un punto y llegar al selector «Zona» a 375 × 667. Antes de marcar un punto, el mapa aprovecha el espacio de la línea de cantón y provincia. Al marcarlo, esa línea vuelve a ocupar su sitio.
- [ ] **A16** Toque el mapa sobre tierra, por ejemplo Limón centro → aparece una línea «cantón, provincia» (p. ej. «Limón, Limón») y «Zona» ofrece las zonas cercanas más «Otra…»; arrastre el pin a otro pueblo y la línea y la zona se actualizan solas.
- [ ] **A17** Toque el mar o un punto fuera del país → «Ponga el punto sobre tierra, dentro de Costa Rica».
- [ ] **A18** Escriba «Cocles» en el buscador y elija la opción «Cocles» → el mapa salta allí, la línea dice «Talamanca, Limón» y «Zona» queda en «Cocles».
- [ ] **A19** Toque «Usar mi ubicación» y deniegue el permiso → no pasa nada y el pin se queda donde estaba; si lo concede, el pin va a su posición (desde Canadá, fuera de Costa Rica, saldrá el aviso de A17).
- [ ] **A20** Elija «Otra…» → aparece el campo «Otra zona» («Escriba el nombre de la zona»); escriba «Rancho Escondido» → la lista ofrece `Usar "Rancho Escondido"`; tóquela y «Zona» queda «Rancho Escondido».
- [ ] Toque «Zona» para abrir la hoja inferior «Elegir zona». Compruebe que marca la zona actual, que «Otra…» abre el buscador y que «Cerrar» o Escape devuelve el foco al selector.

### 3.4 Asistente: capacidad y características (pantallas 4 y 5)

- [ ] **A21** Toque «Continuar» en el paso 2 sin marcar nada → avanza igual (publicar avanza siempre) a «¿Cuántos caben?», progreso «3 de 4», sin el rótulo «Su casa».
- [ ] **A22** Con el tipo «Alojamiento completo», en «¿Cuántos caben?» revise → «Personas», «Dormitorios» y «Baños» con «–» (sin indicar); toque «+» en cada uno → pasan a 1; «−» baja y se desactiva en el mínimo; toque «Continuar» sin indicar nada y avanza a «Características», progreso «4 de 4», sin el rótulo «Su casa».
- [ ] **A22a** En 390 × 844 y 375 × 667, revise el primer paso sin cuenta y los pasos con borrador: título a la izquierda, X sin texto arriba a la derecha (44 × 44 px), ocho tramos debajo y contador bajo la barra, a la derecha. No se muestra «Su casa»; la descripción accesible conserva etapa y paso global. Capacidad presenta filas abiertas con iconos, separadores y −/+ de 44 × 44 px. Atrás conserva su recuadro inferior izquierdo; Continuar y su flecha quedan juntos y centrados a su derecha, también en la entrada sin cuenta. No hay solapamientos ni scroll sin teclado. Avance, vuelva y cierre: se conserva lo guardado. Fotos y texto, Precio y Revisar y enviar conservan sus rótulos; en el resumen los pasos obligatorios incompletos mantienen su tramo vacío. «Revisar y enviar» aparece una sola vez junto a «último paso»; las filas tienen al menos 44 px y la oferta se ve completa por encima de la barra inferior en un teléfono pequeño.
- [ ] **A23** Con el tipo «Habitación», en esta pantalla sale solo el contador «Personas» (sin «Dormitorios» ni «Baños»: una Habitación es siempre 1 dormitorio y 1 baño) y debajo «Baño de la habitación» con «Privado» y «Compartido»; con «Alojamiento completo» salen «Dormitorios» y «Baños» y no sale el baño de la habitación. Vuelva al paso 1, cambie a «Alojamiento completo» y regrese al 4 → «Dormitorios» y «Baños» marcan 1 y se pueden cambiar.
- [ ] **A24** En «Características» revise las dos columnas con iconos y etiquetas de una línea, igual que Filtros: Wifi, Aire acond., Parqueo, Cargador EV, Mascotas, Niños gratis, Piscina, Frente al mar y Rancho/BBQ. Mascotas usa una huella y Niños gratis una cara de bebé. Al seleccionar, aparece el check a la derecha con margen, conservando el tamaño. «Parqueo» muestra el campo «Tipo de parqueo». Repita en la edición de las características de una casa publicada.
- [ ] **A25** Marque «Parqueo» → aparece «Tipo de parqueo» con «Seleccione una opción», «Gratuito» y «De pago»; desmárquelo → el selector desaparece.
- [ ] **A26** Marque «Parqueo» y «Frente al mar», elija «Gratuito» y toque «Continuar» → avanza a «Nombre y descripción».

### 3.5 Asistente: nombre y descripción (pantalla 6)

- [ ] **A27** Revise la pantalla → etapa «Fotos y texto» «1 de 2», «Nombre de la casa» con «0 / 32 · mínimo 5», «Descripción (opcional)» con «Puede añadirla después» y «Sin enlaces, teléfonos ni publicidad. Se revisa antes de publicar.».
- [ ] **A28** Escriba «Casa» (4 letras) → «4 / 32 · mínimo 5»; escriba una letra más → el contador deja de avisar; escriba un nombre de más de 32 letras y se detiene en «32 / 32».
- [ ] **A29** En la descripción escriba «Casa de madera a 80 m de la playa.» → «Faltan 46 caracteres»; con 80 o más el aviso se va y queda el contador de largo (máximo 2000).
- [ ] **A30** Toque el nombre con el teclado abierto → el campo sube bajo la cabecera, la descripción llena el alto que queda y «Continuar» no queda tapado; la tecla del teclado dice «Siguiente» en el nombre y «Listo» al final.
- [ ] **A31** Deje el nombre en «Casa» (corto) y toque «Continuar» → avanza igual a «Fotos» (no bloquea; se avisa en el último paso).

### 3.6 Asistente: fotos (pantalla 7)

- [ ] En escritorio, con sesión, compruebe que después de los datos iniciales aparecen Precio a la izquierda y Fotos a la derecha. Suba una foto, escriba el precio y continúe a «Nombre y descripción» y después a «Revisar y enviar». Vuelva dos veces con «Atrás» y compruebe que se conservaron la foto y el precio.

- [ ] **A32** Sin fotos revise → «Fotos» con «0 de 15», «Necesita al menos una foto para enviarla a revisión.», botón «Añadir» y «Horizontales, sin teléfonos ni marcas de agua.».
- [ ] **A33** Toque «Añadir» y elija 4 fotos de la galería → cada una pasa por «Preparando…», «Subiendo…» y «Guardando…»; el contador queda en «4 de 15» y la primera lleva «Portada».
- [ ] **A34** Con 2 o más fotos revise → «Mantenga pulsada una foto y arrástrela para cambiar el orden. La primera es la portada.» (con una sola foto no sale).
- [ ] **A35** Mantenga pulsada la foto 3 y suéltela en la primera posición → ahora lleva «Portada», el orden se conserva al recargar y la página no se movió.
- [ ] **A36** Toque la ✕ de una foto → desaparece, el contador baja a «3 de 15» y las demás se reacomodan.
- [ ] **A37** Suba más fotos hasta pasar de 15 → solo suben las que caben, sale «Máximo 15 fotos.», el contador dice «15 de 15» y «Añadir» desaparece.
- [ ] **A38** Elija un archivo que no sea imagen (PDF o GIF) → «Ese formato no se puede subir. Use JPG o PNG.».

### 3.7 Asistente: precio (pantalla 8)

- [ ] **A39** Revise la pantalla → etapa «Precio», «Precio por noche» con «₡», «¿Acepta alquiler por meses?» con «No» marcado y «Sí», y «En colones; el cliente puede verlo en dólares. El precio final lo acuerda por WhatsApp.».
- [ ] **A40** Toque «Sí» → aparece «Precio al mes (opcional)» y «Si lo deja vacío, en su ficha dirá «Precio a negociar con el anfitrión».»; vuelva a «No» → el campo desaparece y se vacía.
- [ ] **A41** Escriba `85000` por noche y `480000` al mes y toque «Continuar» → llega a «Revisar y enviar».

### 3.8 Revisar y enviar (pantalla 9)

- [ ] **A42** Revise la cabecera → «Revisar y enviar» y «último paso»; filas «Alojamiento» («Alojamiento completo»), «Dónde» (p. ej. «Playa Bonita · Limón, Limón, Limón»), «Capacidad» («5 pers. · 2 hab. · 2 baños»), «Nombre», «Fotos» («4 fotos») y «Precio» («₡85 000 / noche · ₡480 000 / mes»).
- [ ] **A43** Con nombre corto y sin fotos → las filas «Nombre» y «Fotos» salen en terracota con «Añadir el nombre» y «Añadir una foto», la barra de progreso deja vacíos esos tramos y «Enviar a revisión» no se puede tocar.
- [ ] **A44** Toque la fila «Añadir el nombre» → paso 6; corrija el nombre (5 a 32) y toque «Continuar» → vuelve directo a «Revisar y enviar» (no al paso 7) y la fila vuelve a normal con ««Casa Manzanillo, a pie de playa»» (su nombre entre «»). Igual con cualquier fila, en terracota, en ocre o normal: «Continuar» guarda y vuelve al resumen, y «Atrás» (la flecha) también vuelve al resumen sin guardar, incluso desde «Alojamiento» (paso 1). Entrando al asistente por «Seguir publicando», «Continuar» y «Atrás» siguen el orden de siempre.
- [ ] **A45** Con nombre, foto, tipo, ubicación y precio pero sin descripción → «Nombre» sale en ocre con «Añadir una descripción» y «Enviar a revisión» está activo (avisar no bloquea).
- [ ] **A46** Deje la capacidad vacía, el parqueo marcado sin tipo y el precio mensual mal → salen en ocre «Completar la capacidad», «Parqueo» con «Indicar si se paga» y «Revisar el precio mensual»; ninguno bloquea el envío.
- [ ] **A46b** Con el tipo «Habitación» → la fila «Capacidad» no cuenta habitaciones ni baños: dice el tipo de baño («2 pers. · baño compartido» o «2 pers. · baño privado»), y nunca sale en ocre por las habitaciones ni por los baños (sí, «Completar la capacidad», si falta elegir privado o compartido).
- [ ] **A47** Toque «Ver cómo queda su ficha» → hoja «Vista previa · así la verán los clientes» con la foto «1 / 4», nombre, el pin y «Playa Bonita, Limón», «5 personas · 2 dormitorios · 2 baños», su nombre y debajo «Anfitrión · WhatsApp verificado», «Parqueo gratis», «Frente al mar», «Alquiler mensual», «₡85 000 / noche», «Mensual: ₡480 000 / mes», «≈ $167 / noche» y «Contactar por WhatsApp»; toque «Cerrar» y vuelve a «Revisar y enviar» sin perder nada.
- [ ] **A48** Revise bajo las filas → «Los clientes le escriben al +506 8777 0001 (verificado). No se muestra públicamente.» y la oferta «Si está entre las próximas 50 casas. Después, ₡2 900 al mes. Sin tarjeta.» con «₡0 · 12 meses» (el número de casas baja según las plazas que queden).
- [ ] **A49** Con todo lo obligatorio listo, toque «Enviar a revisión» → botón «Un momento…» y, si la cuenta no tiene correo, pasa a «¿Quiere añadir un correo?».

### 3.9 Pregunta del correo y casa enviada

- [ ] **A50** En «¿Quiere añadir un correo?» revise → campo «Correo», «Para recuperar su cuenta si pierde el acceso a su WhatsApp. Opcional.», «Guardar correo» y «Ahora no».
- [ ] **A51** Toque «Guardar correo» sin escribir → «Escriba su correo o toque «Ahora no».».
- [ ] **A52** Toque «Ahora no» → «¡Listo! Su casa está en revisión» con «Revisamos <nombre> a mano, normalmente en menos de 24 horas. Le avisamos por WhatsApp cuando esté publicada.» y tres pasos: «Enviada» («Hoy · referencia CT-####»), «La revisamos» y «Publicada y gratis 12 meses».
- [ ] **A53** Toque «Ir a Mis casas» → la casa sale con la etiqueta «En revisión», sin botones, y la casilla «1 en revisión».
- [ ] **A54** Publique otra casa hasta enviarla → ya no pregunta por el correo (se recuerda «Ahora no» en ese teléfono) y va directo a «¡Listo! Su casa está en revisión».
- [ ] **A55** En «¡Listo!» toque «Marcar las noches ocupadas» → abre el Calendario de esa casa (ver 3.14), con la casa ya en el selector aunque siga en revisión.
- [ ] **A56** (tras D-aprobar) Abra Mis casas (el aviso por WhatsApp de la decisión no es automático en v1) → la tarjeta pasa a «Activa» con «Compartir» y, si tiene varias casas, los iconos Calendario y Consultas, y su ficha `/casa/CT-####` ya abre en una pestaña sin sesión.

### 3.10 Cerrar y seguir después, borradores

- [ ] **A57** Desde Cuenta o Mis casas (con sesión), empiece una casa y toque «Cerrar» en cualquier paso (su nombre accesible es «Cerrar y seguir después») → la X se desactiva mientras guarda (nombre accesible «Guardando el borrador…») y vuelve a Mis casas con la casa en «Borrador».
- [ ] **A58** En la tarjeta «Borrador» → botones «Seguir publicando» y «Descartar»; «Seguir publicando» abre el primer paso con algo obligatorio sin cumplir (o «Revisar y enviar» si no falta nada).
- [ ] **A59** Toque la tarjeta del borrador → detalle con el título (o «Borrador sin título»), «Seguir publicando» grande, debajo «Falta: fotos y precio» (solo lo obligatorio que falte), «WhatsApp de esta casa» y «Descartar borrador».
- [ ] **A60** Toque «+» («Nueva casa») en Mis casas teniendo un borrador → «Tiene un borrador sin enviar» con ««Borrador del Caribe» · empezado el 30 de octubre.», «Seguir con el borrador» y «Empezar otro»; «Seguir con el borrador» vuelve al paso donde se quedó con lo escrito y «Empezar otro» abre un paso 1 vacío sin la nota «Guardamos el borrador en cada paso; puede seguir después desde Mis casas.»; la cabecera muestra «1 de 4» sin «Su casa», y al cerrar se puede retomar el borrador con lo guardado.
- [ ] **A60b** Toque «+» («Nueva casa») en Mis casas sin ningún borrador → el paso 1 («¿Qué es?») sale al instante con su cabecera («Publicar casa», X a la derecha, progreso y «1 de 4» debajo), sin recuadro gris de carga y sin que asome ninguna otra tarjeta (ni «Publique su casa en pocos pasos» ni «Tiene un borrador sin enviar»), también con DevTools «Slow 4G» + CPU 4×: el borrador se crea por detrás (2026-11-06). Elija «Alojamiento completo» y toque «Continuar» enseguida: al volver a Mis casas, el borrador aparece con su CT-#### y lo elegido guardado. Si abre «Nueva casa» sin pasar por Mis casas (p. ej. recargando /propietario/publicar), puede verse un momento el recuadro gris mientras se consulta la base. Desde el paso 1, «Atrás» del teléfono (o del navegador) vuelve a Mis casas, no a una pantalla intermedia.
- [ ] **A60c** Con un borrador, abra «+» (sale «Tiene un borrador sin enviar»), vuelva a Mis casas, descarte ese borrador desde otro teléfono y toque «+» otra vez → no vuelve a enseñar el borrador descartado: el recuadro de carga y directo al paso 1 de una casa nueva.
- [ ] **A61** En la verificación con `8777 0001` (3.1–3.2) teniendo un borrador → tras el código sale «Tiene un borrador sin enviar» con «Seguir con el borrador» y «Seguir con «<el nombre que escribió>»» (o «Empezar otra» si no llegó a escribir el nombre); esta crea la casa nueva con lo escrito y sigue en Fotos.
- [ ] **A62** Toque «Descartar» en una tarjeta → sube la hoja de la app (no el aviso del navegador) «¿Descartar este borrador?» con «No se puede deshacer.» y «Descartar» (en rojo) / «Cancelar»; «Cancelar» la cierra y la tarjeta sigue; toque otra vez «Descartar» y confirme → la tarjeta desaparece y la casilla «borrador» baja. Lo mismo con «Descartar borrador» en el detalle, que vuelve a Mis casas.
- [ ] **A63** Cree 5 borradores y toque «Empezar otro» una sexta vez → «Ya tiene 5 borradores sin enviar. Termine o descarte uno antes de empezar otro.».
- [ ] **A64** Toque «Continuar» y, en el mismo segundo, cierre la app o recargue → al volver, el paso quedó guardado (el siguiente paso trae lo escrito).
- [ ] **A65** Entre con el mismo número en otro teléfono → el borrador aparece en Mis casas con lo guardado y «Seguir publicando» lo retoma.

### 3.11 Mis casas: estados y tarjetas

- [ ] **A66** Con una sola casa la pestaña dice «Mi casa»; con dos o más, «Mis casas»; el título de la pantalla es «Mis casas» en los dos casos.
- [ ] **A67** Revise las casillas → «activa»/«activas», «por pagar», «en revisión», «borrador»/«borradores»; las que están en cero no salen; tocar «borrador» abre ese borrador.
- [ ] **A68** Con casas en varios estados, compruebe el orden → primero cambios pedidos y rechazadas, luego pendiente de pago e inactivas, luego borradores, luego activas y al final en revisión.
- [ ] **A69** Tarjeta «Activa» → foto con la etiqueta «Activa», nombre, zona y Compartir con icono y texto verde sobre la superficie de la tarjeta, sin relleno; una línea neutra separa las acciones, sin banda verde; sin precio ni «Añadir método de pago». Con varias casas, a la derecha están los iconos Calendario y Consultas de esa casa; con una sola casa no aparecen (se usan las pestañas). Tocar la foto o el nombre abre el detalle; arrastrar para desplazar no lo abre.
- [ ] **A69a** En 390 × 844 y 375 × 667, los accesos Calendario y Consultas tienen dibujos de 28 px dentro de objetivos de 44 × 44 px y al menos 16 px entre ellos. Abren la casa correspondiente, sin que el enlace estirado de la tarjeta intercepte el toque. Consultas muestra solo las nuevas de esa casa; cero no muestra contador. Filtrar una casa no marca consultas como abiertas. Al abrir WhatsApp desde una consulta (recorrido 3.14), su contador se actualiza también en Mis casas. No hay desbordamientos; en un móvil más estrecho las acciones pueden pasar a otra fila.
- [ ] **A69b** En una casa Inactiva, también si es la única, Activar suscripción conserva el dorado y cabe completo dentro de los márgenes laterales de la tarjeta (375 × 667 y 390 × 844). Una bloqueada no ofrece activación ni compartir. Los borradores conservan su tarjeta y sus acciones; «Aún sin fotos» sigue indicando la ausencia de fotos.
- [ ] **A69c** La barra de estados mantiene sus casillas, cantidades, colores y accesos (también el enlace al borrador); en móvil, la barra y las tarjetas llegan a los bordes y el botón «Nueva casa» conserva 4 px a la derecha. Las tarjetas con acciones tienen nombre y zona más juntos y un divisor neutro antes de Compartir/Calendario/Consultas. Con nombres largos y en 320 px no se solapan ni recortan los controles. Copiar el enlace muestra «Enlace copiado» sin cambiar el tamaño del botón.
- [ ] **A70** (tras D-pedir cambios) Casa con la etiqueta «Cambios pedidos» → «Nota de 3bstays: <nota>» y «Corregir y reenviar», que abre el asistente con todo relleno; al terminar y enviar vuelve a «En revisión».
- [ ] **A71** (tras D-rechazar) Casa con la etiqueta «Rechazada» → «Nota de 3bstays: <nota>» y sin botones; su detalle dice «Anuncio rechazado».
- [ ] **A72** Casa «En revisión» → sin botones; su detalle dice «La estamos revisando, normalmente en menos de 24 horas. Le avisamos por WhatsApp. Mientras tanto no se puede editar.».
- [ ] **A73** Casa con la oferta vencida sin método (ver 3.17) → etiqueta «Pendiente de pago», botón ocre «Añadir método de pago» y sin «Compartir» ni «Calendario».
- [ ] **A74** Casa con la suscripción parada → etiqueta «Inactiva» y botón ocre «Activar suscripción».
- [ ] **A75** Casa pausada desde el Calendario («Pausar la casa») → etiqueta «Pausada hasta el <fecha>» (o «Pausada» sin fecha) en el beige de «Inactiva», distinta de «Pausada por 3bstays» (la del admin, con el color de «En revisión»), y sigue con Compartir y, con varias casas, los iconos Calendario y Consultas.
- [ ] **A76** Arriba de la lista sale como mucho un solo aviso ocre (el de pago, primero la «Pendiente de pago») con el nombre de la casa; los borradores y los cambios pedidos no lo usan.

### 3.12 Detalle de una casa y compartir la ficha

- [ ] **A77** Abra una casa activa → margen exterior12 px, portada enmarcada con estado y acceso crema de cámara/recuento (44 px, lector «Editar fotos: N fotos»), estadísticas centradas y compactas en dorado suave, sin iconos, y nota «Toque un dato para editarlo. Su ficha seguirá visible durante la revisión.» Ver ficha conserva su posición flotante y no tapa el final.
- [ ] En escritorio, abra el detalle de una casa activa como anfitrión. Compruebe que el panel derecho comienza con los datos editables y que puede abrir cada campo. A 1280 × 800, revise que la tarjeta «Últimos 30 días» sea compacta y que se lean las tres cifras con sus etiquetas.
- [ ] **A78** Abajo y centrado flota el botón «Ver ficha» con un ojo a la izquierda, con el mismo aspecto que «Mapa» de Explorar (tarjeta clara translúcida con texto e icono oscuros, esquinas de 12 px, no redondo), a 12 px del borde y sin chocar con la barra de inicio del iPhone; baje hasta el final: la fila «Suscripción» se lee entera por encima del botón. Tóquelo → abre `/casa/CT-####` con la ficha pública de la casa.
- [ ] **A79** Baje en el detalle → «Compartir» con el enlace `pruebas.3bstays.com/casa/CT-####` debajo, la fila «WhatsApp de esta casa» con «+506 8777 0001 · verificado» y el bloque «Suscripción» con «Oferta de lanzamiento» y «Al día».
- [ ] **A80** Toque «Compartir» → se abre la hoja de compartir del teléfono con el enlace y el texto de la casa; elija WhatsApp y el enlace llega; sin hoja de compartir, el botón dice «Enlace copiado». En escritorio, compruebe que el botón funciona y que la URL no aparece debajo.

### 3.13 Editar una casa publicada

- [ ] En escritorio, edite Precio y compruebe que «Guardar» y la X aparecen arriba del campo. Guarde y verifique que el precio se actualiza y que el editor se cierra. En Nombre, compruebe que la acción dice «Enviar a revisión». Si hay un error, el editor sigue abierto con lo escrito. Cambie otro campo y pulse la X. Compruebe que descarta lo escrito, vuelve «Editar» y reaparece la barra superior.
- [ ] «Guardar» y «Enviar a revisión» están deshabilitados al abrir un campo. Cambie un precio, un nombre, un contador y una característica, y compruebe que la acción se habilita. Reponga cada valor inicial y compruebe que se deshabilita de nuevo. En Ubicación, espere a que se cargue la zona y compruebe que la acción se activa al cambiar el pin o la zona.
- [ ] A 1280 × 800, abra Fotos desde la portada de una casa. Compruebe que la galería se abre en una ventana amplia sobre la ficha y que puede desplazarse dentro de ella, añadir, quitar y ordenar fotos. Cierre con Listo, la X y Escape, y compruebe que el foco vuelve al botón de Fotos y que se conservan los cambios guardados. En móvil, compruebe que Fotos abre su pantalla habitual.

- [ ] **A81** En el detalle de una casa activa revise las filas → «Nombre», «Tipo», «Personas, dormitorios y baños», «Características», «Descripción», «Precio» y «Ubicación»; «Nombre», «Tipo», «Descripción» y «Ubicación» llevan la etiqueta «Revisión» y las otras no.
- [ ] En móvil, la foto del detalle de una casa desde Mis casas llega a ambos bordes. El resto del contenido tiene 3 px de margen a cada lado. Revise a 320 px que los datos y las acciones queden dentro de la pantalla.
- [ ] **A82** Toque «Precio», cambie a `99000` y toque «Guardar» → aviso «Guardado. Ya se ve en su ficha.», vuelve al detalle con «₡99 000 / noche» y la ficha pública (abierta en otra pestaña sin sesión) ya muestra el precio nuevo; «Personas, dormitorios y baños» y «Características» también se guardan al momento con «Guardar», sin revisión.
- [ ] En móvil, los editores de campos abiertos desde Mis casas dejan 12 px a cada lado de la cabecera, el contenido y la barra de botones, igual que Publicar casa.
- [ ] En «Editar casa → Ubicación», compruebe que el mapa llega a ambos bordes y tiene la misma altura mínima que en Publicar casa. A 375 × 667, compruebe que se puede marcar un punto y abrir el selector «Zona».
- [ ] En «Editar casa → Ubicación → Zona → Otra…», toque el campo «Otra zona» en el teléfono y compruebe que queda visible sobre el teclado mientras escribe.
- [ ] **A82b** (con Marco, `8777 0002`, en CT-1050 o CT-1051, que son Habitación) En el detalle, la fila dice «Personas» con solo «N personas» (sin habitaciones ni baños; el baño privado o compartido sale en la fila «Tipo», que es donde se cambia); tóquela → pantalla «Personas» con solo el contador «Personas»; suba una persona y «Guardar» → «Guardado. Ya se ve en su ficha.» y la ficha pública dice «N personas · 1 dormitorio · baño compartido» (o «baño privado»). Devuélvala a como estaba.
- [ ] **A83** Toque «Nombre», cámbielo y fíjese en el aviso → «Este cambio lo revisamos antes de publicarlo, normalmente en menos de 24 horas. Mientras tanto los clientes ven «Casa Coco».» y el botón dice «Enviar a revisión».
- [ ] **A84** Toque «Enviar a revisión» → aviso «Enviado a revisión. Su ficha sigue como está hasta que lo aprobemos.», la etiqueta sobre la foto pasa a «Cambios en revisión» y la fila «Nombre» muestra «En revisión», el nombre nuevo, «Los clientes ven lo de antes hasta que lo aprobemos.» y «Descartar».
- [ ] **A85** Abra la ficha pública en otra pestaña → sigue con el nombre anterior.
- [ ] En escritorio, compruebe que la fila «Nombre» muestra arriba el nombre publicado. Debajo aparece «En revisión» junto a «Los clientes ven lo de antes hasta que lo aprobemos.», con el nombre propuesto en la línea siguiente. Si se pidieron cambios, compruebe que se ve la nota de revisión. Pulse «Descartar» y compruebe que queda solo el nombre publicado.
- [ ] **A86** Editar sigue las reglas de crear (ticket 12): con un nombre de 3 letras toque «Enviar a revisión» → «El nombre de la casa debe tener entre 5 y 32 caracteres.»; con el nombre vacío → «Póngale un nombre a la casa.». En cambio, una descripción de 30 letras **sí se envía** (aviso «Enviado a revisión. Su ficha sigue como está hasta que lo aprobemos. La descripción debe tener entre 80 y 2000 caracteres o quedar vacía.») y en el detalle la fila «Descripción» lleva ese mismo aviso en ocre debajo; sin descripción, la fila dice «Sin descripción» en ocre. Cambiar el nombre de una casa con la descripción corta funciona sin tocar la descripción. Un nombre de antes de más de 32 letras: abra «Nombre» y toque «Enviar a revisión» sin tocarlo → vuelve al detalle sin enviar nada (ni se recorta).
- [ ] **A86b** En «Personas, dormitorios y baños» (o «Precio») de una casa que ya tenía el dato, no se puede dejar vacío: «Indique cuántas personas pueden alojarse (mínimo 1).», «Indique el número de baños (mínimo 1).», «Indique el precio por noche en colones.». En una casa a la que le faltaba un dato (p. ej. sin baños), la fila lleva el aviso en ocre («Indique el número de baños (mínimo 1).») y cambiar otro dato (el precio, las personas) se guarda igual: cada dato se valida solo.
- [ ] **A86c** En «Precio», con «¿Acepta alquiler por meses?» en «Sí», escriba `350 mil` en «Precio al mes (opcional)» → la ayuda de debajo pasa a ocre: «Indique el precio al mes en colones o déjelo vacío.»; si la casa no tenía precio al mes, «Guardar» lo deja «a negociar» y el aviso lo repite; si ya tenía uno, no se guarda y sale ese mensaje arriba. Lo mismo en el paso «Precio» del asistente de publicar (ahí «Continuar» sigue y se guarda vacío).
- [ ] **A86d** En «Tipo» elija «Habitación» sin tocar «Privado» ni «Compartido» y toque «Enviar a revisión» → se envía (como al crear) y la fila «Tipo» dice «Habitación» con el aviso en ocre «Indique si el baño es privado o compartido.»; vuelva a «Tipo», elija uno y el aviso se va. Una casa de las de antes (tipo «Casa» o «Apartamento») abre «Tipo» con «Alojamiento completo» marcado y, sin tocar nada, no envía ningún cambio.
- [ ] En «Editar casa → Tipo», la opción sin seleccionar lleva el mismo borde ocre claro que en «Añadir casa → ¿Qué es?».
- [ ] **A87** En «Ubicación» mueva el pin o cambie la zona → «Enviar a revisión» y el aviso nombra la zona de ahora («…ven «Cocles».»); en el detalle la fila «Ubicación» queda «En revisión».
- [ ] **A88** Toque «Descartar» en un dato en revisión → sube la hoja de la app «¿Descartar este cambio?» con «Su ficha sigue como está.» y «Descartar» / «Cancelar»; confirme y la fila vuelve a «Revisión» con el valor aprobado.
- [ ] **A89** Toque la cámara con el recuento de fotos → pantalla Fotos y sus controles, contador, explicación del orden y de la revisión, y Listo. El acceso sigue en la misma esquina de la portada y no cambia de función.
- [ ] **A90** Añada una foto → aparece En revisión, sube el contador y el acceso de portada indica «N fotos · 1 nueva en revisión» con nombre accesible que empieza por Editar fotos. Quite esa foto nueva con su X → se descarta y baja el contador.
- [ ] En móvil, «Editar fotos» deja 12 px a cada lado de la cabecera, los textos y la barra de botones. La cuadrícula de fotos y «Añadir» llega a ambos bordes.
- [ ] **A91** En una casa con una sola foto aprobada toque su ✕ → «Su ficha necesita al menos una foto. Añada otra y, cuando la aprobemos, podrá quitar esta.».
- [ ] **A92** (tras D-aprobar el nombre) Abra el detalle → la fila «Nombre» ya no está pendiente, muestra el nombre nuevo, la etiqueta vuelve a «Activa» y la ficha pública lo muestra.
- [ ] **A93** (tras D-pedir cambios en un dato) Abra el detalle → la fila muestra «Cambios pedidos» y «Le pedimos cambios: <nota>»; corríjalo y toque «Enviar a revisión» → vuelve a «En revisión» sin la nota.

### 3.14 Calendario

- [ ] En escritorio, compruebe que las casillas con precio muestran «₡45 000» con colones elegidos y «$» al cambiar a dólares desde la barra superior.

- [ ] En escritorio (1280 × 800), seleccione una o varias noches. Debajo de las acciones del menú izquierdo deben aparecer la disponibilidad, el precio, Cancelar y Guardar cambios. Compruebe que puede editar, guardar y volver a seleccionar noches sin que el editor tape la cuadrícula. En móvil, compruebe que el editor sigue al pie de la pantalla.

- [ ] En escritorio (1280 × 800), abra Calendario con dos casas elegibles. Compruebe que el selector de casa encabeza el menú izquierdo, que permanece visible debajo de la barra superior al desplazarse por los meses de la derecha, y que «₡ | $» permanece arriba a la derecha. Cambie de casa desde el menú y confirme que se actualizan los días. Con una sola casa, compruebe que aparece su nombre en el mismo sitio.

- [ ] **A94** Abra Calendario → selector de casa vigente y filas compactas Marcar una reserva y Pausar la casa con iconos sin recuadro y flecha, sin explicaciones debajo. Sin conexión iCal, «Conectar con Airbnb» queda unido a esas filas en la misma tarjeta blanca. Tras conectar, «Sincronización con Airbnb» aparece sobre el fondo crema, con el botón independiente de actualizar a la izquierda, verde claro y gris al deshabilitarse. Las explicaciones de reserva/pausa aparecen en sus hojas antes de confirmar. Rejilla, meses, precios, moneda, leyenda y panel mantienen su funcionamiento.
- [ ] En móvil, Calendario deja 12 px de margen lateral en el contenido y la cuadrícula. Compruebe que los encabezados se alinean con las siete columnas.
- [ ] **A95** Con dos o más casas elegibles, toque el selector de casa → hoja inferior «Elegir casa», X para cerrar, nombres completos y selección dorada con check; no ofrece «Todas las casas». Incluye las activas, las de primera revisión y las que tienen cambios; no salen borradores ni rechazadas. Con una sola se oculta el selector; cambiar de casa no mezcla los días. El selector cerrado tiene el mismo fondo y acabado que en Consultas.
- [ ] En escritorio, abra el selector de casa en Calendario y dentro de la ventana Consultas. Compruebe que la lista se abre junto al selector con el mismo estilo, permite usar flechas y se cierra al elegir, pulsar Escape o hacer clic fuera. Con Escape, el foco vuelve al selector. Abra «Cerrar sesión» en Cuenta y compruebe que la confirmación aparece centrada. En móvil, compruebe que ambos patrones siguen abriendo sus hojas inferiores.
- [ ] **A96** Toque tres noches del mes siguiente (10, 11 y 12) → marco terracota en cada una, panel pegado abajo con «3 noches · 10–12 nov», botones «Disponible» (marcado) y «Ocupado», campo «Precio por noche», «Cancelar» y «Guardar cambios» en gris; la barra de pestañas se esconde.
- [ ] **A97** Toque «Ocupado» y «Guardar cambios» → las tres noches quedan en terracota con rayas y solo el número, al instante; recargue y siguen así.
- [ ] **A98** Seleccione una noche y escriba `110000` en «Precio por noche» → guarde y esa noche muestra solo la cifra distinta; con el panel abierto aparece «Usar el precio base (₡99 000)» que la restaura.
- [ ] **A99** Escriba `0` o letras en «Precio por noche» y guarde → «Escriba un precio por noche en colones, mayor que cero y sin decimales.».
- [ ] **A100** Toque «$» en «₡ | $» → los precios de las casillas pasan a dólares; toque «₡» → vuelven a colones, y la elección se mantiene al recargar.
- [ ] **A101** Active el modo avión, marque una noche como ocupada y guarde → el cambio vuelve atrás y avisa «Sin conexión. Revise su internet e intente de nuevo.».
- [ ] **A101a** Toque «Marcar una reserva» → hoja «Marcar una reserva» con «Elija la llegada y la salida. La noche de la salida queda libre.». Mientras comprueba disponibilidad, muestra «Comprobando disponibilidad…», sin calendario seleccionable, con guardar desactivado y Cancelar disponible. Con Airbnb conectado, reutiliza un éxito de menos de un minuto o espera la importación en curso; en otro caso actualiza con el mismo motor. Después muestra el calendario de rango con los días ocupados manuales/importados de la casa deshabilitados como llegada. Elija un 7 libre → «Ahora elija la salida».
- [ ] **A101b** Elija el 11 como salida → el 7 y el 11 en terracota con la banda entre los dos y el resumen «4 noches · 7–10 <mes>». Toque «Marcar como ocupado» → la hoja se cierra, aviso «4 noches marcadas como ocupadas · 7–10 <mes>» y las noches 7, 8, 9 y 10 quedan rayadas al instante; el 11 sigue libre. Recargue y siguen así; la ficha pública las marca ocupadas.
- [ ] **A101c** Una noche ya ocupada manualmente o por Airbnb no se puede elegir como llegada; un intervalo que la atraviese se rechaza con «Hay noches ocupadas entre esas fechas.». La primera fecha ocupada sí puede ser salida porque esa noche queda excluida. Marcar noches libres con precio especial conserva su precio. Si las fechas se ocupan en otra pestaña o por importación antes de guardar, la base rechaza toda la reserva; no ocupa las otras noches ni cambia precios.
- [ ] **A101e** Fuerce un fallo de lectura de Airbnb antes de abrir la hoja: se conservan las noches válidas y no aparece el calendario seleccionable hasta tocar «Continuar con el último calendario». Cancelar no guarda nada; Intentar de nuevo repite la comprobación. Un error de permisos al leer los días no permite continuar con un supuesto calendario vacío. Sin red, solo puede ofrecer una disponibilidad previamente guardada y tras aviso/confirmación; nunca sin datos conocidos.
- [ ] **A101d** Abra la hoja y ciérrela con «Cancelar», tocando el fondo o con Escape (teclado) → no cambia nada; al volver a abrirla empieza sin fechas. Con un día tocado (panel abajo), marcar una reserva cierra el panel.
- [ ] **A102** Toque «Pausar la casa» → hoja «Pausar la casa» con «Volver a publicarla el (opcional)», «No aparecerá en Explorar ni recibirá consultas. Sus noches y precios se conservan. Sin fecha, sigue pausada hasta que usted la vuelva a publicar.», «Pausar la casa» y «Cancelar».
- [ ] En escritorio, compruebe en «Pausar la casa», «Marcar una reserva» y «Cerrar sesión» que «Cancelar» se ve en terracota, con fondo transparente y sin sombra. Pulse Tab para comprobar el foco visible y active «Cancelar» con el teclado.
- [ ] En escritorio, abra la confirmación de «Parar suscripción». Compruebe que «Mantener suscripción» es el botón verde superior y que pulsarlo cierra la ventana y conserva la suscripción. Debajo, «Parar suscripción» aparece como texto terracota. Pruebe esa acción con una casa de prueba y compruebe que la suscripción se detiene.
- [ ] **A103** Elija una fecha para volver a publicarla de ayer o de dentro de más de un año → «La fecha para volver a publicarla debe ser a partir de mañana y dentro de un año.».
- [ ] **A104** Elija una fecha de vuelta de dentro de una semana y toque «Pausar la casa» → la tarjeta pasa a «Pausada hasta el <fecha>» («No aparece en Explorar ni recibe consultas.») con «Volver a publicarla» a lo ancho, sin «Marcar una reserva»; los días se ven atenuados y la casa no sale en Explorar ni recibe consultas (compruébelo sin sesión en otra pestaña).
- [ ] **A105** Con la casa pausada toque una noche → no se selecciona (solo lectura).
- [ ] **A106** Toque «Volver a publicarla» → vuelven «Marcar una reserva» y «Pausar la casa» al instante y la casa sale otra vez en Explorar.
- [ ] **A107** Con solo un borrador y ninguna casa enviada, abra Calendario → «Su calendario se activa cuando envíe su casa a revisión.» con «Seguir publicando».

#### 3.14.1 Conectar Airbnb e importar noches (#5, solo móvil)

Diseño aprobado: `.scratch/calendarios-externos/diseno-v0.1.md`. En esta entrega no hay exportación, botón «Actualizar ahora», sustitución/desconexión ni programación automática; corresponden a #6–#8. La información muestra la última lectura válida, no promete tiempo real.

**Preparación local reproducible.** Aplicar `pnpm db:al-dia` y regenerar tipos con `pnpm --filter app db:types` desde la carpeta principal. No ejecutar start/reset/stop en la base compartida. Ingresar con `8777 0001`, código `123456`, crear una casa desechable con nombre **Prueba Airbnb**, precio por noche y los datos/foto necesarios, y enviarla a revisión para habilitar Calendario. No usar las diez casas reservadas de `datos:prueba`. Anotar su `CT-####`; si además se van a comprobar búsqueda/contacto, aprobar esa casa por el recorrido admin vigente (§1.2), sin SQL manual de estados.

El arnés siguiente solo admite Supabase en localhost, la cuenta de pruebas y una casa cuyo nombre empieza por «Prueba Airbnb». Usa una URL y un proveedor sintéticos, sin leer Airbnb ni guardar datos de huéspedes. No modifica una conexión con enlace real. Sustituya `CT-xxxx` por el identificador de su casa desechable:

```bash
AIRBNB_MANUAL_HOUSE=CT-xxxx AIRBNB_MANUAL_SCENARIO=inicial pnpm --filter app exec vitest run --project db tests/db/airbnb-manual.test.ts
```

El resultado imprime llegada, salida excluida y fecha de solapamiento manual, todas inventadas: hoy de Costa Rica +10 a +13 (tres noches); el solapamiento es hoy +11. Ejecute la secuencia en el mismo día de Costa Rica. Para las siguientes lecturas, repita el comando cambiando solo el escenario: `repetir`, `cambiar`, `fallo`, `cancelar`, en ese orden. Se usa el mismo motor que en la primera conexión; este arnés opt-in no crea una interfaz de actualización ni un endpoint de pruebas en producción.

- [ ] **IC01 · Primera conexión por pantalla.** En otra casa desechable sin conexión, abra Calendario → «Conectar con Airbnb» → «Conectar Airbnb». Compruebe título, nombre de la casa y campo etiquetado. Con un enlace real de Airbnb que usted controle: «Conectando…» impide doble envío; después aparece la fecha de última importación y el número de noches. No se puede deducir el nombre de Airbnb desde el archivo: confirme que el enlace pertenece a la casa elegida. No pegue enlaces reales en capturas, documentación ni informes compartidos.
- [ ] En escritorio, «Conectar con Airbnb» abre una ventana centrada sobre Calendario con «Importar desde Airbnb» y «Exportar hacia Airbnb» para la casa seleccionada. Compruebe que puede generar y copiar el enlace sin conectar primero la importación. Con un enlace de importación inválido, el mensaje aparece dentro de la ventana y permite corregirlo. Escape devuelve el foco al botón y conserva la casa, el mes y el desplazamiento.
- [ ] **IC02 · Error de primera lectura.** En una casa sin conexión, introduzca una URL incorrecta → error junto al campo sin cambiar el calendario. Un enlace con formato válido que ya no exista da error de lectura, conserva el campo y permite reintentar; nunca dice «Airbnb conectado». Escape/X/Cancelar cierran y devuelven foco al disparador. Cerrar durante la petición no garantiza cancelar la operación: al volver, consultar el estado real.
- [ ] **IC03 · Datos reproducibles.** En la casa «Prueba Airbnb» destinada al arnés, ejecute `inicial`. Abra o recargue su Calendario y la gestión → tres noches importadas, fecha real de la lectura y el origen Airbnb; la fecha de salida impresa por el arnés sigue libre. Cada noche importada muestra el icono de enlace bajo el precio y la leyenda «Bloqueado por Airbnb» explica su origen sin tocar el día. Un bloqueo solo manual no lleva icono. Compruebe que número, precio e icono no se solapan en 375×667 y 390×844, y que el lector anuncia Airbnb (o manual y Airbnb). En la ficha pública no aparece el proveedor. No hace falta cuenta ni enlace real de Airbnb para este caso.
- [ ] **IC04 · Repetición/idempotencia.** Ejecute `repetir` y recargue → las mismas tres noches, sin duplicados. La suite de contrato comprueba además reintentar el mismo requestId: no repite la descarga ni cambia la fecha del éxito anterior.
- [ ] **IC05 · Manual coincidente y precio.** Seleccione la fecha `manualOverlapDate` impresa → «Ocupado por Airbnb · sin bloqueo manual». Toque «Ocupado», ponga ₡75 000 y guarde → al seleccionar otra vez debe decir «Bloqueo manual y Airbnb». Compruebe que otra casa no cambia.
- [ ] **IC06 · Modificación.** Ejecute `cambiar` → mismo UID, ahora desde hoy +11 hasta +14, salida excluida; hoy +10 se libera si no tenía manual, hoy +13 queda ocupado y +14 sigue libre. El manual coincidente y sus ₡75 000 se conservan.
- [ ] **IC07 · Fallo de lectura.** Anote la fecha del último éxito y ejecute `fallo` → error visible, las mismas noches y la misma fecha de éxito. No se publica una instantánea parcial ni se exponen detalles del proveedor. El error se recupera en la siguiente lectura válida controlada.
- [ ] **IC08 · Cancelación/vacío válido.** Ejecute `cancelar` → calendario completo sin eventos, cero noches importadas y nueva fecha de éxito. Solo permanece ocupado el manual de hoy +11 y conserva ₡75 000. No confundir este éxito vacío con IC07.
- [ ] **IC09 · Quitar solo manual.** Con ambas capas presentes (puede reconstruirlas con `repetir`), seleccione la noche coincidente, «Quitar bloqueo manual» → Guardar. La noche continúa ocupada por Airbnb; al seleccionarla de nuevo dice «Ocupado por Airbnb · sin bloqueo manual». El precio especial se conserva. La confirmación nunca promete que está libre.
- [ ] **IC10 · Búsqueda y contacto.** Con la casa aprobada y noches importadas, buscar una estancia que las pise excluye la casa. Una estancia que solo salga en la primera noche ocupada sí puede pasar. En ficha/hoja de contacto, un rango con ocupación bloquea el envío; la RPC también lo rechaza si los días cambiaron después de abrir la pantalla. Los componentes públicos no muestran origen, UID ni enlace privado.
- [ ] **IC11 · Pausa y bloqueo administrativo.** Pausar desde Calendario no impide repetir importación con el arnés y no vuelve a publicar la casa. Si 3bstays bloquea/rechaza la casa, no se publica una lectura nueva ni tardía; conserva las noches anteriores. Levantar un bloqueo permite de nuevo reclamar una lectura válida. La automatización de la recuperación se incorpora con el motor programado de #8, no con un cron en #5.
- [ ] **IC12 · Contexto y accesibilidad.** Probar 375×667 y 390×844, URL larga, teclado abierto, foco/Escape y lector. Volver conserva casa/mes y la restauración del scroll del router. Con días seleccionados, el acceso a conexión espera a Guardar/Cancelar para no perder cambios. El panel diferencia visualmente manual, Airbnb o ambos. Sin red conserva estado previo sin confirmar un guardado nuevo.
- [ ] **IC13 · Sesión y privacidad.** Cerrar sesión y entrar en otra cuenta no muestra estado/conexiones de la anterior. El enlace introducido no aparece en URL de navegación, caché persistida, respuestas del endpoint ni telemetría. Las pruebas de base comprueban que ni dueño ni admin aal2 pueden seleccionar las tablas privadas o ejecutar la RPC de servicio.

Comprobación automatizada del flujo visual: `pnpm --filter app exec playwright test tests/e2e/airbnb.spec.ts --workers=1` con el Chromium y servidor local configurados en esta guía. Los casos I–R de `.scratch/calendarios-externos/pruebas-manuales.md` amplían límites y regresión. Marcar estas casillas solo con resultados observados; escribir el código o ejecutar el arnés no acredita por sí solo la revisión visual.

#### 3.14.2 Exportación hacia Airbnb (#6)

Backend comprobado localmente con `.scratch/calendarios-externos/comprobar-backend-06.sh`: 61 unitarias, tipos y 10 DB correctos. La tarjeta aprobada supera los tres E2E de `apps/app/tests/e2e/ical-export.spec.ts`; revisada visualmente en móvil a 375×667 y 390×844. La aceptación en Airbnb real sigue pendiente y estas casillas no se marcan automáticamente por pasar pruebas locales. Revocar/desconectar por interfaz y programación siguen en #7/#8.

**Lo comprobable localmente, sin Airbnb real:** permisos y capacidades por casa; ICS con lector independiente; vacío válido; salida excluida; 366 noches; manual/importado/ambos; retirar el manual conservando importado y precio; consulta WhatsApp sin evento; token desconocido/revocado; pausa/bloqueo/eliminación; repetición y concurrencia. Los contratos usan datos sintéticos y cuentas desechables locales; no deben apuntar a un proyecto alojado.

- [ ] **EX01 · Generar y regresar.** En una casa de prueba con Calendario habilitado, entrar en Calendarios de Airbnb → Exportar hacia Airbnb. Sin enlace: Generar enlace; mientras responde: Generando enlace… sin doble envío. Después aparece la URL real terminada en `.ics`, de solo lectura, y Copiar enlace. Volver y abrir recupera el mismo enlace. No requiere conectar primero la importación; otra casa tiene un enlace distinto. Generar no significa que Airbnb esté conectado.
- [ ] **EX02 · Copia y errores.** Confirmar «Enlace copiado» solo si el portapapeles aceptó la copia. Si se deniega, conservar la URL seleccionable y ofrecer la instrucción de copia manual aprobada. Error de generación no muestra un enlace inventado ni éxito. Probar 375×667/390×844, URL larga, lector, foco y cambio de cuenta durante una petición: no enseñar un enlace de la cuenta anterior. URL/token no aparecen en navegación, Query, IndexedDB o telemetría.
- [ ] **EX03 · Archivo sin sesión.** Copiar el enlace local y abrirlo sin sesión en otra ventana. Se recibe un ICS válido con fechas y UID técnicos, sin nombre de casa, huéspedes, teléfono, mensajes, precios ni el token en el contenido. Con manuales cero, calendario válido vacío y nota «No hay noches bloqueadas manualmente en este período.». GET y HEAD no requieren cookie/JWT; POST/PUT/PATCH/DELETE no conceden escritura. No hay ETag y todas las respuestas del endpoint llevan no-store.
- [ ] **EX04 · Datos y liberación.** En la casa desechable, marcar tres noches consecutivas manualmente; anotar las fechas. El archivo contiene esas tres noches y cada salida es exclusiva. Cambiar solo un precio no crea ni elimina eventos. Liberar la noche intermedia y consultar otra vez sin añadir una cache-buster: desaparece ese evento y los UID de las otras noches se conservan. Una consulta por WhatsApp no añade bloqueos.
- [ ] **EX05 · Sin ciclos.** Usar los fixtures del contrato para importar una noche externa sola y otra coincidente con manual. El archivo solo exporta la coincidente. Quitar ese manual conserva ocupado por Airbnb en 3bstays y retira el evento del archivo. La copia importada de un evento de 3bstays tampoco vuelve a exportarse después de retirar su manual. No importar el enlace secreto de una casa real en una prueba automatizada.

**Lo que requiere Airbnb real y una URL de pruebas pública:** aplicar antes la migración alojada mediante un paso autorizado aparte y comprobar el endpoint desplegado. El workflow no aplica automáticamente las migraciones a Supabase alojado. No usar localhost ni prometer que una sesión de Cloudflare Access del anfitrión servirá para Airbnb: el proveedor necesita consultar el enlace por su cuenta, sin cookies y sin redirección a login. Esta guía no autoriza modificar Access ni desplegar. Mantener la v1 cerrada en producción según las reglas vigentes.

- [ ] **EX06 · Importar en Airbnb.** En una casa/alojamiento controlado para pruebas, seleccionar su calendario en Airbnb, abrir disponibilidad y la sección de conexión de calendarios. Añadir como calendario externo la URL `.ics` de la misma casa de 3bstays y asignarle un nombre reconocible, por ejemplo «3bstays». Comprobar que Airbnb acepta el archivo y muestra exactamente las noches manuales acordadas; anotar la hora y el resultado observado sin capturar el enlace secreto. Las etiquetas de la plataforma pueden variar por dispositivo/idioma: instrucciones contrastadas con la [ayuda oficial de Airbnb](https://es.airbnb.com/help/article/99).
- [ ] **EX07 · Liberación observada en el proveedor.** Liberar en 3bstays una noche manual exportada. Primero comprobar el archivo (retirada inmediata en la próxima consulta a 3bstays); después esperar la siguiente lectura de Airbnb o usar su actualización del calendario conectado. Registrar cuándo cambia realmente: generar/copiar no acredita recepción y no se promete aplicación inmediata. Si la noche tiene además una ocupación propia de Airbnb, no esperar que 3bstays la libere allí.
- [ ] **EX08 · Ausencia de bucle real.** Comprobar que una ocupación exclusiva de Airbnb aparece importada aquí pero no está en nuestro archivo. Con coincidencia, retirar solo el manual y comprobar que el archivo no sostiene esa ocupación por su copia importada. La actualización manual de importación de 3bstays está en #7 y la automática en #8; en #6 las reconciliaciones locales se verifican con el motor/fixtures controlados, sin simular que ya existe ese botón o cron.

Referencias: [contrato técnico de exportación](../.scratch/calendarios-externos/contrato-tecnico-06.md), [diseño móvil aprobado](../.scratch/calendarios-externos/diseno-v0.1.md), [plan #6](../.scratch/calendarios-externos/plan-06.md). Las casillas solo se marcan con resultados observados; los tests locales no acreditan EX06–EX08.

#### 3.14.3 Gestión de conexiones (#7 · comprobada automáticamente en local)

Comprobación final local del 2026-11-09 mediante `comprobar-cierre-reserva-07.sh`: tipos, 2258 unitarias, 8 pruebas DB de reserva/permisos, 16 E2E de integración y 7 de regresión del calendario correctos, junto con todos los presupuestos aprobados. Se revisaron capturas a 375/390 px, incluida la confirmación sin URL privada. Migraciones locales al día hasta `20261109181419`. La validación inicial del backend de gestión pasó además sus 20 DB. Las casillas siguientes corresponden a la revisión manual de Ana; los E2E no sustituyen las comprobaciones de Airbnb real. Los scripts no ejecutan Git ni aplican migraciones alojadas. El arnés limpia solo sus propias casas; las cuentas/casas manuales `8800…` se conservan.

Preparación reproducible: reutilizar la casa desechable **Prueba Airbnb…** y el procedimiento IC01 de 3.14.1, con el propietario local `8777 0001`, código `123456`. No usar una conexión Airbnb real con el arnés. El escenario inicial ocupa hoy+10, +11 y +12; salida excluida hoy+13. Añadir manualmente hoy+11 con precio especial ₡75 000 y generar un enlace de exportación antes de probar desconexión. El arnés imprime fechas sintéticas e identificador público, nunca enlaces privados. Su nombre público `CT-…` sustituye a `CT-xxxx` en estos ejemplos.

```bash
# Ejecute desde la raíz de la copia actualizada. Solo Supabase local.
AIRBNB_MANUAL_HOUSE=CT-xxxx AIRBNB_MANUAL_SCENARIO=fallo pnpm --filter app exec vitest run --project db tests/db/airbnb-manual.test.ts
AIRBNB_MANUAL_HOUSE=CT-xxxx AIRBNB_MANUAL_SCENARIO=sustituir-fallo pnpm --filter app exec vitest run --project db tests/db/airbnb-manual.test.ts
AIRBNB_MANUAL_HOUSE=CT-xxxx AIRBNB_MANUAL_SCENARIO=sustituir-correcto pnpm --filter app exec vitest run --project db tests/db/airbnb-manual.test.ts
```

Estos comandos prueban el mismo motor/SQL con proveedor sintético; no convierten el enlace sintético en un calendario de Airbnb real. Recargar gestión permite consultar el resultado guardado. El éxito de los botones Actualizar/Sustituir con respuesta controlada se verifica en E2E; para probarlos manualmente de punta a punta, usar después una casa/enlace propio de Airbnb preparado para pruebas.

- [ ] **GC01 · Estado y demora.** Al abrir una casa conectada, mostrar último éxito en hora de Costa Rica y cantidad de noches. El aviso común dice «Los calendarios se actualizan periódicamente. Los cambios pueden tardar en aparecer en la otra plataforma. Confirme la disponibilidad antes de acordar una estancia». No mostrar última lectura de la exportación por Airbnb, próxima actualización ni programación automática de #8.
- [ ] **GC02 · Éxito y doble toque.** Con lectura válida, Actualizar ahora muestra Actualizando… y se desactiva. Con Slow 4G, doble toque u otra pestaña no generan dos lecturas simultáneas. Mantener noches/último éxito durante la petición; al terminar, confirmar Calendario actualizado y fecha real nueva. Vacío válido retira únicamente importados. La prueba E2E retiene la lectura para comprobar progreso y número de descargas.
- [ ] **GC03 · Error posterior y recuperación.** Ejecutar escenario `fallo` y recargar: error con fecha propia, último éxito sin cambios, tres noches importadas conservadas y botón Intentar de nuevo. Repetir con una respuesta válida limpia el error y confirma el nuevo éxito. Sin red, explicar que se consulta el estado guardado y desactivar acciones de red; al reconectar recuperar el estado real, sin anunciar un éxito por volver a tener internet.
- [ ] **GC04 · Sustitución fallida/correcta.** Sustituir enlace abre la hoja aprobada e informa que el anterior seguirá conectado hasta leer el nuevo. Una lectura inválida mantiene hoja/campo, conexión, tres noches y último éxito. Con candidata válida, cerrar solo después de confirmar: Enlace de Airbnb sustituido. Los escenarios del arnés permiten reproducir fallo y éxito; el éxito cambia a hoy+15…+16, salida excluida hoy+17. Repetir solicitudes no duplica noches. No mostrar la URL anterior ni registrar ninguna en telemetría.
- [ ] **GC05 · Desconectar y cancelar.** Desconectar Airbnb abre la confirmación con la explicación de retirada de importados y conservación de manual/precios. Cancelar conserva todo. Confirmar muestra Desconectando… sin doble envío; al acabar, Airbnb desconectado, vuelve Conectar Airbnb y desaparecen solo las tres noches importadas. La coincidencia hoy+11 sigue ocupada manualmente con ₡75 000; el feed de exportación sigue funcionando con esa noche. Una lectura vieja no restaura la conexión; su carrera se comprueba en el contrato DB.
- [ ] **GC06 · Revocar y regenerar.** Con exportación, Revocar enlace abre la confirmación y advierte retirar el anterior de Airbnb. Cancelar conserva el feed. Confirmar muestra Revocando…; después, Enlace revocado, URL retirada y Generar enlace disponible. El enlace viejo devuelve 404 sin caché incluso tras generar otro distinto. La importación sigue conectada y sus noches/precios se conservan. No prometer retirada inmediata de bloqueos ya leídos por Airbnb.
- [ ] **GC07 · Red ambigua y generación posterior.** Una respuesta perdida se reconcilia consultando estado antes de anunciar éxito. No repetir ciegamente una desconexión o revocación sobre una conexión/generación nueva. E2E y contratos retienen/pierden la respuesta y generan otro enlace: el reintento anterior lo conserva; se informa que cambió y se pide cancelar/reabrir la confirmación.
- [ ] **GC08 · Foco, identidad y secretos.** Probar 375×667 y 390×844, URL larga, teclado abierto, Escape/Cancelar y foco al cerrar confirmaciones. Una confirmación pendiente mantiene sus botones desactivados; el foco queda contenido. Cambiar de cuenta/casa durante la lectura no aplica respuestas a la otra. El token de exportación solo está en memoria de la tarjeta; el resumen persistido no lo incluye. No tocar los datos reservados para pruebas manuales.

- [ ] **GC09 · Acceso directo.** Con importación conectada, «Sincronización con Airbnb» aparece sobre el fondo crema. Tocar el botón verde claro de actualizar no navega ni cambia de casa/mes/scroll. Durante la lectura queda desactivado; dos pulsaciones no descargan dos veces. Sin internet pasa a gris. El título/chevrón abre la gestión vigente. Al desconectar la importación, «Conectar con Airbnb» vuelve a la tarjeta blanca incluso si el enlace de exportación sigue disponible. Con selección manual pendiente ambos accesos quedan desactivados.
- [ ] **GC10 · Reserva y actualización previa.** Con los datos sintéticos de GC01, abrir Marcar una reserva: comprobar carga y que las noches importadas hoy+10…+12 y el bloqueo manual coincidente no valen como llegada. Salir en hoy+10 desde hoy+9 sí vale. Con el escenario válido vacío, la comprobación previa retira únicamente importados; hoy+11 manual con ₡75 000 sigue ocupado. Reabrir en menos de un minuto no vuelve a descargar. Con escenario `fallo`, confirmar el uso del último calendario antes de seleccionar. La suite `reservation-availability.spec.ts` controla la descarga sin contactar Airbnb y reproduce esos estados; el contrato fake/PostgREST prueba el rechazo atómico de conflictos y dos reservas simultáneas. Las pruebas locales no garantizan que Airbnb haya publicado ya todas sus reservas.

#### Importación automática (#8)

- [ ] **AC01 · Simular dos ciclos.** Ejecutar la [simulación local](operacion-airbnb.md#simulación-local) con las respuestas sintéticas. Comprobar que el fallo conserva las dos noches y la última fecha válida, que repetir la misma hora no importa y que el siguiente ciclo válido vacío libera las noches importadas.
- [ ] **AC02 · Programador real.** En un entorno de pruebas autorizado y con una casa desechable, modificar un bloqueo en Airbnb y cerrar la app. Consultar el evento `airbnb_cycle` después de la hora prevista y abrir la casa para confirmar los bloqueos y la fecha de última importación. Observar un segundo ciclo sin tocar Actualizar. [Evidencias y reversión](operacion-airbnb.md#evidencia-del-programador-real).

Referencias: `.scratch/calendarios-externos/contrato-tecnico-07.md`, `plan-07.md`, `reservas-07.md` y diseño móvil v0.2 en `diseno-v0.2-propuesta.md`. La aceptación de un enlace exportado por Airbnb, confirmada por Ana tras la excepción específica de Access, no acredita cuándo aplicó cambios ni cuánto tarda en retirar noches. #8 permanece fuera de esta entrega.

### 3.15 Consultas

- [ ] **A108** (con un cliente que ya contactó, ver parte de Cliente) Fíjese en la barra → un contador terracota (p. ej. «1») sobre la pestaña «Consultas».
- [ ] **A109** Abra «Consultas» → arriba «1 consulta nueva» (o «N consultas nuevas»), en texto normal; cada tarjeta lleva avatar «AP», «Ana Prueba», la insignia «Nueva» en dorado suave, «ahora», «9–13 dic · 2 personas» y «Abrir WhatsApp» con símbolo oficial y texto verde, sin banda de fondo y al menos 44 px de alto. Compruebe que la tarjeta omite el borrador de WhatsApp tanto en consultas antiguas como nuevas. Solo al mezclar varias casas aparece su nombre como texto secundario, sin foto ni pastilla; con una sola o al filtrar una casa se oculta. Al pie «La conversación está en su WhatsApp.».
- [ ] **A109a** Abra Consultas con varias tarjetas nuevas. Deje visible el nombre del cliente de una tarjeta un momento → solo las que se ven pierden «Nueva» y baja el contador; la lista conserva su orden. Desplácese a una que estaba abajo y compruebe que se marca al verla. Si entra desde «Mis casas» con un filtro, las consultas de las otras casas siguen nuevas.
- [ ] En móvil, Consultas tiene 12 px de margen a cada lado, igual que Calendario. Revise a 320 px que las tarjetas y sus acciones queden dentro de la pantalla.
- [ ] **A110** Toque «Abrir WhatsApp» → abre WhatsApp con el chat del cliente (`wa.me/<número del cliente>`) sin texto escrito. Si toca el botón antes de que la tarjeta se marque como vista, la consulta se marca al abrir el chat.
- [ ] **A111** Con dos o más casas publicadas alguna vez → selector «Todas las casas», también sin consultas. Abra la hoja «Filtrar por casa» → nombres completos, opción elegida dorada con check, filas de al menos 52 px y lista desplazable. Elija una casa sin consultas → «Todavía no hay consultas de esta casa.»; elija «Todas las casas» → vuelven todas. Recargue con una casa elegida → conserva el filtro y la selección; el recuento superior sigue siendo global. Con una sola casa no sale selector.
- [ ] **A111a** En Consultas y Calendario, compruebe la hoja en 375 × 667 y 390 × 844 con una lista larga: X visible, nombres largos completos sin solapamientos ni desbordamiento horizontal. Con teclado, Tab permanece dentro; flechas e Inicio/Fin recorren opciones y Enter elige. Escape, X y tocar fuera cierran y devuelven el foco al selector. Sin red, una casa de la URL que falte en la caché conserva su filtro y muestra sus consultas disponibles.
- [ ] **A112** Cuenta sin ninguna consulta → «Cuando alguien le escriba por WhatsApp desde la ficha de su casa, aparecerá aquí.».

### 3.16 Promoción y suscripción

- [ ] **A113** En Cuenta del propietario revise «Suscripciones» → «Ver suscripciones» con cantidades reales; las casas al día quedan resumidas, los pagos/avisos y las bloqueadas sin cobro permanecen visibles. «Próximo cobro» y la tarifa vigente se conservan; la fila de método aparece solo cuando corresponde.
- [ ] **A114** Toque «Ver suscripciones» → «Promoción y suscripción» con la oferta de lanzamiento dorada suave, sus plazas reales y los plazos/precios vigentes. Se ven todas las casas, también con más de tres. Inactivas activables primero; una bloqueada nunca ofrece Activar.
- [ ] **A115** En «Sus casas», cada casa tiene su propia tarjeta y la tarifa real por mes, además del estado, fechas, cifras y avisos existentes. En oferta, ₡0 y la tarifa posterior; en una inactiva, «al activarla», «Ahora no se cobra» y fondo dorado claro. Activar sigue dorado; Parar es secundario y conserva la confirmación.
- [ ] **A116** Revise «Método de pago» → «Ninguno todavía» y «Puede añadirlo cuando le avisemos.»; no hay botón «Añadir método de pago» (aún no toca), y debajo «Se guarda en la página segura de la pasarela de pago; en 3bstays nunca se escribe el número de la tarjeta. Ahora no se cobra nada.».
- [ ] **A117** Desde el detalle de la casa toque la fila «Suscripción» («Oferta de lanzamiento», «Al día») → abre «Suscripción» solo de esa casa (con su nombre debajo del título) y, con dos o más casas, «Ver todas sus casas».
- [ ] **A118** Toque «Parar suscripción» → hoja «Parar suscripción» con «¿Parar la suscripción de <casa>? La casa deja de verse y no se cobra. Puede reactivarla cuando quiera.»; toque «Cancelar» → no cambia nada.
- [ ] **A119** Toque «Parar suscripción» y confirme → al instante «Inactiva», «Parada el <hoy> · no se cobra», botón «Activar suscripción» y «Mantiene su plaza de la oferta: gratis hasta el …».
- [ ] **A120** Sin sesión, abra la ficha de esa casa → «Este enlace ya no está activo» y «El anfitrión paró la suscripción de este anuncio, así que el enlace ya no muestra la ficha ni permite contactarlo desde 3bstays.»; la casa no sale en Explorar.
- [ ] **A121** Abra la casa parada desde Mis casas → arriba un bloque ocre «Suscripción parada» («… no aparece en Explorar y el enlace de su ficha no funciona. Actívela para que vuelvan a escribirle.») con «Activar suscripción» y «₡2 900 al mes, sin permanencia»; sin «Compartir».
- [ ] **A122** Toque «Activar suscripción» → vuelve a «Activa» con «Gratis hasta el …» y la ficha pública vuelve con «Contactar por WhatsApp».
- [ ] **A123** Abra `/propietario/suscripcion?casa=CT-#####pago=CT-####` con sesión → la casa queda resaltada y a la vista; sin sesión, pide ingresar y, tras el código, vuelve a esa misma casa.

### 3.17 Fin de la oferta, avisos y método de pago (reloj de pruebas)

Use una casa activa con oferta que sea solo para pruebas: cada casa recorre el plan una sola vez. Prepare en la terminal `BASE`, `SECRETO` (el `TEST_CLOCK_SECRET`) y `CASA` (su `CT-####`). Antes, mande «hola» al sandbox de WhatsApp desde el teléfono del propietario.

- [ ] **A124** (terminal) `curl -X POST $BASE/_pruebas/oferta/$CASA -H "authorization: Bearer $SECRETO" -H "content-type: application/json" -d '{"diasRestantes":90}'` → JSON con `"queued":1` y `"sent":1` (con otro secreto, 401; sin el secreto del worker, 404).
- [ ] **A125** Revise el WhatsApp del propietario → «Hola, <nombre>. Somos 3bstays. La oferta gratuita de «<casa>» termina el <fecha>: hasta entonces no se le cobra nada. Para que su casa siga saliendo en 3bstays después, añada un método de pago aquí: <enlace con #pago=CT-####> Desde esa fecha, ₡2 900 al mes por casa, sin permanencia; puede pararla cuando quiera.».
- [ ] **A126** (terminal) Repita el mismo `curl` de 90 días → `"queued":0` y no llega ningún WhatsApp más.
- [ ] **A127** Abra Mis casas → aviso ocre con el nombre de la casa, «Su oferta gratuita termina en 90 días», «No se le cobrará nada hasta entonces. Añada un método de pago antes de esa fecha para que su casa siga saliendo en 3bstays; después, ₡2 900 al mes por casa, sin permanencia. También se lo recordamos por WhatsApp.» y el botón ocre «Añadir método de pago».
- [ ] **A128** Abra Cuenta → aparece la fila ocre «Añadir método de pago» («Falta · añádalo antes de que termine su oferta»); abra «Promoción y suscripción» → bajo la casa «Aviso de los 90 días enviado el <fecha>.».
- [ ] **A129** Toque el enlace del WhatsApp → abre «Suscripción» con esa casa resaltada y a la vista; el texto del WhatsApp («Hola, …») no se muestra en la app.
- [ ] **A130** (terminal) Mande `diasRestantes` 30 y luego 7 → cada uno con `"sent":1`, un WhatsApp nuevo con la fecha, y en la app «Su oferta gratuita termina en 30 días» y «…en 7 días».
- [ ] **A131** (terminal) Mande `diasRestantes` 0 → llega «Hola, <nombre>. Somos 3bstays. La oferta gratuita de «<casa>» termina hoy. Si no añade un método de pago, desde mañana su casa deja de mostrarse en 3bstays: <enlace> Hoy todavía no se le cobra nada; después, ₡2 900 al mes por casa, sin permanencia; puede pararla cuando quiera.»; en la app «Su oferta gratuita termina hoy» y la ficha sigue activa.
- [ ] **A132** (terminal) Mande `diasRestantes` -1 → `"paymentDue":1` y ningún WhatsApp; a los pocos segundos la ficha sin sesión dice «Este enlace ya no está activo» y «Este anuncio está fuera del catálogo hasta que el anfitrión regularice su suscripción.», sin botón de contacto, y la casa ya no sale en Explorar.
- [ ] **A133** Abra Mis casas → casilla «1 por pagar», aviso ocre «Su oferta gratuita terminó el <ayer>» con «La ficha está oculta y el enlace no funciona hasta que añada un método de pago. ₡2 900 al mes, sin permanencia; puede parar cuando quiera.», y la tarjeta con «Pendiente de pago» y «Añadir método de pago».
- [ ] **A134** Toque «Añadir método de pago» → abre la página de Stripe en modo de prueba (`checkout.stripe.com`); escriba `4242 4242 4242 4242`, `12/30`, CVC `123` y guarde.
- [ ] **A135** De vuelta en la app → «Guardando su método de pago…» y en pocos segundos «Método de pago guardado. No se cobra nada hasta que termine la oferta.»; «Método de pago» dice «Visa ···· 4242 · vence 12/30» con «Cambiar»; la casa «Activa» con «Suscripción activa desde el <hoy> · ₡2 900 al mes» y sin botón ocre.
- [ ] **A136** Sin sesión, abra la ficha de esa casa → vuelve con «Contactar por WhatsApp» y la casa sale de nuevo en Explorar.
- [ ] **A137** Abra Cuenta → «Próximo cobro» con «₡2 900 · <fecha>» y ya no sale la fila ocre «Añadir método de pago».
- [ ] **A138** Toque «Cambiar» y en Stripe cierre o retroceda sin guardar → vuelve a «Suscripción» sin cambios y sin mensaje de guardado.
- [ ] **A139** (escritorio) En Supabase → SQL Editor: `select l.public_id, r.days_before, r.status, r.sent_at from subscription_reminders r join listings l on l.id = r.listing_id order by r.queued_at;` → una fila por umbral (90, 30, 7, 0), todas `sent` y sin repetidas.

### 3.18 Cuenta del propietario

- [ ] En escritorio, abra «Ayuda por WhatsApp» desde la barra superior con una sesión de anfitrión y después sin sesión. Compruebe que la barra sigue visible en Ayuda y que aparece el canal correspondiente. A 1024 px, el icono conserva el nombre accesible «Ayuda por WhatsApp».

- [ ] Con suficientes suscripciones para desplazar la página, baje por la columna derecha y compruebe que el perfil y las acciones de cuenta permanecen debajo de la barra superior. En una ventana baja, compruebe que puede recorrer la columna izquierda para llegar a «Cerrar sesión».

- [ ] En escritorio (1280 × 800), abra Cuenta con una sesión de propietario. Compruebe que las columnas tienen el mismo ancho. A la izquierda aparecen el perfil y las acciones de cuenta. A la derecha se ven directamente las suscripciones de cada casa con su estado, precio mensual, acciones disponibles y método de pago. Abra «¿Cómo funciona el cobro?» desde la misma pantalla. En móvil, compruebe que se conserva el acceso desde la tarjeta de suscripción.

- [ ] **A140** Abra la pestaña «Cuenta» → avatar con iniciales, nombre, número en su línea (`+506 8777 0001`), «WhatsApp verificado» debajo y «Pronto podrá verificar también su identidad (opcional).». En móvil, el enlace «Editar» abre «Mi perfil».
- [ ] **A141** En escritorio, «Mi perfil» muestra el nombre, la descripción y el correo de recuperación como texto en la columna izquierda. Active «Editar» con el teclado y compruebe que aparecen los campos en la misma tarjeta. Cambie un dato, guárdelo, pulse «Listo» y recargue para comprobar que se conserva. La columna de suscripciones sigue visible. En móvil, haga la misma edición desde «Editar» y toque «Listo» para salir.
- [ ] **A142** En móvil, revise las filas → «Favoritos» («Ninguna casa guardada» o «N casas guardadas») y «Ayuda por WhatsApp» («Línea de 3bstays para anfitriones»); con casas no sale «¿Quiere publicar su casa gratis?» y no hay verificación de identidad.
- [ ] En escritorio, a 1024 y 1280 px, abra «Favoritos» desde la barra superior de anfitrión, justo después de «Explorar». Compruebe que se marca como página actual, que siguen visibles las demás opciones y el selector de moneda, y que no hay una fila duplicada en Cuenta.
- [ ] En escritorio, como anfitrión, abra «Consultas» desde el icono situado antes de «Ayuda por WhatsApp», que queda al extremo derecho. Compruebe que se abre un cuadro sobre la pantalla actual, que puede elegir una casa y abrir WhatsApp y que Escape o la X cierran el cuadro y devuelven el foco al icono. En móvil, abra Consultas desde su pestaña inferior.
- [ ] **A143** Toque «Ayuda por WhatsApp» → «3bstays · atención a anfitriones», «Para cualquier duda o problema con su cuenta, sus casas o una consulta recibida, escríbanos por WhatsApp. Es el único canal de atención de 3bstays.», el número de anfitriones «· canal separado del de clientes.» y «Abrir WhatsApp» abre `wa.me` con «Hola, soy anfitrión en 3bstays y necesito ayuda con: ».
- [ ] **A144** Toque «Cerrar sesión» → hoja «¿Cerrar sesión?» con «Tendrá que recibir un código nuevo para volver a entrar.»; confirme → la barra queda en «Explorar», «Favoritos» e «Ingresar».

### 3.19 Barra de abajo del propietario

- [ ] **A145** Con sesión de propietario la barra tiene cinco pestañas → «Explorar», «Mi casa» (o «Mis casas»), «Calendario», «Consultas» y «Cuenta»; con una cuenta sin casas son tres (cliente).
- [ ] **A146** Mire la barra de abajo → barra plana pegada al borde y a todo el ancho, con la línea fina arriba, las cinco etiquetas enteras (también «Calendario» y «Consultas» en un iPhone SE) y la pestaña elegida en terracota (icono y etiqueta); el contador de consultas nuevas, en el icono de «Consultas». Baje la lista en Mis casas (y luego en Consultas, Cuenta y Explorar) → la barra sale por abajo al desplazarse hacia delante; suba un poco o vuelva al principio y regresa; los títulos de arriba (cabeceras «‹ Título») se quedan.
- [ ] **A146a** «Atrás» no vuelve a la pestaña anterior (2026-11-03): en Calendario toque «Explorar» en la barra y deslice desde el borde izquierdo (iPhone) o use «Atrás» (Android) → no vuelve a Calendario: sale de la app (o a la página de antes de entrar). Lo mismo con «Calendario» de una tarjeta de Mis casas. Dentro de una pestaña «Atrás» sigue igual: Explorar → ficha → «Atrás» vuelve a Explorar en el mismo punto de la lista; Mis casas → detalle de una casa → «Atrás» vuelve a Mis casas; en Publicar, del paso siguiente al anterior; desde Cuenta, «Ayuda» o «Suscripción» vuelven a Cuenta.
- [ ] **A146b** Provoque un aviso (p. ej. guarde un dato de su casa y vuelva) → el aviso oscuro aparece a 12 px encima de la barra de abajo; si la barra está escondida, a 12 px del borde; la franja «Hay una versión nueva» se coloca igual.
- [ ] **A147** En Calendario seleccione un día → la barra se va mientras haya días elegidos y vuelve al guardar o cancelar.

## 4. Admin

Para esta parte hace falta una cuenta admin (Daniel `+1 778 347 9837` o Ana `+1 778 347 8492`, país «Estados Unidos/Canadá (+1)», código 123456), una app de autenticación en el teléfono y las casas de prueba de 1.5: **CT-1058** («la casa nueva», en revisión con 5 fotos), **CT-1059** (en revisión, para pedir cambios y rechazar) y **CT-1066** («la casa editada», con nombre, descripción y una foto nueva sin decidir); para 4.7, **CT-1064** y **CT-1065** ya están pausada y bloqueada, y para pausar, bloquear y eliminar desde cero use casas que pueda perder (p. ej. las que publique en la parte 3). Todo desde `https://pruebas.3bstays.com`, vista de teléfono, salvo lo marcado `(escritorio)` o `(terminal)`.

### 4.1 Entrar a la zona del admin y segundo factor

- [ ] **D1** Ingrese como admin (WhatsApp y código 123456) y abra la pestaña **Cuenta** → la pantalla muestra su nombre, «WhatsApp verificado» y, entre las filas, «Revisión de anuncios · admin» con el texto pequeño «Cola de casas por revisar (pide un segundo código)».
- [ ] **D2** Toque «Revisión de anuncios · admin» (primera vez, sin factor vinculado) → abre «Segundo código» con el título «Vincule su app de autenticación» y el texto «Para revisar anuncios le pedimos un segundo código. Escanee este código QR con su app de autenticación (Google Authenticator, 1Password u otra) y escriba abajo el código de 6 dígitos que le muestre.».
- [ ] **D3** Mire el bloque del QR → se ve una imagen cuadrada de QR nítida (alt «Código QR para su app de autenticación»), debajo «¿No puede escanearlo? Escriba esta clave en la app:» y la clave en grupos de 4 letras/números (por ejemplo `UXP7 WBFD YN4Q …`, 32 caracteres).
- [ ] **D4** Mientras la pantalla carga el factor → el botón dice «Preparando…» y, al estar listo, «Verificar y entrar».
- [ ] **D5** Escriba `000000` (o cualquier código equivocado) y toque «Verificar y entrar» → aviso rojo «Ese código no es correcto o caducó.» y se queda en la misma pantalla con el mismo QR (no cambia de QR).
- [ ] **D6** Añada la cuenta a la app (escaneando el QR, o a mano con «clave en texto» tipo «basada en tiempo»), escriba el código de 6 dígitos que muestra y toque «Verificar y entrar» → entra a «Anuncios» (insignia «Admin» arriba a la derecha). Quien escanee primero se queda con el factor: no comparta la pantalla del QR.
- [ ] **D7** Toque la pestaña **Cuenta** y vuelva a «Revisión de anuncios · admin» sin cerrar sesión → entra directo a «Anuncios», sin pedir código otra vez.
- [ ] **D8** En Cuenta, «Cerrar sesión» → confirme y vuelva a ingresar como admin; toque «Revisión de anuncios · admin» → ahora el título es «Confirme que es usted», el texto «Abra su app de autenticación y escriba el código de 6 dígitos de 3bstays.» y **no** hay QR ni clave.
- [ ] **D9** Escriba el código vigente de la app y toque «Verificar y entrar» → entra a «Anuncios».

### 4.2 Quien no entra (sin permiso o sin segundo código)

- [ ] **D10** Ingrese con la cuenta de cliente `8888 1234` (código 123456) y abra a mano `https://pruebas.3bstays.com/admin` → pantalla «Segundo código» con «Esta sección es solo para el equipo de 3bstays», «Si busca una casa, vuelva a Explorar.» y el botón «Ir a Explorar»; no hay campo de código ni QR.
- [ ] **D11** Con esa cuenta, abra Cuenta → no existe la fila «Revisión de anuncios · admin». Repita con la propietaria `8777 0001`: tampoco existe, y abrir `/admin/casas` muestra «Esta sección es solo para el equipo de 3bstays» (puede verse bajo el título «Segundo código»).
- [ ] **D12** (escritorio) Como admin recién ingresado (sin confirmar el segundo código), pegue la dirección de una casa en revisión `https://pruebas.3bstays.com/admin/anuncios/<id>` (el `<id>` es el que aparece en la dirección al abrirla en D20) → lo redirige a «Confirme que es usted» y, tras el código, vuelve a esa casa; sin el código no se ve nada de la casa.
- [ ] **D13** Admin sin segundo código: abra `/admin/casas` a mano → lo manda a «Confirme que es usted» y, tras el código, a «Casas».

### 4.3 Barra del admin y cola de anuncios

- [ ] **D14** Con la sesión admin en `/admin` mire la barra de abajo → cuatro pestañas: «Anuncios» (con un número = casas por revisar), «Casas», «Usuarios», «Cuenta».
- [ ] **D15** Toque «Usuarios» → pantalla «Usuarios» con «Muy pronto: esta sección de la zona del admin llega en otra entrega.»; no es un error.
- [ ] **D16** Vuelva a «Anuncios» → tres cifras arriba: «por revisar», «con cambios», «activas»; debajo tres chips: «Por revisar · N» (marcado), «Cambios pedidos», «Rechazados»; el número del chip y el de la barra coinciden con el de «por revisar».
- [ ] **D17** Mire la lista de «Por revisar» → cada tarjeta lleva miniatura, `CT-#### · hoy`, la insignia «Nueva», el nombre de la casa, `<propietario> · WhatsApp verificado` y `<zona> · N personas · N fotos · ₡precio`; las más antiguas primero; al final «Las más antiguas primero. El anfitrión recibe la decisión por WhatsApp y la ve en Mis casas.».
- [ ] **D18** Si hay una edición pendiente → encima de la lista aparece «Ediciones por revisar» con una tarjeta que dice `Edición: nombre, ubicación, descripción, 1 foto nueva` (según lo que se envió); no aparece en «Por revisar».
- [ ] **D19** Toque «Cambios pedidos» y luego «Rechazados» → muestran sus casas o «Nada por aquí.»; con «Por revisar» vacío el texto es «No hay anuncios pendientes.».

### 4.4 Revisar una casa nueva: lo que se ve

- [ ] **D20** En «Por revisar» toque la tarjeta de la casa nueva → «Revisar anuncio» con flecha de volver; arriba una tira de fotos deslizable, la primera grande con «N fotos» en la esquina.
- [ ] **D21** Deslice la tira de fotos → todas las fotos subidas se ven en orden, con alt «Foto 1», «Foto 2»…; ninguna sale rota.
- [ ] **D22** Debajo de las fotos → el nombre de la casa con su `CT-####`, una línea con tipo, zona, personas, dormitorios y baños, y el precio `₡xx xxx / noche` (con `· mensual ₡…` o `· mensual a negociar` si acepta alquiler mensual).
- [ ] **D23** Revise la tarjeta del propietario → iniciales, nombre y «WhatsApp verificado · +506 8777 0001». No aparece nada de identidad.
- [ ] **D24** Revise la tarjeta «Descripción» → el texto completo de la casa y, debajo, insignias con las características marcadas (Wifi, Piscina…; «Parqueo de pago» o «Parqueo gratuito» si aplica) o «Sin características marcadas».
- [ ] **D25** Si la zona la escribió el propietario en vez de elegirla de la lista → junto al nombre sale la insignia «Zona propuesta por el anfitrión».
- [ ] **D26** Mire el bloque «Antes de decidir» → tres casillas: «Las fotos son de la casa y sin teléfonos ni logos», «La descripción no tiene enlaces ni publicidad», «Zona y precio coherentes»; marcarlas o no **no** bloquea ningún botón.
- [ ] **D27** Mire abajo → el campo «Mensaje para el anfitrión (obligatorio si pide cambios o rechaza)» y la barra fija con «Aprobar y publicar», «Pedir cambios» y «Rechazar».

### 4.5 Decidir una casa nueva

- [ ] **D28** Sin escribir nada, toque «Pedir cambios» → aviso rojo «Escriba un motivo de hasta 2000 caracteres para pedir cambios o rechazar.» y se queda en la misma casa.
- [ ] **D29** Con el campo vacío, toque «Rechazar» → el mismo aviso; no se rechaza nada.
- [ ] **D30** (no aplica desde el 2026-10-30: ya no se puede enviar una casa sin fotos; sáltela salvo que quede una de antes) (casa sin fotos) Abra la tarjeta de «Casa sin fotos» → «Aprobar y publicar» está desactivado, el mensaje viene escrito con «Para publicarla necesitamos al menos una foto de la casa.» y sale el aviso «Sin fotos: solo puede pedir cambios.».
- [ ] **D31** (no aplica, como D30) (casa sin fotos) Toque «Rechazar» sin cambiar el mensaje → «Escriba un motivo de hasta 2000 caracteres para pedir cambios o rechazar.» (el texto de las fotos no sirve de motivo para rechazar).
- [ ] **D32** (casa nueva) Escriba «Necesitamos una foto de la cocina.» y toque «Pedir cambios» → vuelve a «Anuncios» con la nota ««<nombre>»: Cambios pedidos. El anfitrión verá su mensaje.»; la casa sale de «Por revisar» y las cifras bajan una y suben «con cambios».
- [ ] **D33** En ese aviso toque «Avisar a Yorleny por WhatsApp» → abre WhatsApp con el número de la propietaria y el texto «Hola, Yorleny. Le escribimos de 3bstays: revisamos su casa «<nombre>» y necesitamos un cambio antes de publicarla: Necesitamos una foto de la cocina. Puede corregirla desde Mis casas → «Corregir y reenviar».»; vuelva a la app sin enviarlo.
- [ ] **D34** Toque el chip «Cambios pedidos» → la casa está con la insignia «Cambios pedidos»; al abrirla se ve el recuadro «Cambios pedidos» con el texto «Necesitamos una foto de la cocina.» y ya no hay «Aprobar y publicar».
- [ ] **D35** Cambie a la cuenta de la propietaria y abra **Mis casas** → la casa dice «Cambios pedidos», con «Nota de 3bstays: Necesitamos una foto de la cocina.» y el botón «Corregir y reenviar». (No llega ningún WhatsApp automático con la decisión: en v1 el admin avisa a mano si hace falta.)
- [ ] **D36** (CT-1059 «Casa Playa Bite con hamaca») Con la cuenta admin, escriba «Las fotos no son de esta casa.» y toque «Rechazar» → ««Casa Playa Bite con hamaca»: Rechazada. El anfitrión verá el motivo.»; en el chip «Rechazados» aparece con «Rechazada».
- [ ] **D37** Toque «Avisar a <nombre> por WhatsApp» en ese aviso → el texto es «Hola, <nombre>. Le escribimos de 3bstays: revisamos su casa «Casa Playa Bite con hamaca» y no podemos publicarla: Las fotos no son de esta casa. Si tiene dudas, respóndanos a este mensaje.».
- [ ] **D38** (casa rechazada) Con la propietaria, abra Mis casas → «Rechazada» y «Nota de 3bstays: Las fotos no son de esta casa.»; al abrir el detalle: «Anuncio rechazado» con el motivo y sin botón de corregir.
- [ ] **D39** (casa nueva, tras corregirla en 5.2) Con el admin, toque «Por revisar» → la tarjeta vuelve con la insignia «Corregida» (no «Nueva»).
- [ ] **D40** Abra la casa corregida, deje el campo vacío y toque «Aprobar y publicar» (con la propietaria aún sin método de pago y en oferta de lanzamiento) → vuelve a «Anuncios» con ««<nombre>»: Aprobada y publicada. El enlace ya funciona.»; la cifra «activas» sube una y la casa sale de la lista al instante.
- [ ] **D41** Toque «Avisar a Yorleny por WhatsApp» → el texto es «Hola, Yorleny. Le escribimos de 3bstays: su casa «<nombre>» ya está aprobada y publicada. Este es su enlace para compartir con sus clientes: https://pruebas.3bstays.com/casa/CT-####. Gracias por publicar con nosotros.»; envíelo y compruebe en el teléfono de la propietaria que el enlace abre la ficha.
- [ ] **D42** Al pie de la cola → «El anfitrión ve la decisión en Mis casas; avísele por WhatsApp con el botón.» (ya no promete un aviso automático).
- [ ] **D43** Abra la ficha pública `https://pruebas.3bstays.com/casa/CT-####` de esa casa (cliente o ventana sin sesión) → se ve la ficha con el nombre, las fotos y el precio; «Contactar por WhatsApp» está disponible.
- [ ] **D44** Con la propietaria, abra Mis casas → la casa dice «Activa»; en su detalle, «Suscripción» con «Gratis hasta …» (oferta de lanzamiento; no «Pendiente de pago»).

### 4.6 Revisar los cambios de una casa publicada, dato a dato

- [ ] **D45** (casa editada) Con el admin, en «Anuncios» → «Ediciones por revisar» toque la tarjeta de la casa editada → «Revisar edición» con el nombre, `CT-####` y «Edición: nombre, ubicación, descripción, 1 foto nueva» (lo que se envió) y el bloque «Antes de decidir».
- [ ] **D46** Mire el bloque «Nombre» → dos columnas, «Antes <nombre aprobado>» y «Ahora <nombre nuevo>», con el recuadro de mensaje y los botones «Aprobar» y «Pedir cambios». No hay botón «Rechazar» en ninguna parte.
- [ ] **D47** Mire el bloque «Descripción» → muestra el texto nuevo y debajo un desplegable «Antes» cerrado; tóquelo → aparece la descripción aprobada.
- [ ] **D48** Mire el bloque «Ubicación» → un mapa con dos puntos y las etiquetas «Antes: <zona vieja>» y «Ahora: <zona nueva>»; el mapa mantiene su tamaño al cargar (no salta la pantalla); sin red, una caja arena con «Antes: … · Ahora: …».
- [ ] **D49** Mire «Fotos nuevas» → una sección «Foto nueva 1» por cada foto enviada, con la miniatura y sus propios «Aprobar» y «Pedir cambios».
- [ ] **D50** En «Nombre» toque «Pedir cambios» sin nota → «Escriba una nota para pedir cambios.» (en ese bloque, no arriba).
- [ ] **D51** En «Descripción» toque «Aprobar» → el bloque «Descripción» desaparece, la pantalla sigue en la misma edición y lo demás sigue pendiente (no vuelve a la cola todavía).
- [ ] **D52** En «Foto nueva 1» escriba «Se ve un teléfono.» y toque «Pedir cambios» → el bloque queda con «Cambios pedidos: Se ve un teléfono.» y sin botones.
- [ ] **D53** En «Nombre» escriba «Use un nombre sin mayúsculas sostenidas.» y toque «Pedir cambios» → el bloque queda con «Cambios pedidos: Use un nombre sin mayúsculas sostenidas.».
- [ ] **D54** En «Ubicación» toque «Aprobar» (lo último que queda en revisión) → vuelve solo a «Anuncios» con ««<casa>»: Cambios aprobados. La ficha ya los muestra.» (el aviso sigue lo último que se decidió) y la casa sale de «Ediciones por revisar», aunque queden datos con cambios pedidos esperando al propietario.
- [ ] **D55** Con la propietaria, abra el detalle de la casa → «Descripción» y «Ubicación» ya muestran lo nuevo sin etiqueta; «Nombre» dice «Cambios pedidos» con «Le pedimos cambios: Use un nombre sin mayúsculas sostenidas.»; la tarjeta de Mis casas dice «Cambios pedidos».
- [ ] **D56** La propietaria corrige el nombre (Nombre → «Enviar a revisión») → «Enviado a revisión. Su ficha sigue como está hasta que lo aprobemos.» y la fila vuelve a «En revisión».
- [ ] **D57** Con el admin, la casa vuelve a «Ediciones por revisar» solo con `Edición: nombre`; abra y toque «Aprobar» → vuelve a «Anuncios» con ««<casa>»: Cambios aprobados. La ficha ya los muestra.» y la casa sale de la lista.

### 4.7 Casas: lista, pausar, bloquear y eliminar

Use dos casas activas de prueba que pueda perder: «la casa a pausar» y «la casa a bloquear», y una tercera para eliminar (puede ser un borrador o una casa rechazada).

- [ ] **D58** Toque «Casas» en la barra → título «Casas» con «Admin», el buscador «Nombre, CT-#### o anfitrión», los chips «Todas · N», «Activas · N», «Por pagar · N», «Inactivas · N», «Pausadas · N» y «Bloqueadas · N» (Todas marcado) y al pie «Toque una casa para ver sus datos, editarla, pausarla, bloquearla o eliminarla.» con el botón «Borradores sin enviar».
- [ ] **D59** Mire una fila → miniatura, nombre, `CT-#### · <propietario> · <zona>`, la línea de suscripción («Gratis hasta 30 oct 2027», «Oferta vencida el 29 oct · sin método de pago», «Parada por el anfitrión el 30 oct» o «Pagando desde el … · ₡2 900 al mes») y la insignia («Activa», «Por pagar», «Inactiva», «En revisión»…).
- [ ] **D60** Escriba en el buscador parte del nombre de una casa, sin tildes y en minúsculas → quedan solo las que coinciden y los números de los chips **no** cambian; borre y escriba su `CT-####` → queda esa casa.
- [ ] **D61** Escriba el nombre de la propietaria (por ejemplo «yorleny») → salen sus casas; escriba «zzz-ninguna» → «Ninguna casa coincide con la búsqueda.».
- [ ] **D62** Toque cada chip → la lista se filtra, la dirección cambia (`?ver=activas`, `?ver=por-pagar`, `?ver=inactivas`…) y cada chip muestra tantas filas como su número; un chip vacío dice «Nada por aquí.».
- [ ] **D63** Toque una casa activa → sube una hoja con el nombre, `CT-#### · <propietario> · <zona>`, «Ver ficha pública», «Ver datos del anuncio», «Editar casa», «Editar calendario», los botones «Pausar» y «Bloquear» y, al final, «Eliminar casa» en contorno rojo; la ✕ («Cerrar») la cierra.
- [ ] **D64** En la hoja toque «Ver ficha pública» → abre `/casa/CT-####` como la ve un cliente; vuelva y toque «Ver datos del anuncio» → «Revisar anuncio» en solo lectura, con el estado y el botón «Avisar a <nombre> por WhatsApp».
- [ ] **D65** Toque una casa que no está publicada (en revisión o rechazada) → la hoja dice «Solo se pausa o se bloquea una casa publicada.» y solo ofrece «Eliminar casa».
- [ ] **D66** (la casa a pausar) «Pausar» → «Pausar casa» con «Sale de Explorar y su enlace deja de funcionar. El anfitrión la sigue viendo y editando, con el motivo; usted la reanuda cuando todo esté en orden. La suscripción no cambia.» y el campo «Motivo (lo verá el anfitrión)»; toque «Pausar casa» con el motivo vacío → «Escriba el motivo (hasta 2000 caracteres).».
- [ ] **D67** Escriba «Confirme que las fotos son de esta casa.» y toque «Pausar casa» → aviso «Casa pausada», la hoja sigue abierta con «Reanudar» en lugar de «Pausar» y el botón «Avisar a <nombre> por WhatsApp», cuyo texto es «Hola, <nombre>. Le escribimos de 3bstays: su casa «<nombre>» está pausada en 3bstays: Confirme que las fotos son de esta casa. Puede seguir editándola desde Mis casas; cuando todo esté en orden, la reanudamos.».
- [ ] **D68** Cierre la hoja → la casa sale en el chip «Pausadas» y ya no en «Activas».
- [ ] **D69** Cliente (sin sesión): abra su `/casa/CT-####` → «Este enlace ya no está activo»; en Explorar ya no aparece.
- [ ] **D70** Propietaria: Mis casas → la tarjeta dice «Pausada por 3bstays»; en el detalle, el recuadro «Pausada por 3bstays» con «Su casa no aparece en Explorar y el enlace de su ficha no funciona por ahora. Puede seguir editándola; cuando todo esté en orden, la reanudamos nosotros.» y «Motivo: Confirme que las fotos son de esta casa.»; cambie el precio → se guarda (pausada se puede editar).
- [ ] **D71** Admin: abra la casa pausada y toque «Reanudar» → «Casa reanudada», la hoja se cierra, vuelve al chip «Activas», su ficha abre otra vez (recargue) y sale en Explorar; la propietaria ya no ve el recuadro.
- [ ] **D72** (la casa a bloquear) «Bloquear» → «Bloquear casa» con «Igual para el público. El anfitrión verá el motivo y «Escribir a 3bstays», no podrá editarla ni reactivarla y su suscripción se para: sin cobro ni avisos mientras esté bloqueada.»; escriba «Publica un teléfono dentro de las fotos.» y toque «Bloquear casa» → «Casa bloqueada», «Desbloquear» y el botón de WhatsApp con «…su casa «<nombre>» está bloqueada en 3bstays: Publica un teléfono dentro de las fotos. Si tiene dudas, respóndanos a este mensaje.»; la casa pasa al chip «Bloqueadas».
- [ ] **D73** Propietaria: el detalle de la casa → recuadro «Bloqueada por 3bstays» con «Su casa no aparece en Explorar, el enlace de su ficha no funciona y no se puede editar. Mientras esté bloqueada no se cobra su suscripción.», el motivo y el botón verde «Escribir a 3bstays» (abre el WhatsApp de propietarios); los datos salen en gris sin poder tocarlos, no hay «Compartir» y la suscripción dice «Parada mientras la casa esté bloqueada · no se cobra».
- [ ] **D74** Propietaria: intente cambiar el calendario o una foto de la casa bloqueada → no deja, con «Esta casa está bloqueada por 3bstays. Escríbanos por WhatsApp.».
- [ ] **D75** Admin: en la casa bloqueada solo hay «Desbloquear» (no «Pausar» ni «Bloquear»); tóquelo → «Casa desbloqueada»; la casa vuelve a su estado de antes (Activa si lo estaba; si estaba en oferta, la fecha del último día gratis se corre los días que duró el bloqueo) y la propietaria vuelve a poder editar.
- [ ] **D76** (la casa a eliminar) «Eliminar casa» → «Eliminar casa» con «Desaparece para todos, también para el anfitrión y de los favoritos de los clientes. Los datos, fotos y consultas quedan guardados, ocultos. No hay «deshacer» en la app.», «Motivo (queda en el registro)» y «Para confirmar, escriba CT-####»; con un código distinto → «Escriba el código de la casa (CT-####) para confirmar.».
- [ ] **D77** Escriba el motivo y el código en minúsculas (`ct-1022`) y toque «Eliminar casa» → «Casa eliminada», la hoja se cierra y la casa desaparece de todos los chips.
- [ ] **D78** Propietaria: la casa ya no está en Mis casas (bajan los contadores; si era su única casa, la barra vuelve a «Explorar · Favoritos · Cuenta»); Cliente: su enlace dice «Este enlace no existe» y desaparece de sus Favoritos.

### 4.8 Editar casas (Ana)

Ana edita cualquier dato de cualquier casa salvo las eliminadas, al momento y sin revisión, con las mismas pantallas y reglas que el anfitrión (ticket 10 de la ronda del 2 nov). Use una casa activa de la propietaria de prueba y un borrador de otra cuenta (empiece uno con la clienta y déjelo sin nombre ni fotos).

- [ ] **D78a** Casas → toque la casa activa → «Editar casa» → «Editar casa» con `CT-#### · <nombre>` arriba, la ficha editable de siempre sin las etiquetas «Revisión», el aviso «Toque un dato para cambiarlo. Lo que guarde se publica al momento, sin revisión.» y, al final, la fila «Calendario»; no salen las cifras de 30 días ni la suscripción de la cuenta de Ana.
- [ ] **D78b** Toque «Nombre» → la pantalla del dato con el nombre publicado, **sin** el aviso de revisión y con el botón «Guardar» (no «Enviar a revisión»); escriba «Abc» y guarde → «El nombre de la casa debe tener entre 5 y 32 caracteres.»; escriba un nombre válido y guarde → «Guardado. Ya se ve en su ficha.» y la fila lo muestra.
- [ ] **D78c** Toque «Precio» → cambie el precio por noche y guarde → la fila lo muestra; en una pestaña sin sesión, `/casa/CT-####` (recargue) muestra el nombre y el precio nuevos.
- [ ] **D78d** Propietaria: el detalle de la casa muestra lo que cambió Ana, sin nada «En revisión» por esos datos.
- [ ] **D78e** Propietaria: cambie el nombre de la casa (queda «En revisión»). Ana: abra «Editar casa» → la fila «Nombre» muestra el nombre publicado y debajo «Pendiente del anfitrión: <el de la propietaria>»; cambie el nombre ella misma → manda el de Ana, la línea del pendiente desaparece, la casa ya no está en «Ediciones por revisar» y la propietaria deja de ver su cambio en revisión (sin aviso).
- [ ] **D78f** «Fotos» (la píldora de la portada) → añada una foto → sale en la ficha pública al momento (sin revisión); quite fotos hasta dejar una → con la última, «Su ficha necesita al menos una foto…».
- [ ] **D78g** La fila «Calendario» (o «Editar calendario» de la hoja) → «Calendario» con el nombre de la casa, sin «Marcar una reserva» ni «Pausar la casa»; toque un día, «Ocupado», «Guardar cambios» → la propietaria lo ve en su Calendario y la ficha pública lo marca ocupado.
- [ ] **D78h** Una casa bloqueada también se edita desde «Editar casa» (Ana puede; la propietaria no).
- [ ] **D78i** Casas → «Borradores sin enviar» → «Borradores» con «Casas que su anfitrión empezó y aún no envió.» y, por borrador, la foto (o el hueco), el nombre («Sin nombre»), `CT-#### · <anfitrión> · empezado el …` y lo que falta en ocre («Falta: nombre y fotos») o «Listo para enviar».
- [ ] **D78j** Toque el borrador → abre el asistente donde se quedó, con el título «Asistir casa»; escriba el nombre, «Continuar», suba una foto, «Continuar» hasta «Revisar y enviar» → las filas llevan a su paso y vuelven al resumen como al anfitrión.
- [ ] **D78k** «Enviar a revisión» → lleva a «Revisar anuncio» de esa casa; apruébela como siempre. La dueña del borrador lo ve en revisión (o activo) en Mis casas.
- [ ] **D78l** Revisar anuncio de una casa sin publicar (en revisión, con cambios o rechazada) → arriba a la derecha, «Editar»: abre el asistente de esa casa con el puerto de Ana.
- [ ] **D78m** (terminal, base `bnbtico-pruebas`) `select action, target_listing_id, created_at from admin_actions where action in ('listing.edit','listing.submit') order by created_at desc limit 10;` → una fila `listing.edit` por cada guardado de esta parte (dato, foto, orden, calendario o pantalla del asistente) y una `listing.submit` por el envío.

### 4.9 La ficha pública tras decidir

- [ ] **D79** Abra `https://pruebas.3bstays.com/casa/CT-####` de la casa editada **antes** de aprobar el nombre y anote el título → es el nombre viejo.
- [ ] **D80** Apruebe el nombre (D57) y espere hasta 1 minuto; recargue la ficha una vez → el título es el nombre nuevo. Si tarda más de un minuto, anote la hora (ver D85).
- [ ] **D81** Apruebe una foto nueva y recargue la ficha → la foto está al final de la galería y el contador de la ficha sube en uno.

### 4.10 Seguridad y telemetría

- [ ] **D82** (escritorio) Abra `/admin`, `/admin/casas` y una revisión con la consola del navegador abierta (F12) → no aparece ningún aviso «Content Security Policy» ni «Refused to execute inline script».
- [ ] **D83** (terminal) `curl -sI https://pruebas.3bstays.com/casa/CT-####` → la cabecera `content-security-policy` contiene `script-src 'self' https://challenges.cloudflare.com;` y no contiene `unsafe-inline`.
- [ ] **D84** (terminal, base `bnbtico-pruebas`) `select action, reason, created_at from admin_actions order by created_at desc limit 10;` → una fila por cada decisión de esta parte: `listing.changes`, `listing.reject`, `listing.approve`, `edit.changes` y `edit.approve` (la nota o el campo en `reason`).
- [ ] **D85** (terminal) `select id, status_code, created from net._http_response order by created desc limit 10;` → tras cada aprobación hay respuestas de la purga con `status_code` 200; ninguna 401, 502 o 503 (401 = secreto distinto; 503 = purga no configurada).
- [ ] **D86** (terminal) `select build, message, count(*) from client_errors group by 1,2 order by 3 desc limit 10;` → ningún error nuevo de las pantallas de admin (revise las filas con `created_at` de hoy); no debe salir nada con `page` que empiece por `/admin`.

## 5. Recorridos de punta a punta

Cada recorrido cambia de rol: cierre sesión con Cuenta → «Cerrar sesión» y entre con el otro número. Roles: **Cliente** `8888 1234`, **Propietaria** `8777 0001`, **Admin** Daniel o Ana (con el segundo código). Anote la hora de cada paso para ver cuánto tarda en reflejarse.

- [ ] **X1** Publicar → revisar → aparece en Explorar → el cliente contacta por WhatsApp → la propietaria ve la consulta.
  1. Propietaria: Mis casas → «Nueva casa» y publicar una casa en Cocles con nombre «Casa X1», precio, al menos una foto → termina en «¡Listo! Su casa está en revisión» y en Mis casas con «En revisión».
  2. Admin: Anuncios → la casa sale con «Nueva» y `Cocles · … fotos · ₡…` → ábrala, revise fotos y datos → «Aprobar y publicar» → ««Casa X1»: Aprobada y publicada. El enlace ya funciona.».
  3. Cliente (sin necesidad de sesión para mirar): Explorar → «Casa X1» aparece en la lista con «Cocles» y su precio; tóquela → la ficha abre.
  4. Cliente: «Contactar por WhatsApp» → hoja «Escríbale a Yorleny»; elija llegada y salida y 3 personas → «Abrir WhatsApp» abre `wa.me/50687770001` con el enlace de la ficha de Casa X1 en la primera línea, una línea en blanco y luego «Hola, vi Casa X1 en 3bstays y me interesa. ¿Está disponible del … al … para 3 personas? Gracias.».
  5. Cliente: vuelva a la app (atrás desde WhatsApp) → la ficha sigue abierta, sin errores.
  6. Propietaria: la pestaña «Consultas» muestra un número. Abra Consultas y deje visible la tarjeta: pierde «Nueva» y baja el contador. «Abrir WhatsApp» abre `wa.me/50688881234` sin texto preparado.

- [ ] **X2** Pedir cambios → la propietaria corrige y reenvía → el admin aprueba.
  1. Admin: abra una casa nueva en revisión → mensaje «Cambie la foto de portada, se ve un número de teléfono.» → «Pedir cambios» → «Cambios pedidos. El anfitrión verá su mensaje.».
  2. Propietaria: Mis casas → «Cambios pedidos», «Nota de 3bstays: Cambie la foto de portada, se ve un número de teléfono.» y «Corregir y reenviar».
  3. Propietaria: «Corregir y reenviar» → arregla la foto en el asistente y envía a revisión → de nuevo «¡Listo! Su casa está en revisión»; Mis casas dice «En revisión».
  4. Admin: Anuncios → la casa sale con la insignia «Corregida» (no «Nueva») → «Aprobar y publicar».
  5. Cliente: Explorar muestra la casa; Propietaria: Mis casas → «Activa».

- [ ] **X3** Editar una casa publicada → revisión dato a dato → ficha actualizada.
  1. Propietaria: Mis casas → casa activa → «Nombre» → escribe «Casa X3 frente al mar» → «Enviar a revisión» → «Enviado a revisión. Su ficha sigue como está hasta que lo aprobemos.»; luego «Descripción» (texto nuevo) y «5 fotos · Editar» → añade una foto (en Fotos, «Añadir fotos»).
  2. Cliente: abre `/casa/CT-####` → sigue con el nombre, descripción y fotos de antes.
  3. Admin: Anuncios → «Ediciones por revisar» → `Edición: nombre, descripción, 1 foto nueva` → «Aprobar» el nombre; «Pedir cambios» en la foto con «Se ve un teléfono.»; «Aprobar» la descripción (lo último en revisión) → vuelve a Anuncios con «Cambios aprobados. La ficha ya los muestra.», aunque la foto quede con cambios pedidos.
  4. Cliente: recarga la ficha (hasta 1 minuto) → nombre y descripción nuevos; la foto nueva no aparece.
  5. Propietaria: Fotos → la foto nueva dice «Cambios pedidos» con «Se ve un teléfono.»; la quita y sube otra → «En revisión» → Admin aprueba la foto → vuelve a Anuncios con «Cambios aprobados. La ficha ya los muestra.».
  6. Cliente: recarga la ficha → la foto nueva ya está en la galería.

- [ ] **X4** Pausar la casa en el calendario → sale de Explorar → se vuelve a publicar.
  1. Propietaria: Calendario → elija la casa activa → toque «Pausar la casa» («No sale en Explorar ni recibe consultas. Puede elegir cuándo vuelve.») → hoja «Pausar la casa» → deje la fecha vacía → «Pausar la casa».
  2. Propietaria: la tarjeta dice «Pausada» («No aparece en Explorar ni recibe consultas.») con el botón «Volver a publicarla»; en Mis casas, etiqueta «Pausada».
  3. Cliente: Explorar (recargue) → la casa ya no sale en la lista ni en el mapa; Consultas de la propietaria no recibe nada nuevo de ella.
  4. Propietaria: «Volver a publicarla» → vuelve la fila «Pausar la casa».
  5. Cliente: Explorar → la casa vuelve a salir.

- [ ] **X5** Noches ocupadas → Explorar con esas fechas no la muestra.
  1. Propietaria: Calendario → toque tres noches seguidas (por ejemplo del 20 al 22 del mes que viene) → en el panel «Ocupado» → «Guardar cambios».
  2. Cliente: Explorar → «Empiece su búsqueda» → «¿Cuándo?» → llegada el día 20 y salida el 23 → «Buscar» → la casa **no** aparece (todas las noches de llegada a salida deben estar libres).
  3. Cliente: repita con llegada el día 23 y salida el 26 → la casa **sí** aparece.
  4. Propietaria: vuelva a marcar las tres noches «Disponible» → «Guardar cambios»; el Cliente repite el paso 2 y la casa aparece.

- [ ] **X6** Fin de la oferta → reloj de pruebas → pendiente de pago → pagar con tarjeta de prueba → activa.
  1. Propietaria: elija una casa activa con oferta (sin método de pago guardado) y anote su `CT-####`.
  2. (terminal) `curl -X POST https://3bstays-pruebas.ana-garcia-saiz.workers.dev/_pruebas/oferta/CT-#### -H "authorization: Bearer $TEST_CLOCK_SECRET" -H "content-type: application/json" -d '{"diasRestantes":7}'` → responde con avisos encolados; repetir el mismo umbral da `queued:0`.
  3. Propietaria: llega el WhatsApp del aviso de 7 días (si el número está en el sandbox de Twilio); en la app, Mis casas y Cuenta muestran la oferta que termina pronto con el enlace `#pago=CT-####`.
  4. (terminal) Repita con `{"diasRestantes":-1}` → la casa pasa a «Pendiente de pago».
  5. Cliente: `/casa/CT-####` → «Este enlace ya no está activo»; la casa no sale en Explorar. Admin: Casas → chip «Por pagar» con «Oferta vencida el … · sin método de pago».
  6. Propietaria: Mis casas → casa «Pendiente de pago» con «Su oferta gratuita terminó el …» y «La ficha está oculta y el enlace no funciona hasta que añada un método de pago. ₡2 900 al mes, sin permanencia; puede parar cuando quiera.» → «Añadir método de pago».
  7. Propietaria: en la página de Stripe en modo de prueba, tarjeta `4242 4242 4242 4242`, `12/30`, CVC `123` → vuelve a Suscripción con «Método de pago guardado.» y «Visa ···· 4242 · vence 12/30»; la casa dice «Activa» con «Suscripción activa desde el … · ₡2 900 al mes».
  8. Cliente: `/casa/CT-####` → la ficha vuelve a verse; Explorar la muestra de nuevo. Admin: Casas → «Activa» con «Pagando desde el … · ₡2 900 al mes».

- [ ] **X7** La propietaria para la suscripción → el enlace deja de funcionar → la reactiva. (Lo hace la propietaria; pausar, bloquear y eliminar desde el admin están en 4.7.)
  1. Propietaria: Mis casas → casa activa → Suscripción → «Parar suscripción» → confirmar → la casa queda «Inactiva» con «Parada el … · no se cobra».
  2. Cliente: `/casa/CT-####` → «Este enlace ya no está activo» y «El anfitrión paró la suscripción de este anuncio, así que el enlace ya no muestra la ficha ni permite contactarlo desde 3bstays.»; Explorar ya no la lista.
  3. Admin: Casas → chip «Inactivas» con «Parada por el anfitrión el …».
  4. Propietaria: «Activar suscripción» → la casa vuelve a «Activa»; Cliente: la ficha vuelve a abrir.

- [ ] **X8** Rechazar una casa → el enlace nunca funciona.
  1. Propietaria: publica una casa «Casa X8» y la envía a revisión; anote su `CT-####`.
  2. Cliente: `/casa/CT-####` → «Este enlace ya no está activo» y «Este anuncio no está disponible en este momento.»; no sale en Explorar.
  3. Admin: abre la casa, escribe «Las fotos no son de esta casa.» y toca «Rechazar» → ««Casa X8»: Rechazada. El anfitrión verá el motivo.».
  4. Propietaria: Mis casas → «Rechazada» con «Nota de 3bstays: Las fotos no son de esta casa.»; Cliente: el enlace sigue sin funcionar; Admin: chip «Rechazados» la lista.

---

## 6. Si algo falla

Por cada fallo, mande por WhatsApp o cree un issue en `.scratch/pruebas-<fecha>/issues/NN-<tema>.md` con:

1. El código de la comprobación (p. ej. **A44**) y lo que esperaba.
2. Lo que pasó, con captura de pantalla (o grabación si es un movimiento: barra, mapa, arrastrar fotos).
3. Teléfono, navegador y si era la app instalada o el navegador.
4. La hora aproximada (para buscar en `client_errors` y en los registros del worker).
5. El `CT-####` de la casa y el número de la cuenta usada.

No hace falta parar: marque la casilla como fallida (✗), anótelo y siga con la siguiente. Si un fallo bloquea una parte entera (p. ej. no se puede ingresar), avise antes de seguir.

## 7. Registro de la prueba

| Fecha | Quién | Teléfono y navegador | Partes hechas | Fallos (códigos) |
|---|---|---|---|---|
| | | | | |


## Marca gráfica vigente · comprobación tras integrar recursos (2026-11-05)

- [ ] En el teléfono, cabeceras y aviso de giro muestran el logotipo 3bstays; el fondo de la página se ve detrás, sin placa crema ni letras recortadas.
- [ ] En la portada sobre foto se ve el logo blanco sin rectángulo ni sombra propia. Al compartir un enlace, la imagen OG usa la marca 3bstays.
- [ ] Favicon: cuadrado terracota con esquinas redondeadas y B crema. Al instalar la PWA, B terracota sobre crema, sin recuadro; el recorte circular no corta la B.
- [ ] Los logos de las maquetas y del prototipo son los de 3bstays; en `design/logo/` solo está la biblioteca `3bstays-2026-11-10`.

- [ ] En Explorar y Favoritos, compruebe a 320 px que un alojamiento completo muestra personas, dormitorios y baños con iconos y texto, y que estos pueden pasar a otra línea si falta espacio. Una Habitación muestra solo las personas. Encima del precio salen solo las características presentes (Wifi, Mascotas, Niños gratis, etc.), con los mismos dibujos de la ficha. Revise una casa sin características y otra con las nueve. El precio y los iconos quedan libres del botón de WhatsApp.

- [ ] En la ficha, la capacidad muestra los iconos de personas, cama y baño. Una Habitación conserva «baño privado» o «baño compartido».

- [ ] La zona lleva el mismo pin de mapa en las tarjetas de Explorar y Favoritos y en la cabecera de la ficha.

- [ ] En las tarjetas de lista y en la ficha se lee «1 dormitorio» o «N dormitorios». En la tarjeta del mapa, el icono lleva su cifra y conserva la etiqueta accesible completa. El tipo de alojamiento sigue llamándose «Habitación».

- [ ] Toque un precio del mapa. La tarjeta muestra el pin de zona y una fila con iconos y cifras de personas, dormitorios y baños para alojamiento completo, o solo personas para Habitación. El nombre puede ocupar dos líneas y el tipo se alinea a la izquierda en su propia línea, encima de la ubicación. Debajo de la capacidad están el precio y el botón cuadrado de WhatsApp. A 320 px, compruebe que el precio por noche y el total de una estancia se lean junto al botón. Los iconos de características aparecen debajo del precio y quedan libres del botón.

- [ ] En Explorar y Favoritos, el tipo aparece debajo del nombre y encima de la zona, alineado a la izquierda, también a 320 px. En la tarjeta del mapa y la ficha, aparece debajo del nombre. Se lee «Alojamiento completo» o «Habitación · baño privado/compartido» según los datos. Sin dato del baño, solo «Habitación». No se duplica la antigua pastilla de tipo en la ficha. Revise que el texto se ajuste a 320 px sin invadir WhatsApp.
