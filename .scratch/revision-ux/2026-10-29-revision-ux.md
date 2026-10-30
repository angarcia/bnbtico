# Revisión UX sin anestesia · segunda ronda · 2026-10-29

Status: ready-for-agent · repasada punto por punto con Ana el 2026-10-29; pendiente de implementar cuando termine el otro agente (sin commits hasta entonces)

Las mismas dos pasadas que la del 2026-10-26 (diseñador obsesionado con la conversión; usuario que entra por primera vez), ahora sobre la app con la ronda de Ana del 2026-10-28 (Explorar al estilo Airbnb, búsqueda a pantalla completa, mapa en la lista, ficha cuadrada, Mis casas y Actividad nuevas, ficha editable, Calendario vertical, publicar sin cuenta). Árbol de trabajo del 2026-10-29 sobre `67a432c`, con cambios sin commitear (servidor local `127.0.0.1:5173`, Supabase local).

**Cómo se recorrió.** Datos de demostración propios: 5 casas activas con fotos reales en Cocles, Playa Negra, Manzanillo, Cahuita y Playa Chiquita (una con una sola foto, dos con alquiler mensual), un borrador sin fotos ni precio, una casa en revisión, dos consultas nuevas y visitas. Solo móvil: iPhone 13 (390×844) e iPhone SE (375×667), con cliente sin cuenta, búsqueda completa con zona, fechas y personas, hoja de contacto, Ingresar, y propietario con las cuatro casas. Dos pasadas iguales: una con Chrome emulando el iPhone y otra con **WebKit, el motor de Safari** (Playwright 1.64, WebKit 27.2). Las capturas están en `capturas-2026-10-29/` (Chrome) y `capturas-2026-10-29/webkit/` (no versionadas; los nombres van entre corchetes en cada punto), con el texto de cada pantalla en `textos.txt`. Escritorio queda fuera de esta revisión.

**Qué no cubre.** El WebKit de Playwright es el motor de Safari, pero en macOS, no iOS: no saca el teclado en pantalla ni los selectores nativos de fecha y número del iPhone, y la red es la local. Esos puntos (la hoja de contacto con el teclado abierto, el campo de zona de la búsqueda y los selectores de fecha) hay que mirarlos en un iPhone de verdad.

**Qué es «convertir».** Lo mismo que el 2026-10-26: (1) el cliente toca «Contactar por WhatsApp» y llega al chat; (2) el propietario publica, ve que le funciona y contesta rápido, y en el mes 13 paga. Las reglas que no se tocan siguen igual: el código de WhatsApp es obligatorio, WhatsApp es el único canal, usted, colones orientativos, presupuestos de JS y LCP. Los puntos que contradicen una decisión de la ronda de Ana van marcados **[Decisión]**.

**Regla de estilo (Ana, 2026-10-29).** Todo lo que se añada o se mueva usa los estilos que tiene hoy la app (`2f8021b` y siguientes), no los de las pantallas v2 del 28: botones tonales con transparencia y un solo verde lleno para la acción principal, esquinas de 8 px (6 las etiquetas, 12 las tarjetas), Figtree, sin contornos en los controles, ocre al 70 % y beige al 55 %. Las clases que ya existen (`btn`, `chip`, `card`, `list-item`, `note`…) antes que estilos nuevos. Las maquetas de esta revisión se hacen sobre la app real.

## Lo que ya funciona bien (no tocar)

- **Las fechas y las personas de la búsqueda llegan al mensaje.** Buscar «Cocles · 8–11 nov · 2 personas», abrir una casa y tocar «Contactar» deja la hoja con «¿Está disponible del 8 al 11 de noviembre para 2 personas?» [c20-hoja-con-busqueda]. Es justo lo que pidió Ana y quita trabajo al cliente.
- **Contactar sin cuenta** ya no pierde la intención: «Continuar» en la hoja, «Un paso y le escribe a Yorleny» con la casa arriba, y el error con el número vacío dice la verdad («Escriba su número de WhatsApp.») [c10, c11, c11c]. C2 y A6 de la ronda anterior, resueltos.
- **La ficha** cabe en un iPhone SE con la barra de contacto entera, el nombre y las cifras visibles [s02-ficha]. C3 de la ronda anterior, resuelto.
- **La ficha editable** es clara: qué se cambia al momento y qué pasa por revisión, «Compartir ficha» con el enlace debajo, visitas y consultas de 30 días y la oferta con su fecha [p03b].
- **Búsqueda** («¿Dónde?» filtra al escribir «coc» → Cocles; resumen «8–11 nov» al cerrar la tarjeta) [c03c, c05].

---

## Crítico: frena la conversión hoy

### C1. Actividad esconde las consultas nuevas debajo de cuatro fotos gigantes
[p08-actividad, p08b-actividad-completa]

**Diseñador:** la pestaña lleva el contador rojo «2» y es lo único de la app que significa dinero para el propietario: alguien le quiere alquilar. Al abrirla, la primera pantalla entera son cuatro tarjetas cuadradas con foto; dos de ellas (el borrador y la casa en revisión) no tienen ni una cifra que enseñar. «Últimas consultas» empieza a dos pantallas y media de scroll. El contador promete algo que la pantalla no enseña.
**Usuario (propietario):** «Me salió un 2 en rojo. Abro… mis casas otra vez. ¿Dónde está lo nuevo?». Si no baja, el cliente espera, le escribe a otro y se pierde la consulta. Contestar rápido es lo que hace que el propietario vea que bnbtico le funciona.

**Arreglo** (`src/client/screens/actividad.tsx`, `global.css`):
- Si hay consultas nuevas, **«Últimas consultas» va arriba**, con las nuevas primero y sus chips por casa; las cifras de cada casa van debajo.
- **Fuera de Actividad las casas sin cifras**: el borrador y la casa en revisión no tienen visitas ni consultas, y ya salen en Mis casas.
- Las tarjetas de cifras, más bajas: con dos casas o más, la foto como miniatura y las tres cifras al lado, no una foto cuadrada de media pantalla. **[Decisión]** (G de la ronda de Ana pide foto cuadrada de dos en dos).

**Hecho cuando:** con una consulta nueva, a 375×667 se ve la consulta y su «Abrir WhatsApp» sin hacer scroll; el borrador no sale en Actividad.

> **Acordado (2026-10-29, Ana).** Sustituye las tarjetas por casa de la decisión G de su ronda.
> - **La pestaña pasa a llamarse «Consultas» y solo tiene consultas**: las nuevas primero, cada una con la miniatura de la foto y el nombre de su casa encima (así se distinguen casas de nombre parecido, como «Casa Limón» y «Casita Limón»), y bajo el título «N consultas nuevas».
> - **Chips por casa con «Todas» por defecto**; con una sola casa, sin chips.
> - **Sin cifras ni tarjetas de casas en Consultas.** Las cifras de 30 días (visitas, toques en WhatsApp y consultas) **suben en el detalle de la casa** a una tarjeta bajo la portada, con las clases de hoy (`card` + `activity-figures`), sin enlace a las consultas (para eso está la pestaña). Sustituye la línea pequeña del final.
> - **La portada del detalle de la casa pasa a 4:3** (hoy es apaisada, 800×340).
> - **Etiqueta «Nueva»: con el estilo del botón «Descartar borrador» publicado** (`.btn-outline-bad`): fondo terracota al 12 % (`color-mix(in srgb, var(--brand) 12%, transparent)`) y letra `--brand-ink` (#B44C30). Ver C3.
> - Maqueta sobre la app real: `maquetas/consultas-despues.png` y `maquetas/detalle-4x3.png` (antes: `consultas-antes.png`, `detalle-antes.png`).
> - Descartado: comparar casas, el desplegable y reglas sobre los nombres (únicos, zona o CT según el caso).
> - Anotar en `docs/decisiones.md` como decisión de Ana al implementarlo.

### C2. La primera pantalla de Explorar no enseña ninguna casa
[c01-explorar, s01-explorar, c06-resultados, c02b-mapa-pantalla]

**Diseñador:** en un iPhone 13, la primera pantalla es la píldora, la fila de filtros, «5 casas en Limón», un mapa de unos 220 px de alto que es casi todo mar y la parte de arriba de una foto. Ni un nombre ni un precio de casa. En el SE, igual. **En Safari es peor:** sin `requestIdleCallback`, el mapa se carga con un `setTimeout` de 1,5 s (`src/shared/idle.ts`) y los marcadores aparecen a los 2,4 s incluso en local; hasta entonces, lo más grande de la pantalla es una caja beige vacía [webkit/c01-explorar, webkit/c06-resultados, webkit/c01c-explorar-mapa-cargado]. En el mapa, con cinco casas, dos marcadores se pisan («₡95 000» queda tapado por «₡55 000» y se lee «₡95 ᴼᴼᴼ»). En los resultados de Cocles, los marcadores se cortan en los bordes («₡95 000» pegado a la izquierda y «₡55 000» a la derecha), porque el encuadre no deja margen.
**Usuario (cliente):** «¿Esto es un mapa de Limón? ¿Dónde están las casas?». Para quien llega desde un enlace de WhatsApp o Instagram, la primera impresión es un mapa a medio cargar y no un catálogo.

**Arreglo** (`src/client/screens/explorar.tsx`, el mapa de la lista):
- **El mapa más bajo**, de unos 160–180 px, para que asome la primera casa con su nombre y su precio en la primera pantalla (a 390×844, y a 375×667 al menos la foto y el nombre). Sigue siendo el primer elemento de la lista y sigue abriendo el mapa a pantalla completa. **[Decisión]** (A de Ana fija el mapa como primer elemento; no dice su alto).
- El encuadre con margen (`fitBounds` con `padding` de medio marcador) para que ningún precio se corte.
- Si dos marcadores se pisan, se juntan en uno («2 casas») o se separa el segundo.
- Mientras carga, la caja no debe quedar vacía: los precios como etiquetas sobre un fondo plano del Caribe (o el mapa estático de la zona) desde el primer pintado, y Leaflet encima cuando llegue. En Safari, empezar la carga al pintar, no 1,5 s después.

**Hecho cuando:** a 390×844, sin scroll, se ve el nombre y el precio de una casa; ningún marcador queda tapado ni cortado con las cinco casas de prueba.

> **Acordado (2026-10-29, Ana). Baja a alto impacto; la estructura de Explorar no se toca.** Medido en la app real a 390×664 (lo útil de un iPhone 13 con las barras de Safari): con el mapa a 140 px tampoco cabe el nombre de la primera casa (su foto mide ~270 px) y los marcadores se cortan, así que el primer punto del arreglo se descarta. El alto del mapa (220 px), las tarjetas y el orden se quedan **como están hoy** en `/explorar` (capturas `maquetas/explorar-actual-220.png` y `explorar-mapa-140.png`). Se hace solo:
> 1. **Que el mapa no salga vacío en Safari:** empezar a cargarlo al pintar (no 1,5 s después) y, mientras llega Leaflet, enseñar ya los precios sobre el fondo.
> 2. **Marcadores:** encuadre con margen para que ninguno se corte en el borde, y los que se pisan, juntados en uno («2 casas»).
>
> Nuevo «hecho cuando»: en Safari, la caja del mapa nunca se ve lisa y vacía; con las cinco casas de prueba y con los resultados de Cocles, ningún marcador queda tapado ni cortado. Las dimensiones de Explorar no cambian.

### C3. Botones, etiquetas y filtros se ven iguales
[maquetas/muestrario-1-actual.png]

**Diseñador (Ana, 2026-10-29):** tras `2f8021b`, el botón secundario (`btn-ghost`/`btn-soft`, verde al 14 %), el chip elegido (verde al 26 %) y la etiqueta «Activa» (`badge-ok`, mezcla equivalente al 14 %) son el mismo verde con la misma letra verde oscura; el chip sin elegir y la etiqueta «Borrador» llevan el mismo beige; las esquinas son 8, 8 y 6 px. Solo cambia la altura (44, 40 y 28 px). **Usuario:** no sabe qué se toca (botón), qué se elige (filtro) y qué es solo un estado (etiqueta); «Activa» con «Parar suscripción» debajo forman un único bloque verde.

> **Acordado (2026-10-29, Ana). Se queda todo como está hoy.** Tras ver varias hojas (`maquetas/muestrario-*.png`: etiquetas en píldora, con punto de color, con transparencias, chip oscuro, terracota al 22 % con letra al 85 %), Ana prefiere los estilos actuales:
> - **Botones:** como hoy, incluido el terracota (`.btn-outline-bad`: terracota al 12 % con letra `--brand-ink`), que le gusta en «Descartar borrador».
> - **Filtros:** como hoy (beige sin elegir; verde claro al 26 % con ✓ elegido).
> - **Regla de forma (Ana, 2026-10-29): lo que informa y no se toca, redondo; lo que se toca, rectángulo de 8 px.** Redondo (`border-radius: 999px`): etiquetas de estado, «Nueva», «Revisión» y las etiquetas sobre las fotos (`.pill`: precio «₡25 000 / noche», contador «1 / 5»). Rectángulo de 8 px, como hoy: botones y filtros (chips). «5 fotos · Editar» se toca, así que se queda rectangular.
> - **Etiquetas: sin punto y redondas (píldora), con sus colores de hoy.** Todas: las de las fotos (`.state`: Activa, Borrador, En revisión…), las de las tarjetas (`.badge`) y «Revisión» (`.tag-rev`). Se quita el punto (`.state::before`) y pasan a `border-radius: 999px`, como en las maquetas de A4 (`maquetas/borrador-despues.png`, `revision-despues.png`). Los colores no cambian, salvo «Nueva» (abajo).
> - **Campos de texto con una línea fina (Ana, 2026-10-29):** hoy no tienen borde (`border: 1.5px solid transparent`) y se ven raros. Pasan a **1 px en el color de las líneas de la app** (`--line`, opción C de `maquetas/campos-linea.png`): `input`, `textarea`, `select` y la caja `.input-money` (sin repetir la línea en el `input` de dentro). El selector «+506» (`.input-prefix .prefix`) es un botón y se queda sin línea. El foco sigue como hoy.
> - **«Ingresar» de la cabecera de Explorar, como enlace de texto** (Ana, 2026-10-29): texto verde (`--primary`) subrayado, sin fondo, en vez del verde tonal que hoy lo confunde con los filtros y con «₡» elegido. Con sesión sigue el círculo con las iniciales. Maqueta: `maquetas/ingresar-opciones.png` (opción A); descartados el texto oscuro, el terracota (quitar) y el ocre (dinero).
> - **Todo lo terracota, como el botón «Descartar borrador» publicado** (fondo `--brand` al 12 %, letra `--brand-ink`). Lo único que cambia es «Nueva», que hoy es terracota del logo sólido con letra crema (`global.css:536`) y pasa a ese estilo.

---

## Alto impacto

### A1. Calendario abre a mitad de pantalla y esconde sus propios controles
[p06-calendario, p06c-calendario-al-abrir, p06d-calendario-arriba]

**Diseñador:** la pantalla abre desplazada 360 px hacia abajo: arriba se ve directamente «Noviembre 2026». Quedan ocultos el título, **qué casa se está editando** (con varias casas, el selector), «Cerrar la casa hasta…» y **los días que quedan de esta semana** (el 29, 30 y 31 de octubre, hoy jueves).
**Usuario (propietario):** «Quiero bloquear este fin de semana, que ya lo alquilé por fuera… ¿dónde está el viernes?». Y con dos casas: «¿Esto es la Cabina o la Casa?».

**Arreglo** (`src/client/screens/calendario.tsx`): abrir arriba del todo, o desplazar solo hasta la semana actual sin pasarla (la fila de hoy, no el mes siguiente). El nombre de la casa (o su selector), fijo arriba al desplazar.

**Hecho cuando:** al abrir Calendario se ven el nombre de la casa, «Cerrar la casa hasta…» y el día de hoy, sin tocar nada.

> **Acordado (2026-10-29, Ana).** Como se propone: abrir arriba del todo (título, casa, «Cerrar la casa hasta…» y el mes actual con los días que quedan de esta semana) y el nombre o selector de la casa fijo arriba al desplazarse por los meses. Sin cambios de diseño.

### A2. Suscripción: lo más visible de cada casa es «Parar suscripción»
[p09-suscripcion]

**Diseñador:** en plena oferta gratuita, cada casa tiene un único botón grande, y es para irse. El dato que retiene (lo que la casa le ha dado: visitas y consultas) no está; «Quedan 45 de 50» (la escasez, que empuja a publicar más casas) va al final, debajo del método de pago. Y la pantalla termina con un bloque ocre de 11 líneas de «Cómo funciona».
**Usuario (propietario):** «¿Parar? ¿Me van a cobrar ya?». El botón pone la idea de irse en la cabeza de alguien que no paga nada.

**Arreglo** (`src/client/screens/suscripcion.tsx`):
- Por casa: estado, «Gratis hasta el 29 oct 2027» y «21 visitas · 1 consulta en 30 días». **«Parar suscripción» pasa a enlace discreto** al final de la casa, con su confirmación de siempre.
- «Cómo funciona», plegado («¿Cómo funciona el cobro?») y sin fondo ocre (ver A6).

**Hecho cuando:** en Suscripción no hay ningún botón relleno de «Parar»; cada casa enseña sus cifras.

> **Acordado (2026-10-29, Ana).** Maqueta sobre la app real: `maquetas/suscripcion-activa-e-inactiva.png` (y la confirmación en `suscripcion-parar-despues.png`; antes: `suscripcion-antes.png`). Botones y etiquetas con los estilos de hoy (C3).
> - **Orden de la pantalla:**
>   - **Si alguna casa necesita algo** (inactiva o pendiente de pago): Oferta de lanzamiento → Sus casas (esas casas primero) → Método de pago → «¿Cómo funciona el cobro?».
>   - **Si todas están al día:** Oferta de lanzamiento → Método de pago → «¿Cómo funciona el cobro?» → **Sus casas, abajo del todo**. Coherente con la decisión D de la ronda de Ana (la suscripción, arriba solo si falta algo).
>   - La tarjeta de la oferta, **arriba del todo** mientras queden plazas; cuando se cubran las 200, se quita.
> - **Casa activa:** estado (etiqueta como hoy), «Gratis hasta…» (o el precio, si ya no está en oferta), **sus cifras de 30 días** («44 visitas · 1 consulta en 30 días»), los avisos y, al final, **«Parar suscripción» como texto gris subrayado y centrado** (`btn-text`). Al tocarlo, la hoja de confirmación de siempre; su botón «Parar suscripción», en el terracota tonal de hoy (`.btn-outline-bad`, como «Descartar borrador»), y «Cancelar» en verde tonal.
> - **Casa inactiva o pendiente de pago:** etiqueta «Inactiva» con el estilo de etiqueta de hoy; justo debajo de su estado, **«Activar suscripción» en ocre** (`btn-sun`, ancho completo); debajo, si conserva plaza, «Mantiene su plaza de la oferta: gratis hasta…».
> - **«Cómo funciona»**, plegado en una fila «¿Cómo funciona el cobro?» con su ›, sin fondo ocre.
> - Se descartaron: «Parar» como botón de ancho completo (verde o terracota) y como enlace pegado a la izquierda.

### A3. Mis casas: lo que pide acción queda en medio, y cuatro casas son ocho pantallas
[p02b-mis-casas-completa]

**Diseñador:** el orden es «En revisión», «Borrador», «Activa», «Activa». El borrador (lo único que necesita que el propietario haga algo) queda en segundo lugar, entre una casa que no se puede tocar y las activas. Cada tarjeta es una foto cuadrada a todo el ancho más botones: con cuatro casas, unos 6 600 px, es decir, ocho pantallas. Los recuadros de arriba cuentan «2 activas» y «1 en revisión», pero no el borrador.
**Usuario (propietario):** «Tenía algo a medias… ¿dónde?».

**Arreglo** (`src/client/screens/propietario.tsx`):
- **Orden por acción pendiente**: primero lo que necesita algo del propietario (cambios pedidos, pendiente de pago, borrador), luego las activas y al final lo que está en revisión.
- Recuadro «1 borrador» junto a los otros dos, que lleve al borrador.
- Con tres casas o más, la foto a media altura (4:3) en vez de cuadrada. **[Decisión]** (B de Ana: una casa por fila con foto cuadrada).

**Hecho cuando:** con un borrador, es la primera tarjeta de Mis casas.

> **Acordado (2026-10-29, Ana).** (1) Orden por acción pendiente: cambios pedidos, pendiente de pago, inactiva y borrador primero; luego las activas; al final las que están en revisión (el mismo criterio que Suscripción en A2). (2) Recuadro «N borradores» junto a «activas» y «en revisión», que lleva al borrador (o a la lista filtrada si hay varios). (3) **La foto se queda cuadrada** (decisión B de su ronda); se descarta el 4:3 en Mis casas y se revisa solo si con muchas casas resulta pesado.

### A4. El detalle de un borrador abre con un botón que no funciona
[p04-casa-borrador, p05-casa-revision]

**Diseñador:** la primera fila es «Compartir ficha · Disponible cuando la casa esté activa», en gris y con su flecha, que parece tocable y no hace nada. La acción que importa, «Seguir con el borrador», es una fila más. Pasa lo mismo en la casa en revisión.
**Usuario (propietario):** toca «Compartir ficha», no pasa nada. «¿Está roto?».

**Arreglo** (`src/client/screens/casa-editable.tsx`): en borrador, **«Seguir publicando» como botón relleno** arriba, debajo de la portada, con lo que falta («Falta: fotos y precio»); «Compartir ficha» no sale hasta que la casa esté activa. En revisión, sin fila de compartir; basta la línea «La estamos revisando…».

**Hecho cuando:** en un borrador no hay ninguna fila desactivada y el botón relleno es «Seguir publicando».

> **Acordado (2026-10-29, Ana).** Maquetas: `maquetas/borrador-despues.png` y `revision-despues.png` (antes: `borrador-antes.png`, `revision-antes.png`). Con la portada 4:3 de C1; etiquetas y botones como hoy (C3).
> - **Borrador:** bajo la portada, «Seguir publicando» como botón principal (`btn-primary`) con «Falta: …» debajo (lo que falta para enviarlo, de `validateAll`); fuera la fila «Seguir con el borrador» y la de «Compartir ficha». Quedan «WhatsApp de esta casa» y «Descartar borrador», como hoy.
> - **En revisión:** fuera la fila de «Compartir ficha»; la nota «La estamos revisando…» pasa del ocre al beige grisáceo de «Revisión» (`--review-soft`); la etiqueta, como hoy.
> - «Compartir ficha» solo aparece con la casa activa.

### A5. Cambiar el nombre no avisa de que pasa por revisión
[p03c-editar-campo, p03b-casa-activa-completa]

**Diseñador:** en el detalle, «Nombre» lleva la etiqueta «Revisión», pero la pantalla del campo solo tiene el texto y «Guardar». Nada dice que el cambio no se verá hasta que lo aprobemos ni que mientras tanto sigue «Casa Mono Congo». Pasa lo mismo con Tipo, Descripción y Ubicación.
**Usuario (propietario):** guarda, vuelve, ve el nombre viejo en la ficha pública. «No se guardó». Lo vuelve a intentar o nos escribe.

**Arreglo** (`src/client/screens/editar.tsx`): en los campos con revisión, encima del botón: «Este cambio lo revisamos antes de publicarlo, normalmente en menos de 24 horas. Mientras tanto los clientes ven «Casa Mono Congo».», y el botón dice **«Enviar a revisión»** en vez de «Guardar».

**Hecho cuando:** en los cuatro campos con revisión, el botón dice «Enviar a revisión» y la pantalla nombra el valor que sigue visible.

> **Acordado (2026-10-29, Ana). Cambia el flujo de edición: sin «Enviar a revisión» general y revisión campo por campo.** Lo que pasa hoy (probado en local, `maquetas/flujo-1b-arriba.png`): al guardar el nombre, la casa queda en «Edición sin enviar», sale un bloque ocre arriba con un «Enviar a revisión» general y «Descartar cambios», y el aviso «Guardado. Envíelo a revisión cuando termine.». El propietario tiene que volver a enviarlo, y el admin revisa la edición entera de golpe.
> - **Propietario:** en los campos con revisión (nombre, tipo, descripción, ubicación y cada foto nueva), el botón dice «Enviar a revisión» y **ese cambio va directo a revisión**; la pantalla del campo nombra la casa bajo el título y avisa: «Este cambio lo revisamos antes de publicarlo, normalmente en menos de 24 horas. Mientras tanto los clientes ven «…».» (`maquetas/editar-nombre-despues.png`). Fuera el estado «Edición sin enviar», el bloque ocre y el botón general. En el detalle, cada campo pendiente enseña su nuevo valor con la etiqueta «En revisión» y su propio «Descartar».
> - **Se acumula:** se puede cambiar otro campo (o el mismo otra vez) mientras hay cambios en revisión; para cada campo cuenta **el último valor enviado**. Desaparece la regla «una sola edición a la vez» (decisión D de la ronda de Ana).
> - **Admin, campo por campo:** al abrir la casa ve cada campo pendiente con el valor aprobado y el último enviado, y **aprueba o pide cambios en cada uno por separado** (con nota propia). Se puede aprobar el nombre y pedir cambios en una foto. Lo aprobado se publica al momento; lo demás sigue pendiente.
> - **Si el propietario cambia un campo mientras el admin lo tiene abierto**, el admin no puede aprobar el valor viejo: se le pide volver a abrirlo (hoy ya existe ese control con `submitted_at`; pasa a ser por campo).
> - **Base de datos:** `listing_edits` guarda hoy una fila por casa con un único estado; pasa a estado, nota, fecha de envío y revisor **por campo** (columnas por campo o una tabla `listing_edit_fields(listing_id, field, value, status, note, submitted_at…)`), y `listing_edit_photos` lleva su propio estado por foto. RPC de revisión por campo; políticas y prueba de contrato antes que pantalla. Migración nueva con relleno de las ediciones abiertas (con `app.allow_status` si toca `listings`, ver memoria de migraciones).
> - Anotar en `docs/decisiones.md` como decisión de Ana: sustituye «una sola edición a la vez» y la revisión de la edición entera.

### A6. El ocre se usa para todo y deja de avisar de dinero
[p03b, p03d-editar-fotos, p09-suscripcion, p02b, p08-actividad]

**Diseñador:** la regla de la ronda de Ana (B) dice: ocre solo para dinero y avisos de pago. Hoy lo llevan la nota «Toque un dato para cambiarlo…», las etiquetas «Revisión», la nota de las fotos, el «Cómo funciona» de Suscripción, la etiqueta «Borrador» y el fondo de la tarjeta del borrador. Cuando en el mes 12 llegue el aviso de pago en ocre, será una caja amarilla más.

**Arreglo** (`global.css` y esas pantallas): esas notas, en el gris verdoso de las notas informativas (`--surface-2` o el de «Las fechas y las personas van en el mensaje…» de la búsqueda); las etiquetas «Revisión» y «Borrador», neutras. El ocre queda para la oferta, el precio, «Activar suscripción», «Añadir método de pago» y la fila de pago cuando falta algo.

**Hecho cuando:** fuera de dinero y pago no queda ningún fondo ocre en las pantallas del propietario.

> **Acordado (2026-10-29, Ana).** Corrección: no era ocre sino el beige arena de la marca (`--surface-2`, #F6E7C8); el ocre (`--sun`) solo está en dinero y pago, y se queda. Maquetas (antes a la izquierda, después a la derecha): `maquetas/arena-1-detalle.png`, `arena-2-fotos.png`, `arena-3-como-funciona.png`, `promo-paso9.png`.
> - **Notas informativas en blanco** (tarjeta `--surface` con la sombra de las demás), en vez de arena: «Toque un dato para cambiarlo…» (detalle de la casa), «El orden y las fotos que quite…» (editor de fotos) y «Cómo funciona» de Suscripción (que además va plegado, A2). Clases `.note-arena` y `.card-arena` donde son notas, no chips ni etiquetas.
> - **La nota de la oferta del paso 9** (`.offer-line`: «Si está entre las próximas 45 casas…», «₡0 · 12 meses»): **blanca con todo el texto en el marrón de pago** (`--sun-ink`), igual que la tarjeta «Oferta de lanzamiento» de Suscripción (`.offer-card`).
> - Chips, selector ₡ | $, etiqueta «Borrador» y el hueco de foto vacía siguen en arena.

### A7. Filtros: la zona y «mensual» salen dos veces, y se contradicen
[c07b-filtros-completa]

**Diseñador:** arriba, «Su búsqueda · Zona: Cualquier zona»; debajo, «ZONA: Todas | ✓ Limón». La misma pantalla dice a la vez «cualquier zona» y «Limón». «Solo alquiler mensual» es el chip de Explorar y también otra casilla más entre las características.
**Usuario:** «¿Cuál de las dos zonas cuenta?».

**Arreglo** (`src/client/screens/filtros.tsx`): una sola fila de zona en «Su búsqueda», que resuma provincia y zona («Limón · Cocles» o «Todo Limón»), y fuera el bloque «ZONA» de provincias; o, si se queda, que la fila diga «Limón». «Solo alquiler mensual», fuera de «Qué necesitan» (ya está en Explorar) o como interruptor propio arriba, una sola vez.

**Hecho cuando:** en Filtros, cada criterio aparece una vez y su valor coincide con la píldora de Explorar.

> **Acordado (2026-10-29, Ana).** Maqueta (antes a la izquierda, después a la derecha): `maquetas/filtros.png`. (1) Una sola fila «Zona» en «Su búsqueda», que resume provincia y zona («Todo Limón», «Limón · Cocles»); fuera el bloque «ZONA · Todas | Limón». (2) «Solo alquiler mensual» sale de «Qué necesitan» (ya está en Explorar). (3) Cuando haya casas en otras provincias, la provincia se elige en «¿Dónde?», con las zonas agrupadas por provincia.

### A8. Sin cuenta, la app no tiene ninguna puerta para publicar
[c01b-explorar-completa, c12-favoritos-vacio, c14b-cuenta-sin-sesion-completa]

**Diseñador:** «Publicar mi casa» solo existe en la portada. Quien llega a la app por un enlace de una ficha o de Explorar (el caso normal tras el lanzamiento, porque los propietarios también miran casas) no encuentra cómo publicar: ni en Explorar, ni en Favoritos, ni en Ingresar. Con sesión sí aparece, escondida en Cuenta. El asistente sin cuenta (§E de Ana) ya está hecho; le falta la puerta.
**Usuario (propietario):** «Vi la casa de mi vecina en bnbtico. ¿Cómo pongo la mía?». Busca y se va.

**Arreglo:** al final de Explorar, junto a «¿No encuentra lo que busca?», una tarjeta «¿Tiene una casa en el Caribe? Publíquela gratis 12 meses» que lleve a `/publicar`; y en Ingresar, un enlace «¿Quiere publicar una casa?». Mientras dure la oferta, con el número de plazas que quedan.

**Hecho cuando:** sin sesión, desde Explorar se llega al paso 1 del asistente en un toque.

> **Acordado (2026-10-29, Ana).** Maquetas: `maquetas/publicar-explorar-dorado.png` (la de la derecha) y `publicar-ingresar.png`.
> - **Explorar:** al final de la lista, encima de «¿No encuentra lo que busca?», una tarjeta con el estilo de la oferta (`.offer-card`: blanca, título y letra pequeña en el marrón dorado `--sun-ink`): «¿Tiene una casa en el Caribe?», «Publíquela gratis 12 meses. **Quedan N de 50 plazas.**», «Después, ₡2 900 al mes por casa. Sin comisiones; los clientes le escriben por WhatsApp.» y el botón **«Publicar mi casa gratis» en ocre** (`btn-sun`), que lleva a `/publicar`. Las plazas, de la misma consulta que la oferta de Suscripción; sin plazas, la tarjeta dice el precio y el botón «Publicar mi casa».
> - **Ingresar (y Mi cuenta sin sesión):** bajo «No tengo acceso a mi WhatsApp», una fila **en ocre**, con el mismo fondo que el botón de Explorar (`--sun` al 70 %, como `btn-sun`) y letra oscura: «¿Quiere publicar su casa gratis?» · «Gratis 12 meses · quedan N de 50 plazas», que lleva a `/publicar`. La fila «Publicar mi casa» de Cuenta con sesión, igual en ocre.
> - Se descartó el botón verde: la promoción va en ocre, como todo lo de dinero.

### A9. Paso 9: «Falta el precio» parece un dato más
[p11-asistente-9]

**Diseñador:** a la casa le falta el precio (obligatorio), pero el resumen lo dice en el mismo gris que el resto, la barra de progreso está entera y «Enviar a revisión» está activo. Además, la cabecera de este paso dice «Precio · 2 de 2» cuando es «Revisar y enviar».
**Usuario (propietario):** toca «Enviar» y le sale un error; o, peor, cree que ya lo envió.

**Arreglo** (`src/client/screens/publicar.tsx`, `src/client/publish/wizard-parts.tsx`): las filas incompletas y obligatorias, en terracota con «Añadir precio →»; el segmento de la barra de ese paso, sin llenar; y, con algo obligatorio pendiente, el botón dice «Falta el precio» y lleva al paso 8. La cabecera del paso 9, «Revisar y enviar».

**Hecho cuando:** un borrador sin precio no puede tocar «Enviar a revisión» sin saber antes qué falta.

> **Acordado (2026-10-29, Ana).** Maqueta (hoy a la izquierda, propuesta a la derecha): `maquetas/paso9.png`. (1) La cabecera del paso 9 dice «Revisar y enviar · último paso». (2) En la barra de progreso, el segmento del paso que falta queda vacío. (3) La fila obligatoria que falta (hoy solo el precio; las fotos y la descripción no lo son) va en el terracota de «Descartar borrador» (fondo `--brand` al 12 %, texto `--brand-ink`) con «Añadir precio ›». (4) El botón principal **siempre dice «Enviar a revisión» y queda desactivado** mientras falte algo obligatorio (Ana); para ir a lo que falta está la fila en terracota. (5) **Botones del asistente, en todos los pasos:** «Atrás» pasa a un botón cuadrado de 56 px con solo la flecha ‹ (fondo tonal, `aria-label="Atrás"`), y «Continuar ›» con texto y flecha a la derecha (iconos de la app, no el carácter). En el último paso, ‹ y «Enviar a revisión» sin flecha. Maquetas: `maquetas/navegacion-minimalista.png` (opción C) y `navegacion-flechas-solas.png` (el último paso); se descartaron las dos flechas solas (E y F) y «‹ Atrás» con texto. (6) Sin línea de aviso extra bajo la oferta (queda tapada por la barra de abajo y no hace falta). La nota de la oferta va en blanco con texto marrón (A6).

---

## Detalles para pulir

### N1. Textos cortados en la cabecera de Explorar
[c06-resultados, c08-mensual, s01-explorar]
La píldora corta las personas («Cocles · 8–11 nov · 2 p…»), en el SE corta «Empiece su búsque…» y el chip activo se queda en «✓ Solo alquiler mens…». **Arreglo:** abreviar el resumen a «Cocles · 8–11 nov · 2 pers.» y, con el chip activo, quitar la palomita o usar «Mensual» en el chip. **[Decisión]** si se cambia el texto del chip.

> **Acordado (2026-10-29, Ana).** Maqueta: `maquetas/n1-pildora.png`. La píldora de búsqueda hoy no lleva fechas («Cocles · 2 personas») y no se corta: se queda como está. **El chip activo pasa a «✓ Mensual»** (sin activar sigue «Solo alquiler mensual»), porque hoy se corta en «✓ Solo alquiler mens…» (iPhone 13) y «me…» (SE).

### N2. Hoja de contacto: los campos vacíos parecen rellenos
[c10-hoja-contacto, s03-hoja-contacto, webkit/c10-hoja-contacto, webkit/s03-hoja-contacto]
Sin personas, el control se lee «–  [–]  +»: el valor vacío es otro guion dentro de una caja, igual que el botón de restar; en Safari, además, el campo enseña las flechas ▲▼ del campo numérico al lado del guion. En Safari, las fechas vacías enseñan la de hoy en gris («2026-10-29» en llegada y en salida), que parece una estancia ya elegida de cero noches. **Arreglo:** el valor vacío de personas como «Sin indicar» en gris, sin caja que imite un botón y sin flechas (`appearance: textfield` y fuera `::-webkit-inner-spin-button`); las fechas vacías con su texto propio («Elegir fecha») en vez del valor gris del sistema. Comprobar en un iPhone real cómo salen los selectores nativos.

> **Acordado (2026-10-29, Ana).** Maquetas: `maquetas/n2-hoja-hoy.png` (Chrome y Safari hoy) y `n2-despues.png`. (1) **Las fechas de la hoja de contacto usan el mismo calendario de rango que «¿Cuándo?» de la búsqueda** (`src/client/range-calendar.tsx`, llegada y salida, con su terracota de selección), no el selector de fecha del sistema: dos casillas «Elegir fecha» (o la fecha elegida, «8 nov») que lo abren. Si la búsqueda ya tiene fechas, llegan elegidas, como hoy. Con «Solo alquiler mensual», una sola fecha «Desde», igual que en la búsqueda. (2) Personas: «− Sin indicar +», sin caja ni flechas ▲▼. (3) **El mensaje deja de ser editable en la hoja:** se muestra como vista previa, en gris claro y sin caja de texto, y se actualiza al cambiar fechas o personas; debajo, «Podrá añadir lo que quiera en WhatsApp antes de enviarlo.». Sale el campo «Su mensaje» y la nota «Puede editarlo aquí o en WhatsApp…»; la consulta guarda siempre el mensaje redactado. Así desaparecen las fechas grises de hoy en Safari y la incoherencia entre la hoja y la búsqueda (pendiente de la revisión anterior).

### N3. El dólar se escribe de otra manera
[c09-ficha, s02-ficha]
«≈ $2,843 / mes» lleva coma de miles, mientras los colones van con espacio («₡1 450 000»), y la línea mensual en dólares no va en negrita como la de colones. **Arreglo:** el mismo separador (espacio fino) y el mismo peso en las dos columnas: «≈ $2 843 / mes».

> **Acordado (2026-10-29, Ana).** Maqueta: `maquetas/n3-dolar.png`. Los dólares, con **espacio** para los miles, como los colones: «≈ $2 843 / mes» (no «$2,843»). Se descartaron la coma y el punto: en español la coma es decimal y el punto se lee como decimal en inglés; el espacio no se confunde en ningún país y es la regla del proyecto («₡95 000»). La cifra mensual en dólares, en negrita y oscura como la de colones; «/ mes» en gris normal.

### N4. El calendario de la ficha repite el mismo precio 30 veces **[Decisión]**
[c09b-ficha-completa]
Cada día del mes lleva «$186» (o «₡95 mil»), aunque ninguno cambie; los días con otro precio, que son lo que importa, no destacan. **Arreglo:** en la ficha del cliente, el precio solo en los días que no son el de base (con su ★), y la línea «Precio base…» debajo como hoy. El calendario del propietario sigue con el precio en cada casilla (C de Ana).

> **Acordado (2026-10-29, Ana). El calendario de la ficha del cliente se rehace; el del propietario no cambia.** Maquetas: `maquetas/n4-final.png` (sin el ocre de los días de precio distinto), `n4-todos-precios.png` (opción B) y `ficha-entera.png`.
> - **Precio en todos los días**, como hoy, pero **sin «₡»** dentro de la casilla («95 mil», «120 mil»; en dólares «$186»): el símbolo ya está en la barra de precios.
> - **Número del día pequeño (12 px) en la esquina superior izquierda** de la casilla, **con transparencia** (`--fg` al 55 %; en los ocupados, su terracota `--cal-busy-ink` también al 55 %). **El precio, centrado, sin negrita (600) y al 80 %** (`--state-ink` al 80 %), para que el calendario no se vea recargado (Ana, opción B de `maquetas/n4-transparencias.png`).
> - **Colores:** días libres en verde claro (como hoy), **también los de precio distinto** (Ana: con el precio en cada casilla ya se ve; sin ★ ni color propio); **ocupados en terracota con rayas y sin el texto «Ocupado»** (solo el número; el lector de pantalla dice «20 de noviembre, ocupado»).
> - **Sin márgenes laterales:** la rejilla va de borde a borde (como la foto de la ficha); la leyenda y la línea de debajo conservan su margen. Leyenda: «Disponible · Ocupado» con sus muestras; fuera «★ Precio distinto» y la línea «Precio base…; los días con ★ tienen otro precio».
> - **Solo para mirar, no interactivo:** el calendario está al final de la ficha y la barra de contacto es fija; las fechas se eligen en la hoja de contacto, que abre el mismo calendario que «¿Cuándo?» (N2). A3 (1–3) de la revisión del 2026-10-26 (elegir fechas en el calendario de la ficha) **pasa a la siguiente revisión**.

> **Sustituye lo anterior (Ana, 2026-10-29): la ficha reutiliza el formato del Calendario del propietario (C4)**, el mismo componente: casillas de 47 × 92 px, 6 px entre ellas y 14 px de margen; número centrado arriba y precio completo sin «₡» ni redondeo debajo, con sus transparencias; fondo de los días en verde al 6 %; ocupados en terracota con rayas y solo el número; sin ★ ni marca para el precio especial; días pasados del mes tachados y más claros; leyenda «Disponible · Ocupado». **La diferencia: en la ficha no se desplaza hacia abajo**: un mes a la vez, con ‹ › para cambiar de mes (como hoy), y solo para mirar. **Elegir días en el calendario de la ficha queda para la siguiente revisión** (Ana, 2026-10-29; sigue abierto lo de A3 de la revisión del 26). Quedan sin efecto el número en la esquina y el borde a borde de la versión anterior de N4.

### N5. El selector ₡ | $ en las pantallas del propietario
[p02b, p08-actividad]
Mis casas y Actividad ya no enseñan precios y siguen con el selector de moneda en la cabecera. **Arreglo:** el selector solo donde hay precios (Explorar, Favoritos, Calendario).

> **Acordado (2026-10-29, Ana).** El selector ₡ | $ solo en las pantallas con precios: Explorar, Favoritos y Calendario (y la ficha no lo tiene, decisión B de su ronda). Fuera de Mis casas, Consultas, el detalle de la casa y Cuenta.

### N6. Al abrir la búsqueda, un recuadro amarillo alrededor de «¿Dónde?»
[c03-buscar]
El foco que se pone al abrir la tarjeta sale con el anillo de teclado. **Arreglo:** foco en el campo «Busque una zona» (abre el teclado, que es lo que se quiere) o `:focus-visible` sin anillo para el foco puesto por código.

> **Acordado (2026-10-29, Ana).** Al abrir la búsqueda, el foco va al campo «Busque una zona» (abre el teclado) y sin anillo amarillo; el anillo sigue con `:focus-visible` para quien usa teclado.

### N7. Ayuda termina con la atribución de OpenStreetMap
[c17-ayuda]
«Límites administrativos © colaboradores de OpenStreetMap…» al pie de la ayuda por WhatsApp, sin mapa en la pantalla. **Arreglo:** moverla a «Términos y privacidad» o a debajo del mapa que use esos límites.

> **Acordado (2026-10-29, Ana).** Fuera de Ayuda la línea «Límites administrativos © colaboradores de OpenStreetMap…»; pasa a «Términos y privacidad» (requisito de la licencia ODbL). Los mapas siguen con su «Leaflet | © OpenStreetMap».

### N8. Un error en la consola en cada pantalla (técnico)
`src/client/chrome.tsx:20` registra la consulta `admin-queue` con `enabled: false` y sin `queryFn`; TanStack lo escribe como error en desarrollo en cada pantalla, también sin sesión. No lo ve el usuario, pero tapa los errores de verdad al depurar. **Arreglo:** leer el contador con `useQueryClient().getQueryData` y una suscripción a la caché, o darle el `queryFn` de `src/client/admin.ts`.

---

> **Acordado (2026-10-29, Ana).** Se corrige como se propone; sin cambio visible.

### N9. «Siguiente» de «¿Cuándo?» queda tapado
[maquetas/buscar-siguiente-13.png, buscar-siguiente-se.png]

Detectado por Ana en su iPhone. Medido con WebKit en el espacio útil de Safari: en un iPhone 13 (390 × 664) «Siguiente» está en 583–627 px y la barra fija «Borrar todo · Buscar» empieza en 588, así que queda debajo de ella; en un iPhone SE (375 × 553), del todo oculto (525 frente a 477). No lo tapa la barra de Safari sino nuestra propia barra de abajo: el calendario mide `min(52dvh, 420px)` y, sumado a «¿Dónde?», el título y el pie, no cabe encima de la barra. La barra de Safari no se puede ocultar desde la web (sí desaparece con la app instalada en la pantalla de inicio).

> **Acordado (2026-10-29, Ana): que «Siguiente» se vea siempre.** El alto del calendario se calcula con lo que queda libre (`100dvh` menos la cabecera, «¿Dónde?», el título, el pie con «Siguiente» y la barra de abajo con `env(safe-area-inset-bottom)`), de modo que el pie siempre quede encima de la barra; el calendario se desplaza por dentro. Prueba en WebKit a 390 × 664 y 375 × 553 que compruebe que «Siguiente» no queda bajo la barra. Alternativa si no basta en el SE: mover «Siguiente» a la barra de abajo mientras está abierta «¿Cuándo?» (como Airbnb).

## Tipografía y títulos (Ana, 2026-10-29)

### T1. Demasiada negrita
[maquetas/negrita-explorar.png, negrita-ficha.png, negrita-mis-casas.png, negrita-consultas.png]

Medido en la app: en la ficha, 44 textos a 700 o más y 72 a 600; en Mis casas, 17 a 700; el selector «₡» a 800. Incoherencias: en Explorar el precio de la tarjeta (700) pesa más que el nombre de la casa (600); en la ficha, «≈ $186» (700) más que «₡95 000» (600). La fuente es Figtree variable, así que bajar solo de 700 a 600 casi no se nota.

> **Acordado (2026-10-29, Ana). Opción B, con los títulos al 85 %.** Maquetas: `maquetas/titulos-*.png` (columna del 85 %).
> - **600:** títulos de pantalla y de casa (`h1`, `h2`, `.listing-title`, `.house-card-title`, `.flow-title`), precios principales y botón principal (`btn-primary`, `btn-wa`, `btn-sun`).
> - **500:** todo lo demás que hoy va a 600 o más: chips, etiquetas, botones secundarios, pestañas, «Empiece su búsqueda», «Ingresar», nombres en las consultas, cifras de Mis casas, selector de moneda (hoy 800), letras de los días de la semana, encabezados en versalitas.
> - **Títulos de casa y de pantalla en `--fg` al 85 %** para que no compitan con el precio y los botones; el precio queda al 100 %.
> - Corregir las incoherencias: precio de la tarjeta al mismo peso que el nombre; «≈ $» al mismo peso que «₡» en la ficha.
> - Una sola escala en `global.css` (variables de peso) en vez de pesos sueltos; revisar `contrast.test.ts` con el 85 %.

### T2. Sin títulos en las pestañas
[maquetas/sin-titulos.png, mis-casas-mas.png]

> **Acordado (2026-10-29, Ana).** Las pestañas **Mis casas, Consultas, Favoritos y Calendario no llevan título visible** (la pestaña de abajo ya dice dónde se está); el `h1` se queda solo para lectores de pantalla (`sr-only`, como Explorar). **Títulos de sección:** solo se quita «Últimas consultas» (repite la pantalla). Se quedan los que explican lo que viene debajo: «Disponibilidad» y «Zona aproximada» en la ficha, «Para quiénes», «Qué necesitan» y «Precio orientativo por noche» en Filtros, y los bloques de Cuenta y del asistente. Lo demás de cada pantalla se queda como está.
> - **Mis casas:** el botón «Nueva casa» sigue junto a las cifras de «activas» y «en revisión», del mismo alto, **sin fondo verde**: recuadro transparente con la línea fina de los campos (`--line`) y el «+» en verde (`aria-label="Nueva casa"`).
> - **Calendario:** el selector de casa y «Cerrar la casa hasta…» suben al hueco del título (A1).
> - **Favoritos:** sin «Favoritos» arriba; la lista empieza bajo la barra.

## Navegación y cuenta (Ana, 2026-10-29)

### C4. La cuenta pasa a la barra de abajo y fuera la barra superior con el logo
[maquetas/cuenta-pestana.png]

> **Acordado (2026-10-29, Ana).**
> - **Viajero (sin sesión o sin casas):** tres pestañas, **Explorar · Favoritos · Ingresar** (icono de persona); con sesión, «Ingresar» pasa a **«Cuenta»**. Fuera «Ingresar» de la cabecera de Explorar (deja sin efecto lo acordado en C3 sobre el enlace subrayado) y **la píldora «Empiece su búsqueda» ocupa todo el ancho**; el hueco de «Ingresar» queda libre (se descartó poner ahí un botón de publicar: un «+» suelto confunde al viajero y «+ Publicar» corta la búsqueda; publicar ya tiene sus puertas en A8 y C5). Maqueta descartada: `maquetas/explorar-publicar.png`.
> - **Propietario:** cinco pestañas, **Explorar · Mis casas · Calendario · Consultas · Cuenta**. **Favoritos sale de la barra y pasa a una fila de Cuenta** (con su contador). Tope de cinco pestañas (`MAX_TABS`), sin cambiar.
> - **Fuera la barra superior con el logo en Mis casas, Calendario y Consultas** (en Favoritos el logo se queda en el hueco de arriba, ver abajo); el contenido empieza arriba, respetando la zona segura del iPhone. El logo no hace falta en ninguna pestaña (Ana: se puede valorar dejarlo en Cuenta, pero no es necesario).
> - **Favoritos:** en el hueco de arriba, **el logo a la izquierda y ₡ | $ a la derecha** (la barra de hoy sin «Ingresar»). Maqueta: `maquetas/favoritos-calendario.png`.
> - **Calendario del propietario:** arriba, **el selector de casa y ₡ | $ en la misma fila**, y debajo «Cerrar la casa hasta…». Maqueta: `maquetas/favoritos-calendario.png`.
> - **Selector ₡ | $ (sustituye N5):** en Explorar, Favoritos y el Calendario del propietario; fuera de Mis casas, Consultas, el detalle de la casa y Cuenta.
> - **Calendario del propietario, arriba:** el selector de casa **a todo el ancho**; ₡ | $ en la fila de «Toque los días para editarlos», a la derecha. Maqueta: `maquetas/calendario-propietario-arriba.png`.
> - **Calendario del propietario, rejilla:** **margen lateral mínimo (4 px)** en vez del de la página; **la fila L K M J V S D en la misma rejilla y con el mismo margen** que las casillas, para que cada letra quede centrada sobre su columna (comprobado en la maqueta); **todos los días con fecha libre o futura del mismo alto** (64 px; hoy 64 en unas semanas y 75 en otras); **el mes actual se ve entero** desde el día 1 (hoy empieza en la semana actual y el mes sale cortado), con **las semanas ya pasadas compactas** (30 px, número pequeño en gris) para que no empujen el resto; **títulos de los meses sin negrita** (400). Maquetas: `maquetas/calendario-propietario-arriba.png` y `calendario-propietario.png`. Sustituye en A1 lo de «desplazar hasta la semana actual».
> - **Calendario del propietario, casillas (Ana, con la referencia del calendario de anfitrión de Airbnb):** **47 × 92 px**, 6 px entre ellas y 14 px de margen lateral; número del día pequeño (14 px, 500) centrado arriba y precio centrado debajo (12 px, sin negrita), los dos con transparencia (número al 70 %, precio al 75 %); **precio completo sin «₡» ni redondeo** («38 000», «38 900»; en dólares «$76»), porque «38 mil» redondea 38 900 a «39 mil» y puede esconder un precio especial; **fondo de los días en verde al 6 %** (hoy 9 %); **días pasados del mes actual del mismo tamaño, con el número tachado y más claro** (sustituye las semanas compactas); **ocupados en terracota con rayas y solo el número**, sin «Ocupado»; **precio especial sin ★ ni marca**: solo se ve la cifra distinta (igual que en la ficha); la leyenda queda «Disponible · Ocupado»; **días seleccionados para editar: solo un marco terracota alrededor** (2 px, `--brand-ink` al 60 %), sin relleno; el fondo verde y el texto no cambian. Se distingue de los ocupados (terracota claro con rayas). Maquetas: `maquetas/calendario-propietario.png`, `calendario-fondo.png` (6 %), `calendario-seleccion.png` y `calendario-especial-ocupado.png` (A).
> - **Selección en terracota, nunca en verde:** marco terracota en el Calendario del propietario; «¿Cuándo?» y la hoja de contacto siguen con su cuadrado terracota (rango de fechas). Ocupado = terracota claro con rayas.
> - **Barra de pestañas que se esconde al bajar (Calendario del propietario, como Airbnb):** al desplazarse hacia delante en el calendario (hacia abajo) la barra sale por abajo y no vuelve; al desplazarse hacia atrás (hacia arriba) vuelve a aparecer; arriba del todo, siempre visible. Animación corta de `transform: translateY` (unos 200 ms, `ease-out`), un umbral de unos 8 px para que no parpadee con movimientos pequeños, y sin animación con `prefers-reduced-motion`. **En Explorar, de momento no** (Ana, 2026-10-29): se valorará más adelante (Airbnb lo hace), con la etiqueta «Mapa» bajando al sitio de la barra.
> - **Panel de edición de días (al seleccionar):** se queda con su diseño de hoy (3 filas: «3 noches · 4–6 nov» y Cancelar; Disponible / Ocupado y precio; «Guardar cambios»), pero **oculta la barra de pestañas mientras hay días seleccionados** y va pegado abajo (como Airbnb; el calendario gana unos 140 px y se ve una semana más); **«Guardar cambios» más bajo (44 px, 16 px de letra)** y **en gris mientras no hay cambios** (hoy parece un botón verde pálido). Maqueta: `maquetas/panel-edicion.png` (opción A; la B, pequeño a la derecha, queda como alternativa). Al guardar o cancelar vuelven las pestañas.
> - **Fallo a corregir:** hoy el ₡ | $ del Calendario del propietario no hace nada: `src/client/screens/calendario.tsx` no pasa `currency` ni `fx` a `MonthGrid` (la ficha sí, en `src/shared/listing-calendar.tsx`). Usar `useCurrency()` y el tipo de cambio como en Favoritos, con prueba e2e que cambie a $ y vea los precios en dólares.
> - **Calendario:** sin logo ni título; arriba, el selector de casa y «Cerrar la casa hasta…» (A1).
> - Las demás pantallas sin pestañas (ficha, asistente, Ingresar, Cuenta, Filtros…) siguen con su cabecera de flujo (‹ y título).

### C5. Pantalla de Cuenta
[maquetas/cuenta-propietario.png (hoy), maquetas/cuenta-propuesta.png]

> **Acordado (2026-10-29, Ana).**
> - **Es una pestaña (C4):** sin flecha ‹ ni título «Cuenta» (T2).
> - **Bloque del nombre:** el número en su propia línea bajo el nombre y «✓ WhatsApp verificado» debajo (hoy «WhatsApp verificado ·» se corta y el punto queda colgando); sigue la línea «Pronto podrá verificar también su identidad (opcional).» y «Editar».
> - **Suscripción:** una casa en revisión dice solo «En revisión» (fuera el «· ₡0»); «Próximo cobro» en plena oferta: «Nada hasta el 29 oct 2027» sin negrita (hoy «₡0 · sin método de pago» en negrita suena a problema); cuando toca pagar, «₡2 900 desde el …».
> - **Método de pago: con las condiciones que ya tiene la app** (Ana): la fila solo aparece cuando falta el método **y toca avisar** (90/30/7/0 días del fin de la oferta, o pendiente de pago), en ocre, como «Añadir método de pago» con la fecha en que termina la oferta. En plena oferta sin aviso, no sale.
> - **Filas nuevas:** «Favoritos · N casas guardadas» para el propietario (sale de su barra, C4); para el viajero, «¿Quiere publicar su casa gratis?» en ocre (A8).
> - **Ayuda por WhatsApp:** la línea que le toca a cada uno (clientes o propietarios); hoy dice «Línea de bnbtico para propietarios» a todos.
> - Términos y privacidad y «Cerrar sesión» al final, como hoy.

## Cómo atacarlo

1. **C1, A1 y A4**: tres arreglos de pantalla, sin decisiones abiertas, que tocan lo que más usa el propietario.
2. **C2**: alto del mapa y encuadre; decidir el alto con Daniel (y con Ana, por ser su estructura).
3. **A5, A9, A2**: textos y jerarquía; poco código.
4. **A6, A7, A3 y A8**: limpieza de color, de Filtros, del orden de Mis casas y la puerta de publicar.
5. Detalles N1–N8 en una sola pasada.

Pendiente fuera de esta revisión: A3 (1–3) de la ronda anterior (elegir fechas en el calendario de la ficha) sigue con Ana; la hoja de contacto sigue usando campos de fecha del sistema mientras la búsqueda usa el calendario de rango.
