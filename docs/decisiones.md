## 2026-10-13 · Ficha móvil: un solo botón de contacto; fechas y mensaje por defecto en la hoja

- **Decisión.** En móvil (prioridad del producto: la gente lo usará desde el teléfono), la ficha deja de pedir fechas y personas en la tarjeta de precio y el único botón de contacto es la barra fija de abajo. Al pulsarlo, la hoja «Contactar por WhatsApp» trae Llegada, Salida y Personas (opcionales) y el mensaje completo ya redactado («Hola, vi {casa} en bnbtico y me interesa. ¿Está disponible del 20 al 23 de diciembre para 4 personas? Gracias.»), que se actualiza solo al cambiar fechas o personas mientras el usuario no lo haya editado a mano. Lo que va a WhatsApp es ese texto tal cual, sin otro saludo delante.
- **Web.** La ficha web no cambia (fechas y personas en la tarjeta de precio, hoja de siempre); se mantiene porque también puede existir, pero el diseño se optimiza para móvil y app.
- **Owner.** Se retira «responde en ~1 h» de la tarjeta del owner en la ficha (móvil y web): no es un dato que conozcamos.
- **Dónde.** `design/prototype/contacto-hoja.js` (condicionado a `S.dev==='phone'`), ajuste en `verificacion-opcional.js` (línea del owner en la hoja sin separador colgante). Prueba: `tests/prototype/contacto-hoja.cjs`.

# Registro de decisiones

## 2026-10-13 · Una sola lista de características al publicar y al filtrar

Decisión del usuario: los filtros de búsqueda deben coincidir con las opciones que marca el propietario al publicar. Lista única: **Piscina, Mascotas, Wifi, Aire acondicionado, Parqueo, Cargador eléctrico, Niños pequeños gratis**. Se añaden al formulario «Niños pequeños gratis» y «Cargador para carro eléctrico» (este último ya existía como filtro); se añaden a los filtros «Parqueo» y «Niños pequeños gratis», que filtran de verdad; se retiran de los filtros Amueblado, Sin depósito y los chips decorativos (Frente al mar, Rancho/BBQ, Accesible, Cochera). La ficha muestra Parqueo real y Niños pequeños gratis en «Lo que ofrece»; admin las ve al revisar. Prototipo: `caracteristicas.js`; prueba `tests/prototype/caracteristicas.cjs`.

Ampliación del mismo día: se añaden **Frente al mar** y **Rancho / BBQ** a la lista única (formulario, filtros, ficha y revisión), y el **precio por noche (mín./máx.)** pasa a verse en Explorar sin abrir «Más filtros» y a filtrar de verdad (antes era decorativo).

## 2026-10-13 · «Mensual» en lugar de «Largo plazo»; Explorar sin buscador de texto y con filtros a la vista

Decisiones del usuario: (1) en toda la interfaz «Largo plazo» pasa a «Mensual» («¿Aceptás alquiler mensual?», «Mensual: consultar precio…»); la landing comercial se conserva sin cambios (`copy-mensual.js`). (2) En Explorar se retira el campo de búsqueda por texto (era decorativo) y los filtros principales quedan a la vista: Personas, Habitaciones, Piscina, Mascotas, Aire acondicionado, Wifi, Cargador eléctrico, más el botón «Más filtros» y «Limpiar» cuando hay alguno activo (`explorar-filtros.js`). Pruebas: `copy-mensual.cjs`, `explorar-filtros.cjs`.

## 2026-10-13 · Se retira «Uso de los baños» del formulario

Decisión del usuario: el formulario de publicación ya no pregunta si los baños son privados, compartidos o mixtos; solo el número de baños. El dato queda fijo en «privados» por debajo y no se muestra en Mis casas ni en la revisión de admin. Prototipo: `formulario-simple.js`; prueba `tests/prototype/formulario-simple.cjs`. Sustituye el punto correspondiente de `publicacion.md` (10-12).

## 2026-10-13 · Descartado: precio por persona por noche

Se exploró e implementó en el prototipo un precio por persona por noche (con mínimo de personas y niños pequeños sin pagar) y el usuario pidió deshacerlo el mismo día. Queda **un único precio por noche de toda la casa, en colones**. El módulo `precio-persona.js` y su prueba se eliminaron; no hay rastro en la interfaz. Se conserva, por útil, la corrección de que al saltar la sugerencia de Veriff no se pierden las fechas y personas escritas en la ficha (`verificacion-opcional.js`).

## 2026-10-13 · Colones como única moneda; dólares solo para visualizar

Decisión del usuario: la app funciona en colones. Los propietarios ingresan todos los precios en colones (se retira el selector de moneda del formulario de publicación). El cliente ve todo en colones por defecto y puede cambiar a dólares, pero es solo visualización: conversión con un tipo de cambio de referencia (₡510 por US$1 en la demo), con aviso de que el propietario cobra en colones. El propietario siempre ve sus precios en colones. Sustituye «el owner decide en qué moneda cobra» (10-02) y el campo `currency CRC|USD` por anuncio; en producción el tipo de cambio debería tomarse de una fuente oficial y mostrarse la fecha. Prototipo: `moneda.js` (los anuncios de ejemplo en dólares pasan a colones); prueba `tests/prototype/moneda.cjs`. Único cambio en el HTML base: `fmt` pasa de `const` a `var` para poder redefinirla.

## 2026-10-13 · Foco en el Caribe: Limón por defecto y provincias con casas

Decisión del usuario: el lanzamiento se centra en el Caribe. En Explorar la provincia seleccionada por defecto es **Limón**. Un propietario de otra zona puede registrar su casa igual, y desde que se aprueba su provincia aparece automáticamente en los filtros aunque sea la única casa; las provincias sin casas visibles no aparecen. En el prototipo (`zona-caribe.js`) los chips se recalculan en cada vista según las casas visibles del modo actual; si la persona elige otra provincia o «Todas» se respeta su elección. Se añaden tres casas de ejemplo del Caribe (Manzanillo, Cahuita, Punta Uva) y, como consecuencia, **una casa aprobada por admin entra en el catálogo de la demo** (antes no se incorporaba). Prueba: `tests/prototype/zona-caribe.cjs`; ajustadas `admin-review`, `calendar` y `request-distribution`.

## 2026-10-13 · Estados de la casa y avisos de fin de oferta por WhatsApp

Decisión del usuario: una casa pasa por **Pendiente de revisión → Pendiente de pago → Activa**, y **Inactiva** si el propietario para su suscripción. Con la oferta de lanzamiento el paso Pendiente de pago se salta hasta que termina el período gratuito. Desde **3 meses antes** del fin de la oferta bnbtico le escribe por WhatsApp explicando que debe añadir un método de pago para que su casa siga saliendo; en el prototipo los avisos son a los 90, 30 y 7 días y el último día (simulados). Al terminar la oferta: con método de pago guardado, la suscripción empieza sola; sin él, la casa pasa a Pendiente de pago y deja de mostrarse hasta que lo añada. Parar la suscripción deja la casa Inactiva (oculta, sin cobro) y se puede reactivar.

Esta decisión reintroduce un aviso automático por WhatsApp desde bnbtico (el de fin de oferta), que la decisión del 2026-10-12 había descartado en general; requiere plantillas de la API de WhatsApp Business, la misma integración prevista para el OTP. Prototipo: `estados-casa.js` (estados, acciones en Mis casas, resumen en Promoción y suscripción, botón «Simular fin de oferta · demo»); prueba `tests/prototype/estados-casa.cjs`. Reactivar una casa ya no exige Veriff.

Añadido el mismo día: si la suscripción está parada (Inactiva) o la casa está Pendiente de pago, **el enlace de la ficha deja de funcionar**: muestra «Este enlace ya no está activo» con el motivo y un botón para explorar otras casas, sin precio ni contacto. Al reactivar, el mismo enlace vuelve a mostrar la ficha.

## 2026-10-13 · Catálogo: identidad verificada primero

Decisión del usuario: en el catálogo aparecen primero las casas de propietarios con identidad verificada con Veriff; dentro de cada grupo se conserva el orden anterior. La línea de resultados lo indica («Primero, las de propietarios con identidad verificada»). Es el incentivo para una verificación que es opcional. Prototipo: `verificacion-opcional.js` (orden en `filtered()`), con dos propietarios de ejemplo sin Veriff para que se vea; prueba en `tests/prototype/verificacion-opcional.cjs`.

## 2026-10-13 · WhatsApp obligatorio, identidad con Veriff opcional

Decisión del usuario: para publicar una casa o escribir a un propietario lo único necesario es tener el WhatsApp verificado. La verificación de identidad con Veriff pasa a ser **opcional**: al intentar contactar por primera vez y al enviar un anuncio se sugiere («Verificar ahora» / «Continuar sin verificar»), pero se puede saltar y no bloquea nada; tampoco el admin la exige para aprobar un anuncio. Hay dos sellos visibles para la otra parte: **WhatsApp verificado** (todos) e **Identidad verificada** (solo quien pasó Veriff). El cliente los ve en la ficha y en la hoja de contacto junto al propietario; el propietario los ve en cada consulta junto al cliente. Sustituye las decisiones del 10-02 y 10-12 que hacían obligatoria la identidad y el estado público único «Identidad verificada» que englobaba ambas comprobaciones.

Prototipo: `verificacion-opcional.js` (cargado al final) relaja los requisitos, redefine la pantalla de identidad con opción de saltar y añade los sellos; pruebas actualizadas (`account-access`, `admin-review`, `admin-concierge`, `launch-scope`) y nueva `tests/prototype/verificacion-opcional.cjs`. La landing comercial se conserva sin cambios; su línea «Propietario y cliente con identidad verificada» queda pendiente de revisar junto con el resto de textos. Pendiente en documentos: `identidad-y-seguridad.md`, `architecture.md`, `roadmap.md` y CLAUDE.md siguen describiendo Veriff como obligatorio.

## 2026-10-13 · Mis consultas abre WhatsApp directamente

Decisión del usuario: el cliente ya abrió el chat con el propietario, así que responder no necesita plantilla ni pantalla intermedia. En Mis consultas el botón pasa a «Abrir WhatsApp» y abre el chat con ese cliente sin mensaje preparado. La plantilla se conserva solo para el primer mensaje del cliente desde la ficha. Prototipo: `consultas-directo.js`; prueba `tests/prototype/consultas-directo.cjs`.

## 2026-10-13 · Cuenta simplificada

Decisión del usuario: reducir botones y clics en Mi cuenta / Cuenta. Portada con nombre, teléfono y dos sellos (Identidad, WhatsApp); «Escribinos por WhatsApp» como acción principal; «Promoción y suscripción» (propietario) o «¿Tenés una casa? Publicala» (cliente); «Editar perfil» plegado, que contiene foto, descripción, correo de recuperación y Cambiar WhatsApp; «Cerrar sesión» como enlace. Se retiran «Cerrar otras sesiones» y «Mis contactos» (el registro de aperturas se consulta desde WhatsApp). Mientras falta Veriff se muestra el aviso por rol y «Verificar mi identidad».

Prototipo: `account-simple.js`, cargado al final, sustituye la portada de `account-access.js` reutilizando sus acciones. Prueba: `tests/prototype/account-simple.cjs`.

## 2026-10-13 · Contacto con bnbtico solo por WhatsApp, un número por rol

Decisión del usuario: el único canal de atención de bnbtico para clientes y propietarios es WhatsApp, con un número para propietarios y otro para buscadores. Se retira de la v1 el flujo de reclamaciones dentro de la app: desaparecen «Reclamaciones y ayuda» de Mi cuenta / Cuenta, «Reportar un problema» de la ficha y la pestaña Reclamaciones de Admin. Cualquier problema se trata por el WhatsApp de soporte del rol; Admin conserva Usuarios, desactivar/reactivar con motivo e historial privado. En la cuenta queda un único botón «Escribinos por WhatsApp».

Prototipo: módulo `support-whatsapp.js`, cargado al final, oculta esos accesos sin borrar `claims.js` (sus pantallas quedan sin ruta visible, conservadas como exploración). Números de ejemplo, sin apertura real. Prueba: `tests/prototype/support-whatsapp.cjs`. Sustituye las decisiones de reclamaciones del 2026-10-05 y 2026-10-12 en lo que toca a la interfaz; `reclamaciones.md` pasa a histórico.

## 2026-10-13 · Alta sencilla, sesión recordada y recuperación

Se aprueba implementar en el prototipo el mismo registro para ambos roles: nombre y WhatsApp, con código para completar el alta. No correo inicial ni contraseña, huella o Face ID. La sesión se recuerda; un nuevo dispositivo/navegador requiere otro código. Foto, descripción y correo son opcionales en el perfil. Sugerir correo de recuperación y exigir su confirmación antes de usarlo. Cambio de WhatsApp: verificar nuevo destino antes de reemplazar el anterior, conservar cuenta/Veriff y revocar otras sesiones. Sin acceso: correo confirmado o revisión manual de soporte. No detectar automáticamente cambios externos de número.

Veriff permanece pendiente tras registrar y se exige antes de publicar/contactar; copy dirigido al rol correspondiente. Implementación exclusivamente simulada en `account-access.js`, con almacenamiento local de datos ficticios y sin envíos ni seguridad de producción. No cambia la landing. Especificación y límites: [identidad y seguridad](identidad-y-seguridad.md#registro-y-acceso-aprobado--2026-10-13).

## 2026-10-13 · Atención manual y consultas creadas por administración

Dos canales de WhatsApp de bnbtico, uno para propietarios y otro para buscadores. El admin prepara una bienvenida editable por rol y marca su envío manualmente; abrir/preparar no equivale a enviar. Se requiere autorización para recibir la bienvenida y usar la sesión remitente correcta. Números reales pendientes. Al aprobar un anuncio se ofrece el acceso a bienvenida; no se envía automáticamente.

Un cliente puede pedir ayuda por WhatsApp. Administración selecciona su cuenta y crea consultas con fechas/personas/mensaje para casas compatibles. El cliente debe estar activo, con identidad y WhatsApp verificados, y haber autorizado compartir su contacto con esos destinatarios. Se guarda referencia privada de autorización y autoría administrativa. Llegan a «Mis consultas», asociadas a casas concretas, con «Consulta enviada por bnbtico a petición del cliente», no «Abrió tu WhatsApp». No se recupera Pedir casa/Buscan casa ni el reparto automático.

En la demo: selección manual de hasta 10 propietarios, una casa por propietario; revalidación antes de crear, exclusión de consultas activas de esa casa y solapadas del mismo cliente al mismo propietario. Compatibilidad por capacidad, zona, estancia mínima y disponibilidad; otros requisitos deben revisarse manualmente. Solo calendario de diciembre de 2026, sin asumir disponibilidad fuera de ese mes. Datos en memoria, sin WhatsApp ni avisos reales. `admin-concierge.js` y `tests/prototype/admin-concierge.cjs`.

## 2026-10-13 · Contacto iniciado por el cliente y mensajes preparados

Para el lanzamiento se elimina la elección de contacto directo/revisión previa: el cliente verificado inicia WhatsApp desde la ficha, con consentimiento para compartir su número. Fechas, personas y consulta son opcionales. Mis consultas conserva un registro de intentos de apertura, no mensajes confirmados; el propietario no acepta ni descarta consultas y puede volver al chat desde «Contactar por WhatsApp».

El mensaje del propietario identifica cliente, propietario y casa, y añade fechas, personas y «Tu consulta» únicamente cuando existan. Sin contexto usa el saludo sencillo. Texto editable, nunca envío automático. Compartir ficha se destaca en cada casa y se recomienda en el panel: permite recibir contactos verificados desde bnbtico, sin afirmar que verifica contactos externos o garantiza seguridad. Todo se simula en memoria; no hay apertura real de WhatsApp ni verificación real.

En la información de verificación y antes de publicar se explica que clientes y propietarios pasan por las mismas comprobaciones (identidad con Veriff y WhatsApp), con distinto momento de exigencia. No garantiza comportamiento ni reservas seguras. Se mantiene «¿Aceptás largo plazo?» obligatorio Sí/No sin predeterminado; solo Sí habilita precio mensual o consultar al propietario.

## 2026-10-13 · Lanzamiento ligero para captar propietarios

La usuaria aprueba reducir el lanzamiento a publicar casas, compartir sus fichas y recibir consultas directas. Se mantienen registro/borrador, identidad y WhatsApp antes de publicar/contactar, edición y estados por casa, catálogo con filtros básicos, favoritos, calendario sencillo (disponibilidad, precio habitual y excepciones), moderación, reportes y soporte. La ficha compartible no revela teléfonos ni permite saltarse la verificación del cliente, incluso si el owner permite contacto directo.

Se aplazan Pedir casa/Buscan casa, reparto por tandas, barras de consultas en calendario, valoraciones de clientes, temporadas/fines de semana, mapas avanzados, alertas, estadísticas detalladas, PMS y apps nativas. IA sigue a evaluar, no prometida para v2. No se esperan meses ni una v2 completa para probar demanda: pequeño catálogo en una zona y primeras pruebas con clientes. La verificación de titularidad y pagos entre partes siguen fuera del lanzamiento.

`launch-scope.js` aplica este alcance al prototipo sin borrar las exploraciones. El enlace de ficha de la demo solo funciona en el ordenador que sirve localhost; no es publicación pública. Promoción 50/50/100 casas con 12/6/3 meses y contador explícitamente de ejemplo; condiciones de asignación e inicio pendientes. Ver `roadmap.md` para el alcance vigente. Todo sigue en memoria, sin autenticación, Veriff, OTP, notificaciones, archivos subidos ni cobros reales.

## 2026-10-13 · Distribución escalonada de Pedir casa

Se aprueba priorizar propietarios sin consultas en las fechas buscadas y esperar 24 horas antes de ampliar a los demás. Límite acumulado de 10 propietarios distintos; se conserva disponibilidad real de todas las noches como requisito y se excluye al propietario con consulta directa del mismo cliente en fechas iguales/solapadas, incluso descartada. La consulta directa tiene precedencia visual sobre la búsqueda compartida. Identificadores de cuenta, no comparación de nombres.

Sin candidatos libres de consultas, o llegada en 48 horas, envío inmediato hasta 10. Desempate por menos envíos recientes (30 días en la demo). Antes de la segunda tanda se revisan de nuevo consentimiento, identidad/WhatsApp, disponibilidad, duplicados y destinatarios anteriores. Cerrar o «Ya encontré alojamiento» cancela; abrir WhatsApp no. Fechas libres no se interpretan: reparto inmediato sin prioridad por intervalo. Documentación vigente en `contacto-whatsapp.md`. Prototipo en memoria, mes fijo diciembre 2026, botón para avanzar 24 horas; sin notificaciones ni tareas de servidor reales.

## 2026-10-13 · Buscan casa en calendario

Check independiente por casa «Mostrar personas que buscan casa». Barras amarillas dentro de las casillas, solo nombre, combinadas con consultas azules sin superponer líneas. Solo solicitudes activas con consentimiento, fechas explícitas y casa destinataria compatible/verificada. Fechas libres no se interpretan; se añaden Entrada/Salida opcionales a Pedir casa. El detalle diferencia búsqueda compartida de interés directo y permite ofrecer esa casa por WhatsApp, descartar solo para ese calendario o confirmar el acuerdo externo y ocupar sus noches sin cambiar precios. Acuerdo: amarillo/mostaza oscuro, retenido aunque el cliente cierre su búsqueda; cierre impide nuevas propuestas. No se cierra automáticamente la búsqueda ni se descartan otras consultas. Demo fija en diciembre de 2026, sin reservas, pagos ni WhatsApp real.

## 2026-10-13 · Consultas directas en calendario

Gestión aprobada desde una consulta: «Contactar por WhatsApp», «No me interesa» (oculta su barra y conserva historial) y «Marcar como ocupado». Esta última pide confirmar que la estancia se acordó por WhatsApp, ocupa sus noches excluyendo la salida, conserva precios y otras consultas, y muestra «Estancia acordada» con barra azul oscuro. Abrir WhatsApp no marca ocupación ni el acuerdo concede consentimiento de contacto. Sin cobros ni gestión de reservas en bnbtico: anotación manual del propietario. Una estancia ya acordada no ofrece descarte; la disponibilidad sigue siendo editable desde el calendario. La demo rechaza marcar parcialmente estancias que excedan diciembre de 2026.

Ajuste visual posterior: barras finas de una línea, solo con el nombre. Fechas y número de noches se conservan en el detalle al tocar y en el texto accesible; mismo color y nombre entre semanas, sin flechas ni texto adicional visible.

Refinamiento aprobado: sustituir etiquetas diarias/contador por una barra continua por consulta, con nombre, fechas y noches. Las barras van dentro de las casillas de los días, debajo de su número y precio, no en filas externas al fondo de disponibilidad. Coincidencias en líneas separadas; continuación entre semanas con mismo color/línea y flechas. Cada barra abre únicamente su consulta. Se mantienen intactos disponibilidad, tarifas y consentimiento.

Se aprueba ver solo consultas directas de la casa seleccionada mediante «Mostrar consultas», sin búsquedas compartidas. Etiquetas azules separadas del precio y disponibilidad; agrupación cuando coinciden varias. Al pulsar, detalle con fechas, personas y mensaje, seguido del flujo existente de contacto por WhatsApp. Son consultas, no reservas: no alteran días ni tarifas. Se representan noches (llegada inclusiva, salida exclusiva). Fechas explícitas sin inferirlas del mensaje; consultas sin fechas permanecen en Mis consultas. La demo sigue fija en diciembre de 2026 y no envía WhatsApp real.

## 2026-10-13 · Preferencia de contacto para todas las casas

Mis consultas incorpora el ajuste general de WhatsApp directo o revisión previa en bnbtico. «Todas» incluye casas actuales y futuras. Aplicarlo reemplaza los ajustes actuales, con aviso explícito; después cada casa puede tener su excepción. Las nuevas heredan el valor general, no la última excepción. No se modifica Buscan casa, no se envían mensajes ni se revocan contactos anteriores. La demo conserva las verificaciones y aplica el cambio general de forma atómica.

## 2026-10-13 · Consultas directas y búsquedas en pestañas independientes

Owner conserva Calendario y divide Contactos en Mis consultas (título Interés en mis casas) y Buscan casa (Personas buscando casa). Inicio distingue ambas con explicación y contadores de pendientes, no mensajes sin leer. Cada búsqueda compartida explica que el cliente no eligió esa casa; acción Ofrecer mi casa por WhatsApp. Se conserva el límite actual de 10: reducir a 5 fue una sugerencia, no una decisión aprobada.

Cliente → Mis solicitudes no recibe propuestas ni mensajes internos: muestra criterios, estado y propietarios que iniciaron contacto desde bnbtico, sin afirmar envío o entrega de mensajes por WhatsApp ni mostrar precios supuestamente ofrecidos. Cerrar búsqueda cambia su estado y retira el consentimiento para nuevos contactos desde esa solicitud, conservando contactos previos y sin prometer detener conversaciones externas. Todo sigue simulado en memoria.

## 2026-10-13 · Sin filtro de propietarios verificados

Se elimina «Solo owners verificados» de los filtros por redundante: todos los propietarios deben completar identidad y WhatsApp antes de publicar. No cambia las condiciones de publicación ni de contacto.

## 2026-10-12 · Selección primero y edición conjunta

Se sustituye elegir modo antes de fechas por tocar directamente uno o varios días. Panel inferior fijo muestra cantidad y fechas, Disponible/Ocupado, precio actual editable y Restaurar tarifa. Mismo precio: precargado; distintos: «Varios precios». Sin tocar precio se conserva cada importe; escribir uno crea excepciones ★ solo donde difiera de la tarifa vigente; si coincide, sigue esa tarifa. Guardar cambios confirma conjuntamente solo lo modificado, sin cambios parciales si hay error. Cancelar o desmarcar todos elimina el borrador. Restaurar muestra inmediatamente cada tarifa vigente en el editable, o «Varios precios» si difieren. El campo sigue editable y solo Guardar cambios confirma. Se retira el texto explicativo bajo el calendario, salvo «Precios orientativos». Configurar tarifas sigue separado arriba. Sustituye la iteración anterior de tres acciones previas.

## 2026-10-12 · Tres acciones y restauración de precio

Se retiran los botones de asignación Habitual/Alta/Baja/Especial. Solo Disponible, Ocupado y Cambiar precio. En Cambiar precio se introduce importe manual (★) o se marca Restaurar precio de tarifa y se aplica a los días seleccionados. Restaurar borra la excepción, calcula la tarifa por los rangos vigentes y su importe de fin de semana si corresponde, quita ★ y mantiene disponibilidad. Guardar configuración recalcula rangos en todos los días no especiales, también al mover/acortar un período; no conserva asignaciones antiguas fuera de rango. Especiales sobreviven a la reconfiguración hasta restaurarlos explícitamente.

## 2026-10-12 · Fechas obligatorias al configurar temporadas

Alta y baja requieren inicio y fin si se introduce cualquiera de sus precios (por noche o fin de semana). Sin temporada configurada no se exigen fechas. Validación atómica: fechas completas, existentes, ordenadas y sin solapamiento; error mantiene el panel abierto y el calendario intacto. La temporada sigue requiriendo precio por noche aunque se indique precio de fin de semana. Sustituye el carácter opcional anterior de las fechas; demo limitada a diciembre de 2026.

## 2026-10-12 · Simplificación de tarifas

Se sustituyen porcentajes y checks por importes directos. Cada sección (Tarifa habitual, Temporada alta, Temporada baja) tiene Precio por noche y Precio de fin de semana opcional. Viernes/sábado usan ese importe de su propia sección; vacío usa su precio por noche todos los días, sin heredar el fin de semana de otra sección. Domingo usa precio por noche. Especiales se conservan como importe final; fechas opcionales de temporadas, disponibilidad y guardado colapsable sin cambios. Esta decisión sustituye las propuestas anteriores de aumento porcentual y checks independientes.

## 2026-10-12 · WhatsApp editable y verificado por casa

La usuaria sustituye la regla de número único para todos los anuncios. Crear casa copia el WhatsApp de cuenta a un campo editable; si se mantiene el verificado, no repetir comprobación. Otro número requiere código antes de publicar/usarlo. En casas publicadas se conserva el anterior hasta verificar el nuevo. Cada destino es independiente: cambiarlo no actualiza otras casas ni permite compartirlo sin consentimiento. Verifica acceso al teléfono, no identidad del operador. Demo en `listing-whatsapp.js`, código 123456 visible, sin envíos reales; producción requiere OTP y permisos en servidor.

## 2026-10-12 · Tarifas compartidas, fines de semana y saturación

Ajuste visual posterior: retirar Alta/Baja, +% y símbolos ✓/× de cada casilla para simplificar el calendario; mantener día, precio, colores y estrella especial. La leyenda se reduce después a Disponible, Ocupado y ★ Especial, eliminando Base/Alta/Baja y +% Fin de semana. Información completa conservada en texto accesible y resumen, sin cambios de cálculo.

Corrección aprobada: base orientativa al crear la casa; alta y baja opcionales configuradas en calendario, compartidas por todos los días asignados a cada temporada. Especial por día concreto, independiente de cambios de temporada; la selección múltiple permite asignar el mismo importe a varios días sin vincular sus futuras ediciones. Checkbox opcional de fin de semana y porcentaje aplicado sobre base, alta o baja, excluyendo especiales (última corrección aprobada), solo para noches de viernes y sábado (corrección posterior aprobada: domingo a lunes sin aumento). Sin acumulación al guardar/recalcular. No altera disponibilidad. Vaciar una temporada devuelve sus días a base, conservando especiales.

Se sustituyen rayas/puntos por saturación: alta intensa, baja suave, base intermedia, siempre verde disponible/rojo ocupado, con texto y símbolos. Botones de tarjeta: Disponible verde / No disponible rojo; Contacto directo Sí verde / No ámbar. Demo en memoria y sin pagos; detalle vigente en `design.md`.

Ajuste aprobado posterior: botones Alta/Baja ocultos sin tarifa; Base/Alta/Baja muestran importe. Inicio/Fin opcionales de temporadas alta y baja aplican el período inclusivo conservando especiales y disponibilidad. Guardar tarifas cierra el menú si es válido. El check de fin de semana aparece al definir un porcentaje; desactivarlo conserva ese valor. Demo limitada explícitamente a diciembre de 2026.

Última organización aprobada: secciones Base, Alta y Baja. Porcentaje compartido definido junto a base; check independiente por cada tarifa, inicialmente marcado y visible con porcentaje configurado. El check base solo afecta a base, no desactiva alta/baja. Vaciar el porcentaje suspende todos los aumentos conservando preferencias. Especiales excluidos. Se corrige la propuesta inicial que trataba el check base como general.

## 2026-10-12 · Calendario visual, cierre temporal y reapertura opcional

Aprobado inicialmente: color para disponibilidad (verde/rojo) y patrón para tarifa; los patrones fueron sustituidos por saturación según la corrección de arriba. Modos de edición, selección múltiple y Aplicar; cambiar temporada no libera días ocupados. Estado por casa, sin reservas ni pagos.

La tarjeta sustituye Desactivar por Disponible/No disponible; Activar/Desactivar queda en Editar. No disponible cierra el calendario entero y bloquea nuevas consultas, manteniendo anuncio visible y todos los datos del calendario intactos. Volver a Disponible restaura esos datos. Desactivar oculta el anuncio; no son equivalentes. Las consultas previamente recibidas pueden seguir atendiéndose.

Al cerrar, fecha opcional de reapertura futura (00:00 Costa Rica). Sin fecha queda cerrado hasta acción del propietario; reabrir manualmente cancela la fecha. Una reapertura nunca publica un anuncio desactivado. Demo fija de diciembre 2026, memoria local y temporizador solo con página abierta, no un servicio de producción. Backend/retención/programación pendientes. También se explicitan ambas opciones de contacto: directo por WhatsApp o revisar primero cada consulta en bnbtico.

## 2026-10-12 · Características con casillas y tarifa de parqueo

La usuaria simplifica el formulario: mascotas, piscina, wifi, aire acondicionado y parqueo se marcan mediante checkbox cuando están disponibles. Parqueo revela Gratuito/De pago, obligatorio si está marcado, sin preselección; desmarcar borra la tarifa. Se retira Está amueblado, incluso si se acepta largo plazo. Formulario, datos enviados a revisión y ficha admin adaptados. Demo en memoria, sin cambio de esquema de producción; `parkingType` pendiente de trasladar a backend.

## 2026-10-12 · Contacto directo opcional por casa

La usuaria aprueba **No por defecto**, pero corrige la propuesta de perfil: la preferencia es **por casa**. En Mis casas se muestran Calendario, Editar, Activar/Desactivar y Contacto directo Sí/No. El teléfono continúa en la cuenta. Sí supone autorización anticipada del propietario; el cliente verificado consiente compartir su número y abre WhatsApp sin aceptación individual. No mantiene el flujo vigente. Solicitudes masivas y contactos ya aceptados no cambian. Sin integración de avisos ni botones en WhatsApp Business.

Demo en `house-controls.js`, pausa local y controles de cuenta/identidad simulados, conservando deduplicación. Calendario corresponde a la casa elegida; Editar prepara su borrador para revisión, sin sustituir automáticamente el anuncio público. Sin envíos, persistencia, cobros ni OTP real. Especificación: `contacto-whatsapp.md`.

## 2026-10-12 · Descartar por ahora notificaciones y aceptación en WhatsApp Business

La usuaria descarta por ahora los avisos automáticos por WhatsApp Business y el botón de aceptar integrado en el chat con bnbtico. La aceptación o el descarte siguen dentro de bnbtico; después se accede al WhatsApp directo entre las partes. No implementar plantillas de consultas, botones de respuesta ni redirecciones de aceptación desde WhatsApp. No hay integración real que retirar. Se conserva la verificación de WhatsApp por OTP junto a Veriff: la aclaración se refiere a notificaciones y aceptación, no a esa comprobación. Tampoco cambia el WhatsApp manual de soporte. Cualquier reconsideración requiere una nueva decisión, sin compromiso de v2.

## 2026-10-12 · Un único estado público de identidad verificada

Aclaración de la usuaria: «Identidad verificada» incluye Veriff y WhatsApp verificados. Solo se separan los pasos para informar a la propia persona de qué le falta y para el control interno; no hay dos sellos públicos. No se publican casas de usuarios con alguna comprobación pendiente ni se permite contactar a propietarios sin ambas. Registro/login siguen sin barrera inicial. Actualización documental; pantallas e integración aún pendientes. Fuente: `identidad-y-seguridad.md`.

## 2026-10-12 · Veriff y WhatsApp obligatorios para ambos roles

La usuaria aprueba identidad mediante Veriff y verificación de WhatsApp mediante OTP para todos los propietarios y clientes. Registro/login sin verificaciones iniciales; ambas antes de contactar, enviar solicitudes, publicar o responder. Número por usuario, no por casa. No sustituye consentimiento de contacto ni comprueba propiedad; titularidad registral continúa fuera de v1. Fuente: `identidad-y-seguridad.md`. Solo documentado: pantallas OTP y conexiones Meta/Veriff pendientes. No elige WhatsApp como único login ni aprueba por sí mismo la integración de notificaciones de consultas.

## 2026-10-12 · Distinguir interés directo y búsquedas compartidas

La usuaria elige renombrar «Me contactaron» a **Interés en mis casas**. Ambas pestañas de Contactos incluyen explicación visible: interés directo por un alojamiento concreto frente a **Solicitudes**, búsquedas enviadas a varios propietarios compatibles donde pueden ofrecer una casa. Se corrige la demo para que las respuestas a búsquedas compartidas no creen nuevas entradas de interés directo; siguen en Solicitudes y en el historial del cliente. Sin cambiar consentimiento ni contacto por WhatsApp.

## 2026-10-12 · Usuarios administrables y soporte propio; sin devoluciones en la app

Aprobado Admin → Usuarios para propietarios y clientes: buscar, consultar identidad/anuncios/reportes, desactivar/reactivar con motivo y confirmación y conservar historial. Desactivar oculta anuncios e impide nuevos contactos/publicaciones, manteniendo ayuda y reclamaciones. WhatsApp de negocio exclusivo de bnbtico para soporte desde ficha/caso, sin intermediación entre las partes ni importación de chats. Demo ficticia con notas privadas manuales, sin envíos. El número real queda pendiente de configuración.

La usuaria retira toda gestión de devoluciones entre partes: eliminar importe/moneda, aceptación de devolución, comprobantes y confirmación de recepción. Si quieren devolución, la describen libremente y la acuerdan fuera de bnbtico. Admin solo gestiona el reporte, conducta y medidas de cuenta. Sustituye las decisiones previas sobre seguimiento de dinero; no afecta al modelo de suscripción de bnbtico.

## 2026-10-12 · Explicar las acciones ante reportes

Texto aprobado visible antes de reportar y durante el seguimiento: qué revisa bnbtico, cuándo pide respuesta, qué medidas puede tomar y cómo solicitar revisión. Aclarar devolución directa sin garantía y sin acceso a WhatsApp; no hay sanción automática ni recargos. Mantener aviso explícito de acciones simuladas en el prototipo. No añadir sanciones efectivas ni prometer plazos mediante este cambio de copy.

## 2026-10-12 · Revisar el anuncio completo antes de aprobar

La usuaria aprueba añadir una ficha completa de revisión en admin: descripción, fotos ampliables, ubicación, características, precios y condiciones. Se sustituyen las decisiones rápidas de la cola por Revisar anuncio. Aprobar requiere haber abierto la ficha, identidad aprobada y cinco fotos; pedir cambios o rechazar exige motivo. La identidad sigue siendo responsabilidad de Veriff, sin aprobación manual ni comprobación registral en v1. La demo conecta envíos del formulario con la cola y refleja el estado en Mis casas; no publica, notifica ni persiste datos. Fotos reales, mostrar el motivo al propietario y corrección/reenvío quedan pendientes.

## 2026-10-12 · IA como posibilidad, no compromiso de producto

La usuaria no tiene decidido incorporar búsqueda asistida por IA. Se mueve de v1 a Pendientes de decisión, sin prometerla para v2. Se retiran del prototipo su tarjeta y registro de ruta. Se conservan el simulador histórico y las propuestas para evaluar utilidad, costes y experiencia; cuotas, créditos y precios no son requisitos de lanzamiento. Pedir casa sigue visible y gratuito, sin IA, con matching y validaciones conservados. Esta decisión sustituye la inclusión de búsqueda asistida en la limpieza v1 anterior.

## 2026-10-12 · Mostrar solo alcance v1 en el prototipo

La usuaria pide ocultar funciones posteriores. Retirados el acceso a Verificar propiedad y la carga de `property.js` (incluida su ruta), la tarjeta de planes por nivel y la promesa de descuentos por volumen. Se conservan código histórico, guía y roadmap para v2, no se eliminan datos. Admin pasa a Revisión de anuncios, con estado simulado de Veriff de solo lectura, sin cédula/selfie ni aprobación manual de identidad. La identidad pendiente bloquea aprobar el anuncio. Se mantienen búsqueda asistida y reclamaciones por pertenecer a v1; no se añaden agencias ni integraciones PMS. Prueba de entrada completa: `tests/prototype/v1-scope.cjs`. Siguen pendientes las adaptaciones de catálogo/búsquedas descritas en `publicacion.md`; ocultar v2 no implica que el prototipo ya sea la app de producción.

## 2026-10-12 · Campos obligatorios y catálogo vacacional

Se aprueba aplicar al formulario las decisiones de [publicacion.md](publicacion.md): solo Casa/Apartamento/Habitación; alquiler vacacional con precio por noche; Acepta largo plazo obligatorio y sin preselección, con precio mensual o Consultar con el propietario; habitaciones y baños obligatorios, uso privado por defecto; un WhatsApp por usuario, nunca por casa. Sustituye los dos modos excluyentes y las propuestas de No por defecto y teléfono por anuncio. Demo implementada en `publication.js`, con validación y estado en memoria. Catálogo, buscadores, matching y migraciones aún necesitan adaptar el modelo de modalidad; no afirmar que estén migrados. Sin integración de identidad, fotos, pagos ni publicación real.

## 2026-10-12 · Sincronización completa con PMS en v2

La usuaria aprueba incluir en v2 la importación y actualización de anuncios desde el gestor de propiedades (PMS) del propietario o agencia: **descripción, fotos, precios y disponibilidad**. El objetivo es evitar mantener el mismo anuncio en varios sitios. iCal queda como alternativa de calendario, no como solución a la sincronización completa.

Dirección propuesta: conectar la cuenta con autorización, seleccionar casas, revisar los anuncios antes de publicarlos y mantener el PMS como fuente de los campos sincronizados. Evaluar OwnerRez como primer candidato, sin proveedor contratado ni acceso aprobado; ampliar según los PMS de los primeros usuarios. Cada conector requiere validar acceso, condiciones, campos disponibles y frecuencia de actualización. Mantener identidad, moderación de fotos/descripciones y suscripción por casa; los precios siguen siendo orientativos y deben distinguir moneda, tarifa por fecha y suplementos.

El modelo sigue siendo contacto por WhatsApp tras solicitud y aceptación, sin gestionar reservas ni pagos entre partes. La [documentación de integración de canal de OwnerRez](https://www.ownerrez.com/support/articles/api-channel-integration-overview), consultada el 2026-10-12, admite consultas por correo como alternativa y exige datos reales de contacto. No se ha encontrado allí una prohibición de WhatsApp: queda por confirmar con el proveedor el encaje de bnbtico, el formato de las consultas y el consentimiento necesario para compartir correo/teléfono, sin adelantar la entrega de datos respecto al flujo aprobado. No asumir aprobación comercial ni imponer un flujo de reservas.

Solo planificación de v2: no se ha implementado conexión, modificado el prototipo ni contactado a proveedores.

## 2026-10-12 · Excluir verificación de propiedad de v1

La usuaria descarta comprobar titularidad registral en la primera versión. Se mantiene la identidad obligatoria de clientes y propietarios mediante Veriff. V1 no solicita número de finca ni certificación literal, ni ofrece sello o cola admin de titularidad. La guía y la demo existentes se conservan como exploración posterior, sin comprometer una fecha. Ocultar el recorrido de propiedad del prototipo queda pendiente; no se ha modificado código en esta iteración. La promoción no debe exigir verificación de titularidad: la propuesta de asignar plaza al publicar por primera vez una casa aprobada sigue pendiente de confirmación.

## 2026-10-12 · Guardar estrategia desde cero, registro directo y tarifas de agencia en estudio

La usuaria pide conservar la conversación en su proyecto. Se actualizan [marketing.md](marketing.md) y [business-model.md](business-model.md), con un [resumen de la sesión de marketing](resumen-marketing-2026-10-12.md). Esto no autoriza publicar anuncios, contactar negocios, gastar dinero ni implementar los precios propuestos.

Preferencia expresada: los anuncios deben llevar a registrarse y publicar directamente en bnbtico. La captación mediante formulario comercial y asistencia obligatoria queda sustituida por registro directo con ayuda opcional. La app debe estar operativa antes de contactar comercialmente. Se propone permitir completar el recorrido en web móvil y ofrecer ayuda de IA para título/descripción; esa integración aún no existe.

Última recomendación de publicidad, pendiente de presupuesto y ejecución: hasta US$200 compartidos entre Facebook e Instagram para captar propietarios, con dos anuncios, hasta 20 días a unos US$10 diarios y revisión tras US$50. Destino: registro/publicación. Carteles, Google, TikTok e influencers quedan fuera de esa primera asignación. Es distinta de la propuesta posterior para viajeros y no garantiza captar 50 casas.

La usuaria cuestiona los paquetes baratos para agencias y menciona US$20 por casa y «a partir de 7». Se respondió interpretando un posible suelo de US$7 por casa y proponiendo niveles US$20/15/10/7 según volumen. Interpretación, umbrales y fórmula no están cerrados: la tabla aplicada a todas las casas haría bajar la factura al cruzar umbrales. No implementarla como regla de cobro. Se mantiene la referencia individual de ₡9.900 y la promoción confirmada por casa de 12/6/3 meses.

## 2026-10-07 · Oferta de lanzamiento escalonada para las primeras 200 casas

La decisión final de la usuaria es **1 año gratis para las primeras 50 casas (posiciones 1–50), 6 meses para las siguientes 50 (51–100) y 3 meses para las siguientes 100 (101–200)**. El cupo global es de 200 casas y se cuenta por casa, aunque un propietario o agencia publique varias; cada propiedad recibe el tramo que le corresponda. La cuota posterior de referencia sigue siendo ₡9.900/mes por casa; identidad y requisitos de publicación se mantienen. Condiciones en [business-model.md](business-model.md).

Esta corrección sustituye el mes gratis original, la propuesta de tres meses para todas las casas, los cupos por propietario y la propuesta intermedia de cinco meses en el segundo tramo. Motivo: una oferta de lanzamiento limitada que incentive incorporar las primeras casas. Criterio propuesto, aún por concretar: asignar plaza y comenzar el período en la primera publicación aprobada. Alta sin tarjeta, conversión al pago, duplicados/republicaciones, posible fecha límite adicional y combinación con el descuento anual pendientes de concretar; no hay implementación ni cobros reales. Cualquier contador público deberá reflejar plazas reales conforme al criterio que se acuerde.

La usuaria quiere desarrollar la app antes de contactar comercialmente a propietarios y agencias. Durante el desarrollo se prepara la estrategia. El Caribe es la zona recomendada para el piloto porque tiene una casa allí y conoce qué agencias operan, aunque no son contactos personales; zona concreta y presupuesto pendientes. Plan de trabajo en [marketing.md](marketing.md). El prototipo todavía muestra el antiguo primer mes gratis; su actualización está anotada en el roadmap.

## 2026-10-07 · Volver al contacto sencillo por WhatsApp

La usuaria aprueba volver a la versión simple y abrir el prototipo. Se eliminan el chat interno, su bandeja y la arquitectura provisional de números intermediarios. Cliente: solicita contacto aceptando compartir su número. Owner: acepta contactar por WhatsApp o marca «No me interesa». Sin selector de canales; sin comisión por alquiler ni pagos entre partes. La identidad obligatoria, titularidad opcional, marca y reclamaciones se conservan. Siguen vigentes los siete días por cliente/casa, sin duplicar avisos ni reiniciar el plazo al descartar. Una solicitud nueva no hereda la aceptación de otra; la caducidad no retira un contacto ya compartido. Especificación: `contacto-whatsapp.md`.

La demo no abre WhatsApp, envía mensajes ni verifica identidades. Se guardó la versión con chat y sus pruebas/documentos en `backups/bnbtico-antes-volver-whatsapp-2026-10-07.tar.gz`; el código de la prueba privada retirada se puede recuperar ahí. Esta decisión sustituye las dos alternativas de chat y puente que siguen como historial.

## 2026-10-07 · Arquitectura provisional: cliente en bnbtico, owner en WhatsApp Business

Después de la demo de chat interno, la usuaria acepta que el cliente converse en bnbtico y el owner desde su número habitual de WhatsApp Business, mediante un número intermediario de bnbtico por cliente. No es un número nuevo por owner ni WhatsApp personal para ambos. Se pretende separar los clientes en el WhatsApp del owner sin entregar el teléfono personal del cliente. Aprobación provisional, condicionada a proveedor, límites, presupuesto y reglas de mensajería; no autoriza contratación ni compras. El chat directo opcional con doble aceptación no se elimina. El prototipo actual no implementa el puente: ambos lados siguen simulados dentro de la app. Especificación y pendientes, incluidos varias casas por pareja de participantes y reutilización de números: `chat-privado.md`.

## 2026-10-07 · Probar chat privado y WhatsApp opcional

La usuaria aprobó experimentar con un chat privado sencillo dentro de bnbtico: «Contactar» lleva al chat, sin elegir canal primero. «Pasar a WhatsApp» exige aceptación explícita de ambas partes; rechazar mantiene el chat. Sin Twilio ni números intermediarios. Se conservan solicitudes por cliente/casa durante 7 días, caducidad sin cierre del historial y «No me interesa» sin reinicio. Pedir casa recibe propuestas privadas, no comparte números. Demo en memoria, sin envíos ni filtro de texto; producción y privacidad pendientes. Especificación: `chat-privado.md`. Se guardó antes la versión completa del prototipo/documentos/pruebas en `backups/bnbtico-antes-chat-privado-2026-10-07.tar.gz` porque la usuaria quiere evaluar el cambio de forma reversible. Esta decisión sustituye las entradas históricas sobre contacto directo obligatorio.

Formato: fecha · decisión · motivo · alternativas descartadas.

## 2026-10-05 · Asistente guiado para verificar propiedad
La usuaria aprueba botón por casa en Mis casas: pregunta si tiene certificación, guía paso a paso con enlace al Registro y ayuda para encontrar finca, código y envío tras aviso/consentimiento. Implementado en property.js como demo: código ficticio exclusivo, progreso por casa en memoria y estado «Verificación en revisión», sin sello automático. No recoge documentos reales ni consulta el Registro; revisión admin y sellos públicos con ayuda siguen pendientes. Flujo y prueba en docs/design.md.

## 2026-10-05 · Etiquetas explicadas y guía de certificación literal
Etiquetas aprobadas: «Identidad verificada» para owners y clientes; «Propietario verificado» opcional por casa y «Copropietario verificado» cuando proceda. Cada una lleva ayuda pulsable. Copy exacto en identidad-y-seguridad.md: identidad sin mencionar Veriff y propiedad con fecha, sin añadir en ese texto breve la frase de exclusión retirada por la usuaria. El alcance de las comprobaciones no cambia. Se amplía guia-verificacion-finca.md con obtención de certificación literal, código distinto de finca/plano, validación oficial, coste en el portal y resolución de problemas. Guía y requisitos documentados; botones, formulario y revisión admin pendientes de implementar. No se compra ni se solicita información real.

## 2026-10-05 · Marca bnbtico aplicada al prototipo
Se integra el logo original elegido en este chat (rana sonriente sobre hoja y texto bnbtico), conservado sin modificaciones en `design/prototype/assets/bnbtico-original.png`. La cabecera muestra únicamente el panel inferior mediante CSS; no se regenera ni se usa la captura con Canvas. Coral de marca #FF385C, variante de acción #D92349 para contraste con blanco y tonos rosados suaves; verde reservado a WhatsApp y estados positivos, con colores naturales en fotos/mapa. Se mantienen fondos cálidos, tipografías y flujos. Tokens actualizados; nombre del repo, ruta HTML e IDs CT sin cambios. Dominio y marca legal siguen pendientes.

## 2026-10-05 · Dos verificaciones: identidad obligatoria y titularidad opcional
La usuaria elige Veriff para verificar identidad y solicita una segunda comprobación opcional por casa basada en número de finca. Sustituye la decisión previa de no comprobar titularidad, sin añadir autorización de alquiler. No solicitar el segundo sello no impide publicar si se cumplen los demás requisitos. Veriff sigue sin contrato/integración; Essential es candidato de plan. El nombre preciso del sello propuesto es «Titularidad registral comprobada», no garantía de vivienda o pago. Guía: guia-verificacion-finca.md. Acceso a datos, obligaciones legales, excepciones societarias y condiciones pendientes: privacidad-verificaciones.md. Documentación creada; pantallas y comprobaciones reales aún no implementadas.

## 2026-10-05 · Reclamaciones sin recargos y devolución directa
La usuaria aprueba gestionar reportes y pedir devoluciones al owner sin que bnbtico reciba ni devuelva el dinero. Se descarta subir la cuota por denuncias: revisión con pruebas y respuesta de ambas partes, medidas proporcionales y posibilidad de reclamar. Comprobante del owner no cierra una devolución sin confirmación del cliente. Devolver no elimina medidas. Flujo simulado y límites en reclamaciones.md; no hay sanciones, archivos ni pagos reales.

## 2026-10-02 · Identidad para ambos roles; sin comprobar autorización de alquiler
La identidad es el principal servicio diferencial. Clientes y propietarios deben verificar documento, rostro y presencia real antes de contactar/enviar solicitudes o publicar/responder. El alta, exploración y preparación de borradores deben ser sencillos. La usuaria descarta verificar titularidad o autorización: queda un único sello «Identidad verificada», sin garantía sobre la casa. Esto sustituye la revisión manual solo de owners y la propuesta intermedia de dos sellos. Ver identidad-y-seguridad.md.

## 2026-10-02 · Veriff como candidato y protección de cuentas propuesta
Essential es una opción de piloto, no contratación ni elección definitiva. Plus/Premium y Sumsub se compararon; no asumir que el plan superior es imprescindible. Validar documentos locales, resultados, facturación, revisión y tratamiento/borrado de datos. Passkeys, autenticación reforzada, avisos, límites y recuperación segura se propusieron, pero requieren aprobación y diseño. No están implementados.

## 2026-10-02 · Costes y alcance de la sesión
Contabilizar identidad de clientes y propietarios. Se acepta evaluar un precio mayor por calidad, sin cambiar todavía la referencia ₡9.900/mes y primer mes gratuito. Comunidad sin anuncio como posible plan más barato, sin precio/funciones cerrados; no regalar acceso solo por verificación ni un año gratuito a verificados. Dirección de marca bnbtico, rana sobre hoja roja. Resumen consolidado: resumen-sesion-2026-10-02.md. Las entradas anteriores que siguen son históricas cuando contradicen estas decisiones.

## 2026-10-02 · Decisión final de contacto: WhatsApp directo
Se elimina el número intermediario, el chat privado simulado y la aceptación bilateral para simplificar. Cliente y owner conversan directamente en WhatsApp; bnbtico no puede garantizar que sus números queden ocultos. Se mantiene una solicitud por cliente/casa cada 7 días y «No me interesa» sin reiniciar ese plazo. La limitación afecta solo a avisos dentro de bnbtico. En Pedir casa se requiere consentimiento explícito para responder al cliente por WhatsApp. Especificación vigente: contacto-whatsapp.md. Las decisiones de intermediación que siguen son históricas.

## 2026-10-02 · Una solicitud por cliente y casa durante 7 días
Plazo desde el envío original, configurable. Los intentos repetidos abren la consulta existente sin duplicar avisos. «No me interesa» no cambia la fecha ni bloquea futuras consultas. Al vencer, el aviso deja de estar pendiente y se puede crear otra solicitud; se conservan historial y conversaciones anteriores. Se descarta el límite por propietario porque un cliente puede interesarse por varias casas. Implementado únicamente en el prototipo; especificación en `contacto-privado.md`.

## 2026-10-02 · WhatsApp intermediado y contacto con consentimiento bilateral
El cliente y el propietario hablan mediante el número de bnbtico hasta que ambos acepten compartir sus contactos. Sin contacto propietario → propietario ni reparto automático de teléfonos en solicitudes. Sustituye las decisiones anteriores de WhatsApp directo y exposición del número por consentimiento unilateral. Prototipo funcional de texto en `design/prototype/relay.js`; especificación y limitaciones en `contacto-privado.md`. Integración real, proveedor y migraciones pendientes.

## 2026-10-02 · Prioridad de comunidad local de propietarios e iteración del prototipo
La usuaria quiere que el proyecto sirva sobre todo para que los propietarios hagan comunidad local. Esta orientación complementa el catálogo y el contacto directo con clientes; no define todavía funciones concretas entre propietarios ni cambia las reglas existentes sobre WhatsApp, reservas o pagos. Próximo trabajo: continuar iterando sobre el prototipo actual. El nombre sigue abierto; se han explorado Nidaluma, Ticosticos y Localtico, sin selección definitiva ni disponibilidad de dominio garantizada.

## 2026-10-02 · Modelo de negocio: suscripción por casa, sin comisiones
Los owners pagan una cuota mensual por cada casa activa (ref. ₡9.900). Sin comisión por reserva. Motivo: replicar el modelo local (todo se cierra por WhatsApp) y diferenciarse de Airbnb/Booking. Descartado: plan único por owner (penaliza a quien tiene una sola casa) y planes por nivel (quedan para v2).

## 2026-10-02 · Sin reseñas de casas; los owners valoran a los clientes
No se puede comprobar quién se hospedó porque la reserva ocurre fuera de la app, así que las reseñas de casas serían falsificables. En cambio, los owners (que pagan) valoran a los clientes que los contactaron. La confianza hacia la casa viene de la verificación manual del owner con cédula.

## 2026-10-02 · Contactar requiere cuenta de cliente
Teléfono verificado por OTP. Permite registrar leads, que los owners sepan quién escribe y que puedan valorarlo. Descartado: contacto anónimo.

## 2026-10-02 · Precio orientativo + calendario manual
El owner fija precio base y puede marcar días ocupados/precios especiales a mano. Todo se negocia por WhatsApp. Descartado: reservas y pagos en la app.

## 2026-10-02 · Pagos de suscripción gestionados por la plataforma
Tarjeta con renovación automática + SINPE Móvil (pago manual por ciclo con recordatorio y gracia de 5 días). Checkout en web para evitar comisiones y reglas de compras in-app de Apple/Google; validar si la suscripción califica como "servicio fuera de la app". Copy: "sin permanencia", no "pausá cuando querrás".

## 2026-10-02 · Solicitudes de casa (búsqueda inversa)
El cliente describe lo que busca (estructurado + texto libre); la app notifica solo a owners cuya casa cumple. **El owner responde por WhatsApp directamente al cliente** con mensaje prellenado. Motivo: la gente ya hace todo por WhatsApp; no construir chat interno. Protección: consentimiento explícito del cliente, máx. 10 owners por solicitud, solo owners verificados reciben el número, el cliente puede cerrar la solicitud. Descartado: respuestas del owner dentro de la app (añadía un paso ajeno al hábito actual).

## 2026-10-02 · Presupuestos en total, no por noche
En solicitudes vacacionales el cliente indica presupuesto total para la estadía y el owner responde con precio cerrado por las noches pedidas. En largo plazo, por mes. El catálogo sigue mostrando "desde ₡X / noche" porque ahí no hay fechas.

## 2026-10-02 · Web y móvil desde el día 1
Monorepo con `packages/ui` y `api-client` compartidos para no duplicar. Descartado: solo web responsive primero (el owner publica desde el teléfono y el cliente busca desde el teléfono; la app nativa importa para notificaciones y presencia en tiendas).

## 2026-10-02 · Vacacional y largo plazo desde v1
Dos modos con filtros, unidad de precio y copy propios. Descartado: empezar solo con vacacional.

## 2026-10-02 · Búsqueda: mapa + lista + destinos + filtros
Se pidió "todos". En escritorio el mapa va sticky al lado de la lista; en móvil la lista manda y el mapa es un bloque arriba.

## 2026-10-02 · Filtros funcionales en v1
Personas, habitaciones, precio y amenidades (incluido **cargador eléctrico**, pedido explícitamente). Las amenidades son un enum compartido entre filtros, ficha, wizard y solicitudes, porque el matching depende de ellas.

## 2026-10-02 · Detección de requisitos en texto libre
Reglas por palabras clave en v1 (barato, predecible, sin latencia); el cliente confirma los chips. LLM en v2 si el texto libre resulta ser el camino principal.

## 2026-10-02 · Español con voseo; moneda la elige el owner
UI solo en español en v1 (inglés v2). Cada casa en ₡ o $ según el owner; la plataforma no convierte ni cobra entre partes.

## 2026-10-02 · Nombre provisional "CasaTica"
Gusta junto con "Pura Casa". Se usa como provisional en código y prototipo; se cambia fácil (un token de marca). Pendiente dominio, redes y Registro Nacional.

## 2026-10-02 · Dirección aproximada
La ficha muestra una zona (~500 m), nunca la dirección exacta; la comparte el owner por WhatsApp.

## 2026-10-02 · Dirección visual
Cálida y local (verde selva, dorado "sol", papel cálido) con la claridad de un marketplace. Verde WhatsApp reservado al botón de contacto. Tipografía: Bricolage Grotesque (display) + Nunito Sans (texto). Español con voseo.
# 2026-10-07 · Separar pedir casa y búsqueda asistida

Pedir casa conserva el formulario gratuito de filtros obligatorios y el consentimiento para propuestas de owners. Búsqueda asistida es una entrada distinta para explorar y acotar el catálogo mediante preguntas; no envía solicitudes automáticamente. Se implementa solo un simulador local. Se retira la detección ingenua por palabras en las notas del formulario para evitar convertir preferencias o negaciones en obligaciones. Cuotas y búsquedas extra son dirección de producto pendiente de integración. Especificación: `busqueda-asistida.md`.
