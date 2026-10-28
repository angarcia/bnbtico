# Plan de pruebas manual · mejoras del 2026-10-27

Comprueba desde el teléfono las cuatro mejoras acordadas con Daniel el 2026-10-27:

1. **Navegación simple.** Una barra que crece con las casas, Cuenta arriba, «Actividad» y ₡ | $ arriba.
2. **Alquiler mensual como característica.**
3. **Ubicación por punto.**
4. **Fotos: ordenar arrastrando.**

Las especificaciones están en `.scratch/navegacion-simple/`, `.scratch/mensual-como-caracteristica/`, `.scratch/ubicacion-por-punto/` y `.scratch/fotos-arrastrar/`. Las decisiones, en `docs/decisiones.md` (entradas del 2026-10-27).

**Entorno:** `https://nueva.bnbtico.com` (rama `develop`, worker `bnbtico-pruebas`, Supabase `bnbtico-pruebas`). Desde la red de Rivian, la misma app está en `https://bnbtico-pruebas.ana-garcia-saiz.workers.dev`.

**Números de prueba**, todos con el código `123456`:

| Número | Uso |
|---|---|
| `8777 0001` | Propietaria «Yorleny Prueba» |
| `8888 1234` | Cliente |
| `8888 9999` | Libre |

Los admins (Daniel y Ana) entran con `123456` y su app de autenticación. Conviene usar un segundo teléfono o una pestaña privada para hacer de cliente.

**Manda este plan** sobre `docs/pruebas-manuales-fase-r.md` y `docs/pruebas-manuales-revision-ux.md` donde no coincidan. La tabla D dice qué filas de esos planes quedan sustituidas. Se recorre **en orden y de una vez**: cada bloque deja preparado el siguiente.

---

## A. Antes de empezar

| Paso | Estado |
|---|---|
| A1 | ✅ **Hecho el 2026-10-28.** Se borraron las casas de prueba de `bnbtico-pruebas`: 14 casas, 46 fotos (98 archivos), favoritos, consultas, suscripciones y días del calendario. Se conservan los 6 perfiles y los 2 admins. |
| A2 | ✅ **Hecho el 2026-10-28.** Migraciones aplicadas: `owner_activity`, `mensual_como_caracteristica`, `calendario_sin_precio_por_noche`, `ubicacion_postgis`, `distritos_osm`, `zonas`, `ubicacion_en_listings` y `place_at_determinista`. Resultado: 7 provincias, 84 cantones y 494 distritos; 55 zonas activas de 1092. |
| A3 | ✅ **Hecho el 2026-10-28.** Despliegue de `develop` en verde (run 40711293971). |
| A4 | **Cerrar la app instalada del todo y volver a abrirla**, o recargar, para que tome la versión nueva. |

> No hay ninguna casa en pruebas. El bloque B2 publica una desde cero y, cuando un admin la aprueba en B3, el resto del plan la usa. La app vieja (`pruebas.bnbtico.com`) ya no puede crear borradores: todo se prueba en `nueva.bnbtico.com`.

---

## B. Recorridos

### B1 · Sin sesión: barra de dos pestañas y barra superior

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| M1 | En una pestaña privada, abrir la app | Explorar. Abajo, **solo dos pestañas: Explorar y Favoritos**. Arriba, una barra fija con el logo, «₡ \| $» e «Ingresar». En un teléfono de 375 px (iPhone SE o mini) todo cabe sin cortarse ni solaparse | ☐ |
| M2 | Mirar la fila de chips bajo el buscador | Solo **«Solo alquiler mensual»** y **«Más filtros»**. Ya no están «Vacacional» y «Mensual» | ☐ |
| M3 | Abrir «Más filtros» | Filtros a pantalla completa, **sin la barra superior** (lleva su propia cabecera con «Volver»). En la lista de características, **«Solo alquiler mensual» después de las nueve** | ☐ |
| M4 | Volver y tocar «Ingresar» | Lleva a la pantalla del código por WhatsApp | ☐ |

### B2 · La propietaria publica desde cero (`8777 0001`)

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| M5 | Ingresar con `8777 0001` → código `123456` | Llega a **Explorar** porque aún no tiene casas. Siguen **dos pestañas**. Arriba, en lugar de «Ingresar», un círculo con **«YP»** | ☐ |
| M6 | Tocar «YP» | **Cuenta a pantalla completa** con flecha de volver (no es una pestaña). Tiene una fila **«Publicar mi casa»** y **no** tiene fila «Moneda» | ☐ |
| M7 | Flecha de volver. Volver a abrir Cuenta → «Ayuda por WhatsApp» → «Volver» → «Volver» | Vuelve a Ayuda, luego a Cuenta y luego a **Explorar**, sin rebotar entre Cuenta y Ayuda | ☐ |
| M8 | Cuenta → «Publicar mi casa» | Se crea el borrador. **La barra pasa a cinco pestañas**: Explorar · Favoritos · **Mi casa** · Calendario · Actividad (con una sola casa la pestaña dice «Mi casa»; con dos o más, «Mis casas»). Abre el paso 1 «¿Qué es?» con «Su casa · 1 de 4» y, arriba, **«Tenga a mano:»** con 5 fotos horizontales o más, el precio y unos 10 minutos. **No** pregunta «¿Cómo alquila?» | ☐ |
| M9 | Elegir el tipo → «Continuar» | Paso **«¿Dónde está su casa?»** («Su casa · 2 de 4»): buscador arriba, mapa, el texto «Toque el mapa o arrastre el punto hasta su casa.», la nota «En la ficha solo se ve una zona aproximada de unos 500 m…» y, abajo, «Zona». **Ya no hay** selectores de provincia ni de cantón, y tampoco hay otra pantalla con el mapa | ☐ |
| M10 | En el buscador escribir «Coc» y elegir «Cocles» | El mapa va a Cocles con zoom de calle y el teclado se cierra. **No pone el punto** | ☐ |
| M11 | Tocar el mapa sobre Cocles | Aparece el punto. Debajo, **«Talamanca, Limón»** (no se puede editar). En «Zona» queda elegida **Cocles**. La lista trae las zonas a menos de 5 km (Cocles, Puerto Viejo, Playa Chiquita…), luego el distrito **Cahuita** y al final «Otra…» | ☐ |
| M12 | Arrastrar el punto unos cientos de metros, y después buscar «Limón centro» y tocar allí | Mientras busca, la línea dice «Buscando el cantón…» **sin hacer saltar la pantalla**. En Limón centro pasa a **«Limón, Limón»** y la lista cambia (queda elegida Limón centro) | ☐ |
| M13 | Volver a poner el punto en Cocles. En «Zona» → «Otra…», escribir «Cocles» → tocar **«Usar "Cocles"»** | Queda elegida la **Cocles de la lista**, no una zona nueva | ☐ |
| M14 | «Otra…» → escribir «Cerca del río» → tocar «Usar "Cerca del río"». Con el teclado abierto, mirar el campo y las sugerencias | Con el teclado abierto se ven el campo y sus sugerencias, y se pueden tocar. Abajo dice «Datos © OpenStreetMap · Photon». Queda **«Cerca del río»** como zona. En el teclado, Enter sin nada marcado también elige «Usar "…"» | ☐ |
| M15 | Poner el modo avión, mover el punto y quitar el modo avión | Sin red sale «No pudimos ubicar el punto. Revise su conexión.» con «Reintentar» y «Continuar» apagado. Al volver la red, la línea se actualiza sola | ☐ |
| M16 | Abrir a mano la dirección del paso cambiando `/2` por `/3` | Lleva al paso 2 (`…/2`) | ☐ |
| M17 | Completar personas, características, nombre y descripción hasta el paso de **Fotos** («Fotos y texto · 2 de 2») | Mientras carga la pantalla de fotos, el título «Fotos» no se mueve | ☐ |
| M18 | Subir **6 fotos o más** desde el carrete | Cada foto muestra su progreso. Con 2 fotos o más aparece **«Mantenga pulsada una foto y arrástrela para cambiar el orden. La primera es la portada.»**. Ya **no** existen «Hacer portada», «← Antes» ni «Después →» | ☐ |
| M19 | **iPhone y Android:** mantener pulsada una foto medio segundo | Se agranda un poco y lleva sombra. **En Android vibra**; en iPhone no. **No** sale el menú de la imagen, ni la lupa, ni la selección de texto | ☐ |
| M20 | Arrastrarla a la primera casilla y soltar | Las demás se apartan mientras arrastra. Al soltar queda **primera, con «Portada»**, sin volver atrás. Tras recargar, sigue igual | ☐ |
| M21 | Deslizar el dedo en vertical empezando sobre una foto; dar un toque corto a otra | El deslizamiento hace **scroll normal** y no levanta ninguna foto. El toque corto no hace nada | ☐ |
| M22 | Con 12 fotos o más, arrastrar la última hacia el borde de arriba de la rejilla | La rejilla se desplaza sola hasta la portada | ☐ |
| M23 | Mientras sube una foto, mantener pulsada otra | No se levanta. Al terminar la subida, ya se puede | ☐ |
| M24 | ✕ en una foto | Se quita. Tras ordenar con el teclado (VoiceOver o TalkBack), el foco **no salta** solo a otra foto | ☐ |
| M25 | *(Opcional, VoiceOver)* Pasar con dos dedos hasta «Mover foto 3 antes» y hacer doble toque | Dice «Foto movida a la posición 2» | ☐ |
| M26 | «Continuar» → paso **Precio** («Precio · 1 de 2») | «Precio por noche» (obligatorio) y, debajo, **«¿Acepta alquiler por meses?»** con **No** ya marcado y Sí. Con No no aparece nada más | ☐ |
| M27 | Tocar «Sí» con el teclado abierto en el precio por noche | Se marca a la primera, sin que la pantalla se mueva y se pierda el toque. Aparece **«Precio al mes (opcional)»** con la ayuda «Si lo deja vacío, en su ficha dirá «Precio a negociar con el dueño».» | ☐ |
| M28 | Escribir un precio al mes, tocar «No» y luego «Sí» otra vez | El precio al mes se ha borrado | ☐ |
| M29 | Dejar «Sí» con el precio al mes **vacío**, poner el precio por noche → «Continuar» | Pasa al resumen. Dice «₡X / noche · mensual a negociar» | ☐ |
| M30 | «Enviar a revisión» | «Enviada a revisión». En la pestaña **Mi casa** se ve **directamente el detalle de la casa**, sin lista ni flecha de volver, con «Añadir otra casa» al final | ☐ |

### B3 · Un admin la revisa (Daniel o Ana)

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| M31 | Como admin (código y segundo factor), en «Anuncios», abrir la casa para revisarla | La línea dice «… · Cerca del río, Talamanca, Limón» y aparece la marca **«Zona propuesta por el dueño»**. Si en M14 volvió a elegir Cocles de la lista, no hay marca | ☐ |
| M32 | Aprobar | Pasa a **Activa**, gratis por la oferta de lanzamiento | ☐ |

### B4 · La propietaria con su casa activa

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| M33 | Con `8777 0001`, abrir la pestaña **Mi casa** (con una casa; «Mis casas» si tiene dos o más) | Detalle directo de la casa activa, con un **único aviso** arriba si toca (el de pago tiene prioridad sobre «Seguir publicando»). No hay tarjeta de la oferta de lanzamiento: la casa dice «Gratis hasta…» | ☐ |
| M34 | Desde el otro teléfono (cliente), abrir la ficha de la casa dos o tres veces y tocar «Contactar por WhatsApp» | — | ☐ |
| M35 | En el teléfono de la propietaria, abrir **Actividad** | «Actividad · Últimos 30 días» con **tres cifras grandes**: visitas, toques en WhatsApp y consultas. Las visitas y el toque del cliente cuentan; las de la propia dueña no. Abajo, «Últimas consultas» con «Abrir WhatsApp», y el contador de nuevas está en la pestaña Actividad | ☐ |
| M36 | Abrir `/propietario/consultas` y `/propietario` (como en un aviso antiguo de WhatsApp) | Entran en Actividad y en Mis casas, sin pantalla en blanco | ☐ |
| M37 | Cerrar la app instalada del todo y volver a abrirla | **La barra no salta**: desde el primer momento muestra las cinco pestañas | ☐ |

### B5 · El cliente: moneda y alquiler mensual

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| M38 | Como cliente, en Explorar | La tarjeta de la casa dice **«₡X / noche»**: el precio siempre lleva su unidad. Ya no aparece la etiqueta «Mensual» en la tarjeta | ☐ |
| M39 | Tocar el chip **«Solo alquiler mensual»** | Se marca. La línea dice **«1 casa acepta alquiler mensual en Limón»** y la tarjeta dice **«Precio a negociar»** | ☐ |
| M40 | Con el chip puesto, abrir «Más filtros» | El rango de precio **no aparece**. «Solo alquiler mensual» está marcado en la lista. Un mínimo mayor que el máximo que quedara de antes no bloquea «Ver N casas» | ☐ |
| M41 | Quitar el chip | Vuelven «N casas en Limón», «₡X / noche» y el rango de precio | ☐ |
| M42 | Abrir la ficha | En la cabecera de la foto está el selector **«₡ \| $»** y no hace saltar nada al cargar. En la rejilla de características está **«Alquiler mensual»** con su icono de calendario. En la barra de abajo, bajo el precio por noche, **«Mensual: precio a negociar con el dueño»**. Ya no está la etiqueta «Vacacional · Mensual» | ☐ |
| M43 | En la barra superior de Explorar pasar a **$**, abrir la ficha y recargar | Los precios salen en dólares en Explorar y en la ficha, y la elección se mantiene tras recargar. Bajo el número de casas ya no hay selector | ☐ |
| M44 | Abrir `/explorar?modo=monthly`, que es un enlace viejo | Entra con el chip «Solo alquiler mensual» puesto y la dirección pasa a `?mensual=1`. Con `?modo=both` entra sin filtro | ☐ |
| M45 | Con el chip «Solo alquiler mensual» puesto, en «Más filtros» marcar «Piscina» (para que no salga ninguna) → «Ver 0 casas» → «Escribir a bnbtico por WhatsApp» | El mensaje dice «Busca alquiler mensual.» y no «Modalidad: …» | ☐ |

### B6 · Una segunda casa, y volver a cliente

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| M46 | Propietaria: pestaña Mi casa → «Añadir otra casa» → «Cerrar» en el paso 1 | La pestaña pasa a decir **«Mis casas»** y muestra la **lista** con las dos casas y un único aviso arriba («Seguir publicando» del borrador) | ☐ |
| M47 | Calendario y Actividad con dos casas | Actividad muestra **una tarjeta por casa**: la activa con sus cifras y el borrador solo con su estado | ☐ |
| M48 | *(Opcional, al final)* Borrar el borrador y pedir a un admin que quite la casa activa | Con cero casas, la barra vuelve a **dos pestañas**, la app lleva a Explorar y en Cuenta reaparece «Publicar mi casa» | ☐ |

---

## C. Si algo falla

Mande por WhatsApp, o en un issue de `.scratch/<mejora>/`, uno por fallo:

1. El número del paso (p. ej. «M20») y qué esperaba.
2. Captura de pantalla o grabación, con la hora.
3. Teléfono y navegador (p. ej. «iPhone SE, Safari» o «Pixel 7, Chrome, app instalada»), y si tenía red.
4. La casa (CT-####) y la cuenta con que entró.

---

## D. Filas de otros planes que este sustituye

| Plan | Filas | Por qué |
|---|---|---|
| `pruebas-manuales-fase-r.md` | B4, D2 | La ficha ahora tiene selector «₡ \| $» y la moneda vive en la barra superior, no en Explorar ni en Cuenta (M42–M43) |
| `pruebas-manuales-fase-r.md` | B5b, D4 | Ya no hay chips Vacacional y Mensual: solo «Solo alquiler mensual» (M2, M39–M41) |
| `pruebas-manuales-fase-r.md` | B5d | El selector «₡ \| $» está en la barra superior, no junto al número de casas ni en Cuenta (M43) |
| `pruebas-manuales-fase-r.md` | B11b, B11b3 | Se publica desde Cuenta → «Publicar mi casa» o Mis casas; ya no hay Inicio (M8, M30) |
| `pruebas-manuales-fase-r.md` | D6 | Cuenta no es una pestaña: se abre desde la esquina superior (M6) |
| `pruebas-manuales-revision-ux.md` | U2 | La etiqueta «Vacacional» ya no existe en la ficha (M42) |
| `pruebas-manuales-revision-ux.md` | U44–U58 | Este plan los incluye en orden (M1–M48); no hace falta repetirlos |
