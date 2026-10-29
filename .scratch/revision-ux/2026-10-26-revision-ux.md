# Revisión UX sin anestesia · 2026-10-26

Status: done (2026-10-27) · implementada sobre `develop`; plan de pruebas en `docs/pruebas-manuales-revision-ux.md`

Dos pasadas sobre la app nueva (`apps/app`, árbol de trabajo del 2026-10-26, con el ticket 15 ya hecho): (1) diseñador obsesionado con la conversión destrozando cada decisión visual; (2) usuario que entra por primera vez y lo toca todo, anotando dónde se pierde o quiere irse. Recorrido en iPhone 13 (390×844) y iPhone SE (375×667), y unas capturas en escritorio (1280): cliente sin cuenta, propietario nuevo sin casas y propietario con casa activa, borrador, casa en revisión y una consulta. Las capturas están en `capturas/` (no versionadas; los nombres van entre corchetes en cada punto).

## Qué es «convertir» aquí

bnbtico no vende una prueba gratuita. Convierte dos veces:

1. **Cliente → toca «Contactar por WhatsApp» y llega al chat con el propietario** (el éxito del catálogo).
2. **Propietario → publica una casa** (gratis 12 meses las primeras 50; ese es el «free trial»). Después tiene que **ver que funciona** (aperturas, consultas) para pagar en el mes 13.

Todo lo de abajo se ordena por cuánto frena una de esas dos cosas.

## Reglas que no se tocan (aunque el fundador las quiera saltar)

- Verificar el WhatsApp por código es obligatorio para contactar y publicar. Se puede **suavizar** el paso, no quitarlo.
- WhatsApp es el único canal: sin chat interno, sin reseñas de casas, sin Veriff en v1.
- `docs/diseno-v1.md` manda en aspecto y copy. Los puntos que lo contradicen van marcados **[Decisión]**: no se implementan sin que Daniel lo apruebe y se anote en `docs/decisiones.md`.
- Usted en toda la UI, español de Costa Rica. Precios en colones, orientativos.
- Presupuestos: JS privado < 150 KB gz (hoy ~146 KB: poco margen), ficha LCP < 1,5 s, sin avisos de hidratación.
- Ya abiertos y no repetidos aquí: tickets 16 (filtros en una fila), 17 (barra inferior en Ingresar y Mi cuenta), 18 (entrar solo con el WhatsApp), 19 (nombre y descripción) y 20 («Anuncio visible»).

## Implementación (2026-10-27)

Un commit por punto, con sus pruebas: C3 `a768507` · A11 `6ec5f04` · N4 `25004b4` · N7 `83b71c3` · A12 `a1ecde5` · A4 `325ddad` · A5 `dbaa51d`, `ab8f2c2` · C2 `ac6746c` · A6 `4925215` · A3 (4–5) `9fd5aeb` · C4 `b338649` (3), `59b37ed` (1–2, con A1), `890949d` (4), `9737e77` (5, con A9), `e803cb6` (6) · N1 `cee09d8` · N2 `6f33883` · N3 `c14e86e` · A10 `18002a5` · A2 `17b3074` · N6 `33828c3` · N5 `38641eb` · C1 `ec6439f`. Migraciones nuevas: `primera_publicacion`, `evento_paso_asistente`, `estadisticas_casa`. Límites de tamaño ajustados: hoja de contacto 5 → 5,5 KB y pantallas de las pestañas 20 → 22 KB (el total de la zona privada sigue < 150 KB). Pendiente: A3 (1–3, con Ana), A7 y A8 (fase 5), A11 (b) con su disparador, la pasada de escritorio completa y el número +506 de propietarios.

## Segunda pasada (2026-10-26, sobre `abf003e`, con los tickets 15–20 hechos)

Mismo recorrido en 390×844, 375×667 y 1280. **Todo lo acordado sigue aplicando**, con estos matices:

- **C2 / A6:** el Ingresar nuevo (ticket 18) pide primero el número, pero desde la hoja de contacto sigue diciendo «Ingresar · Entre con su WhatsApp», la hoja sigue diciendo «Abrir WhatsApp», sigue el campo «País de su WhatsApp» además de la caja «+506», y con el número vacío sale «Ese número no parece válido para el país elegido.». Se implementan sobre el flujo de dos pasos.
- **C3:** igual (barra de ~260 px en el SE con la línea en dos renglones).
- **C4:** igual; el paso 7 bloquea «Continuar» con 2 fotos («Agregue al menos 5 fotos.» en rojo arriba y «Añada al menos 5 fotos.» abajo). El paso 6 ya tiene «n / 60 · mínimo 5» y «n / 2000 · mínimo 80» (ticket 19): N3 se monta sobre eso.
- **A1, A2, A10, N1, N6, N7:** igual.
- **A4 / A5:** el Calendario sigue abriendo «Mi borrador» con octubre casi entero en gris.
- **A5 / N2, estados vacíos que ya existen:** sin casas, Calendario dice «Publique su casa para usar el calendario.» con «Publicar casa», y Consultas con casa publicada dice «Todavía no le han escrito. Comparta su ficha para recibir consultas.» sin botón. Se sustituyen por los textos acordados (y se añade el botón), sin duplicarlos.
- **A11:** el buscador sigue diciendo «Cualquier fecha · cualquier grupo»; Explorar ya tiene solo Vacacional, Mensual y «Más filtros» (ticket 16).
- **N5:** igual (columna de 560 px en 1280).

---

## Crítico — frena la conversión hoy

### C1. La portada de producción no tiene ni un botón
[g01-portada, d01-portada]

**Diseñador:** es la única página que ve hoy cualquiera que llegue a bnbtico.com (todo lo demás da 404 hasta el lanzamiento) y es un folleto: titular, tres bloques de párrafos y la oferta de lanzamiento (el mejor gancho que tenemos, «12 meses gratis») en gris de 13 px al final. Ni un enlace, ni un WhatsApp, ni un «avíseme». La foto del hero es una playa nublada y gris: el Caribe en su peor día.
**Usuario:** «Muy pronto… ¿y qué hago? ¿Cómo publico mi casa? ¿Me avisan?». Cierro la pestaña.

**Arreglo** (`apps/app/public/portada.html`, `portada/portada.css`; sigue sin JS):
- Botón relleno arriba, en el hero: «Quiero publicar mi casa gratis», que abre `wa.me/<WA_OWNERS>` con el texto «Hola, tengo una casa en <zona> y quiero publicarla en bnbtico». Debajo, en contorno: «Avíseme cuando abra», que abre `wa.me/<WA_GUESTS>`. Los números se escriben al construir (los mismos `WA_OWNERS`/`WA_GUESTS` del build), no a mano.
- Subir la oferta a una tarjeta propia, justo debajo del hero: «Las primeras 50 casas: 12 meses gratis. Después ₡9 900 al mes, sin comisiones ni permanencia», y repetir el botón de propietario.
- Convertir «Cómo funciona» en 3 pasos numerados (como en las pantallas 30/32 del diseño) en vez de un párrafo.
- Cambiar la foto del hero por una con sol (candidatas en `design/pantallas/fotos/`: `beach.jpg`, `aerial.jpg`); debe seguir pesando lo mismo para no tocar el LCP.

**Hecho cuando:** la portada, a 375 px, muestra un botón de propietario sin hacer scroll; los dos botones abren WhatsApp con el texto redactado; `portada.spec.ts` sigue en verde y la portada no carga JS.

> **Acordado (2026-10-26).** Todavía no hay número +506 de bnbtico y no se usan números personales (privacidad, conversaciones que se quedan en un teléfono personal, enlaces viejos apuntando a él) ni uno +1 (resta confianza a un propietario tico). Se hace ya: tarjeta de la oferta bajo el hero, «Cómo funciona» en 3 pasos numerados y foto del hero con sol (mismo peso). El botón «Quiero publicar mi casa gratis» (WhatsApp de propietarios con mensaje redactado) lo inserta el worker al servir la portada **solo si `WA_OWNERS` está configurado**; sin él, la tarjeta cierra con «Abrimos pronto en el Caribe sur.» y no hay botón muerto. El de clientes («Avíseme cuando abra») se deja para el lanzamiento. Sin formulario de correo. Cambios de portada en `main` y luego merge a `develop`. Pendiente fuera del código: conseguir un chip prepago +506 con WhatsApp Business (app gratuita) para la línea de propietarios.
>
> **Foto del hero (acordado 2026-10-26):** se mejora la foto real de Playa Negra en vez de cambiarla. Las fotos de `design/pantallas/fotos/` son de Crystal Jungle Villa y no sirven: sugerirían que esa casa está en bnbtico y no sabemos si tenemos derechos. Se usa la variante **B** (exposición +, calidez, saturación ×1,3 y contraste ×1,06, sin inventar cielo ni sol), ya generada en `.scratch/revision-ux/portada-foto/B-calida-{1592,800}.jpg`: sustituye a `apps/app/public/portada/playa-negra-{1592,800}.jpg` con el mismo nombre y pesa menos (102 KB y 45 KB frente a 109 KB y 62 KB). Encuadre en móvil: `.soon-bg img { object-position: 85% 70% }` (antes `74% 50%`), con más selva y menos cielo gris; el escritorio (≥ 760 px) no cambia. Comparaciones en `portada-foto/`. Más adelante (b): una foto real de un día con sol del Caribe sur, cambiando solo esos dos archivos.

### C2. El momento de la verdad (contactar) se convierte en «Ingresar» y pierde la intención
[g08-contactar → g09-contactar-enviar]

**Diseñador:** el cliente llena la hoja de contacto y toca un botón verde WhatsApp que dice «Abrir WhatsApp»… y no abre WhatsApp: lo lleva a una pantalla titulada «Ingresar», con un titular genérico («Su nombre y su WhatsApp. Nada más.»), tres salidas («Recibir código», «Ya tengo cuenta», «No tengo acceso») y la tarjeta que recuerda a qué casa vuelve **debajo del pliegue**. El botón promete una cosa y hace otra.
**Usuario:** «¿Ingresar? Yo no quería crear una cuenta, quería escribirle a Ana». Es justo el punto donde más gente se va.

**Arreglo** (`src/shared/contact-sheet.tsx`, `src/client/screens/cuenta.tsx`):
- En la hoja, sin sesión verificada, el botón dice **«Continuar»** (no «Abrir WhatsApp») y la nota de debajo se queda como está: «Para escribirle necesita verificar su WhatsApp con un código. Lo que escribió se guarda.».
- En Ingresar, cuando `next` apunta a un contacto: cabecera «Escribirle a Ana» en vez de «Ingresar»; H1 «Un paso y le escribe a Ana»; la tarjeta de la casa (foto, nombre, «Ana · WhatsApp verificado») **arriba**, antes del formulario, y fuera los enlaces secundarios (el ticket 18 ya los unifica: coordinar con él).
- Tras verificar el código se abre WhatsApp directamente con el mensaje guardado (comprobar que ya pasa así; si vuelve a la ficha y hay que tocar otra vez, es otro abandono).

**Hecho cuando:** desde la ficha hasta WhatsApp, un cliente nuevo hace como mucho 4 toques (Contactar → Continuar → Recibir código → Verificar) y en ninguna pantalla aparece la palabra «Ingresar». Prueba Playwright del recorrido completo.

> **Acordado (2026-10-26), puntos 1–3, y se construye dentro del ticket 18** (que rehace Ingresar: número primero, nombre solo si la cuenta es nueva). Añadido al final de `.scratch/fase-r/issues/18-entrar-solo-con-whatsapp.md`: botón «Continuar» en la hoja sin sesión; Ingresar en modo contacto con «Escribirle a <nombre>», la tarjeta de la casa arriba y sin enlaces secundarios; tras el código, directo a WhatsApp sin segundo toque y sin la pantalla «¡Listo! Su cuenta está creada» (la invitación al correo queda en Mi cuenta). Tras el ticket 18, comprobar contra su «Hecho cuando» en la nueva pasada. **Actualización (2026-10-26): el ticket 18 se cerró (`b95ac5f`) sin implementar este añadido; se implementa con esta revisión, sobre el Ingresar nuevo de dos pasos.**

### C3. En un iPhone SE, la barra de contacto se come el 40 % de la ficha
[g14-ficha-se]

**Diseñador:** en 375×667 la barra fija mide unos 260 px: precio, una nota de dos líneas alineada a la derecha («≈ $363 · orientativo; el precio final lo acuerda con el propietario») y el botón. Junto al hero de 320 px y un título de 30 px a tres líneas, la primera pantalla de la ficha no enseña **nada** de la casa salvo foto, nombre y precio: ni zona, ni personas, ni características.
**Usuario:** «¿Dónde queda? ¿Cuántos caben?». Tengo que hacer scroll con un tercio de pantalla útil.

**Arreglo** (`src/shared/listing-page.tsx`, `src/styles/global.css`):
- La línea de la barra se queda en **una sola línea**: «≈ $363 · orientativo». La frase «el precio final lo acuerda con el propietario» pasa al cuerpo (ya está en «Publicada por…»). El diseño v1 ya pedía «en una línea».
- Título de la ficha: 30 px solo hasta 2 líneas; si no cabe, 24 px (`text-wrap: balance` ya está).
- Barra objetivo ≤ 150 px en 375 px de ancho.

**Hecho cuando:** en 375×667, sin hacer scroll, se ven la zona y «N personas · N habitaciones». Lighthouse de la ficha sin cambios (CLS 0).

> **Acordado (2026-10-26), puntos 1–4.** Respeta la decisión del ticket 15 (dos cifras apiladas, «orientativo» por el tipo de cambio fijo): la línea queda «≈ $186 · orientativo»; «el precio final lo acuerda con el propietario» pasa al cuerpo; título a 30 px hasta dos líneas y a 24 px si es más largo (por longitud del nombre, no midiendo en el navegador); barra ≤ ~150 px a 375 px. Anotado en `docs/decisiones.md` (2026-10-26 · Revisión UX).

### C4. Publicar la primera casa: tres veces el mismo mensaje antes de la primera pregunta, y el requisito duro escondido en el paso 7
[o02-inicio-vacio → o04-publicar-entrada → o21-paso1 … o27-paso7]

**Diseñador:** Inicio dice «Publique su casa», la tarjeta dice «Publique su casa en pocos pasos» y el botón «Publicar casa» lleva a **otra pantalla** «Publicar casa · Publique su casa en pantallas cortas» con un botón «Empezar». Dos toques muertos y tres repeticiones antes de la primera pregunta. Y lo que de verdad hace abandonar (**mínimo 5 fotos horizontales, sin teléfonos ni marcas de agua**) aparece en el paso 7 de 9, cuando el propietario ya invirtió seis pantallas y probablemente no tiene las fotos a mano.
**Usuario:** «Llevo 6 pantallas y ahora me pide 5 fotos que no tengo en el teléfono. Lo dejo para otro día» (y no vuelve).

**Arreglo** (`src/client/screens/propietario.tsx` Inicio, `src/client/screens/publicar.tsx`):
- «Publicar casa» en Inicio (y «Nueva» en Mis casas) **crea el borrador y entra directo al paso 1**. La pantalla intermedia solo aparece si ya hay un borrador sin enviar («Seguir con el borrador» / «Empezar otro»).
- En la tarjeta de Inicio, antes del botón, una lista corta de qué tener a mano: «5 fotos horizontales o más · el precio por noche o por mes · unos 10 minutos». Sin párrafos.
- En el paso 7, el contador «2 de 5–15» en ocre mientras falten fotos, y la frase «Añada al menos 5 fotos» arriba, junto al contador, no abajo.

**Hecho cuando:** de Inicio vacío al paso 1 hay un solo toque; `publicar.spec.ts` actualizado (hoy pasa por «Empezar»).

> **Acordado (2026-10-26), ampliado.** Se mantienen las 9 pantallas (decisión del 2026-10-21: una pregunta por pantalla, sin scroll en 375×667, guardado en cada paso); lo que falla es dónde está el esfuerzo, no el número de pantallas. Seis puntos:
> 1. «Publicar casa» (Inicio) y «Nueva» (Mis casas) crean el borrador y entran al paso 1; la pantalla intermedia solo si hay un borrador sin enviar.
> 2. En la tarjeta de Inicio, antes del botón, lista corta: «5 fotos horizontales o más · El precio por noche o por mes · Unos 10 minutos».
> 3. **Las fotos dejan de ser un muro:** en el paso 7 se puede continuar con menos de 5 («Faltan N fotos · puede añadirlas al final»; contador en ocre). El mínimo de 5 se exige al enviar: el paso 9 muestra «Faltan N fotos» con un botón al paso 7. Cambia `validateStep(7)` en el dominio y el fake; `submit_listing` ya exige 5 fotos en SQL, así que nada llega a revisión sin ellas.
> 4. **Tres etapas en vez de «Paso n de 9»:** «Su casa» (pasos 1–5), «Fotos y texto» (6–7), «Precio» (8–9). La barra conserva los 9 tramos agrupados en tres con su rótulo; la cabecera dice la etapa y el paso dentro de ella («Su casa · 2 de 5»).
> 5. **El paso 9 pasa a «Revisar y enviar»:** resumen de lo escrito (cada bloque lleva a su paso), botón en contorno «Ver cómo queda su ficha» (vista previa con `ListingPage`, cargada a demanda, sin contacto y con una banda «Vista previa»; absorbe A9), WhatsApp de la casa, oferta y «Enviar a revisión».
> 6. **Medir el abandono:** evento `wizard_step` (número de paso alcanzado, sin datos personales) con las balizas de `docs/telemetria.md`; con unas semanas de datos se decide si sobra, se une o se reordena alguna pantalla.
>
> Anotado en `docs/decisiones.md` (2026-10-26 · Revisión UX). Actualizar `publicar.spec.ts`, `docs/telemetria.md` y el plan de pruebas manual.

---

## Alto impacto

### A1. Inicio no ve el borrador sin terminar
[o05-inicio vs. o06-mis-casas]

**Diseñador:** el propietario tiene «Mi borrador» a medias, que es exactamente la conversión pendiente, e Inicio le dice «Su casa, en marcha» y solo enseña la casa activa. El borrador solo existe en Mis casas.
**Usuario:** «Ah, ¿ese lo había empezado?».

**Arreglo** (`propietario.tsx`, InicioScreen): si hay un borrador (o una casa con cambios pedidos), una tarjeta arriba del todo: foto, nombre, «Paso N de 9» con la barra de progreso y **un único botón relleno «Seguir publicando»**. El «Compartir ficha» de la casa activa pasa a contorno mientras exista esa tarjeta (un relleno por pantalla).

> **Acordado (2026-10-26).** Tarjeta arriba del todo en Inicio con el borrador sin enviar más reciente (o la casa con cambios pedidos): foto o hueco, nombre («Sin nombre todavía» si no hay), dónde se quedó en el lenguaje de etapas de C4 («Fotos y texto · faltan 3 fotos», «Su casa · 2 de 5») y un único botón relleno «Seguir publicando» que abre ese paso. Con cambios pedidos: la nota del admin y «Corregir y reenviar». Mientras la tarjeta esté, «Compartir ficha por WhatsApp» de la casa activa va en contorno. Con varios borradores, solo el más reciente y «y N borradores más · Ver en Mis casas». Sin cambios en la base.

### A2. El propietario no ve que bnbtico le funciona (y en el mes 13 tiene que pagar)
[o05-inicio, o07-detalle]

**Diseñador:** la tarjeta de la casa dice «Publicada hoy». El diseño v1 pide **aperturas de ficha** en Inicio y no están; tampoco en el detalle. Sin números, en el mes 13 la suscripción es un acto de fe. «38 personas vieron su ficha · 4 le escribieron» es lo que renueva, y lo que hace que el propietario comparta su enlace.
**Usuario (propietario):** «¿Alguien la está viendo?».

**Arreglo:** en Inicio y en el detalle de la casa, «N aperturas · N consultas en los últimos 30 días». Ya mandamos los eventos `listing_view` (`docs/telemetria.md`) y el admin de Casas pide las mismas cifras (diseño v1, 19): hace falta una RPC/vista con RLS del dueño que las devuelva, con su prueba de contrato antes de la pantalla (regla del repo). Cuando aún no hay datos: «Comparta su enlace para que lleguen las primeras visitas».

> **Acordado (2026-10-26).** En la tarjeta de la casa de Inicio y en el detalle: «N visitas · N consultas · últimos 30 días» («visitas», no «aperturas»); sin datos, «Comparta su enlace para que lleguen las primeras visitas». RPC nueva `owner_listing_stats(listing_id)` (solo el dueño o el admin) que cuenta `listing_view` de `events` y las consultas de 30 días; `events` sigue sin leerse desde el navegador. Prueba de contrato antes de la pantalla. **La ficha no manda `listing_view` cuando la abre su propietario** (sesión y casa propia), para que sus visitas no inflen la cifra. Migración nueva, creada después de la del ticket 19. Actualizar `docs/telemetria.md` y `docs/diseno-v1.md` si cambia el término.

### A3. El calendario de la ficha es decorativo y luego pedimos las fechas a mano
[g06b-ficha-full, g08-contactar]

**Diseñador:** la ficha enseña un calendario de disponibilidad precioso que no se puede tocar; dos toques después, la hoja de contacto pide «Llegada / Salida» con selectores nativos (en Chrome de escritorio se ven como `yyyy-mm-dd`). Además, el campo «Personas» corta su propio texto de ayuda («¿Cuántos sc…»).
**Usuario:** «Ya vi que el 14 está libre, ¿por qué tengo que volver a meterlo?».

**Arreglo** (`src/shared/listing-calendar.tsx`, `contact-sheet.tsx`, `contact-flow.ts`):
- Tocar un día disponible marca la llegada y un segundo toque la salida (rango resaltado como en el calendario del propietario). Con un rango elegido, la barra fija dice «Contactar por WhatsApp · 14–16 nov» y la hoja se abre con las fechas puestas.
- Personas: contador −/+ (como en el paso 4 de publicar) que arranca con el filtro de Explorar (`ppl`) si lo hay.
- El mensaje redactado incluye fechas y personas en cuanto existen (ya lo hace; comprobar con fechas que vienen del calendario).

> **Acordado (2026-10-26), puntos 1–5; los puntos 1–3 (elegir fechas en el calendario de la ficha) quedan pendientes de hablarlo con Ana.**
> 1. *(Pendiente de Ana)* Primer toque = llegada, segundo = salida, rango resaltado como en el calendario del propietario; tercer toque empieza de nuevo. Un día ocupado no vale como llegada; un rango con alguna noche ocupada no se acepta («Hay noches ocupadas entre esas fechas»); la salida sí puede ser el primer día ocupado.
> 2. *(Pendiente de Ana)* Con fechas, el botón dice «Contactar por WhatsApp · 14–16 nov» y junto al calendario aparece «Quitar fechas»; la barra no cambia de alto (C3).
> 3. *(Pendiente de Ana)* La hoja se abre con esas fechas; los campos de fecha siguen editables.
> 4. Personas con contador −/+ (como el paso 4 de publicar), desde el filtro «Personas» de Explorar si lo hay, con tope en la capacidad de la casa.
> 5. Comprobar que el mensaje redactado recoge fechas y personas y que el borrador se conserva al ir a verificar (C2).
>
> Notas: la ficha es SSR; el toque funciona tras hidratar, con el calendario del mismo tamaño (CLS 0, sin avisos de hidratación). La selección vive en memoria y en el borrador de contacto de la pestaña, no en la URL. Los puntos 4–5 se hacen aunque Ana descarte los 1–3.

### A4. Los calendarios de fin de mes enseñan casi solo días pasados
[g06b-ficha-full, o08-calendario]

Hoy, 26 de octubre, tanto la ficha como el Calendario del propietario muestran octubre completo: 25 días grises y muertos y 6 útiles. En la ficha, además, los días pasados ocupan el espacio donde el cliente busca fechas.

**Arreglo** (`month-grid.tsx`, `listing-calendar.tsx`, `calendario.tsx`): si quedan menos de 10 días en el mes, abrir directamente el mes siguiente (o enseñar una ventana de 5 semanas desde la semana actual). Los días pasados sin precio ni fondo.

> **Acordado (2026-10-26), opción (a).** Si quedan menos de 10 días en el mes, los dos calendarios (ficha y Calendario del propietario) abren en el mes siguiente; la rejilla sigue siendo un mes L–D y «‹» vuelve al actual (en el propietario no se va más atrás del mes actual, como hoy). Días pasados: solo el número en gris tenue, sin precio ni fondo. La regla vive en el componente común (`month-grid.tsx`) para que no se separen. «Mes actual» con la fecha de Costa Rica (UTC−6) en servidor y navegador, para que la ficha SSR no discrepe al hidratar cerca de la medianoche.

### A5. El Calendario del propietario abre un borrador
[o08-calendario]

`calendario.tsx:71-73`: `houses` incluye borradores y, sin `?casa=`, coge `houses[0]`, así que abre «Mi borrador», que no puede tener reservas. **Arreglo:** el selector solo lista casas activas (y, como mucho, en revisión) y por defecto abre la última usada o la primera activa; sin casas activas, un estado vacío con «Su calendario se activa cuando publiquemos su casa». Prueba e2e con un borrador más reciente que la casa activa.

> **Acordado (2026-10-26).**
> 1. El selector lista las casas que **han estado publicadas alguna vez** (tienen fecha de aprobación): las activas (también con «Anuncio visible» apagado, ticket 20) y las ya publicadas que se reabrieron para editarlas y están en revisión, porque sus reservas siguen existiendo. Fuera: borradores y casas nunca aprobadas. «Pendiente de pago» e «inactiva» se deciden en la fase 5.
> 2. Por defecto, la última casa usada si sigue en la lista; si no, la primera activa.
> 3. Sin casas publicadas: estado vacío «Su calendario se activa cuando publiquemos su casa» con un botón según el caso: «Seguir publicando» (hay borrador, como A1) o «Publicar casa» (no hay nada).
> 4. Con una sola casa publicada, sin selector: su nombre como subtítulo.
> 5. Playwright: borrador creado después de la casa activa → Calendario abre la activa y el borrador no está en el selector; `?casa=<id de un borrador>` cae en la activa.
>
> **Cambio de regla (2026-10-27, opción a, al implementar):** la pantalla «Enviada» tiene «Marcar las noches ocupadas» (diseño v1, pantalla 12) para preparar el calendario mientras se revisa, así que la regla final es: **tienen calendario todas las casas salvo los borradores nunca enviados y las rechazadas** (en revisión por primera vez, con cambios pedidos, activas, pausadas y las publicadas que se están editando). Por defecto, la casa de la URL, la última usada o la primera activa. El estado vacío dice «Su calendario se activa cuando envíe su casa a revisión.» (en vez de «cuando publiquemos su casa», que ya no es cierto). Un `?casa=` de un borrador cae en la activa y la URL se corrige. Implementado en `ab8f2c2` (columna en `dbaa51d`).
>
> **Ajuste acordado (2026-10-26):** una casa ya publicada que se reabre para editarla conserva su calendario mientras se revisa (punto 1). Hoy no hay columna que lo diga: `reviewed_at` se rellena en cualquier revisión (también al pedir cambios a una casa nunca publicada). Implementación: migración con `listings.first_published_at timestamptz`, que `review_listing` rellena la primera vez que aprueba (y no se toca después), con relleno para las casas activas actuales (`= reviewed_at`), sin grant de escritura para el cliente (lo protege `listings_protect`) y su prueba de contrato.
>
> **Pasos de prueba manual (van a la guía final).** Desde el teléfono, en `nueva.bnbtico.com` (o la URL del worker), con una cuenta de propietario de prueba. Para tener una segunda casa activa, publíquela y apruébela desde la cuenta de admin (segundo código).
>
> | # | Preparación | Acción | Resultado esperado |
> |---|---|---|---|
> | A5-1 | Propietario sin casas ni borradores | Pestaña Calendario | «Su calendario se activa cuando envíe su casa a revisión.» y un botón «Publicar casa»; sin selector ni rejilla. |
> | A5-2 | Solo un borrador, empezado y dejado en el paso 4 | Pestaña Calendario | El mismo aviso con el botón «Seguir publicando»; al tocarlo, el asistente abre en el paso 4 (el primero con algo pendiente) con lo escrito. |
> | A5-3 | Solo una casa enviada a revisión por primera vez (sin aprobar) | Pestaña Calendario | Abre **su** calendario (con su nombre como subtítulo, sin selector): se puede preparar mientras se revisa. Lo mismo desde «Enviada» → «Marcar las noches ocupadas». |
> | A5-4 | Una casa activa («Casa A») y después crear un borrador nuevo | Pestaña Calendario | Abre el calendario de «Casa A» con su nombre como subtítulo y **sin selector**; el borrador no aparece en ningún sitio de la pantalla. |
> | A5-5 | Dos casas activas («Casa A» y «Casa B») y un borrador | Pestaña Calendario → abrir el selector | El selector lista solo «Casa A» y «Casa B». |
> | A5-6 | Igual que A5-5 | Elegir «Casa B» → pestaña Inicio → volver a Calendario | Abre «Casa B» (recuerda la última usada). Cerrar la app y volver a abrirla: sigue en «Casa B». |
> | A5-7 | Igual que A5-5 | Mis casas → botón «Calendario» de «Casa A» | Abre el calendario de «Casa A», aunque la última usada fuera «Casa B». |
> | A5-8 | «Casa B» con «Anuncio visible» apagado (detalle de la casa) | Pestaña Calendario → selector | «Casa B» sigue en la lista y se pueden marcar noches. |
> | A5-9 | Dos casas activas; en «Casa B», detalle → «Editar la ficha» y confirmar (vuelve a revisión y deja de verse en Explorar) | Pestaña Calendario → selector | «Casa B» **sigue** en el selector y se pueden marcar noches mientras se revisa. Un borrador nuevo (nunca enviado) sigue sin aparecer. |

### A6. Ingresar: el error con los campos vacíos miente
[g11b-cuenta-enviar-vacio]

Con nombre y número vacíos sale un único error: «Ese número no parece válido para el país elegido.». No marca el nombre ni dice que falta el número. Además, «País de su WhatsApp: Costa Rica (+506)» y la caja «+506» al lado del número repiten lo mismo dos veces.

**Arreglo** (`cuenta.tsx`): errores por campo y en orden: «Escriba su nombre», «Escriba su número de WhatsApp» y, solo si hay número, «Ese número no parece válido…», junto a su campo y con el foco en el primero que falle. Quitar la caja del prefijo y dejar el prefijo dentro del selector de país (o al revés: un solo control). Coordinar con el ticket 18, que rehace esta pantalla.

> **Acordado (2026-10-26) y se construye dentro del ticket 18.** Errores por campo (número vacío, número no válido, nombre vacío, nombre corto) debajo de su campo y con el foco en él. Un solo control de país: la caja del prefijo pasa a ser el selector («+506 ▾») y desaparece el campo «País de su WhatsApp». Añadido al final del ticket 18. **Actualización (2026-10-26): el ticket 18 se cerró (`b95ac5f`) sin implementar este añadido; se implementa con esta revisión, sobre el Ingresar nuevo de dos pasos.**

### A7. Cuenta del propietario: «₡0 · sin método de pago» suena a problema

> **Fase 5 (2026-10-26).** No se toca ahora: la fase 5 rehace suscripción, oferta por tramos y avisos. Al escribir su especificación, incluir este punto como requisito (y, en A8, decidir si el envío reserva la plaza gratis).
[o10-cuenta-prop]

Con una casa activa en su año gratis, la tarjeta de suscripción dice «Cuando publique una casa, aquí verá su suscripción» (contradictorio: ya tiene una; puede que sea la caché de una visita anterior, **verificar**) y «Próximo cobro: ₡0 · sin método de pago», que se lee como un aviso de pago fallido.

**Arreglo** (`cuenta.tsx`, tarjeta Suscripción): por casa, «Casa Selva Cocles · gratis hasta el 26 oct 2027». «Sin método de pago» solo aparece dentro de la ventana de avisos (90 días antes del fin de la oferta), que es cuando «Añadir método de pago» existe según las reglas de producto. Si es la caché: invalidar la consulta de suscripción al cambiar el estado de una casa.

### A8. La oferta duda justo cuando el propietario se compromete **[Decisión]**

> **Fase 5 (2026-10-26).** No se toca ahora: la fase 5 rehace suscripción, oferta por tramos y avisos. Al escribir su especificación, incluir este punto como requisito (y, en A8, decidir si el envío reserva la plaza gratis).
[o29-paso9, o05-inicio]

Paso 9: «Si está entre las próximas 44 casas, gratis 12 meses desde que se apruebe». En Inicio, con la casa ya activa: «meses gratis desde que la aprobamos» (¿cuántos?). Al dudar en el último paso, el propietario frena.

**Arreglo:** con la casa activa, fecha concreta («Gratis hasta el 26 oct 2027»). En el paso 9 hace falta decidir si el envío **reserva** la plaza gratis mientras se revisa. Si sí: «Le guardamos una de las 44 plazas gratis mientras la revisamos». Si no: dejar el texto actual pero con la cifra en grande. Es una decisión de producto, no de copy: anotarla en `docs/decisiones.md`.

### A9. Se envía a revisión sin ver cómo queda

> **Absorbido por C4, punto 5** (paso 9 «Revisar y enviar» con la vista previa).
[o29-paso9]

El propietario envía sin haber visto nunca su ficha. **Arreglo:** en el paso 9, un botón en contorno «Ver cómo queda su ficha» que abre `ListingPage` en modo vista previa con el borrador (sin contacto, con una banda «Vista previa»). Sube la calidad de lo que llega a revisión y la confianza al enviar. Cuidado con el presupuesto de JS: `ListingPage` ya está en el bundle de la ficha; cargar la vista previa a demanda.

### A10. La confianza está enterrada al final de la ficha
[g06b-ficha-full, d03-ficha]

«Publicada por **Ana Prueba** · WhatsApp verificado. Sin comisiones…» está debajo del mapa, en gris pequeño. En un catálogo sin reseñas (por decisión de producto), la persona que alquila **es** la prueba social. **Arreglo:** una línea con las iniciales de la persona y su nombre bajo el título («Ana · responde por WhatsApp · WhatsApp verificado»), sustituyendo la etiqueta suelta «WhatsApp verificado» de arriba. La frase de las comisiones se queda abajo.

> **Acordado (2026-10-26).** Bajo el nombre de la casa, una línea con un círculo de iniciales («AP», como en Mi cuenta y Mis consultas) y «**Ana** · WhatsApp verificado» (solo el nombre de pila, como la hoja de contacto); sustituye a la etiqueta suelta «WhatsApp verificado» de arriba (la de «Vacacional / Mensual» se queda). El párrafo final («Publicada por… Sin comisiones…») se mantiene con el nombre completo. Sin foto del propietario (no se pide en v1) y sin frases que necesiten datos que no hay («responde rápido»). El nombre ya llega en los datos de la ficha SSR: sin petición nueva ni diferencia al hidratar. Anotado en `docs/decisiones.md` (cambia la fila de etiquetas del diseño v1, pantalla 3).

### A11. «Cualquier fecha» promete un filtro que no existe **[Decisión]**
[g02-explorar, g04-filtros]

El buscador de Explorar dice «Limón · Cualquier fecha · cualquier grupo», pero en Filtros no hay fechas. Con la disponibilidad de la fase 4 ya en la base, filtrar por fechas es posible. **Opciones:** (a) quitar «Cualquier fecha» del buscador hasta tenerlo; (b) añadir llegada/salida en Filtros y ocultar las casas con noches ocupadas en ese rango. La (b) es la que más convierte, pero es alcance nuevo de v1: decidirlo.

> **Acordado (2026-10-26): (a) ahora, (b) más adelante con disparador.** El buscador de Explorar pasa a «Limón · cualquier grupo» (fuera «Cualquier fecha»; `explorar.tsx`, `summaryBottom`). No se añade filtro de fechas antes del lanzamiento: un filtro que depende de calendarios que los propietarios casi no marcarán al principio escondería poco (y justo a los más cuidadosos) y daría falsa confianza con solo ~50 casas. **Disparador de (b):** cuando más de la mitad de las casas activas tengan al menos una noche ocupada marcada en los últimos 30 días (consulta sobre `listing_days`, a añadir en `docs/telemetria.md`). Entonces: sección «Fechas» en Filtros con la misma interacción que el calendario de la ficha (A3), Explorar oculta las casas con alguna noche ocupada en el rango, resultados rotulados «Sin noches ocupadas en esas fechas» (nunca «Disponible») y fechas precargadas en ficha y contacto. Anotado en `docs/decisiones.md`.

Superada el 2026-10-29: filtro de fechas construido (`.scratch/explorar-airbnb/spec.md`); se mantiene «nunca "Disponible"».

### A12. Ayuda puede salir a producción con el botón desactivado
[g12-ayuda]

Si `VITE_WA_GUESTS`/`VITE_WA_OWNERS` faltan en el build, Ayuda enseña «Número pendiente de configurar» y un botón gris: el **único** canal de soporte, muerto. En CI se pasan desde `vars`/`secrets` (`app.yml:85-86`), pero nada impide un build sin ellos. **Arreglo:** que el build de producción (`main`) falle si están vacíos, y comprobar que en `pruebas` están puestos.

> **Acordado (2026-10-26).** Fallar en `main` bloquearía hoy los despliegues de la portada (aún no hay números, ver C1), así que: (1) el build falla solo si `LAUNCHED=true` y falta `WA_OWNERS` o `WA_GUESTS`; (2) mientras falten, el build deja un aviso claro en el log de CI («WA_OWNERS / WA_GUESTS sin configurar: Ayuda sale desactivada»); (3) se añade a `docs/antes-de-produccion.md` («números de WhatsApp de bnbtico en `WA_OWNERS` y `WA_GUESTS`», junto al botón de propietarios de la portada de C1); (4) Ayuda se queda como está sin números («Número pendiente de configurar»).

---

## Detalles para pulir

### N1. Mis casas: casillas que no cuadran y tres botones rellenos
[o06-mis-casas]

Las casillas dicen «1 activa · 0 por pagar · 1 en revisión» con un borrador en la lista, que no cuenta en ninguna. El «0 por pagar» en ocre llama la atención sobre nada. Hay tres rellenos a la vez («Nueva», «Seguir», «Compartir ficha») contra la regla de un relleno por pantalla. **Arreglo:** ocultar las casillas a 0 (o añadir «borrador»); con un borrador, «Seguir» es el único relleno y el resto pasa a contorno.

> **Acordado (2026-10-26).** (1) Las casillas a 0 no se muestran y, si las tres son 0, no hay fila; siguen siendo activa / por pagar / en revisión, sin casilla de borrador (lo cubre la tarjeta de A1). (2) Un solo relleno con la misma prioridad que Inicio (A1): con borrador o cambios pedidos, «Seguir» / «Corregir y reenviar»; si no, «Compartir ficha» de la casa activa; «Nueva» en contorno salvo sin ninguna casa, donde es la única acción. (3) «Por pagar» no puede darse hasta la fase 5; entonces aparece en ocre.

### N2. Barra del propietario con destinos vacíos **[Decisión]**
[o02-inicio-vacio]

Un propietario sin casas ve 5 pestañas, y Calendario y Consultas no tienen nada. Valorar ocultarlas (o enseñar un estado vacío con un único siguiente paso) hasta la primera casa activa. El diseño v1 fija las 5 pestañas.

> **Acordado (2026-10-26): no se ocultan pestañas** (barra estable, anticipa para qué sirve bnbtico, y el diseño v1 fija las 5); deja de ser [Decisión]. Estados vacíos con un único siguiente paso: Calendario, el de A5; Consultas sin casa publicada, «Aquí verá a los clientes que le escriban por WhatsApp desde su ficha» con «Seguir publicando» o «Publicar casa»; Consultas con casa publicada y sin consultas, «Todavía nadie le ha escrito. Comparta su ficha para que lleguen las primeras consultas» con «Compartir ficha por WhatsApp».

### N3. Paso 6: una caja en blanco gigante
[o26-paso6]

La descripción es un área vacía de pantalla completa. El ticket 19 pone el mínimo en 80 caracteres: acompañarlo con 3 preguntas guía como texto de ayuda («¿Qué hay cerca? ¿Cómo es por dentro? ¿Qué incluye?»), no con un ejemplo que copien.

> **Acordado (2026-10-26), sobre lo que dejó el ticket 19** (contador «n / 2000 · mínimo 80», ya hecho). (1) Placeholder de la descripción con tres preguntas que desaparecen al escribir: «¿Cómo es por dentro? ¿Qué hay cerca (playa, pulpería, parada de bus)? ¿Qué incluye o qué debe saber el cliente?». (2) Sin texto de ejemplo para copiar. (3) Por debajo de 80, el contador dice «Faltan N caracteres» en ocre; desde 80, el «n / 2000» normal. (4) Se mantiene «Sin enlaces, teléfonos ni publicidad». Solo `fields.tsx` (paso 6).

### N4. 404 y estados vacíos sin botón
[g13-404]

«Revise el enlace o vuelva a Explorar desde la barra de abajo» → añadir un botón «Ir a Explorar». Lo mismo en la ficha bloqueada o desaparecida (`status-pages.tsx`).

> **Acordado (2026-10-26).** 404 de la app: «Ir a Explorar» (relleno). «Este enlace ya no está activo» y casa que no existe: «Ver otras casas en el Caribe» → Explorar. Error al cargar: «Intentar de nuevo» (relleno; enlace a la misma URL) y «Ir a Explorar» (contorno). Las páginas de estado son SSR y van sin JS: los botones son `<a>`. En producción antes del lanzamiento no aplica (todo da 404 con la portada de C1).

### N5. Escritorio: una columna de teléfono en medio de 1280 px
[d02-explorar, d03-ficha]

Explorar y la ficha son la columna de 560 px centrada; el 60 % de la pantalla queda vacío. La vista web es un derivado y no es prioridad, pero una ficha a dos columnas a partir de 1024 px (fotos a la izquierda, datos y contacto fijos a la derecha) y Explorar a 3–4 columnas cambian la primera impresión para quien llega desde un enlace compartido en el ordenador.

> **Acordado (2026-10-26), opción (a), solo dos pantallas y solo CSS:** Explorar a 3 columnas desde 900 px y 4 desde 1200 px (cabecera y buscador al mismo ancho); ficha a dos columnas desde 1024 px, con fotos y descripción a la izquierda y un panel fijo a la derecha (precio, línea de la persona de A10, «Contactar por WhatsApp» y calendario), sin la barra fija inferior. Todo con `@media`: lo que carga el móvil no cambia (presupuesto LCP y puerta de Lighthouse) y la transición Explorar ↔ ficha se comprueba en los dos anchos. El resto de la app se queda en la columna de teléfono.
>
> **Pasada de escritorio completa (aparte, decidido 2026-10-26):** Daniel quiere toda la app con buen diseño en ordenador. No entra en esta revisión porque empieza por decidir la navegación (la barra inferior no vale en escritorio: barra superior o lateral, con la lateral de 232 px del admin del diseño v1 como base) y eso cambia todas las pantallas; se diseña de una vez en el lienzo y se hace **después de la fase 6 y antes del lanzamiento (fase 7)**, para no rehacer las pantallas que cambian las fases 5 y 6. Anotado en `docs/plan-implementacion.md`.

### N6. Favoritos sin siguiente paso
[g10-favoritos]

La tarjeta guardada lleva a la ficha, pero la nota dice «Compare y escriba directo» sin nada con qué escribir. Añadir en cada tarjeta un enlace en contorno «Escribir» que abra la ficha con la hoja de contacto ya abierta (`?contacto=1` ya existe).

> **Acordado (2026-10-26).** (1) En cada tarjeta de Favoritos, enlace en contorno «Escribir» que abre la ficha con la hoja de contacto abierta; el resto de la tarjeta sigue abriendo la ficha. Parámetro propio `?escribir=1` (no `?contacto=1`, que significa «vuelta de verificar con borrador»), con prueba de cada uno. (2) Casa pausada (ticket 20) o ya no publicada: sin «Escribir» y con «No disponible por ahora». (3) Nota: «Escriba directo desde aquí. Guardar casas no necesita cuenta; para escribir solo verifica su WhatsApp con un código.»

### N7. Detalle de mi casa: la referencia CT sobre la foto
[o07-detalle]

La píldora «CT-4113» sobre la foto compite con el precio y el estado. Es útil para soporte, pero cabe mejor en pequeño junto al enlace, en «Compartir ficha».

> **Acordado (2026-10-26).** Fuera «CT-####» de la foto del detalle (quedan estado y precio). La fila «Compartir ficha» enseña el enlace en pequeño («bnbtico.com/casa/CT-4113») con la frase «Envíe el enlace por WhatsApp o compártalo en sus redes» debajo. Nada más cambia (la ficha pública sigue sin referencia, diseño v1).

---

## Cómo atacarlo

Orden sugerido, de más a menos conversión por esfuerzo:

1. **C3** (una línea de CSS/copy) y **A5**, **A6**, **N4** (arreglos pequeños, sin decisiones).
2. **C2** + **A3** juntos: el camino ficha → WhatsApp, con su prueba e2e de punta a punta.
3. **C4** + **A1**: el camino del propietario nuevo hasta el paso 1, y retomar el borrador.
4. **C1**: portada con botones (va en `main` y después merge a `develop`, según CLAUDE.md).
5. **A2** (necesita RPC y prueba de contrato) y **A9**.
6. Las **[Decisión]** (A8, A11, N2) se resuelven con Daniel antes de tocarlas.

**Entrega final:** además del código, una guía de pruebas manuales en español con el formato de `docs/pruebas-manuales-fase-r.md` (pasos numerados desde el teléfono, resultado esperado en cada uno) que cubra todo lo cambiado por esta revisión.

Cada punto es un commit con sus pruebas en verde (Vitest/Playwright en viewport móvil, primero la prueba). Comprobar `pnpm size` en cada uno que añada JS al shell.
