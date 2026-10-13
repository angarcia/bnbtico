# Reclamaciones y soporte · actualizado 2026-10-12

## Decisiones aprobadas

- La cuota no aumenta por denuncias. No hay multas ni recargos automáticos por reportes, ni reverificación de pago impuesta automáticamente al denunciado.
- Reporte no equivale a culpabilidad: revisar pruebas, escuchar a ambas partes, motivar decisiones y permitir solicitar revisión.
- Se pueden pedir explicaciones, advertir o aplicar medidas proporcionales ante incumplimientos comprobados. Una restricción temporal durante revisión requiere indicios creíbles y justificación; no basta el número de denuncias.
- **Decisión vigente 2026-10-12:** bnbtico no gestiona pagos ni devoluciones entre usuarios. Sin importe solicitado, moneda, estado de devolución, comprobante de devolución ni confirmación de pago. Quien quiera pedir una devolución puede escribirlo en el relato y acordarla directamente fuera de la app. Sustituye el flujo anterior de seguimiento de devoluciones.
- El propietario responde o propone una solución en texto. Admin revisa conducta/anuncios, registra una decisión motivada y puede cerrar la revisión. No certifica acuerdos ni pagos externos.
- Un acuerdo entre partes no elimina medidas ni evita investigar. Sin acuerdo, orientar a canales oficiales; no entregar documentos de identidad a la contraparte.
- Veriff aporta trazabilidad de identidad, no prueba de culpabilidad ni un seguro. Reverificar tiene sentido ante dudas de suplantación/control de cuenta; un upgrade individual de Essential a Plus no está confirmado.

## Prototipo

Antes del formulario y en el seguimiento se muestra «¿Qué hace bnbtico con tu reporte?». Explica revisión de pruebas, solicitud de aclaraciones/respuesta del propietario, medidas proporcionales, comunicación del resultado y posibilidad de revisión. Aclara que no gestiona pagos/devoluciones, no accede a WhatsApp ni sanciona automáticamente. El aviso de prototipo permanece: no hay mensajes reales; los bloqueos de cuenta solo afectan a la demo.

Archivo claims.js, cargado tras relay.js. Cliente: ficha → Reportar un problema, o Mi cuenta → Reclamaciones y ayuda. Owner: Cuenta → Reclamaciones y ayuda. Admin: Reclamaciones.

El cliente selecciona casa y describe hechos y pruebas de ejemplo, sin campos monetarios. El propietario responde. Administración pide respuesta, registra resultado/medida con motivo, cierra la revisión o marca sin acuerdo. Ambas partes pueden solicitar revisión de decisiones; se conserva historial en memoria.

Solo simulación: sin archivos reales, pagos, mensajes externos ni integración con Veriff. Cambiar rol permite probar a ambas partes; no representa autorización de producción. Owners simulados limitados a Marcela (MY[0]); cliente Andrea. Guardar una medida en el caso no la aplica automáticamente: usar Gestionar usuario para desactivar la cuenta. Recargar borra casos y restablece cuentas. Los avisos de 7 días no borran reclamaciones.

## Gestión de usuarios y WhatsApp de soporte

`admin-users.js` sustituye Admin → Owners por **Usuarios** (propietarios y clientes): búsqueda, identidad de solo lectura, anuncios, reportes relacionados e historial privado. Desactivar/reactivar exige motivo y confirmación; no elimina datos ni modifica identidad, moderación o suscripciones. Cuenta desactivada: oculta sus anuncios e impide nuevos contactos, aceptación/respuesta y publicación; mantiene historial, ayuda y reclamaciones. Reactivar levanta este bloqueo, sin aprobar anuncios pendientes o rechazados. No revoca teléfonos ya compartidos ni conversaciones externas.

Desde la ficha o un caso, admin accede al WhatsApp de soporte **bnbtico**, un número de negocio separado del personal y del contacto cliente–propietario. En la demo solo hay número ficticio, vista previa de mensaje y simulación; no se abre WhatsApp. En producción se necesitará configurar el número/cuenta y usar su sesión remitente: un enlace no elige automáticamente el WhatsApp emisor. No hay bot, intermediario, lectura de chats ni importación de respuestas. Las notas manuales quedan privadas en la ficha y, si corresponde, en el caso para admin; no son mensajes enviados. El usuario conserva acceso a Ayuda de bnbtico incluso con cuenta desactivada.

## Antes de producción

- Diseñar permisos de servidor, evidencias privadas y acceso separado de notas internas; preservar versiones de anuncio/contacto y trazabilidad.
- Definir plazos de respuesta, criterios de revisión, apelaciones, suspensión/expulsión y levantamiento de medidas; no inventar SLA en la demo.
- Definir conservación por denuncia con asesoramiento legal y proveedor. Essential publica 3 meses de acceso a datos y opción de retención ampliada; confirmar contrato, disponibilidad y preservación, no asumir archivo perpetuo. Fuente consultada: https://www.veriff.com/plans/self-serve.
- Revisar condiciones legales de gestión de reclamaciones y solicitudes de autoridades en Costa Rica. No manejar dinero no elimina por sí solo todas las responsabilidades.
- Implementar restricciones efectivas, recuperación segura de cuentas y carga/validación de pruebas antes de presentar medidas como aplicadas.

Pruebas de demo: `node tests/prototype/claims.cjs`, `node tests/prototype/admin-users.cjs` y `node tests/prototype/contact-expiry.cjs`.
