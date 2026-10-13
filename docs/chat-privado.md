# Contacto privado · histórico · 2026-10-07

> **No vigente.** Se vuelve a WhatsApp directo sin chat ni intermediarios. Prevalece [contacto-whatsapp.md](contacto-whatsapp.md). Lo descrito a continuación es histórico y no representa la demo actual. Copia recuperable: `backups/bnbtico-antes-volver-whatsapp-2026-10-07.tar.gz`.

## Última decisión: cliente en bnbtico, owner en WhatsApp Business

La usuaria aprueba esta arquitectura **provisional**, después de probar el chat interno. No está implementada ni contratada y no debe confundirse con la demo descrita más abajo.

- El cliente escribe y recibe respuestas en el chat de bnbtico.
- Cada cliente tendría un número intermediario de bnbtico, distinto de su teléfono personal. El owner conversa con ese alias desde su número y aplicación habituales de WhatsApp Business; no se le asigna otro número.
- Circuito previsto: **chat del cliente → backend de bnbtico → API del número intermediario del cliente → WhatsApp Business del owner**, con el recorrido inverso para las respuestas. El backend debe validar participantes y registrar/enrutar mensajes; no es una simple apertura de WhatsApp.
- Los números intermediarios se integrarían con el proveedor. El número del owner actúa como destinatario/remitente de WhatsApp, no requiere conectarse a nuestra API para este circuito. No afirmar que Twilio haya aprobado este uso o su escala.
- Un alias diferente por cliente permite al owner distinguir clientes en chats separados. El cliente distingue owners dentro de bnbtico. No prometer un nombre de chat dinámico «bnbtico — Marta»: su presentación depende de WhatsApp y del registro del emisor.
- No se entrega automáticamente el teléfono personal del cliente al owner. bnbtico y el proveedor procesarán el contenido. No prometer anonimato si el cliente escribe datos personales voluntariamente.
- La salida a WhatsApp **directo entre las partes** sigue siendo una opción distinta que requiere doble aceptación; usar el puente del owner no equivale a aceptar compartir teléfonos personales.
- Se conservan identidad obligatoria, solicitud por cliente/casa de 7 días, historial tras expirar y ausencia de reservas/pagos intermediados. Sin contacto owner → owner.

### Validaciones pendientes antes de implementar el puente

1. Proveedor, aprobación del caso de uso, límites de números y condiciones de alta; momento de asignación del alias por definir. No comprar un número automáticamente por cada registro ni autorizar compras con esta decisión.
2. Presupuesto completo frente a la referencia de unos US$20/mes: alquiler, mensajes, plantillas, infraestructura, identidad y soporte. No se cambia la tarifa aprobada por casa ni se promete mensajería ilimitada.
3. Consentimiento del owner para recibir mensajes, ventanas de atención y plantillas aprobadas cuando correspondan. No asumir que escribir en bnbtico abre una ventana de WhatsApp del owner. Diseñar espera/reanudación si no puede entregarse texto libre.
4. Enrutamiento cuando el mismo cliente contacta varias casas del mismo owner, o retoma solicitudes caducadas: comparten la misma pareja de números. Definir contexto de casa/solicitud antes de reenviar; nunca adivinar destinatario ni asociar una respuesta a la última consulta por defecto.
5. Ciclo de vida y eventual reutilización de alias: no reasignar un número confiando en que se borre el historial del WhatsApp ajeno. Evitar cruces de mensajes antiguos entre clientes.
6. Autenticación de webhooks, idempotencia, estados de entrega, límites de uso, retención, acceso de soporte, privacidad y revisión jurídica. Filtro de enlaces/teléfonos/correos pendiente de diseño y pruebas, no implementado.

## Estado actual: demo anterior, todavía sin puente

El prototipo sigue simulando a **ambas partes dentro de bnbtico**, con WhatsApp directo opcional tras doble aceptación. El puente por cliente requiere una próxima iteración y posterior integración real. La nueva decisión sustituye el descarte de intermediarios de esa demo, pero no altera su funcionamiento automáticamente. El antiguo `contacto-privado.md` no es la especificación de este nuevo circuito.

## Experiencia implementada en la demo anterior

1. Una sola acción principal en la casa: **Contactar**. Tras ingresar con identidad verificada, se abre un chat privado con el owner, vinculado a esa casa. Abrirlo sin enviar no crea una solicitud.
2. El primer mensaje crea la solicitud. Cliente y owner responden dentro de bnbtico; no se muestran automáticamente teléfono ni correo. Cliente: **Mensajes**. Owner: **Contactos → Responder** o **Ver todos los mensajes**.
3. Dentro del chat, **Pasar a WhatsApp** es secundario. La confirmación explica que podrán ver y guardar el número y que se recomienda uno de negocio. **Aceptar y proponer** registra la aceptación del proponente, no la de ambos.
4. El destinatario puede **Seguir por acá** o **Revisar y aceptar**. Tras leer y confirmar el aviso, ambas aceptaciones habilitan **Abrir WhatsApp**. Una misma parte no puede aceptar por la otra.
5. Rechazar o cancelar mantiene el chat y no comparte contacto. Los consentimientos son propios de esa conversación; no se trasladan a otras casas o solicitudes. Una vez visto un número no se promete retirarlo.
6. WhatsApp es una conversación externa directa, no un canal intermediado: bnbtico no puede leer, filtrar ni borrar sus mensajes. No hay Twilio, número intermediario ni ventanas de 24 horas en este diseño.
7. **Pedir casa** autoriza propuestas privadas de hasta 10 owners verificados compatibles, no la entrega del teléfono. **Responder** permite elegir una casa coincidente y escribir la propuesta en el mismo chat. El envío, no abrir el editor, marca la búsqueda como respondida.

## Solicitudes: se mantienen los 7 días

- Una solicitud activa por cliente y casa durante 7 × 24 horas desde el primer envío; configurable. Volver a contactar abre la existente sin un nuevo mensaje inicial ni aviso duplicado.
- «No me interesa» es una marca interna del owner. No reinicia el plazo, no elimina el chat y no bloquea al cliente permanentemente.
- Expirar no cierra conversaciones ni borra mensajes o contactos ya compartidos. El historial permite continuar el chat anterior.
- Tras expirar, **Contactar** permite una nueva solicitud, con plazo y consentimientos nuevos. El historial anterior permanece separado.

## Alcance real de la demo

`design/prototype/relay.js`, HTML/CSS y pruebas Node sin dependencias. Todo permanece en memoria y recargar lo borra. No hay autenticación, verificación, notificaciones, persistencia, apertura de WhatsApp ni envío real. Solo datos ficticios.

**Probar ambos lados · demo** permite simular la respuesta del otro participante dentro de la misma conversación. La vista indica a quién se está simulando. Es exclusivamente un control de demostración, no una facultad de los usuarios de producción. Los selectores generales Cliente / Owner usan cuentas ficticias; Marcela solo ve sus casas en el panel normal.

Texto escapado al mostrarlo, 1–2000 caracteres no vacíos, borradores por conversación en memoria. Solo texto: sin fotos, audios ni llamadas. No se filtran enlaces, correos ni números escritos voluntariamente; no se promete anonimato. Moderación y política de contenido pendientes.

## Antes de producción

- Identidad de ambas partes obligatoria, permisos del servidor por participante y casa, sin selector de simulación.
- Tablas de conversaciones, participantes, mensajes y consentimientos; RLS, acceso al teléfono solo con aceptación bilateral vigente. No enviar teléfonos al navegador antes de ese punto.
- Creación atómica e idempotente de solicitudes, reloj del servidor, deduplicación concurrente y registro de cambios de consentimiento. El prototipo por nombres ficticios no implementa estas garantías.
- Entrega/reintentos, notificaciones sin texto sensible, límites de frecuencia, bloqueo/reportes y moderación a diseñar. Las migraciones actuales no implementan el chat.
- bnbtico procesará y almacenará mensajes: definir aviso de privacidad, finalidad, retención, acceso de soporte, eliminación, proveedores y revisión jurídica. «Privado» significa no público y sin exposición automática del teléfono, no una promesa de cifrado de extremo a extremo.
- No se gestionan reservas ni pagos entre partes. Sin cambios en precio de suscripción, identidad con Veriff o titularidad registral opcional.

## Reversibilidad y comprobaciones

Versión anterior conservada en `backups/bnbtico-antes-chat-privado-2026-10-07.tar.gz`; instrucciones en `backups/README.md`. No restaurarla sobre archivos con cambios sin revisarlos.

Pruebas: `node tests/prototype/private-chat.cjs`, `node tests/prototype/contact-expiry.cjs`, `node tests/prototype/claims.cjs` y `node tests/prototype/property-verification.cjs`. Revisar también móvil y web en el navegador.

Comprobación 2026-10-07: las cuatro suites pasan, JavaScript válido y `git diff --check` limpio. Revisado en navegador: ficha → ingreso ficticio → chat móvil, envío de ambos participantes, propuesta/rechazo/aceptación de WhatsApp y aviso de apertura simulada; chat y propuesta desde Owner → Contactos → Solicitudes en web, sin errores de consola. Revisión independiente encontró y se corrigieron dos problemas: leads ajenos visibles al owner y propuestas que perdían el enlace a su conversación al expirar. Ambos cuentan con pruebas de regresión; también el acceso a propuestas después del login. El archivo de respaldo y el enlace simbólico AGENTS.md permanecen intactos.
