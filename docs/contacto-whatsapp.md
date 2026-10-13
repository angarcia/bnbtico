# Contacto por WhatsApp directo · vigente 2026-10-07

## Decisión

**Excepción manual aprobada · 2026-10-13:** administración puede crear consultas por casa a petición de un cliente activo y verificado, con autorización específica registrada para compartir el contacto con los destinatarios seleccionados. Aparecen en Mis consultas del propietario como enviadas por bnbtico, no como aperturas de WhatsApp. Máximo 10 propietarios y una casa por propietario en cada envío; controles de compatibilidad y duplicados. Bienvenidas separadas por rol y números de soporte diferentes, enviadas manualmente por administración. Ver `decisiones.md` y `admin-concierge.js`; no hay automatización, API ni WhatsApp real en la demo.

**Alcance vigente del lanzamiento · 2026-10-13:** únicamente contacto directo iniciado por el cliente desde la ficha, tras login, identidad y WhatsApp verificados y consentimiento explícito. Fechas, personas y consulta opcionales. Mis consultas registra intentos de apertura, sin afirmar envío/entrega. El propietario puede reabrir el chat con un mensaje editable que incluye los datos existentes y omite bloques vacíos. Sin aceptar/rechazar ni selector de contacto por casa. Las preferencias y aceptación descritas abajo quedan como exploración histórica, fuera del lanzamiento. La demo solo muestra el texto y simula la apertura; no comparte teléfonos reales ni envía mensajes.

Actualización 2026-10-13: en Mis consultas, el propietario puede aplicar contacto directo Sí/No a todas sus casas actuales y como predeterminado de las futuras. La confirmación avisa que reemplaza excepciones actuales. Después se puede cambiar una casa individualmente sin afectar las demás ni el predeterminado. Inicialmente No. Las verificaciones y el consentimiento del cliente se mantienen; Buscan casa y contactos previos no cambian. Preferencia simulada en memoria, no integración con WhatsApp Business.

Volver al flujo sencillo, sin chat interno ni números intermediarios para las conversaciones entre usuarios. bnbtico conecta a las partes; las conversaciones, reservas y pagos se acuerdan fuera. La suscripción remunera el anuncio y los contactos, sin comisión por alquiler. Las alternativas de chat y puente de WhatsApp quedan históricas en `chat-privado.md`.

Requisito 2026-10-12: además de Veriff, ambos participantes deben tener su WhatsApp verificado mediante OTP antes de contactar/responder; también antes de enviar «Pedir casa». Registro/login siguen sin verificaciones iniciales. El OTP requiere integración separada pendiente y no autoriza compartir el teléfono ni importa chats. Fuente: [identidad-y-seguridad.md](identidad-y-seguridad.md). Todavía no implementado en la demo.

## Flujo por casa

### Preferencia por anuncio · 2026-10-12

En **Owner → Mis casas**, cada casa ofrece Calendario, Editar, Disponible/No disponible y **Contacto directo: Sí/No**. Activar/Desactivar anuncio queda dentro de Editar. Por defecto **No** para contacto directo: se conserva la aceptación individual descrita abajo. Corrección 2026-10-12: también el número puede variar por casa. Se copia del usuario al crearla, con campo editable; otro número exige comprobar acceso antes de usarlo. Si se cambia en una casa publicada, el anterior sigue activo hasta verificar y guardar el nuevo. Otras casas no cambian. La identidad sigue siendo la del titular de la cuenta, no la de quien controla el teléfono alternativo. El cliente mantiene su WhatsApp de cuenta. No implica intermediación ni notificaciones de WhatsApp Business.

No disponible mantiene el anuncio visible, cierra temporalmente todo el calendario y bloquea nuevas consultas/propuestas. Conserva los contactos previos (incluidas consultas pendientes ya recibidas), todas las fechas, tarifas y precios. Disponible restaura el calendario tal como estaba. Al cerrar puede elegirse una fecha futura opcional de reapertura a las 00:00 de Costa Rica; sin fecha, solo se reabre manualmente. La reapertura no reactiva un anuncio desactivado ni cuentas bloqueadas. Demo en memoria; programación de servidor pendiente.

Con **Sí**, el propietario autoriza por adelantado el contacto para esa casa. Un cliente con identidad y WhatsApp verificados confirma compartir su teléfono y abre WhatsApp, sin esperar una aceptación por consulta. No hay envío automático ni notificación de WhatsApp Business. La demo solo simula la apertura; un intento no demuestra mensaje enviado, recibido ni reserva.

Cambiar a No conserva contactos ya aceptados e historial y no retira números compartidos. Activar Sí no envía mensajes a consultas antiguas. El cliente puede continuar una consulta vigente usando la nueva preferencia, sin duplicar el registro ni reiniciar los siete días. «Solicitudes» compartidas no se aceptan automáticamente.

Desactivar una casa la oculta del catálogo y bloquea nuevos contactos desde bnbtico; no cierra chats externos. Reactivarla exige aprobación, identidad/WhatsApp válidos y cuenta activa. La demo no altera facturas ni suscripciones. Estas reglas requieren autorización de servidor en producción.

Implementación de demo: `house-controls.js`; prueba `tests/prototype/house-controls.cjs`. Calendario abre la casa elegida. Editar prepara su borrador y envía cambios a revisión sin sustituir automáticamente el anuncio público. Comprobaciones simuladas, sin OTP, datos reales ni persistencia.

### Flujo con Contacto directo: No

Decisión 2026-10-12: descartados por ahora los avisos automáticos y botones de aceptación en WhatsApp Business. Los pasos siguientes se realizan en bnbtico, hasta abrir el chat directo. No implementar el flujo explorado de notificación desde el número de bnbtico y aceptación dentro de WhatsApp. Esto no elimina el OTP de verificación del número ni el soporte manual.

1. El cliente toca **Solicitar contacto**. Se exige cuenta e identidad verificada antes del envío; en la demo la identidad se da por aprobada, no se comprueba realmente.
2. Un aviso explica que el teléfono se compartirá con ese owner y que WhatsApp permite verlo/guardarlo. Marca una casilla inicialmente desmarcada y toca **Enviar solicitud**. Abrir o cancelar el aviso no crea una solicitud.
3. El owner, también con identidad aprobada, ve la solicitud en **Mis consultas → Interés en mis casas** (antes «Me contactaron»). Elige **Contactar por WhatsApp** o **No me interesa**. Esta pestaña explica el interés directo por una casa concreta; **Buscan casa** explica las búsquedas enviadas a varios propietarios, a las que el owner puede responder ofreciendo una casa compatible.
4. Al contactar, revisa el aviso sobre compartir su número y confirma **Aceptar y contactar por WhatsApp**. Así acepta el contacto que el cliente ya solicitó. No hay selector de canales, chat previo ni tercera confirmación del cliente.
5. Cliente → **Mi cuenta → Mis contactos** permite ver el estado y continuar por WhatsApp después de la aceptación. Antes solo se muestra la solicitud pendiente, no el contacto.

Los números no figuran en el anuncio público. Recomendar WhatsApp Business o un número distinto del personal. No prometer anonimato, impedir contacto posterior, leer/filtrar mensajes ni retirar un número ya visto. No hay contacto owner → owner.

## Caducidad y deduplicación

- Una solicitud activa por cliente y casa durante 7 × 24 horas desde el envío, configurable.
- Reintentar abre la misma solicitud sin nuevo aviso ni cambio de fecha.
- «No me interesa» es una marca del owner: no reinicia el plazo, no envía un mensaje y no bloquea solicitudes futuras. Puede reactivarla antes de vencer.
- Una solicitud pendiente expirada ya no habilita una nueva aceptación; el cliente puede enviar otra desde la ficha. La nueva solicitud necesita aceptación propia, sin heredar la anterior.
- La caducidad conserva el historial y no retira un contacto ya aceptado ni cierra WhatsApp. El límite solo afecta a solicitudes de bnbtico, no a mensajes externos.

## Pedir casa

**Aplazado del lanzamiento inicial desde 2026-10-13.** Se conserva esta especificación para evaluar la fase siguiente; `launch-scope.js` oculta las entradas e inhabilita el reparto. El lanzamiento conserva únicamente las consultas por una casa concreta, con las mismas verificaciones obligatorias.

El cliente acepta expresamente compartir su contacto con hasta 10 owners verificados compatibles. El owner elige una casa coincidente y confirma el contacto por WhatsApp. La apertura se registra como intento/respuesta, no como mensaje entregado ni reserva. Las propuestas precargadas y el formulario son ejemplos de demo: matching completo, límites y cierre efectivos requieren backend.

### Reparto por tandas · 2026-10-13

- Se cuentan **propietarios distintos**, no anuncios: máximo 10 en toda la búsqueda. Cada destinatario queda asociado a una casa compatible y disponible.
- Con Entrada/Salida explícitas, se exige disponibilidad de todas las noches (salida excluida). Una casa ocupada, desactivada o no disponible no participa; otra casa del mismo propietario sí puede hacerlo.
- Si ese propietario ya tiene una consulta directa del mismo cliente para fechas iguales o solapadas, no recibe la búsqueda. Se compara la cuenta, no el nombre; descartar la consulta no elimina esa exclusión. Tampoco se repite el envío de una búsqueda del mismo cliente/fechas al mismo propietario.
- Primera tanda: propietarios sin consultas directas vigentes de otros clientes que coincidan con esas fechas. Un contacto por WhatsApp aún en negociación puede contar; una consulta descartada, caducada o con estancia acordada no baja prioridad. Las noches ocupadas se excluyen antes.
- A las **24 horas**, si la búsqueda sigue abierta y el consentimiento y verificaciones continúan vigentes, se reevalúan disponibilidad, duplicados y destinatarios previos, y se amplía hasta completar 10. No se exige que falten respuestas: abrir WhatsApp no demuestra que el cliente haya encontrado alojamiento.
- Si no hay propietarios sin consultas, se envía inmediatamente a los compatibles con consultas. Si la llegada es dentro de **48 horas**, también se envía inmediatamente hasta 10. Referencia de fecha sin hora: medianoche de Costa Rica, incluyendo llegadas de hoy.
- En igualdad de prioridad, reciben primero quienes tuvieron menos envíos en los últimos **30 días** (parámetro de esta simulación), con desempate estable. Esto reparte oportunidades; no garantiza reservas.
- Sin fechas exactas no se deduce un intervalo del texto: envío inmediato por los filtros del catálogo, sin prioridad ni comprobación de disponibilidad por fechas.
- «Cerrar búsqueda» y «Ya encontré alojamiento» cancelan las tandas pendientes y bloquean nuevos contactos desde ella. No retiran teléfonos ya compartidos ni cierran WhatsApp.
- Si aparece una consulta directa después del reparto, la búsqueda compartida deja de mostrarse a ese propietario para ese cliente/fechas; no se duplica la barra amarilla con la azul. Se conserva el historial de reparto.

Demo: `request-distribution.js`, memoria y reloj simulado. «Mis solicitudes» muestra destinatarios y próxima tanda; «Probar segunda tanda · demo → Avanzar 24 horas» permite ensayarla. La disponibilidad solo puede comprobarse en diciembre de 2026, el mes implementado: se rechazan fechas exactas fuera de él. Recargar restablece todo. La segunda tanda solo funciona con la página abierta; **producción requiere tarea programada en servidor**, persistencia, autorización y envíos idempotentes/transaccionales. No se envían avisos reales.

Prueba: `node tests/prototype/request-distribution.cjs`.

## Estado real y pruebas

`design/prototype/relay.js` simula solicitudes, aceptación, historial, descarte, reactivación y avance de siete días. No abre WhatsApp, almacena conversaciones ni contiene números utilizables. Los mensajes preparados para WhatsApp no se guardan. Datos y consentimiento solo en memoria; recargar borra cambios. Los datos precargados incluyen contactos aceptados y pendientes. No hay autenticación, identidad, notificaciones ni protección de servidor reales.

Pruebas: `node tests/prototype/direct-whatsapp.cjs`, `node tests/prototype/contact-expiry.cjs`, `node tests/prototype/claims.cjs`, `node tests/prototype/property-verification.cjs`.

Antes de producción: permisos e identidad en backend; consentimiento auditable; reloj de servidor y deduplicación atómica; acceso privado a teléfonos solo para participantes autorizados; límites de búsqueda; retención y avisos de privacidad. No almacenar números en la API pública ni tratar el estado del navegador como autorización.

Copia de la versión con chat antes de volver: `backups/bnbtico-antes-volver-whatsapp-2026-10-07.tar.gz`. No se modifica la marca, el asistente de titularidad ni las reclamaciones.
