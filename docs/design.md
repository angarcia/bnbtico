# Diseño

> **Dirección visual vigente (2026-10-20): «Sol y sal».** Paleta, tipografía y componentes en `design/tokens/tokens.json` (0.2.0); pantallas de la v1 en `design/pantallas/` y especificación en `docs/diseno-v1.md`; logo en `design/logo/`. Donde este documento diga otra cosa en lo visual, manda `diseno-v1.md`.

> **Nota 2026-10-15.** Partes de este documento están superadas. Reglas vigentes en `CLAUDE.md` y `docs/plan-implementacion.md`; el prototipo (vista Móvil) es la especificación de v1. En particular: WhatsApp verificado es lo único obligatorio (Veriff opcional, fuera de v1); contacto directo por WhatsApp sin solicitud/aceptación; sin reclamaciones en la app; colones con visualización en dólares; «Mensual» en vez de «Largo plazo».


## Registro y perfil · vigente 2026-10-13

`account-access.js` se carga tras las extensiones de lanzamiento. Alta: nombre y WhatsApp → código → sugerencia opcional de correo de recuperación. Sin correo en registro, contraseña, huella ni Face ID. Sesión recordada en el navegador; al salir o acceder sin sesión, WhatsApp + código. Mi perfil añade foto local, descripción, correo con confirmación simulada, Cambiar WhatsApp y Cerrar otras sesiones. Recuperación con correo confirmado y nuevo WhatsApp; alternativa de ayuda manual sin prometer acceso automático. Veriff pendiente tras registrar: cliente antes de contactar, propietario antes de publicar; mensajes diferentes para cada rol. Volver del paso de identidad conserva el borrador/contexto. Detalles y límites de simulación: [identidad y seguridad](identidad-y-seguridad.md#registro-y-acceso-aprobado--2026-10-13). No se modifica la landing.

## Lanzamiento ligero · vigente 2026-10-13

Admin → Usuarios → Ficha: «Preparar bienvenida» por rol y «Crear consulta en nombre del cliente». La bienvenida tiene texto editable, canal remitente, permiso, preparación simulada y confirmación manual de envío; no se marca enviada al abrir. La consulta exige fechas/personas, presenta casas compatibles para selección y recoge autorización con referencia privada. En Owner → Mis consultas se distinguen aperturas de ficha y consultas de bnbtico mediante el origen, con el mismo botón de WhatsApp. No hay otra bandeja para los propietarios. La ayuda muestra el canal correspondiente al rol; números reales pendientes.

Contacto directo único: el cliente inicia desde la ficha; fechas, personas y consulta opcionales. Mis consultas es un registro de aperturas, no una bandeja de aceptación ni confirmación de mensajes enviados. El botón del propietario mantiene «Contactar por WhatsApp» y prepara un saludo editable con el contexto disponible; consulta vacía no muestra «Tu consulta». Sin aceptar/rechazar ni ajustes de canal. Compartir ficha es la acción destacada en cada casa y se recomienda en Inicio/Mis casas, explicando la verificación previa al contacto y los límites de la demo. Al publicar se informa de que los clientes verificados podrán contactar directamente y ver/guardar el número de esa casa.

El alcance aprobado es publicar → compartir ficha → consultas directas. `launch-scope.js` se carga al final y limita la UI sin borrar exploraciones. Cliente: Explorar, Favoritos, Mi cuenta. Owner: Inicio, Mis casas, Calendario, Mis consultas, Cuenta. Sin Pedir casa/Buscan casa, valoraciones, estadísticas detalladas ni barras de consultas en calendario. Precio habitual y excepciones por días; temporadas y fines de semana se conservan como exploración oculta. El mapa del catálogo se retira; permanece la ubicación aproximada de la ficha.

Compartir ficha muestra un enlace con la referencia de la casa; no incluye teléfonos ni permite evitar login, identidad o WhatsApp verificados al contactar. En localhost el enlace solo sirve en el mismo ordenador. Promoción con contador claramente simulado, según los tramos documentados; condiciones comerciales pendientes antes de publicar. Las secciones siguientes que describen búsquedas compartidas y tarifas avanzadas son referencias para fases posteriores, no alcance inicial. Fuente de prioridades: `roadmap.md`.

## Calendario y cierre temporal · vigente 2026-10-12

Actualización 2026-10-13: además de las consultas directas, «Mostrar personas que buscan casa» activa barras amarillas de búsquedas compartidas para cada casa. Se combinan en líneas separadas con las azules. Solo se muestran destinatarias compatibles, activas, consentidas y con fechas exactas; los acuerdos ya anotados se conservan aunque cierre la búsqueda. El detalle permite ofrecer la casa del calendario por WhatsApp, «No me interesa» (solo la oculta para esa casa) y confirmar «Marcar como ocupado» (amarillo oscuro, noches ocupadas sin cambiar precios). No recibe propuestas nuevas una búsqueda cerrada. Pedir casa añade Entrada/Salida opcionales; sin ellas la búsqueda permanece en Buscan casa, sin inferir fechas del texto. Módulo `calendar-searches.js`, estado en memoria y mes fijo diciembre 2026.

Último ajuste: secciones «Tarifa habitual», «Temporada alta» y «Temporada baja», cada una con «Precio por noche» y «Precio de fin de semana (opcional)». Sin porcentajes ni checks. Viernes y sábado usan el precio de fin de semana de su propia tarifa; vacío significa usar su precio por noche todos los días, sin heredar otro precio de otra sección. Especial es siempre el importe final. Alta/baja exigen inicio y fin al configurar cualquiera de sus precios; sin temporada no se exigen fechas.

WhatsApp por casa (2026-10-12): paso Precio al crear y sección dedicada en Editar. Campo editable precargado con el número del usuario; si es el mismo ya verificado, sin nuevo código. Otro número: Guardar o verificar → código simulado → Verificar y guardar para esta casa. Mostrar contacto actual y aviso de que se conserva hasta verificar el nuevo. Estado pendiente/errores locales, sin sello público adicional. No altera otros anuncios ni cambia la identidad del propietario. Reglas en `publicacion.md`.

- Tarjetas: Calendario, Editar, Disponible/No disponible y Contacto directo. Activar/Desactivar anuncio pasa al interior de Editar; desactivar oculta la ficha. No disponible mantiene la ficha visible, cierra temporalmente todo el calendario y bloquea nuevas consultas/propuestas. Consultas ya recibidas e historial se conservan. No borra ni modifica disponibilidad, tarifas o precios de los días.
- Al cerrar se pregunta por una fecha de reapertura opcional. Vacía: cierre indefinido hasta pulsar Disponible. Con fecha futura válida: reapertura a las 00:00 de Costa Rica, sin reactivar un anuncio desactivado ni saltar requisitos de cuenta. Reabrir manualmente cancela la programación. Se muestra la fecha programada en la tarjeta.
- Calendario: verde = disponible, rojo = ocupado. Alta más saturada, baja más suave y base intermedia, sin rayas ni puntos. Casillas con día, precio y estrella solo para especial; sin etiquetas Alta/Baja, +% ni símbolos ✓/×. Leyenda reducida a Disponible, Ocupado y ★ Especial: sin Base/Alta/Baja ni +% Fin de semana. La explicación de tarifas queda en la nota inferior, el detalle accesible y el resumen. Botones de tarjeta: Disponible/Contacto directo Sí verdes, No disponible rojo y Contacto directo No ámbar (revisión previa, no error).
- Configurar tarifas por casa: base orientativa procedente de la creación; alta y baja opcionales, inicialmente sin configurar. Guardar una tarifa actualiza todos los días asociados, incluidos ocupados, sin cambiar su disponibilidad. Vaciar alta/baja devuelve sus días a base; no modifica especiales. La base también actualiza el precio orientativo del catálogo de la demo.
- Editar días: selección primero, sin modo previo. Tocar días alterna selección. Panel inferior fijo con cantidad/fechas, disponibilidad Disponible/Ocupado (sin cambio inicial; volver a tocar desmarca), precio por noche precargado con importe efectivo o «Varios precios», botón Restaurar tarifa y Guardar cambios único. Precio intacto no crea excepciones; editarlo aplica el importe a toda la selección, con ★ solo en los días cuyo precio difiere de la tarifa configurada. Si coincide, vuelve a seguir esa tarifa sin excepción. Restaurar muestra inmediatamente en el editable la tarifa vigente de cada fecha y fin de semana, o «Varios precios» si difieren; permanece editable y no guarda hasta pulsar Guardar cambios. El texto bajo el calendario queda solo en «Precios orientativos». Disponibilidad y precio pueden guardarse juntos de forma atómica; entrada inválida no cambia ninguno. Cancelar, quitar la última fecha o cambiar de casa limpia el borrador. Configurar tarifas permanece separado arriba.
- Temporada alta y baja requieren Inicio/Fin si se introduce precio por noche o de fin de semana (ambos, orden válido e inclusivos); sin temporada configurada no se requieren fechas. Guardar un período nuevo o modificado asigna la temporada correspondiente a sus días, salvo precios especiales, sin cambiar disponibilidad; quitar una fecha mientras la temporada tenga precio bloquea el guardado, sin modificar el calendario. Alta y baja no pueden solaparse: se valida antes de guardar. En la demo solo admite diciembre de 2026. Guardar correctamente colapsa el menú; errores lo mantienen abierto.
- Fin de semana: importe directo opcional independiente por tarifa, positivo y en la moneda de la casa; puede ser mayor o menor que su precio por noche. Solo viernes y sábado; domingo usa precio por noche. Editar el importe recalcula sus días asignados, incluidos ocupados; vaciarlo restaura el precio por noche. Nunca sustituye precios especiales. La grilla y el detalle muestran el precio resultante. Precios siempre orientativos.
- Demo en `calendar.js`: diciembre 2026 fijo, datos por casa en memoria, compartidos con su ficha pública. Recargar borra todo. Reapertura simulada mientras la página esté abierta; producción necesita tarea de servidor, persistencia y permisos. Prueba: `tests/prototype/calendar.cjs`.
- Contacto directo: textos explícitos «Sí, aceptar contacto directo por WhatsApp» y «No, revisar cada consulta en bnbtico antes de contactar por WhatsApp con los clientes». Sin mensajería interna ni automatización de WhatsApp.
- Calendario del propietario: «Mostrar consultas» (inicialmente desmarcado por casa) muestra barras continuas y finas dentro de las casillas por las noches de cada consulta directa, independientes de disponibilidad y tarifas. Solo el nombre visible; las consultas coincidentes ocupan líneas distintas. Al cruzar semanas se conserva color, nombre y línea. Tocar una barra abre solo esa consulta con nombre completo, entrada/salida, noches, personas, mensaje y contacto por WhatsApp usando el consentimiento existente. Fechas y noches también están en el texto accesible de la barra. No son reservas ni bloquean noches. Llegada incluida, salida excluida; sin fechas válidas o fuera de diciembre de 2026 quedan en Mis consultas. No incluye Buscan casa ni expone consultas en el calendario público. Consultas expiradas sin aceptación no habilitan contacto nuevo. La ficha captura fechas explícitas y personas, y permite mensaje opcional antes de confirmar; reintentar no duplica ni cambia la consulta original. Demo en `calendar-consultations.js`, sin envíos reales.
- Mis consultas → «¿Cómo querés recibir consultas?» configura todas las casas actuales y futuras. Inicialmente se revisan en bnbtico; aplicar WhatsApp directo requiere confirmación y las verificaciones vigentes. La acción general reemplaza los ajustes individuales actuales y fija el valor inicial de las nuevas casas. Después cada casa puede desactivarlo o activarlo individualmente sin modificar el valor general. Mostrar valor para nuevas casas y cuántas actuales aceptan contacto directo. No afecta a Buscan casa ni retira números compartidos. Estado solo en memoria; nuevas publicaciones siguen sin incorporarse al catálogo en esta demo.

Gestión de consultas desde calendario: contactar por WhatsApp no cambia la disponibilidad. «No me interesa» retira la consulta del calendario sin borrar historial ni cambiar fechas. «Marcar como ocupado» pide confirmación de un acuerdo externo por WhatsApp; solo entonces marca todas las noches ocupadas (no la salida), conserva tarifas y demás consultas y cambia la barra a azul oscuro con estado «Estancia acordada» en el detalle. No crea una reserva ni cobra dinero. Se conserva solo el nombre en la barra y el estado también figura en su texto accesible. Los acuerdos no se descartan desde este detalle; el propietario puede seguir editando la disponibilidad manualmente. La demo no acepta marcar un intervalo parcial fuera de diciembre de 2026.

Las decisiones de esta sección sustituyen la ubicación anterior de Activar/Desactivar en la tarjeta.

Formulario de publicación, Detalles (2026-10-12): características con checkbox (mascotas, piscina, wifi, aire acondicionado, parqueo). Marcar parqueo revela un selector obligatorio Gratuito/De pago sin valor inicial; desmarcar limpia esa selección. Retirar Está amueblado. La elección Sí/No de largo plazo sigue siendo obligatoria y sin valor inicial.

Actualización 2026-10-12: **Mis casas** muestra debajo de cada casa publicada Calendario, Editar, Activar/Desactivar y **Contacto directo: Sí/No** (No inicial). Con Sí, el propietario presta consentimiento previo para esa casa; un cliente verificado confirma compartir su teléfono y continúa por WhatsApp sin aceptación individual. Con No se conserva la consulta pendiente. Número único por cuenta; Solicitudes compartidas sin cambios. Preferencia y pausa simuladas en `house-controls.js`; especificación en `contacto-whatsapp.md`. Editar abre los datos de la casa como borrador para revisión, sin aplicar cambios automáticamente al catálogo.

Requisito aprobado 2026-10-12, pendiente de pantallas: clientes y propietarios completan **Veriff + código de verificación de WhatsApp** antes de contactar, enviar solicitudes, publicar o responder. Explorar, registrarse, iniciar sesión y preparar borradores no exige esas verificaciones iniciales. Un único estado público **«Identidad verificada»** engloba ambas comprobaciones; no mostrar un sello separado de WhatsApp. Los pasos pendientes se distinguen solo para informar a la propia persona. Ni Veriff ni OTP por separado conceden el estado completo. Ninguna casa se publica ni se habilita contacto con una verificación incompleta. Fuente: [identidad-y-seguridad.md](identidad-y-seguridad.md). La demo todavía no implementa este paso.

> Demo vigente 2026-10-07: WhatsApp directo, sin chat interno ni intermediario. Cliente solicita contacto y owner acepta al responder. Especificación y límites: `contacto-whatsapp.md`.

Referencia viva: `design/prototype/casatica-prototipo.html` (abrir en el navegador; selector Cliente / Owner / Admin / Landing y Móvil / Web). También publicado como artifact privado en claude.ai (gallery → "CasaTica Prototipo"). Tokens en `design/tokens/tokens.json`.

## Cómo usar el prototipo
- Es un único HTML sin dependencias: datos de ejemplo en JS, pantallas renderizadas por función, navegación por `data-go`. Los selectores de arriba cambian rol y dispositivo; la misma pantalla se adapta con container queries (390 px en marco de teléfono, ancho completo en web).
- Lo que **sí** funciona: cambiar modo, filtros reales (provincia, personas, habitaciones, piscina, mascotas, cargador eléctrico, A/C, wifi), favoritos, abrir ficha, flujo de contacto (login → sheet → toast), pedir casa con detección de requisitos, mis solicitudes, wizard de 5 pasos, calendario (tocar días), valorar clientes, solicitudes del owner con sheet de respuesta, aprobar/rechazar en admin.
- Lo que **no**: buscador de texto, rango de precio, mapa real, subida de fotos, pagos. Son decorativos.
- Las "fotos" son degradados con etiqueta; en producción van imágenes reales 16:11 en tarjeta y 4:3 en galería.

## Flujos detallados
Reclamaciones: ver `reclamaciones.md` para entradas por rol, respuesta del propietario y decisiones/revisión de administración. Sin importe ni gestión de devoluciones: solo relato libre, acuerdos económicos fuera de la app. Admin → Usuarios permite desactivar/reactivar con motivo y confirmación, consultar historial y preparar contacto por el WhatsApp de soporte bnbtico; datos y número ficticios, sin envíos reales.

Requisitos vigentes, no descripción exacta de todas las pantallas actuales: identidad-y-seguridad.md prevalece sobre la demo antigua. Registro separado de identidad obligatoria; desde el 2026-10-05 se añade titularidad registral opcional por finca/casa, sin comprobar autorización de alquiler. Guía de contenido: guia-verificacion-finca.md; privacidad y revisión jurídica: privacidad-verificaciones.md. No implementado en las pantallas. Marca bnbtico/rana sobre hoja y paleta coral sí aplicadas al prototipo el 2026-10-05; tokens vigentes más abajo.


### Solicitar contacto por WhatsApp (cliente)
1. En la ficha elige llegada, salida y personas (vacacional) o "desde cuándo" (largo plazo) y toca **Solicitar contacto**.
2. Sin sesión → registro sencillo. Antes de contactar, completar identidad (documento + rostro + liveness); teléfono/OTP no basta. Volver al contacto tras aprobación, sin repetir por conversación. Pendiente de implementar en la demo.
3. Confirmación sencilla: acepta compartir su número con ese owner y toca «Enviar solicitud». No se abre un chat. El owner puede «Contactar por WhatsApp» (aceptar) o «No me interesa».
4. El envío crea/reutiliza una solicitud por cliente/casa durante 7 días; reabrir no duplica avisos. Mi cuenta → Mis contactos muestra estado e historial. WhatsApp se habilita cuando el owner acepta; sin alternativa de chat interno. Demo sin envíos reales; ver `contacto-whatsapp.md`.

Mensaje prellenado (vacacional):
> Hola {nombreOwner}, vi tu casa «{título}» en CasaTica (ref {CT-####}). ¿Está disponible del {llegada} al {salida} para {personas} personas? Gracias 🙂

Largo plazo:
> Hola {nombreOwner}, vi tu {tipo} «{título}» en CasaTica (ref {CT-####}). ¿Sigue disponible a partir de {mes}? Somos {personas} personas.

### Pedir casa (cliente) → responder (owner)
1. Cliente: elige Vacaciones / Para vivir, personas (stepper), fechas o "desde cuándo", zona, chips de imprescindibles, texto libre, presupuesto **total** (vacacional) o mensual (largo plazo).
2. Todos los filtros seleccionados son obligatorios. Las notas libres no modifican los chips automáticamente. Presupuesto estructurado con moneda y noches para comparar total vacacional.
3. Vista previa de casas compatibles según el catálogo; fechas y disponibilidad pendientes de confirmar con el owner. Solo anuncios de owners verificados; no convertir divisas ni dar por confirmadas amenidades sin datos.
4. Checkbox de consentimiento: "Acepto que hasta {min(10, N)} owners verificados que cumplan mis requisitos accedan a mi contacto y me respondan por WhatsApp."
5. Enviar (requiere cuenta e identidad aprobada). Toast "Enviada a N owners". → Mis solicitudes.
6. Owner: recibe notificación; en Buscan casa ve la tarjeta (cliente + ★, modo · personas · fechas · zona, chips, badge de presupuesto, texto, "Coincide con: {casa}"). Toca **Ofrecer mi casa por WhatsApp**.
7. Elige una casa coincidente, revisa el mensaje y acepta contactar por WhatsApp. La apertura simulada marca `replied`, no confirma envío ni entrega. Alternativa: «No me interesa».
8. Cliente, en Mis solicitudes: lista de propietarios que iniciaron contacto desde bnbtico (casa e identidad verificada; no mensajes recibidos ni precios ofrecidos) con Ver casa / WhatsApp; aviso "revisá que el chat venga de un owner de esta lista"; Cerrar solicitud.

Mensaje prellenado del owner:
> Hola {nombreCliente}, soy {owner} de CasaTica. Vi que buscan casa para {personas} personas ({fechas}) con {requisitos}. Mi casa «{título}» en {zona} cumple todo: {enlace ficha}. Les puedo dejar las {n} noches en {precio total} en total. ¿Les sirve?

### Búsqueda asistida (exploración no aprobada, oculta)

Desde el 2026-10-12 no aparece en Explorar ni registra una ruta en v1. La usuaria no ha decidido incorporarla; no se promete para v2. Se conserva como diseño histórico un chat guiado con preguntas básicas, resumen editable y afinado de coincidencias, sin IA real, avisos ni cobros. Pedir casa sigue visible como formulario gratuito sin IA. Estado y propuestas condicionales: `busqueda-asistida.md`.

### Publicar casa (owner)
Se puede preparar el borrador sin verificar identidad, pero no publicarlo ni responder hasta su aprobación. No hay trámite de autorización para alquilar. Los tiempos de revisión de la demo son ilustrativos, no SLA comprometido.

Wizard vigente de 5 pasos: **Alojamiento** (Casa/Apartamento/Habitación y Acepta largo plazo Sí/No sin preselección) → **Ubicación** aproximada → **Detalles** (habitaciones y baños obligatorios, baños privados por defecto) → **Fotos** (mín. 5, simuladas) → **Precio** por noche, precio mensual opcional según largo plazo o Consultar con el propietario. WhatsApp único en Mi cuenta, no por casa. Validación y resultado En revisión en memoria, sin promesa de plazo ni publicación real. Especificación y límites: [publicacion.md](publicacion.md). Implementación de demo en `publication.js`; catálogo/búsquedas todavía conservan modalidades históricas.

### Verificar propiedad (owner) · demo implementada 2026-10-05

**Decisión 2026-10-12: fuera de v1 y oculto en el prototipo.** Se retiraron botones y carga de `property.js`; la ruta `o-verify` ya no se registra. Código y guía conservados como diseño futuro. La identidad obligatoria de ambos roles permanece. Las propuestas de administración registral de la sección siguiente también quedan fuera de v1.

Diseño histórico, no visible en v1: desde Panel o Mis casas, **Verificar propiedad** abría `o-verify`, conservando la casa seleccionada. Pregunta inicial: «¿Ya tenés una certificación literal?»; quien tiene código salta al envío y quien no lo tiene recorre tres pantallas: preparar referencia (con ayuda «No sé mi número de finca»), obtener certificación (enlace oficial en pestaña nueva) y emitir/copiar código. Botones Atrás, Continuar y Salir y continuar después.

El paso final muestra campo de código, aviso de privacidad de demostración y consentimiento explícito. Solo permite **Usar código de ejemplo** (`RNPDIGITAL-DEMO-2026`), sin escribir ni subir datos reales. Enviar cambia la solicitud a **Verificación en revisión**, no concede un sello ni cambia publicación, identidad o suscripción. Cada casa conserva su paso/código/consentimiento en memoria; salir y volver permite continuar, recargar lo borra. No hay solicitudes al Registro, compras, persistencia, autenticación real ni conexión con la cola admin.

Implementación histórica: `design/prototype/property.js`, ya no cargado por el HTML; pruebas aisladas: `node tests/prototype/property-verification.cjs`. Guía de contenido y fuentes: `guia-verificacion-finca.md`. Ni asistente ni sellos registrales están visibles en v1.

### Identidad y moderación (admin)
V1 muestra **Revisión de anuncios**, con estado de identidad de Veriff de solo lectura (simulado). Se retiraron documentos, selfie, cédula y SLA de 24 h de esta cola. **Revisar anuncio** abre descripción completa, galería ampliable, ubicación aproximada, capacidad, características, precios y condiciones. Desde allí se puede aprobar, pedir cambios o rechazar; las dos últimas acciones requieren motivo. Hay que abrir la revisión antes de decidir; identidad pendiente o menos de cinco fotos impiden aprobar. Las decisiones no verifican personas ni publican realmente. No se ofrece cola registral. Implementado en `admin-review.js`, con datos y fotos de ejemplo, estado en memoria y prueba `tests/prototype/admin-review.cjs`. La gestión real de incidencias de identidad sigue pendiente. Ver `identidad-y-seguridad.md`.

Antecedente 2026-10-05, sustituido para v1: se propuso una cola de titularidad en el Registro; queda guardada como alternativa futura, no visible.

Propuesta pendiente de implementar: renombrar la cola a «Titularidad de propiedades», mostrar casa/finca/derecho, referencia del titular y estado de identidad de solo lectura; permitir comprobar titularidad, pedir aclaración o dejarla no comprobada, con fecha, fuente y motivo. Ni aprobar esta cola verifica identidad ni publica automáticamente la casa; no obtener el sello opcional no pausa por sí solo el anuncio. Incidencias de Veriff se gestionan como soporte/reintento/revisión con el proveedor, sin botón para autoaprobar identidad. Moderación de anuncios y reclamaciones conservan sus flujos separados. No mostrar documentos de identidad completos por defecto.

## Dirección
Cálida y local, con la claridad de un marketplace. Marca **bnbtico**, rana sonriente sobre hoja en coral, aplicada al prototipo el 2026-10-05. Original conservado en `design/prototype/assets/bnbtico-original.png`; CSS encuadra su panel inferior sin modificar la imagen. Logo compacto en cabeceras móvil y web. Coral #FF385C para marca y coral profundo #D92349 para acciones con texto blanco; fondos cálidos y rosas suaves. Verde para WhatsApp y estados positivos; dorado escaso en estrellas/avisos. Fotos y mapa conservan sus colores naturales. Español de Costa Rica con voseo.

## Roles y navegación
- **Cliente** (móvil: tab bar inferior; web: barra superior): Explorar · Pedir casa · Favoritos · Mi cuenta.
- **Owner:** Inicio · Mis casas · Calendario · Mis consultas · Buscan casa · Cuenta. Dos pestañas independientes, no subpestañas de Contactos.
- **Admin:** Anuncios · Casas · Usuarios · Reclamaciones.
- **Landing** pública para captar owners.

## Pantallas

### Cliente
- **Home:** segment Vacacional / Largo plazo, buscador, chips de provincia, mapa con pins de precio (sticky lateral en escritorio), tarjetas. Línea «N casas · precios orientativos, acordalos con el owner».
- **Filtros:** provincia, personas (mín.), habitaciones (mín.), amenidades (piscina, mascotas, ⚡ cargador eléctrico, A/C, wifi, frente al mar, rancho/BBQ, accesible; en largo plazo amueblado, cochera, sin depósito), rango de precio. Sin filtro de propietarios verificados: la identidad y WhatsApp verificados son requisitos de publicación, no una opción de búsqueda. Nota que enlaza a "Pedí una casa".
- **Ficha:** galería (mosaico en escritorio), badges (Identidad verificada de quien publica, modo, ref CT-####), título, zona, descripción, amenidades, calendario con ocupados y temporada alta, mapa aproximado, tarjeta del owner, aviso antifraude. Panel sticky con precio "desde", fechas, personas y botón Contactar; en móvil barra inferior fija con precio + botón.
- **Contacto:** solicitud con consentimiento, estado pendiente/aceptada/expirada y acceso a WhatsApp tras aceptación del owner. Sin chat interno.
- **Login:** alta sencilla separada de identidad. Passkeys propuestas, pendientes de validación. Documento + rostro + liveness al intentar contactar/publicar/responder, no al explorar.
- **Pedir casa:** formulario gratuito sin IA, con personas, fechas, zona, imprescindibles, notas y presupuesto. Vista previa de compatibilidad (no disponibilidad), consentimiento y envío simulado. Búsqueda asistida oculta y pendiente de evaluación. El modo vac/largo histórico aún requiere la adaptación descrita en `publicacion.md`.
- **Mis solicitudes:** criterios, texto, lista de propietarios que iniciaron contacto desde bnbtico (casa e identidad verificada; no mensajes recibidos ni precios ofrecidos) con Ver casa / WhatsApp, aviso antifraude, cerrar solicitud.
- **Favoritos** y **Mi cuenta** (puntuación como cliente con etiquetas, casas contactadas, alertas por zona, idioma).

### Owner
- **Panel:** 4 stat tiles (vistas 30 d con sparkline, contactos, casas activas, suscripción), aviso de solicitudes nuevas, aviso de clientes sin valorar, mis casas.
- **Mis casas:** tarjetas con vistas/contactos/precio, estado (Activa / En revisión), nota de pago por casa.
- **Publicar alojamiento (wizard 5 pasos):** Alojamiento → Ubicación → Detalles → Fotos → Precio → Enviar a revisión. Campos y validación vigentes en [publicacion.md](publicacion.md); WhatsApp a nivel de cuenta.
- **Calendario y precios:** marcar ocupado por día, precio especial, temporada alta, mínimo de noches.
- **Mis consultas / Interés en mis casas:** antes «Me contactaron». Texto visible explica interés directo en una casa concreta, identificada en cada contacto. Leads con puntuación previa, valoración, Contactar por WhatsApp / No me interesa.
- **Buscan casa / Personas buscando casa:** texto visible explica que son búsquedas enviadas a varios propietarios (hasta 10 compatibles), no contactos exclusivos por una casa. El propietario puede ofrecer una compatible (cliente + ★, criterios, presupuesto, texto, "coincide con: {casa}"), «Ofrecer mi casa por WhatsApp» y selector de casa/confirmación de WhatsApp.
- **Cuenta** y **Suscripción** (desglose por casa, total, próximo cobro, anual, pausar).

### Admin
- **Anuncios:** cola → Revisar anuncio completo → Aprobar / Pedir cambios / Rechazar. Identidad de solo lectura; incidencias del proveedor pendientes, sin sello ni revisión de autorización para alquilar.
- **Casas** (tabla de ejemplo con estado, vistas, contactos, MRR) y **Usuarios** (búsqueda de propietarios/clientes, ficha, desactivar/reactivar, historial y WhatsApp de soporte simulado).

### Landing

Copy aprobado de la columna bnbtico en la tabla comparativa: **Visibilidad: Mundial**; **Confianza: Propietario y cliente con identidad verificada**. Describe la política de identidad de ambos roles, no la titularidad registral de la casa ni una verificación real en la demo.
Hero con la frase de visión, 3 pasos (Publicás · Te encuentran · Acordás los detalles), caja de precio con "sin permanencia", tabla comparativa (CasaTica / plataformas con comisión / solo WhatsApp), casas recientes, FAQ.

## Sistema de diseño

### Pedir casa: reparto por tandas (2026-10-13)

El formulario anticipa cuántos propietarios recibirán la primera tanda y explica la ampliación a las 24 horas, hasta 10 distintos. Consentimiento explícito para todo ese máximo, no solo el número inicial. «Mis solicitudes» muestra todas las búsquedas del cliente, cantidad de destinatarios efectivos, próxima tanda y las acciones «Ya encontré alojamiento» / «Cerrar búsqueda». Panel de prueba plegado para avanzar 24 horas, sin avisos reales. Buscan casa, contadores, selector de casa y calendario solo muestran búsquedas ya recibidas, no las que esperan su tanda. Una consulta directa del mismo cliente/fechas excluye la búsqueda compartida para ese propietario. Reglas y límites de la demo en `contacto-whatsapp.md`.

### Color
| Token | Light | Dark | Uso |
|---|---|---|---|
| bg | #F7F5EF | #141917 | fondo |
| surface / surface2 | #FFFFFF / #EFEDE6 | #1C2320 / #242D29 | tarjetas / chips |
| fg / muted | #1B2420 / #5F6B64 | #EDEFEA / #A3ADA6 | texto |
| line | #DDD9CE | #2F3934 | bordes |
| coral | #FF385C | #FF385C | marca |
| primary / primaryInk / primarySoft | #D92349 / #A81736 / #FFF0F3 | #FF8097 / #FFADC0 / #44232D | acciones, selección y fondos de marca |
| primaryOn | #FFFFFF | #35101A | texto sobre primary |
| successInk / successSoft | #124634 / #DCEFE4 | #8FD3B0 / #1E3A2D | estados positivos y verificado |
| sun / sunSoft / sunInk | #E8A33D / #FBEFD9 / #7A4E07 | #F0B24F / #3B2E17 / #F3D6A1 | estrellas, temporada alta, avisos |
| whatsapp | #25D366 (texto #063B1E) | igual | solo CTA de contacto |
| ok / warn / bad | #2E8B57 / #C97A12 / #C2432F | iguales | estados |

### Tipografía
Bricolage Grotesque 700/800 para títulos y cifras; Nunito Sans 400/600/700 para texto. Escala 11 (eyebrow uppercase) · 12 · 13 · 15 base · 17 · 20 · 22 · 24–26 · 32/50 hero. Cifras tabulares. Formato `₡95.000` / `$120`.

### Forma
Radios: tarjetas 14–16, botones 12, inputs 10, chips 999. Espaciado base 4; padding de vista 16 móvil / 32 escritorio. Una sola sombra suave. Breakpoints por contenedor: 640 (2 columnas), 800 (nav superior, ficha en 2 columnas), 1000 (3 columnas + mapa sticky).

### Componentes clave
ListingCard · Badge Identidad verificada · Botón Contactar (+ barra inferior en móvil) · Solicitud de contacto · Confirmación de WhatsApp · Chips de filtro · Segment control · Calendario (L K M J V S D, ocupado rayado, alta en sunSoft) · Stat tile con sparkline · Wizard de 5 pasos · Lead row con estrellas · Request form · Request card (owner) · Reply sheet · Note (aviso) · Admin queue card.

### Copy
Voseo tico, directo. Siempre "orientativo" junto al precio. Frases fijas: "Sin comisiones. Hablás directo con {owner}." · "CasaTica no procesa pagos." · "La dirección exacta la comparte el owner." · "Sin permanencia ni contratos".

### Accesibilidad
Contraste AA en ambos temas, focus ring visible (sun), `aria-label` en botones de icono, `prefers-reduced-motion`, áreas táctiles ≥ 40 px.
