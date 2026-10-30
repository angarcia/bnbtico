# Plan de pruebas manual · revisión UX (2026-10-26/27)

> **2026-10-29 · ronda de Ana:** las secciones «Ronda de Ana…», «Explorar al estilo Airbnb», «Editar una casa publicada», «Publicar v2» y «Cuenta, suscripción por casa y Actividad» (U59–U103) son lo más reciente y **mandan** sobre el resto de este plan, sobre `docs/pruebas-manuales-mejoras-2026-10-27.md` y sobre `docs/pruebas-manuales-fase-r.md` donde no coincidan.
>
> **2026-10-28:** las mejoras del 2026-10-27 (navegación simple, alquiler mensual, ubicación por punto y fotos arrastrando) se prueban con `docs/pruebas-manuales-mejoras-2026-10-27.md`, que manda sobre este plan donde no coincidan.

Comprueba desde el teléfono todo lo cambiado por la revisión UX acordada con Daniel (`.scratch/revision-ux/2026-10-26-revision-ux.md`). Entorno: `https://nueva.bnbtico.com` (rama `develop`, worker `bnbtico-pruebas`, Supabase `bnbtico-pruebas`). Desde la red de Rivian, la misma app está en `https://bnbtico-pruebas.ana-garcia-saiz.workers.dev`. Se hace **de una vez, desde el teléfono**, después de desplegar. Marque cada casilla y, si algo falla, anote el número del paso (ver C).

Números de prueba con código `123456`: `8888 1234` (cliente), `8777 0001` (propietaria «Yorleny Prueba»), `8888 9999` (libre). Los admins (Daniel y Ana) también entran con `123456`. Conviene un segundo teléfono o una pestaña privada para hacer de cliente y de propietaria a la vez.

Lo que **no** cambió y no hace falta repetir: moneda y tipo de cambio, el calendario por dentro (marcar noches, precios ★). Explorar, el admin, «Anuncio visible» (ahora «Cerrar la casa hasta…» en el Calendario), la publicación y Cuenta sí cambiaron en la ronda de Ana: ver sus secciones. Para eso sigue valiendo `docs/pruebas-manuales-fase-r.md`.

---

## A. Antes de empezar (Daniel)

| Paso | Qué hacer | Bloquea |
|---|---|---|
| A1 | ✅ **Hecho el 2026-10-27** (las tres aplicadas y comprobadas: 2 de 2 casas activas con fecha de publicación, `wizard_step` permitido, `owner_listing_stats` solo con sesión y solo para el dueño). **Migraciones nuevas en `bnbtico-pruebas`**, en este orden, desde la raíz del repo en `develop` al día: `pnpm exec supabase migration list` (deben salir solo en «Local») y `pnpm exec supabase db push`. 1) `20261027060732_primera_publicacion` (fecha de primera publicación; el calendario la usa). 2) `20261027073701_evento_paso_asistente` (la baliza `wizard_step`). 3) `20261027074733_estadisticas_casa` (visitas y consultas de cada casa). | pruebas: sin la 1 el calendario no ve las casas reabiertas; sin la 2 el asistente funciona pero sus balizas se rechazan; sin la 3 Inicio no muestra las cifras |
| A2 | **Despliegue de `develop` en verde** (GitHub → Actions, o `gh run list`). En el log del paso «Build para desplegar» debe salir el aviso `WA_OWNERS / WA_GUESTS sin configurar: Ayuda sale desactivada.` mientras no haya números de bnbtico: es lo esperado (A12) | despliegue |
| A3 | **Cerrar la app instalada y volver a abrirla** (o recargar) para que tome la versión nueva | pruebas |

---

## B. Recorridos

### Cliente: de la ficha a WhatsApp (C2, C3, A3, A10)

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| U1 | En una pestaña privada, sin sesión, abrir una ficha (p. ej. `/casa/CT-1015`) en un teléfono pequeño (iPhone SE o similar) | La barra de abajo tiene **una sola línea** bajo el precio: «≈ $186 · orientativo». **Sin hacer scroll** se ven la zona y «N personas · N habitaciones». Si el nombre de la casa es largo (más de ~38 letras) sale más pequeño, sin ocupar tres líneas | ☐ |
| U2 | En la misma ficha, debajo del nombre de la casa | Un círculo con las iniciales de quien la alquila y «**Yorleny** · WhatsApp verificado». Arriba ya no está la etiqueta suelta «WhatsApp verificado» (sigue la de «Vacacional»). Al final de la ficha sigue «Publicada por Yorleny Prueba…» | ☐ (sustituida 2026-10-28: ver `docs/pruebas-manuales-mejoras-2026-10-27.md`, M42) |
| U3 | En Explorar, «Más filtros» → Personas «4+» → «Ver N casas»; abrir una casa con capacidad de 4 o más → «Contactar por WhatsApp» | La hoja abre con **Personas 4** y el mensaje dice «…para 4 personas». Los botones − y + cambian el número y el mensaje; «+» se apaga al llegar a la capacidad de la casa. Escribir un número mayor y tocar el botón → «Esta casa es para N personas como máximo.» | ☐ |
| U4 | Sin sesión, en la hoja: mirar el botón verde | Dice **«Continuar»** (no «Abrir WhatsApp»), con la nota «Para escribirle necesita verificar su WhatsApp con un código. Lo que escribió se guarda.» | ☐ |
| U5 | Escribir un mensaje propio y tocar «Continuar» | Pantalla **«Escribirle a Yorleny»** (no «Ingresar»): arriba la tarjeta de la casa (foto, nombre, «Yorleny · WhatsApp verificado»), «Un paso y le escribe a Yorleny», el número de WhatsApp. **No** hay «No tengo acceso a mi WhatsApp» ni la palabra «Ingresar» | ☐ |
| U6 | Número `8888 9999` (o uno libre) → «Recibir código por WhatsApp» → nombre → «Recibir código…» → código `123456` | La pantalla del código también dice «Escribirle a Yorleny» y lleva la tarjeta arriba. Tras el código: **no** aparece «¡Listo! Su cuenta está creada»; vuelve a la ficha, la hoja dice «Abriendo WhatsApp…» y **WhatsApp se abre solo** con el número de Yorleny y el mensaje escrito en U5 | ☐ |
| U7 | Volver atrás desde WhatsApp | La ficha, con la hoja cerrada | ☐ |
| U8 | Cerrar sesión. Repetir U4–U6 con `8888 1234` (ya tiene cuenta), pero esperar **más de 30 minutos** en la pantalla del código antes de escribirlo | Tras el código la hoja reabre con el **mensaje por defecto** (lo escrito caducó) y **no** abre WhatsApp sola: espera a que toque «Abrir WhatsApp». *(Opcional: tarda media hora.)* | ☐ |

### Ingresar (A6)

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| U9 | Sin sesión, Mi cuenta → Ingresar. Mirar el campo del número | Ya no existe el campo aparte «País de su WhatsApp»: la caja **«+506 ▾»** junto al número es el selector. Al tocarla salen los países con su código | ☐ |
| U10 | Tocar «Recibir código por WhatsApp» con el número vacío | Debajo del número, en rojo: «Escriba su número de WhatsApp.», con el campo marcado y el teclado en él | ☐ |
| U11 | Escribir «123» y volver a tocar | «Ese número no parece válido para el país elegido.» debajo del número | ☐ |
| U12 | Con un número sin cuenta, en el paso del nombre, tocar sin escribirlo | «Escriba su nombre.» debajo del nombre, con el teclado en él | ☐ |
| U13 | En la caja «+506 ▾» elegir «Otro país» | La caja dice «Otro ▾» (sigue ahí para volver a cambiar) y el número se escribe completo con «+» | ☐ |

### Favoritos, Explorar y páginas de error (N6, A11, N4)

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| U14 | Guardar una casa con el corazón → pestaña Favoritos | Cada casa tiene un botón verde **«Enviar WhatsApp»** con el icono de WhatsApp (antes «Escribir»; revisión de Ana, 2026-10-28). La nota dice «Escriba directo desde aquí. Guardar casas no necesita cuenta; para escribir solo verifica su WhatsApp con un código.» | ☐ |
| U15 | Tocar «Enviar WhatsApp» | Abre la ficha con la hoja de contacto **ya abierta**; no se envía nada solo. La dirección queda `/casa/CT-…` sin `?escribir=1` | ☐ |
| U16 | Una casa pausada (Anuncio visible apagado) que esté en Favoritos | En vez de «Enviar WhatsApp», «No disponible por ahora» | ☐ |
| U17 | Explorar: leer el buscador de arriba | «Limón · Cualquier grupo» (ya no dice «Cualquier fecha») | ☐ |
| U18 | Abrir `/no-existe` | «No encontramos esta página» con el botón **«Ir a Explorar»** | ☐ |
| U19 | Abrir `/casa/CT-999999` y la ficha de una casa reabierta para editar | «Este enlace no existe» / «Este enlace ya no está activo» con el botón **«Ver otras casas en el Caribe»** | ☐ |

### Propietaria nueva: publicar (C4, A1)

Con una cuenta sin casas (p. ej. `8888 9999` recién creada en U6, o borre las suyas).

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| U20 | Mi cuenta → «Publicar mi casa» → Inicio | Tarjeta «Publique su casa en pocos pasos» con la lista **Fotos horizontales, si ya las tiene · El precio por noche · Unos 10 minutos** (actualizado 2026-10-29, publicar v2: las fotos ya no son obligatorias para enviar) y el botón «Publicar casa» | ☐ |
| U21 | Tocar «Publicar casa» | Entra **directo al paso 1** (sin la pantalla intermedia «Empezar») | ☐ |
| U22 | Mirar la cabecera y la barra en varios pasos | Arriba a la derecha la etapa en dos líneas: **«Su casa · 1 de 4»** … «Su casa · 4 de 4», «Fotos y texto · 1 de 2», «Precio · 2 de 2» (actualizado 2026-10-28: con la ubicación por punto el mapa va dentro de «¿Dónde está su casa?»). La barra tiene 8 tramos agrupados 4 · 2 · 2, con un hueco mayor entre etapas | ☐ |
| U23 | Paso 6, descripción vacía | Dentro de la caja, tres preguntas guía («¿Cómo es por dentro? ¿Qué hay cerca…? ¿Qué incluye…?») que desaparecen al escribir. Con menos de 80 caracteres el contador dice **«Faltan N caracteres»** en ocre; desde 80, «n / 2000» | ☐ |
| U24 | Paso 7 sin fotos y después con **2 fotos** → «Continuar» (actualizado 2026-10-29, publicar v2) | Sin fotos, la ayuda «Puede enviarla sin fotos; para publicarla necesitamos al menos una.» y el contador «0 de 15»; con 2, «2 de 15». Sin avisos en ocre. **Deja seguir** al paso 8 en los dos casos | ☐ |
| U25 | Paso 9 (actualizado 2026-10-29, publicar v2) | Título **«Revisar y enviar»**; seis filas (Alojamiento, Dónde, Capacidad, Nombre, Fotos, Precio) que llevan a su pantalla. «Nombre» dice «<nombre>» (con « · sin descripción» si no la tiene); «Fotos», «Ninguna todavía», «1 foto» o «2 fotos». Nada en ocre. Todo cabe sin scroll | ☐ |
| U26 | Tocar «Ver cómo queda su ficha» | La ficha tal como la verán los clientes, con la banda «Vista previa · así la verán los clientes» y «Cerrar»; el botón de WhatsApp se ve pero apagado. «Cerrar» vuelve al paso 9 | ☐ |
| U27 | Con 2 fotos (o ninguna), tocar «Enviar a revisión» (actualizado 2026-10-29, publicar v2) | Se envía: ya no hace falta un mínimo de fotos para enviar. Para aprobarla, el admin necesita al menos una; sin fotos solo puede pedir cambios | ☐ |
| U28 | «✕ Cerrar» → Mis casas (actualizado 2026-10-29, publicar v2) | La tarjeta del borrador con su nombre y **«Seguir publicando»**, que abre la primera pantalla que falte; con todo completo (aunque tenga 2 fotos o ninguna), el paso 9 «Revisar y enviar». Nada de «faltan fotos» | ☐ |
| U29 | Desde el paso 9, «Enviar a revisión» con las 2 fotos (actualizado 2026-10-29, publicar v2) | Se envía sin pedir más fotos: «¡Listo! Su casa está en revisión» (si la cuenta no tiene correo, antes la pregunta «¿Quiere añadir un correo?») | ☐ |
| U54 | Paso 7 con 6+ fotos (iPhone y Android): mantener pulsada una foto ~½ s | Se agranda un poco con sombra. **En Android vibra** (en iPhone no). **No** sale el menú de la imagen ni la lupa o selección de texto | ☐ |
| U55 | Arrastrarla a la portada y soltar | Las demás se apartan mientras arrastra. Al soltar queda primera con «Portada», sin parpadeo de vuelta. Tras recargar, sigue igual | ☐ |
| U56 | Con 12+ fotos, arrastrar la última hacia el borde de arriba de la rejilla | La rejilla sube sola hasta la portada | ☐ |
| U57 | Deslizar el dedo en vertical empezando sobre una foto | Hace scroll normal y no levanta ninguna. Un toque corto no hace nada | ☐ |
| U58 | *(Opcional, iPhone con VoiceOver)* Dos dedos hacia la derecha hasta «Mover foto 3 antes», luego doble toque | Dice «Foto movida a la posición 2» | ☐ |
| U30 | Pestaña Consultas sin casa publicada | «Aquí verá a los clientes que le escriban por WhatsApp desde su ficha.» con «Publicar casa» (o «Seguir publicando» si hay un borrador; si solo hay una en revisión, «Su casa está en revisión…») | ☐ |

### Propietaria con casa activa (A1, A2, N1, N2, N7)

> Desde 2026-10-27 (navegación simple) no hay pestañas Inicio ni Consultas: U31, U32, U33 y U36 quedan sustituidas por la sección «Navegación simple» (U44–U53); U34 y U35 valen con las salvedades de allí (una casa se ve directa, un solo aviso). Lo mismo para U20, U28 y U30 más arriba: donde dicen «Inicio» o «Consultas», léase Mis casas (aviso «Seguir publicando») o Actividad.

Con `8777 0001` (Yorleny, con CT-1015 activa). Antes, desde **otro** teléfono o una pestaña privada, abra la ficha de CT-1015 un par de veces.

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| U31 | Inicio | En la tarjeta de la casa activa: **«N visitas · N consultas · últimos 30 días»** (o «Comparta su enlace para que lleguen las primeras visitas» si aún no hay). Las visitas del otro teléfono cuentan | ☐ (sustituida: ya no hay Inicio ni Consultas; ver U44–U53) |
| U32 | Desde el teléfono de Yorleny (ya con sesión y tras abrir Mis casas), abrir su propia ficha varias veces y volver a Inicio | Las visitas **no** suben: las de la propia dueña no cuentan | ☐ (sustituida: ya no hay Inicio ni Consultas; ver U44–U53) |
| U33 | Crear un borrador («Nueva») y volver a Inicio | Arriba, la tarjeta del borrador con «Seguir publicando» (relleno); «Compartir ficha por WhatsApp» de la casa activa pasa a **contorno**. Con dos o más borradores: «y N borradores más · Ver en Mis casas» | ☐ (sustituida: ya no hay Inicio ni Consultas; ver U44–U53) |
| U34 | Mis casas | Casillas solo las que tienen algo (ya no «0 por pagar»); **un solo botón relleno** en la pantalla (el «Seguir» del borrador; sin borrador, «Compartir ficha»); «Nueva» en contorno. «Seguir» abre el primer paso con algo pendiente | ☐ |
| U35 | Detalle de la casa activa | La foto lleva estado y precio, **sin «CT-1015»**; la fila «Compartir ficha» muestra el enlace `…/casa/CT-1015`; bajo la foto, las visitas y consultas de U31 | ☐ |
| U36 | Consultas (si no hay ninguna; si hay, borrar en pruebas o saltar) | «Todavía nadie le ha escrito. Comparta su ficha para que lleguen las primeras consultas.» con «Compartir ficha por WhatsApp» | ☐ (sustituida: ya no hay Inicio ni Consultas; ver U44–U53) |

### Navegación simple (2026-10-27)

En el teléfono. Para los pasos 2 a 7 hace falta un número de prueba sin casas (por ejemplo `8888 9999`; si ya tiene, bórrelas antes).

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| U44 | Sin sesión (ventana privada), abrir la app | Barra de abajo con **solo dos pestañas**: Explorar y Favoritos. Arriba, logo, «₡ \| $» y «Ingresar» | ☐ |
| U45 | Ingresar con un número sin casas | Siguen **dos pestañas**; arriba, en lugar de «Ingresar», las iniciales. Cae en Explorar | ☐ |
| U46 | Tocar las iniciales | Cuenta a **pantalla completa** con flecha de volver (no es pestaña). Hay una fila **«Publicar mi casa»** y no hay fila «Moneda». La flecha vuelve a donde estaba, sin rebotar | ☐ |
| U47 | «Publicar mi casa» y crear el borrador | Pasa a **cinco pestañas** (Explorar · Favoritos · Mis casas · Calendario · Actividad) y Mis casas muestra **directo el detalle del borrador** (sin lista, sin flecha), con «Seguir publicando» y «Añadir otra casa» | ☐ |
| U48 | «Añadir otra casa» y crear un segundo borrador | Mis casas pasa a **lista** con las dos; arriba, un único aviso | ☐ |
| U49 | Borrar las dos casas | La barra vuelve a **dos pestañas** y se aterriza en Explorar. En Cuenta reaparece «Publicar mi casa» | ☐ |
| U50 | En Explorar tocar «₡ \| $» para pasar a **$**; abrir una ficha; recargar la página y volver a mirar | Los precios salen en dólares en Explorar y en la ficha (que tiene el mismo selector en su cabecera) y **se conserva tras recargar**. La línea «N casas en Limón» ya no lleva «₡ · $» | ☐ |
| U51 | Abrir `/propietario/consultas` (como en un aviso antiguo de WhatsApp) con una casa | Entra en **Actividad** sin pantalla en blanco; `/propietario` entra en Mis casas | ☐ |
| U52 | Con una casa activa (`8777 0001`, CT-1015), abrir Actividad | «Actividad · Últimos 30 días» con **tres cifras grandes** (visitas · toques en WhatsApp · consultas, sin tarjeta) y «Últimas consultas» con «Abrir WhatsApp»; el contador de consultas nuevas está en la pestaña Actividad. Las visitas de la propia dueña no cuentan (como U32) | ☐ |
| U53 | Con la app instalada y una casa, cerrarla del todo y volver a abrirla | **La barra no salta**: desde el primer pintado ya muestra las cinco pestañas | ☐ |

### Calendarios (A4, A5)

Las filas A5 son las acordadas en la revisión. Para tener una segunda casa activa, publíquela y apruébela desde la cuenta de admin (segundo código).

| # | Preparación | Acción | Esperado | ✓ |
|---|---|---|---|---|
| A4-1 | Cualquier ficha con calendario, cuando quedan **menos de 10 días** en el mes (contando hoy) | Mirar «Disponibilidad» | Abre en el **mes siguiente**; «‹» vuelve al actual. Los días pasados son solo el número en gris claro, sin fondo ni precio. Con 10 días o más, abre en el mes actual | ☐ |
| A4-2 | Igual, en el Calendario de la propietaria | Pestaña Calendario | Lo mismo: a fin de mes abre en el siguiente; los días pasados sin precio | ☐ |
| A5-1 | Propietario sin casas ni borradores | Pestaña Calendario | «Su calendario se activa cuando envíe su casa a revisión.» y «Publicar casa»; sin selector ni rejilla. El botón abre el paso 1 | ☐ |
| A5-2 | Solo un borrador, dejado en el paso 4 | Pestaña Calendario | El mismo aviso con «Seguir publicando»; abre el asistente en el paso 4 (el primero con algo pendiente) con lo escrito | ☐ |
| A5-3 | Solo una casa enviada a revisión por primera vez | Pestaña Calendario | Abre **su** calendario, con su nombre como subtítulo y sin selector: se puede preparar mientras se revisa. Lo mismo desde «Enviada» → «Marcar las noches ocupadas» | ☐ |
| A5-4 | Una casa activa («Casa A») y después crear un borrador nuevo | Pestaña Calendario | Abre «Casa A» con su nombre como subtítulo y **sin selector**; el borrador no aparece | ☐ |
| A5-5 | Dos casas activas («Casa A» y «Casa B») y un borrador | Calendario → selector | Solo «Casa A» y «Casa B» | ☐ |
| A5-6 | Igual que A5-5 | Elegir «Casa B» → Inicio → Calendario | Abre «Casa B» (la última usada). Cerrar la app y volver: sigue en «Casa B» | ☐ |
| A5-7 | Igual que A5-5 | Mis casas → «Calendario» de «Casa A» | Abre «Casa A», aunque la última fuera «Casa B» | ☐ |
| A5-8 | «Casa B» cerrada («Cerrar la casa hasta…» en su Calendario; antes «Anuncio visible» apagado) | Calendario → selector | «Casa B» sigue en el selector, con los días atenuados y «Abrir la casa» arriba | ☐ |
| A5-9 | Dos activas; en «Casa B», detalle → «Editar la ficha» y confirmar (vuelve a revisión) | Calendario → selector | «Casa B» **sigue** en el selector y se pueden marcar noches mientras se revisa; un borrador nuevo nunca enviado sigue sin aparecer | ☐ |

### Escritorio (N5)

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| U37 | En un ordenador (ventana ancha), abrir Explorar | Tarjetas en **4 columnas** (3 si la ventana es más estrecha, 2 en el teléfono) | ☐ |
| U38 | Abrir una ficha en el ordenador | Dos columnas: fotos y texto a la izquierda; a la derecha una tarjeta con el precio y «Contactar por WhatsApp» que **se queda fija** al bajar. En el teléfono, la barra de abajo de siempre | ☐ |
| U39 | Ir de Explorar a una ficha y volver, en el ordenador y en el teléfono | La foto de la tarjeta se convierte en la de la ficha y vuelve (la transición sigue igual en los dos anchos) | ☐ |

### Portada (C1)

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| U40 | Abrir `/?pronto=1` en el teléfono | La foto de Playa Negra **más cálida** y encuadrada hacia la selva (menos cielo gris). Bajo la foto, una tarjeta **«¿Tiene una casa en el Caribe?»** con «Las primeras 50 casas: 12 meses gratis. Después, ₡9 900 al mes por casa, sin comisiones ni permanencia.» y «Abrimos pronto en el Caribe sur.» (sin botón, porque aún no hay número) | ☐ |
| U41 | Bajar hasta «Cómo funciona» | Tres pasos numerados: El propietario publica · Usted la encuentra · Acuerdan directo | ☐ |
| U42 | *(Cuando exista el número de propietarios)* Poner `WA_OWNERS` en GitHub, volver a desplegar y abrir la portada | En la tarjeta, el botón **«Quiero publicar mi casa gratis»** en vez de la frase; abre WhatsApp con «Hola, tengo una casa en el Caribe sur y quiero publicarla en bnbtico.» | ☐ |

### Datos (C4.6, A2) — opcional, se lo puede pedir a Claude

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| U43 | Tras recorrer el asistente, en el SQL Editor la consulta «Asistente de publicar» de `docs/telemetria.md` | Una fila por paso alcanzado con el número de borradores; la ruta guardada es `/propietario/publicar/:id/<paso>` (sin el id real) | ☐ |

### Ronda de Ana · densidad, tarjetas y calendario (2026-10-29)

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| U59 | Recorrer todas las pestañas en un iPhone y en un Android | El margen a los lados es de **16 px** en todas (pantallas, filas de chips, tira de fotos y barras fijas) | ☐ |
| U60 | Mirar la barra de abajo | Iconos de **26 px**; la pestaña activa en terracota `#B44C30` | ☐ |
| U61 | Abrir una ficha con 5 fotos | La foto es **cuadrada**, a todo el ancho y pegada arriba (bajo la muesca); los botones de volver, compartir y corazón se ven enteros y abajo dice «1 / 5» | ☐ |
| U62 | Mirar la barra de abajo de la ficha | Colones a la izquierda («₡42 000 / noche» y el mensual si lo hay) y «≈ $» a la derecha; debajo del botón, «Precios orientativos: el precio final lo acuerda con el propietario.» | ☐ |
| U63 | Mis casas con una sola casa | Una tarjeta con la foto cuadrada y «Activa» encima; tocarla (fuera de los botones) abre el detalle | ☐ |
| U64 | Crear un borrador y volver a Mis casas | El borrador sale **una sola vez**, en su tarjeta, con «Seguir publicando» y «Descartar» | ☐ |
| U65 | Calendario: bajar entre meses con el dedo, elegir un día de este mes y otro del siguiente, «Ocupado» y «Guardar cambios» | Los meses van uno debajo de otro, sin flechas; el panel dice las dos noches y al guardar las dos salen «Ocupado» | ☐ |
| U66 | Calendario de una casa activa: «Cerrar la casa hasta…», poner una fecha y «Cerrar la casa»; mirar Explorar desde otro teléfono; volver y «Abrir la casa» | Arriba dice «Cerrada hasta el …» y los días se atenúan; la casa no sale en Explorar y su ficha dice «No disponible por ahora». «Abrir la casa» la devuelve en un toque y vuelve a salir en Explorar. El detalle de la casa ya no tiene el interruptor «Anuncio visible» | ☐ |
| U66b | Mirar el Calendario de una casa con noches libres y ocupadas | Libres en verde claro; ocupadas en terracota cálido con rayas, el número en terracota oscuro y «Ocupado»; cada día lleva su precio dentro | ☐ |
| U66c | Mirar la ficha | No hay selector «₡ \| $» en la ficha (solo en Explorar); los precios en dólares salen en la barra de abajo | ☐ |

### Explorar al estilo Airbnb (2026-10-29)

Con un iPhone y un Android, sesión cerrada salvo donde se diga. Hacen falta casas con noches ocupadas (por ejemplo, una con el 25 de noviembre ocupado) y una en Cocles.

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| U67 | Abrir Explorar en el iPhone (con muesca) | La píldora «Empiece su búsqueda» queda **bajo la muesca**, sin tapar la hora; arriba no hay barra con el logo; el botón de cuenta está a su derecha y «₡ \| $» al final de la fila de chips. Al bajar, la cabecera se queda fija | ☐ |
| U68 | Tocar la píldora y escribir «coc» | Con el teclado abierto se sigue viendo la lista de zonas («Cocles», «Talamanca, Limón»), no queda tapada | ☐ |
| U69 | Elegir Cocles | Pasa solo a «¿Cuándo?» y la tarjeta de ¿Dónde? muestra «Cocles» | ☐ |
| U70 | En el calendario tocar el 23 de noviembre y luego el 27; probar también con la llegada en un mes y la salida en el siguiente | Los extremos en terracota y la banda en crema entre ellos, en los dos meses; abajo «23–27 nov» y «4 noches» | ☐ |
| U71 | Tocar «Solo alquiler mensual» y abrir ¿Cuándo? | Pide solo «Desde» (un día) y dice «Casas libres del … al …» con 30 noches; no pide salida | ☐ |
| U72 | En ¿Quiénes? poner 4 personas y «Buscar» | La píldora dice «Cocles · 23–27 nov · 4 personas»; la línea, «N casas en Cocles y alrededores · 23–27 nov»; la casa con el 25 de noviembre ocupado **no** sale | ☐ |
| U73 | Cerrar una casa desde su Calendario (otro teléfono) y repetir la búsqueda | La casa cerrada **no** sale nunca, ni con otras fechas | ☐ |
| U74 | Mirar el primer elemento de la lista | El **mapa** con marcadores de precio, sobre las tarjetas, que van **una por fila**. Si no hay red, queda una caja vacía y la lista funciona | ☐ |
| U75 | Bajar por la lista | Flota el botón **«Mapa»** por encima de la barra de pestañas, sin taparla | ☐ |
| U76 | Tocar «Mapa» | Mapa a pantalla completa; **pellizcar y arrastrar** funciona con los dedos; el botón dice «N casas» | ☐ |
| U77 | Tocar un marcador | Sale la tarjeta de esa casa; tocarla abre la ficha | ☐ |
| U78 | En el mapa, gesto o botón **Atrás** | Se cierra el mapa y vuelve la lista en el mismo punto, sin salir de Explorar | ☐ |
| U79 | Con las fechas y las personas puestas, abrir una casa y «Contactar por WhatsApp» | Llegada, salida y personas **ya puestas**; en WhatsApp: «¿Está disponible del 23 al 27 de noviembre para 4 personas?» | ☐ |
| U80 | Con «Solo alquiler mensual» y «Desde» elegido, abrir una casa y «Contactar por WhatsApp» | El mensaje dice «Me interesa alquilar por meses desde el …» | ☐ |
| U81 | En Explorar con el filtro mensual encendido, mirar a 360 y 375 px de ancho | El chip se acorta con «…» y los botones de filtros siguen de 44 × 44 | ☐ |
| U82 | «Borrar todo» en la búsqueda con una característica elegida (Piscina) | Quita zona, fechas y personas y **conserva** Piscina | ☐ |

### Editar una casa publicada (2026-10-29)

Con dos teléfonos: el de la propietaria (una casa activa) y el del admin (con su app de autenticación). Un tercero, sin sesión, para mirar la ficha pública.

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| U83 | Propietaria: en su casa, tocar «Precio», cambiarlo y «Guardar»; luego «Características», marcar una más y «Guardar». Mirar la ficha pública desde el otro teléfono | «Guardado. Ya se ve en su ficha.» las dos veces, sin aviso de edición; la ficha pública ya muestra el precio y la característica nuevos | ☐ |
| U84 | Propietaria: cambiar «Nombre», «Guardar»; en la píldora de fotos añadir una foto y «Listo»; «Enviar a revisión». Abrir Mis casas | Arriba «Cambios sin enviar: nombre, 1 foto nueva» y, tras enviar, «Edición en revisión: nombre, 1 foto nueva · normalmente en menos de 24 horas»; la tarjeta dice «Edición en revisión»; la ficha pública sigue con el nombre de antes | ☐ |
| U85 | Admin, en su teléfono: Anuncios → «Ediciones por revisar» → la casa; mirar «Antes» / «Ahora» y la foto nueva; «Aprobar cambios». Propietaria: abrir su casa | Sin «Rechazar»; al aprobar, «Cambios aprobados. La ficha ya los muestra.» y la sección desaparece. La propietaria ya no ve aviso; la tarjeta dice «Activa»; la ficha pública tiene el nombre nuevo y la foto nueva **al final** | ☐ |
| U86 | Propietaria: cambiar otra vez el nombre y enviarlo. Admin: «Pedir cambios» sin mensaje, luego con un mensaje. Propietaria: corregir el nombre y «Enviar a revisión». Admin: «Aprobar cambios». Después, la propietaria añade una foto nueva (edición nueva) y «Descartar cambios» | Sin mensaje: «Escriba una nota para pedir cambios.». Con él, la propietaria ve «Le pedimos cambios en la edición» con el mensaje y la tarjeta «Cambios pedidos en la edición»; al reenviar, «Edición en revisión: nombre…». Al descartar la segunda edición pregunta «¿Descartar los cambios sin aplicar? Su ficha sigue como está.», el aviso desaparece y la foto nueva no queda en la ficha | ☐ |
| U86b | Propietaria: abrir cada dato de la ficha editable (Nombre, Tipo, Personas, Características, Descripción, Precio, Ubicación); cambiar uno y volver sin guardar | Cada uno abre su pantalla con «Guardar»; volver sin guardar no cambia nada; el gesto Atrás del teléfono vuelve a la ficha (no al formulario) | ☐ |
| U86c | Con una edición en revisión, abrir «Nombre» y «Ubicación» | Las filas en revisión salen con candado y «En revisión»; dentro: «Este cambio está en revisión. Si quiere cambiar algo, descarte la edición y empiece otra.», sin «Guardar», y el punto del mapa no se mueve | ☐ |
| U86d | Editor de fotos (píldora «N fotos · Editar»): arrastrar una foto aprobada a la portada; quitar otra; intentar quitar todas | Ordenar y quitar se aplican al momento (la ficha pública cambia sin revisión); la última foto aprobada no se deja quitar: «Su ficha necesita al menos una foto. Añada otra y, cuando la aprobemos, podrá quitar esta.» | ☐ |
| U86e | Escribir un precio nuevo con el teléfono sin red y «Guardar» | Sale el error y el precio escrito **se conserva** en el campo | ☐ |

### Publicar v2 (2026-10-29)

Con un teléfono sin sesión y un número de prueba libre (`8888 9999`); el admin, en su teléfono.

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| U87 | Sin cuenta: en la portada (`/?pronto=1`) tocar «Publicar mi casa»; responder el paso 1 y «Continuar» | La portada abre `/publicar` (en producción antes del lanzamiento sigue el botón de WhatsApp). El paso 1 se responde sin cuenta; al continuar sale «Para guardar su casa, verifique su WhatsApp» | ☐ |
| U88 | Escribir el número y el nombre, recibir el código, «Verificar y continuar» (probar también recargar la página en medio) | Cabecera «Publicar casa» y «Después seguimos con su casa»; tras el código, directo al paso 2 de su casa (sin «¡Listo!»), con un solo borrador y el tipo elegido en el paso 1; recargar no crea otro | ☐ |
| U89 | Avanzar hasta el paso 6 sin descripción y hasta el 7 sin fotos; en el 9 mirar las filas; «Enviar a revisión» | «Descripción (opcional)» y «Puede enviarla sin fotos; para publicarla necesitamos al menos una.»; en el resumen «Ninguna todavía» y el nombre con « · sin descripción»; se envía. Después sale «¿Quiere añadir un correo?» con «Guardar correo» y «Ahora no» | ☐ |
| U90 | Tocar «Ahora no»; enviar otra casa con la misma cuenta | La pregunta del correo no vuelve a salir; si guarda un correo válido, tampoco | ☐ |
| U91 | Admin: abrir esa casa sin fotos en Anuncios | La nota arena «Sin fotos: solo puede pedir cambios.»; «Aprobar y publicar» no funciona («Para aprobarla hace falta al menos una foto.»); «Pedir cambios» propone «Para publicarla necesitamos al menos una foto de la casa.» | ☐ |
| U92 | Cuenta nueva (otro número libre) desde Ingresar, sin `next`: tras el código mirar «¡Listo! Su cuenta está creada»; probar «Sí, quiero publicarla» y, con otra cuenta, «No, busco casa» | La pregunta «¿Tiene una casa para alquilar?»: «Sí» lleva a publicar y «No» a Explorar; el enlace «Añadir un correo de recuperación» abre el correo. Una cuenta que llegó desde una ficha vuelve a la ficha sin ver la pregunta | ☐ |
| U93 | En el paso 6 escribir un nombre de 33 caracteres | El contador para en 32 y no deja pasar de ahí; con 4 caracteres, «El nombre de la casa debe tener entre 5 y 32 caracteres.» | ☐ |

### Cuenta, suscripción por casa y Actividad (2026-10-29)

Con la propietaria «Yorleny Prueba» (`8777 0001`) con dos casas publicadas y consultas en las dos.

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| U94 | Propietaria con dos casas: Cuenta → una línea de la suscripción de una casa | Abre «Suscripción» con solo esa casa, «Método de pago» y «Cómo funciona», sin la oferta; abajo, al final de la pantalla, «Ver todas sus casas», que lleva a «Promoción y suscripción» con todas | ☐ |
| U95 | Abrir el enlace de un aviso por WhatsApp, `/propietario/suscripcion#pago=CT-1042` (sin `casa`), con dos o más casas | «Promoción y suscripción» con todas las casas y la CT-1042 resaltada | ☐ |
| U95b | En Mis casas, tocar el botón de pago de una casa por pagar (`/propietario/suscripcion?casa=CT-1042#pago=CT-1042`) | «Suscripción» con solo esa casa, resaltada; la URL conserva `casa`. Sin red y con una casa recién aprobada que aún no estaba en el teléfono, la URL sigue con `casa` y no se ven las demás casas | ☐ |
| U96 | Con una casa parada, abrir su suscripción | «Activar suscripción» en ocre (ya no «Reactivar»); al activarla la casa vuelve a Activa | ☐ |
| U97 | Desde la suscripción de una casa, «Añadir método de pago» y completar la pasarela de prueba | Vuelve a la misma casa (`?casa=CT-1042#pago=CT-1042`, sin `pago=ok`), solo esa casa y «Método de pago guardado…» | ☐ |
| U98 | Cuenta con una casa sin método de pago; luego con método | Sin método y con una casa que ya lo necesita (pendiente de pago o con el aviso de 90, 30 o 7 días o del último día): fila «Método de pago» en ocre con «Falta · añádalo antes de que termine su oferta». Sin método y sin aviso (solo borradores o la oferta lejos del final): fila normal con «Ninguno todavía». Las líneas pendientes o inactivas en ocre. Con método: fila normal con la tarjeta | ☐ |
| U99 | Mirar bajo el nombre y el WhatsApp de Cuenta | «Pronto podrá verificar también su identidad (opcional).» y ningún otro texto de identidad en la app | ☐ |
| U100 | Cuenta → al final «Cerrar sesión»: tocar «Cancelar»; repetir y tocar el fondo; repetir y confirmar | «¿Cerrar sesión?» con «Tendrá que recibir un código nuevo para volver a entrar.»; cancelar o tocar fuera cierra y sigue con sesión, con el foco en «Cerrar sesión»; confirmar sale y pide el código otra vez | ☐ |
| U101 | Actividad con dos casas publicadas y consultas de ambas | Cada consulta lleva arriba la etiqueta de su casa; bajo «Últimas consultas» los chips «Todas · <casa>»; tocar uno deja solo sus consultas | ☐ |
| U102 | Con un chip elegido, recargar; tocar «Todas»; elegir una casa sin consultas | La URL lleva `?casa=` y la recarga mantiene el filtro; «Todas» lo quita; la casa sin consultas dice «Todavía no hay consultas de esta casa.» | ☐ |
| U103 | Actividad con una sola casa; luego con dos o más | Con una, su tarjeta ocupa toda la fila (foto cuadrada con la etiqueta de estado y las tres cifras grandes); con dos o más, de dos en dos | ☐ |

### Letra más grande, ficha y botones (2026-10-29)

Con un iPhone SE (o 375 px) y un Android. Hace falta una casa con una descripción larga en varios párrafos, noches ocupadas y un día con precio distinto.

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| U104 | Recorrer Explorar, la ficha, Favoritos y Mis casas | La letra se lee más grande que antes (como en Airbnb); nada se corta ni se sale | ☐ |
| U105 | Abrir la ficha en el iPhone SE sin bajar | Nombre, zona y personas **centrados** y visibles por encima de la barra fija; la barra no pasa de un cuarto de pantalla y «Precios orientativos…» cabe en una línea | ☐ |
| U106 | Bajar un poco | Una línea; la persona («Yorleny», debajo «WhatsApp verificado») en su fila; otra línea; la descripción en **párrafos separados** | ☐ |
| U107 | Con la descripción larga: tocar «Ver más»; luego el botón atrás del teléfono | Se ve recortada en 8 líneas con la última difuminada; «Ver más» abre la descripción entera a pantalla completa; atrás la cierra y la ficha sigue donde estaba (otro atrás sale de la ficha) | ☐ |
| U108 | Con una descripción corta | Se ve entera, sin «Ver más» | ☐ |
| U109 | Mirar «Disponibilidad» en la ficha | Cada noche lleva su precio («₡55 mil», sin «k»); ★ y su cifra en los de precio distinto; disponibles en verde muy suave y ocupadas en terracota suave con rayas y «Ocupado»; casillas juntas con esquinas poco redondeadas. En un teléfono de 320 px, «55 mil» sin «₡» | ☐ |
| U110 | Mirar botones en Favoritos vacío, publicar, Mis casas y una casa por pagar | Esquinas de 8 px, ningún contorno; «Continuar» y «Compartir ficha» en verde lleno algo más suave; los demás («Explorar casas», «Ver más», «Atrás», «Calendario», «Ingresar») en verde muy claro; «Añadir método de pago» en ocre más suave | ☐ |
| U111 | Favoritos vacío y el final de Explorar | «Compare y escriba directo» y «¿No encuentra lo que busca?» en blanco, sin verde ni arena | ☐ |
| U112 | Filtros: elegir Piscina y Wifi; mirar «₡ \| $» | Lo elegido en verde claro sin borde, con ✓; lo no elegido en beige claro; ningún salvia | ☐ |
| U113 | Títulos en Explorar, la ficha, Mis casas y publicar | La misma letra que el texto, más fina que antes (no «tipo cómic») | ☐ |
| U114 | «¿Cuándo?»: elegir llegada y salida | Los dos extremos en cuadrados terracota suave (no círculos naranjas) y la banda entre ellos casi crema; la pestaña activa de abajo en el terracota del logo | ☐ |
| U115 | Hoja de contacto, «¿Quiénes?» y el paso 4 de publicar | Los − / + sin fondo, solo el signo en verde; la ✕ sin fondo; en «¿Quiénes?», la hoja de contacto y el asistente, sin personas pone «–»; los campos de texto sin línea, que se marca al escribir | ☐ |
| U116 | Ficha: los botones sobre la foto | Volver, compartir y corazón cuadrados y crema semitransparente; se leen sobre cualquier foto | ☐ |
---

## C. Si algo falla

Mande por WhatsApp o en un issue de `.scratch/revision-ux/` (uno por fallo):

1. El número del paso (p. ej. «U24» o «A5-9») y qué esperaba.
2. Captura de pantalla o grabación, con la hora.
3. Teléfono y navegador (p. ej. «iPhone SE, Safari» o «Pixel 7, Chrome, app instalada»), y si tenía red.
4. Si el fallo es de cifras (U31–U32) o del calendario (A5): la casa (CT-####) y la cuenta con que entró.
