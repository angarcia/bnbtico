> **Histórico, no vigente.** El flujo vigente está en [contacto-whatsapp.md](contacto-whatsapp.md). No implementar el relay descrito aquí.

# Contacto intermediado · documento histórico, NO vigente

Sustituido por `contacto-whatsapp.md`: la decisión final es WhatsApp directo, sin intermediario ni aceptación bilateral. No implementar las reglas históricas de este documento.

Esta especificación recogía la propuesta anterior de intermediación. Se conserva como historial de decisiones. Sigue vigente que no hay comunicación directa propietario → propietario.

## Flujo aprobado
1. Cliente registrado consulta una casa; propietario verificado responde a una solicitud con una de sus casas coincidentes.
2. Se crea una consulta entre ese cliente y propietario, asociada a una casa. Cada participante habla con el número intermediario de bnbtico. No ve automáticamente el teléfono de la otra persona.
3. Cualquiera puede solicitar contacto directo. Solicitarlo equivale a aceptar compartir el propio número si la otra persona también acepta.
4. Solo la aceptación explícita del otro participante habilita compartir ambos teléfonos. No basta con aceptar dos veces desde la misma cuenta. Los permisos no se transfieren a otras consultas.
5. Rechazar o cancelar restablece el estado privado; pueden continuar mediante bnbtico. Después de compartir no se promete retirar información ya vista.
6. Los mensajes se identifican por consulta; un propietario con varios clientes debe elegir a quién responde. No se comparten agendas ni directorios de teléfonos.

## Caducidad de solicitudes de contacto · aprobada e implementada en la demo
- Una solicitud activa por **cliente y casa**, no por propietario. Consultar otra casa del mismo propietario está permitido.
- Caduca exactamente 7 × 24 horas después del envío original. Plazo configurable (`CONTACT_TTL_DAYS` en la demo). Abrir, responder, rechazar, reactivar o compartir contactos no modifica esa fecha.
- Un nuevo intento durante el plazo abre la consulta existente; no crea otra solicitud, mensaje inicial ni notificación duplicada.
- «No me interesa» descarta esa solicitud para el propietario, sin reiniciar el plazo ni bloquear al cliente permanentemente. Al expirar puede llegar una nueva solicitud, aunque la anterior se descartara.
- Una solicitud expirada deja de mostrarse como pendiente. Se conserva su historial y puede continuar una conversación ya iniciada; tampoco se revocan contactos compartidos.
- Tras la caducidad se puede crear una nueva solicitud con identificador, plazo y consentimiento propios. El historial anterior permanece separado.
- Demo: fechas visibles en consultas y «Me contactaron», acceso a consulta existente y control «Avanzar 7 días en la demo». El reloj simulado afecta a todas las consultas; recargar reinicia los datos. Los ejemplos iniciales arrancan su plazo al cargar.
- Implementación real pendiente: tiempo del servidor, identificadores estables de cliente y casa (la demo identifica clientes por nombre ficticio), operación atómica para impedir duplicados concurrentes, una notificación por creación e idempotencia. No usar el reloj del navegador para aplicar esta regla en producción.

## Ventanas de WhatsApp (independientes de los 7 días)
Cada destinatario tiene su propia ventana de 24 horas desde su último mensaje entrante. Un mensaje del cliente no abre la ventana del propietario. Si está cerrada, se mantiene el texto pendiente y se envía un aviso mediante plantilla aprobada, sujeto a consentimiento y reglas del proveedor. El aviso por sí solo no abre la ventana; la respuesta del destinatario sí. Producción necesita timestamps, cola de entrega e idempotencia, no los booleanos de la demo.

## Prototipo implementado
- En «Me contactaron», cada consulta tiene «Contactar por WhatsApp» (abre la simulación intermediada con el mensaje original del cliente) y «No me interesa» (marca interna, sin mensaje al cliente). Se puede reactivar; el estado dura la sesión de la demo y no elimina el historial ni revoca consentimientos ya otorgados.
- HTML base más `design/prototype/relay.js`, sin dependencias adicionales.
- Entradas: botón superior «Probar contacto privado», ficha → Contactar → login de demo → modal, Mi cuenta → Mis consultas privadas, Owner → Contactos → bandeja o lead, Owner → Solicitudes → responder y Cliente → Mis solicitudes → consulta privada.
- Historial de texto, selector de consulta, selector explícito de participante de demostración, tres estados (privado, pendiente, compartido), aceptar/rechazar/cancelar y prueba de ventana cerrada / aviso / respuesta.
- Texto escapado al renderizar. Mensajes vacíos no se envían. Teléfonos compartidos son máscaras no utilizables, no números reales.
- Toda la información es ficticia, en memoria. No abre chats ni envía notificaciones reales. El selector de ambas partes es exclusivamente una herramienta de demo, nunca una autorización válida de producción.
- La demo no detecta teléfonos, enlaces, correos u otros identificadores escritos en mensajes. No se promete anonimato si el usuario decide incluirlos.

## Pendiente para producción
Número de negocio exclusivo, proveedor WhatsApp Business Platform, validación de políticas y costes, plantillas aprobadas, consentimiento para avisos, webhooks autenticados, participantes autenticados, controles de acceso por consulta, registro auditable de ambas aceptaciones y protección de números en servidor. Incorporar conversations, messages y contact_consents al esquema y actualizar las reglas antiguas de exposición del teléfono; las migraciones actuales NO implementan esta decisión.

bnbtico procesa el contenido para entregar los mensajes. No describir el circuito como una conversación privada directa entre cliente y propietario ni garantizar cifrado extremo a extremo entre ellos. Definir retención, acceso y tratamiento de datos antes del servicio real. Fotos, audios y llamadas fuera de esta primera demo.
# Documento histórico — sustituido

La usuaria eligió WhatsApp directo. No implementar el intermediario, consentimiento bilateral ni ventanas descritos más abajo. Especificación vigente: contacto-whatsapp.md.
