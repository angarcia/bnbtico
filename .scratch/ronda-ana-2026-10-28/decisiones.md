# Ronda de mejoras de Ana · decisiones (2026-10-28)

Fuente: correos de Ana del 2026-10-28 («Cambios bnbtico», con capturas de Airbnb como referencia de estructura, **no** de estilo). Decidido por Daniel pregunta a pregunta el 2026-10-28/29. Ya hecho y desplegado antes de esta ronda: «Enviar WhatsApp» en Favoritos, pestaña «Mi casa»/«Mis casas», sin «Calendario y precios» en el detalle, tarjeta entera tocable, «Solo alquiler mensual», «Otra…» y altura de la descripción.

Reglas de siempre: móvil primero (375 px), estilos y tokens de bnbtico (`design/tokens/tokens.json`, `docs/diseno-v1.md`), español de Costa Rica de **usted**, precios en colones `₡95 000` y orientativos, nunca «total a pagar».

## A · Explorar al estilo Airbnb (estructura), con estilos bnbtico

- **Cabecera:** Explorar no tiene barra superior. Arriba, la **píldora de búsqueda** («Empiece su búsqueda» o el resumen: «Cocles · 23–27 nov · 4 personas») y, a su derecha, el botón de cuenta (iniciales o «Ingresar»). Debajo, una fila: chip **«Solo alquiler mensual»**, botón **filtros** (icono, con contador) y **«₡ | $»** al final. Las demás pestañas conservan su barra superior.
- **Búsqueda a pantalla completa** al tocar la píldora, con tres tarjetas plegables (como Airbnb):
  1. **¿Dónde?** Campo con sugerencias de **zona**, solo eso: al tocarlo salen las zonas que tienen casas (tabla `zones`, activas); al escribir se filtran sin tildes ni mayúsculas. Sin recientes, sin «cerca de mí», sin destinos populares. Elegir una zona busca casas en ella o a ≤ 5 km.
  2. **¿Cuándo?** Calendario sencillo de llegada y salida. Con «Solo alquiler mensual» activo: solo **«Desde»** (una fecha) y salen las casas libres el mes siguiente a esa fecha. Botón «Siguiente» para saltarlo sin fechas.
  3. **¿Quiénes?** Solo número de personas (− / +).
  Abajo: «Borrar todo» y botón principal «Buscar».
- **Filtro por fechas:** solo aparecen las casas disponibles todas esas noches (`listing_days` con `available = false` excluye; casa cerrada excluye).
- **WhatsApp:** al contactar, el mensaje lleva las fechas y las personas de la búsqueda (las personas ya se pasan hoy; añadir fechas). Mensual: «Me interesa alquilar por meses desde el <fecha>».
- **Resultados:** el **mapa** con marcadores de precio («₡42 000») es el **primer elemento de la lista**, no fijo: al bajar desaparece. Se carga aparte (Leaflet diferido) en una caja de alto fijo, sin botón; sin red queda el fondo. Al bajar aparece una etiqueta flotante **«Mapa»** que abre el mapa a pantalla completa; ahí una etiqueta **«N casas»** vuelve a la lista. Tocar un marcador muestra la tarjeta de la casa.
- **Tarjeta de resultados:** **una casa por fila**, foto grande con esquinas redondeadas, corazón arriba a la derecha, debajo nombre (Outfit), zona, «N personas · N habitaciones», precio **siempre por noche** («₡42 000 / noche», o «/ mes» / «Precio a negociar» con «Solo alquiler mensual»), aunque haya fechas.
- «Más filtros» conserva todo lo demás (características, habitaciones, precio, y también zona, fechas y personas editables).
- Futuro (fuera): búsqueda flexible tipo Skyscanner.

## B · Densidad y diseño

- Márgenes laterales más pequeños (≈ 16 px en vez de 20), fotos e iconos más grandes; iconos de la barra inferior más grandes (≈ 26–28 px).
- **Una casa por fila** en Explorar y Mis casas.
- **Ficha:** foto principal **cuadrada (1:1), sin márgenes, a todo el ancho**; botones volver / compartir / corazón encima; contador «1 / 5». **Sin selector ₡ | $ en la ficha** (2026-10-29, Daniel): la barra fija de abajo ya muestra las dos monedas, ordenada así: a la izquierda «₡42 000 / noche» y debajo «Mensual: ₡650 000 / mes»; a la derecha «≈ $82 / noche» y debajo «≈ $1 275 / mes»; después «Contactar por WhatsApp» y, debajo, «Precios orientativos: el precio final lo acuerda con el propietario.». Revierte el selector de la ficha de la navegación simple (2026-10-27).
- **Mis casas** (lista, al estilo «Your listings» de Airbnb, estilos bnbtico): foto cuadrada grande con la **etiqueta de estado encima** («Activa», «En revisión», «Borrador», «Edición en revisión»…), debajo nombre y zona; **sin precio ni texto extra**; debajo los botones. Lo mismo para las tarjetas de **Actividad**.
- **Colores de acción:** el **ocre** (`--sun`) solo para dinero y avisos de pago (pagar, «Activar suscripción», «Añadir método de pago», fila de suscripción/método de pago cuando falta algo). **«Compartir ficha» en verde oscuro relleno**; **«Seguir publicando» en contorno verde**. Una sola acción rellena por tarjeta.
- El color del texto **no cambia** (`--fg` #1C2B2A).
- Un borrador sale como **un solo elemento** en Mis casas con «Seguir publicando» y «Descartar» (sin tarjeta de aviso duplicada arriba para el mismo borrador).

- **Terracota:** el de la marca `#D65C3C` sigue en el logo, los corazones y lo grande; el texto pequeño, contadores, «Nueva», marcadores del mapa y la pestaña activa usan `#B44C30` (contraste 5,1:1; sustituye a `#BF4D2E`).
- **Calendario:** días libres en verde `#DCE8DF`, ocupados en terracota cálido `#F7E3D3` con texto `#9A4B2A`, rayas y «Ocupado»; en «¿Cuándo?» la selección en terracota suave `#D9775A` con el número oscuro.

## C · Calendario

- Días más **altos**, con el **precio dentro** de cada casilla (como la captura de Airbnb, estilos bnbtico), un mes ocupa la pantalla sin hueco debajo, y se pasa de mes **desplazando en vertical** (meses uno debajo de otro).
- Arriba del calendario de cada casa: **«Cerrar la casa hasta…»** (antes «Anuncio visible» en el detalle; misma función: casa fuera de Explorar y sin consultas, reapertura opcional en una fecha).

## D · Editar una casa publicada

- Al tocar una casa se abre **su ficha editable** (no el asistente por pasos): arriba las fotos, luego nombre, tipo (alojamiento completo / habitación), personas, características, descripción, precio… parecida a la ficha pero **sin calendario**. Cada campo se toca para editarlo (pantalla propia si hace falta).
- **Suscripción:** arriba en **ocre** solo si está pausada o pendiente de pago; si no, el bloque de suscripción va **abajo**. **«Compartir ficha»** disponible en esta pantalla.
- **Al momento (sin revisión):** orden de fotos, quitar fotos, personas, habitaciones, baños, características, precio por noche, alquiler mensual y su precio.
- **Con revisión del admin:** ubicación (punto y zona), fotos nuevas, nombre, tipo y descripción. Mientras tanto **sigue activa la versión aprobada**; la edición queda como «Edición en revisión».
- **Una sola edición a la vez por casa.** Si hay una edición sin enviar o en revisión, no se puede abrir otra. Siempre hay **«Descartar cambios»**. En la lista se ve claro que hay una edición en curso (etiqueta en la foto), sin duplicar la casa.
- **«Anuncio visible»** sale del detalle y pasa al Calendario (ver C).

## E · Publicar

- Se puede **enviar a revisión sin fotos y sin descripción**. Para **aprobar**, el admin necesita **al menos 1 foto**; sin fotos solo puede pedir cambios con el aviso «Para publicarla necesitamos al menos una foto de la casa». La descripción es opcional también para aprobar (la ficha no muestra el bloque).
- **Precio por noche sigue obligatorio.**
- **Nombre: máximo 32 caracteres** (mínimo 5).
- **Desde la portada:** «Publicar mi casa» lleva al asistente. Si no hay cuenta, **después del paso 1** («¿Qué es?») una pantalla del propio asistente «Para guardar su casa, verifique su WhatsApp» (número, nombre, código). Al verificar se crea el borrador con lo del paso 1 (guardado en el teléfono mientras tanto) y sigue en «¿Dónde está su casa?». Tras «Enviar a revisión», «¿Quiere añadir un correo?» (se puede saltar). Se construye ya (funciona en pruebas); la portada de bnbtico.com lo usa **el día del lanzamiento** (hasta entonces sigue abriendo WhatsApp).
- **Registro:** tras el código de una cuenta nueva, «¿Tiene una casa para alquilar?» → Sí lleva al asistente; No, a Explorar.

## F · Suscripción y cuenta

- Entrando a «Suscripción» desde una casa, **solo los datos de esa casa**; «Activar suscripción» en ocre si está parada. Futuro: botón ocre «Añadir método de pago».
- En Cuenta, **«Método de pago» en ocre** si falta.
- **«Cerrar sesión»** al final de Cuenta, más discreto, con confirmación «Tendrá que recibir un código nuevo para volver a entrar». La sesión no caduca mientras se use. Passkeys: después del lanzamiento.
- **Identidad:** una **línea informativa** (no botón) bajo «✓ WhatsApp verificado» en Cuenta: «Pronto podrá verificar también su identidad (opcional).» Cambia la regla de «nada de identidad en v1» solo para este texto.

## G · Actividad

- Cada consulta lleva arriba una **etiqueta con miniatura y nombre de la casa**.
- Con **dos casas o más**, chips «Todas · <casa> · <casa>» encima de «Últimas consultas» para filtrar.

## Futuro (no en esta ronda)

Búsqueda flexible tipo Skyscanner; sincronizar calendario por iCal con Airbnb (https://www.airbnb.ca/help/article/99); passkeys.
