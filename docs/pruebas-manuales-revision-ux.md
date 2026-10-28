# Plan de pruebas manual · revisión UX (2026-10-26/27)

> **2026-10-28:** las mejoras del 2026-10-27 (navegación simple, alquiler mensual, ubicación por punto y fotos arrastrando) se prueban con `docs/pruebas-manuales-mejoras-2026-10-27.md`, que manda sobre este plan donde no coincidan.

Comprueba desde el teléfono todo lo cambiado por la revisión UX acordada con Daniel (`.scratch/revision-ux/2026-10-26-revision-ux.md`). Entorno: `https://nueva.bnbtico.com` (rama `develop`, worker `bnbtico-pruebas`, Supabase `bnbtico-pruebas`). Desde la red de Rivian, la misma app está en `https://bnbtico-pruebas.ana-garcia-saiz.workers.dev`. Se hace **de una vez, desde el teléfono**, después de desplegar. Marque cada casilla y, si algo falla, anote el número del paso (ver C).

Números de prueba con código `123456`: `8888 1234` (cliente), `8777 0001` (propietaria «Yorleny Prueba»), `8888 9999` (libre). Los admins (Daniel y Ana) también entran con `123456`. Conviene un segundo teléfono o una pestaña privada para hacer de cliente y de propietaria a la vez.

Lo que **no** cambió y no hace falta repetir: Explorar con filtros, moneda y tipo de cambio, el admin, el calendario por dentro (marcar noches, precios ★), Anuncio visible. Para eso sigue valiendo `docs/pruebas-manuales-fase-r.md`.

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
| U14 | Guardar una casa con el corazón → pestaña Favoritos | Cada casa tiene un botón **«Escribir»**. La nota dice «Escriba directo desde aquí. Guardar casas no necesita cuenta; para escribir solo verifica su WhatsApp con un código.» | ☐ |
| U15 | Tocar «Escribir» | Abre la ficha con la hoja de contacto **ya abierta**; no se envía nada solo. La dirección queda `/casa/CT-…` sin `?escribir=1` | ☐ |
| U16 | Una casa pausada (Anuncio visible apagado) que esté en Favoritos | En vez de «Escribir», «No disponible por ahora» | ☐ |
| U17 | Explorar: leer el buscador de arriba | «Limón · Cualquier grupo» (ya no dice «Cualquier fecha») | ☐ |
| U18 | Abrir `/no-existe` | «No encontramos esta página» con el botón **«Ir a Explorar»** | ☐ |
| U19 | Abrir `/casa/CT-999999` y la ficha de una casa reabierta para editar | «Este enlace no existe» / «Este enlace ya no está activo» con el botón **«Ver otras casas en el Caribe»** | ☐ |

### Propietaria nueva: publicar (C4, A1)

Con una cuenta sin casas (p. ej. `8888 9999` recién creada en U6, o borre las suyas).

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| U20 | Mi cuenta → «Publicar mi casa» → Inicio | Tarjeta «Publique su casa en pocos pasos» con la lista **5 fotos horizontales o más · El precio por noche o por mes · Unos 10 minutos** y el botón «Publicar casa» | ☐ |
| U21 | Tocar «Publicar casa» | Entra **directo al paso 1** (sin la pantalla intermedia «Empezar») | ☐ |
| U22 | Mirar la cabecera y la barra en varios pasos | Arriba a la derecha la etapa en dos líneas: **«Su casa · 1 de 4»** … «Su casa · 4 de 4», «Fotos y texto · 1 de 2», «Precio · 2 de 2» (actualizado 2026-10-28: con la ubicación por punto el mapa va dentro de «¿Dónde está su casa?»). La barra tiene 8 tramos agrupados 4 · 2 · 2, con un hueco mayor entre etapas | ☐ |
| U23 | Paso 6, descripción vacía | Dentro de la caja, tres preguntas guía («¿Cómo es por dentro? ¿Qué hay cerca…? ¿Qué incluye…?») que desaparecen al escribir. Con menos de 80 caracteres el contador dice **«Faltan N caracteres»** en ocre; desde 80, «n / 2000» | ☐ |
| U24 | Paso 7 con **2 fotos** → «Continuar» | Arriba en ocre «Faltan 3 fotos · puede añadirlas al final» y el contador «2 de 5–15» en ocre. **Deja seguir** al paso 8 | ☐ |
| U25 | Paso 9 | Título **«Revisar y enviar»**; cinco filas (Alojamiento, Dónde, Capacidad, Nombre y fotos, Precio) que llevan a su pantalla; en «Nombre y fotos», debajo y en ocre, «Faltan 3 fotos». Todo cabe sin scroll | ☐ |
| U26 | Tocar «Ver cómo queda su ficha» | La ficha tal como la verán los clientes, con la banda «Vista previa · así la verán los clientes» y «Cerrar»; el botón de WhatsApp se ve pero apagado. «Cerrar» vuelve al paso 9 | ☐ |
| U27 | Con 2 fotos, tocar «Enviar a revisión» | Vuelve al paso 7 con «Agregue al menos 5 fotos.» (no se envía nada sin 5 fotos) | ☐ |
| U28 | «✕ Cerrar» → Inicio | Arriba del todo, la tarjeta del borrador con su nombre, «Fotos y texto · faltan 3 fotos» y el único botón relleno **«Seguir publicando»**, que abre el paso 7 | ☐ |
| U29 | Añadir fotos hasta 5, ir al paso 9 y «Enviar a revisión» | «¡Listo! Su casa está en revisión» como antes | ☐ |
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
| A5-8 | «Casa B» con «Anuncio visible» apagado | Calendario → selector | «Casa B» sigue y se pueden marcar noches | ☐ |
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

---

## C. Si algo falla

Mande por WhatsApp o en un issue de `.scratch/revision-ux/` (uno por fallo):

1. El número del paso (p. ej. «U24» o «A5-9») y qué esperaba.
2. Captura de pantalla o grabación, con la hora.
3. Teléfono y navegador (p. ej. «iPhone SE, Safari» o «Pixel 7, Chrome, app instalada»), y si tenía red.
4. Si el fallo es de cifras (U31–U32) o del calendario (A5): la casa (CT-####) y la cuenta con que entró.
