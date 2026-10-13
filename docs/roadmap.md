# Roadmap

## Alcance vigente · 2026-10-13

Lanzamiento orientado a captar propietarios: **publicar → compartir ficha → recibir consultas directas**. Web móvil primero; no es necesario construir toda la exploración del prototipo. Registro y borradores sin verificación; publicar/contactar exige identidad y WhatsApp verificados, también con contacto directo. Primeras pruebas de clientes con un catálogo pequeño y útil en una zona, sin esperar a v2.

- [x] Simplificar la entrada del prototipo con `launch-scope.js`; conservar exploraciones sin mostrarlas. Prueba: `tests/prototype/launch-scope.cjs`.
- [x] Enlace por ficha en la demo (local al ordenador), panel de propietario sin estadísticas avanzadas, promoción identificada como simulación y calendario de precio habitual/excepciones.
- [ ] Implementar el recorrido real, almacenamiento, publicación pública, verificaciones y autorización en servidor. El prototipo no sustituye estos servicios.
- [ ] Medir registro → borrador → publicación → consulta y respuesta; no confundir clic en WhatsApp con mensaje o reserva.

## Contacto vigente · 2026-10-13

- [x] Volver a WhatsApp directo en el prototipo; conservar copia de la versión con chat.
- [x] Contacto directo iniciado por el cliente, sin selector de canal ni aceptación/rechazo. Registro de aperturas y mensaje del propietario con contexto opcional en la demo.
- [ ] Implementar en backend consentimiento del cliente, autorización de contacto al publicar, identidad/WhatsApp y deduplicación de aperturas durante 7 días. Ver `contacto-whatsapp.md`.
- Sin intermediarios ni chat interno en v1.

## Hecho (sesión 2026-10-02, Cowork)
- [x] Cuestionario de requisitos y alcance v1 (ver `vision.md`)
- [x] Prototipo navegable con 21 pantallas (cliente, owner, admin, landing; móvil y web), publicado como artifact y guardado en `design/prototype/`
- [x] Sistema de diseño y tokens
- [x] Modelo de datos y migración inicial con función de matching
- [x] Decisiones: pago por casa, sin reseñas, owners valoran clientes, WhatsApp directo con solicitud y aceptación, presupuestos en total, copy "sin permanencia"
- [x] Investigación rápida de nombre (sin conflictos evidentes; falta dominio y marca)

## v1 — lanzamiento

### Base
- [ ] Scaffold web móvil (pnpm, Turborepo, Next.js, packages/ui con tokens); Expo se aplaza.
- [ ] Supabase: migración inicial, seed, RLS, Storage (público/privado)
- [ ] Elegir autenticación y roles; evaluar passkeys y recuperación segura (propuesta). OTP no sustituye identidad.
- [ ] Piloto Veriff Essential: documentos locales, facilidad, rechazos, casos dudosos, costes y borrado; Veriff elegido como dirección de producto, plan/contrato pendientes.
- [ ] Integrar identidad para clientes y propietarios, permisos backend y notificaciones verificadas del proveedor.
- [ ] Integrar WhatsApp obligatorio por OTP para clientes y propietarios, además de Veriff: pantallas, estados/permisos backend, cambio de número, caducidad/uso único, límites de intentos/reenvíos y recuperación. Ambas comprobaciones antes de contactar/enviar solicitudes/publicar/responder, no al registrarse. Meta Cloud API directa como vía considerada; ver `identidad-y-seguridad.md`.
- [ ] Adaptar migraciones y probar estados, reintentos, reclamación y acceso no autorizado.

### Cliente
- [ ] Home: modo vacacional / largo plazo, buscador, chips de provincia, lista de tarjetas
- [ ] Filtros: personas, habitaciones, precio, amenidades (incl. cargador eléctrico), solo verificados
- [ ] Ficha: galería, amenidades, calendario, mapa aproximado, owner, aviso antifraude
- [ ] Solicitar contacto → login e identidad aprobada → consentimiento → owner acepta → WhatsApp directo (demo lista, backend pendiente; `contacto-whatsapp.md`)
- [ ] Favoritos
- [ ] Mi cuenta: estado de identidad y WhatsApp, historial de contactos y ayuda
- [ ] Reportar anuncio

### Owner
- [x] Demo: calendario por casa con colores/patrones, edición múltiple de días y precios independientes de ocupación; cierre temporal reversible, Disponible en tarjeta y Desactivar dentro de Editar. Fecha opcional de reapertura simulada.
- [ ] Persistir estados diarios y cierre temporal; tarea de reapertura a medianoche de Costa Rica, permisos, consistencia y recuperación. Sin reapertura que reactive un anuncio oculto ni modifique días guardados.
- [x] Demo: controles por casa (Calendario, Editar, Activar/Desactivar, Contacto directo Sí/No con No inicial). Consentimiento anticipado opcional del propietario; número por cuenta y Solicitudes compartidas sin cambios.
- [ ] Backend: persistir preferencia/consentimiento por casa, pausa/reactivación autorizadas, ediciones moderadas y acceso al teléfono solo tras verificar ambas partes y consentimiento. La demo no abre WhatsApp ni modifica cobros.
- [x] Actualizar formulario del prototipo: catálogo vacacional, Casa/Apartamento/Habitación, largo plazo Sí/No explícito, precio mensual o Consultar, habitaciones/baños obligatorios y WhatsApp por usuario. Ver `publicacion.md`; demo en memoria.
- [ ] Adaptar catálogo, filtros, solicitudes, búsqueda asistida y esquema al catálogo vacacional con atributo Acepta largo plazo, sustituyendo modos excluyentes. Integrar validaciones y contacto de cuenta en backend.
- [ ] Registro sencillo y borrador; documento + rostro + liveness antes de publicar/responder. Sin comprobar autorización para alquilar.
- [ ] Wizard de publicación (5 pasos) con validación de fotos (sin teléfonos/enlaces)
- [ ] Panel sencillo: casas, consultas directas, promoción/suscripción y ayuda
- [ ] Calendario: disponible/ocupado, precio habitual y precio especial por días
- [ ] Ficha pública compartible, sin teléfonos expuestos ni salto de verificaciones al contactar
- [ ] Contactos: consultas por casa, contactar por WhatsApp o marcar No me interesa; conservar preferencia de contacto directo
- [ ] Notificaciones: casa aprobada, nuevo contacto, nueva solicitud; canales por concretar, push propuesto. Avisos automáticos y botones de aceptación en WhatsApp Business descartados por ahora (2026-10-12), sin compromiso de v2. Aceptación dentro de bnbtico. OTP de WhatsApp se conserva como comprobación separada.
- [ ] Suscripción por casa: checkout web (tarjeta recurrente + SINPE Móvil), recordatorios, gracia, pausar/cancelar
- [ ] Implementar la oferta para las primeras 200 casas: posiciones 1–50, 1 año gratis; 51–100, 6 meses; 101–200, 3 meses. Cada casa consume una plaza, también en cuentas con varias propiedades. Ver `business-model.md`.
- [ ] Concretar asignación de plazas por casa, inicio del período, duplicados/republicaciones, posible fecha límite adicional y finalización/contratación.

### Admin
- [x] Demo: Usuarios (propietarios/clientes), búsqueda y fichas, desactivar/reactivar con motivo/confirmación, bloqueos locales, historial privado y soporte por WhatsApp bnbtico simulado desde usuario/caso. Sin gestión de devoluciones entre partes.
- [ ] Llevar gestión de cuentas a backend con IDs persistentes, permisos/auditoría, configurar número de soporte de negocio y definir notificación al usuario y efectos de suscripción al desactivar.
- [x] Prototipo v1: ocultar verificación registral y anuncios de planes futuros; admin solo modera anuncios y consulta identidad simulada de Veriff, sin revisar documentos ni aprobar identidad manualmente. Producción pendiente.
- [ ] Llevar reclamaciones.md a producción: pruebas privadas, permisos, decisiones motivadas, apelaciones y medidas efectivas. La demo claims.js solo registra medidas, sin aplicarlas.
- [ ] Cola de incidencias de identidad de ambos roles separada de moderación del anuncio. Sin revisión de titularidad registral ni autorización para alquilar en v1.
- [x] Demo: ficha completa antes de decidir, galería ampliable, aprobar / pedir cambios / rechazar con motivo; conectar envíos del wizard y reflejar estado en Mis casas. Sin publicación real.
- [ ] Moderación en producción: persistencia, permisos, historial, notificación del motivo al propietario y corrección/reenvío.
- [ ] Tabla de casas y de owners (pagos vencidos)
- [ ] Reportes de clientes

### Landing y lanzamiento
- [ ] Landing pública (hero, 3 pasos, precio, comparativa, FAQ)
- [ ] SEO: SSR de fichas, sitemap, Open Graph
- [ ] Términos, privacidad (Ley 8968), política antifraude
- [ ] Actualizar el copy de la promoción en el prototipo: todavía muestra «primer mes gratis»; la decisión vigente son los tres tramos para las primeras 200 casas.
- [ ] Preparar mensajes y publicidad durante el desarrollo; comenzar el contacto comercial y el onboarding cuando funcione la app. Propuesta de piloto en el Caribe, zona concreta por confirmar; ver `marketing.md`.

## v2
- [ ] Evaluar Pedir casa/Buscan casa y Mis solicitudes cuando haya oferta/demanda suficientes; exploración conservada, oculta en el lanzamiento.
- [ ] Reparto escalonado: propietarios distintos, duplicados, prioridad y segunda tanda a 24 h; exploración en `request-distribution.js`, deshabilitada en el alcance inicial.
- [ ] Consultas/búsquedas representadas en calendario, acuerdos manuales y gestión desde sus barras.
- [ ] Tarifas avanzadas por temporada y fin de semana.
- [ ] Valoraciones de clientes por propietarios, alertas de nuevas casas, mapas avanzados y estadísticas detalladas.
- [ ] Apps nativas; comenzar con web adaptable al móvil.
- [ ] Evaluar titularidad registral opcional por finca/casa, excluida de v1 por decisión del 2026-10-12. Conservar guía y demo como exploración futura, sin compromiso de lanzamiento; revisión jurídica, formulario privado, cotejo y cola admin pendientes.
- [ ] Planes por nivel (destacados, más fotos, estadísticas)
- [ ] Descuento por volumen
- [ ] Inglés para turistas y precios en dólares por defecto en zonas turísticas
- [ ] Total orientativo en la ficha al elegir fechas (noches × precio)
- [ ] Re-matching diario de solicitudes abiertas con casas nuevas
- [ ] Detección automática de fraude en fotos (búsqueda inversa, teléfonos en imagen)
- [ ] Sincronizar anuncios completos desde PMS: descripción, fotos, precios y disponibilidad, no solo calendario. Evaluar OwnerRez como primer candidato; otros proveedores según demanda y acceso autorizado. Ver [decisión de integración PMS](decisiones.md#2026-10-12--sincronización-completa-con-pms-en-v2).
- [ ] Validar permisos/condiciones del proveedor, selección de casas, actualización desde el PMS, tarifas por fecha/moneda/suplementos, moderación del contenido y tratamiento consentido de consultas. Sin reservas ni pagos entre partes en bnbtico.
- [ ] Importar calendario externo (iCal) para marcar ocupados como alternativa limitada, sin descripción, fotos ni precios.

## Quizás nunca
- Reservas y pagos dentro de la app (rompe el modelo sin comisiones)
- Reseñas de casas (no verificables sin reserva en la app)
- Intermediación de WhatsApp con números puente (descartada para este experimento)
- Seguro o garantía de depósito

## Pendientes de decisión
- [ ] Evaluar si incorporar búsqueda asistida por IA: utilidad frente al formulario, facilidad de uso y coste. Fuera de v1 y sin compromiso para v2; simulador oculto y documentación conservados en `busqueda-asistida.md`. Cuotas, extras y precios históricos son propuestas, no funcionalidades aprobadas.
- [ ] Validación jurídica de identidad/biometría obligatoria y consulta registral opcional, datos accesibles desde Veriff, proveedores/países, avisos, derechos, retención e inscripción/protocolos ante PRODHAB. Ver privacidad-verificaciones.md.
- [ ] Titularidad opcional: coste, operador registral, vigencia, renovaciones y tratamiento de sociedades/copropiedad/otros derechos.
- [x] Integrar en el prototipo el logo original de rana sobre hoja y paleta coral de bnbtico (2026-10-05).
- [ ] Validar dominio/redes/marca para bnbtico.
- [ ] Revisar cuota de referencia ₡9.900 incluyendo identidad de clientes y owners y la promoción de 12/6/3 meses para las primeras 200 casas. No hay aumento aprobado.
- [ ] Pasarela: Tilopay vs ONVO Pay vs Greenpay
- [ ] Confirmar reglas de App Store / Play sobre cobrar la suscripción fuera de compras in-app
- [ ] Librería UI compartida: Tamagui vs NativeWind
- [ ] Proveedor de OTP (Twilio, Meta Cloud API, local)
- [ ] Zonas para solicitudes: lista cerrada de destinos vs provincia/cantón vs radio
- [ ] Política de retención y acceso a cédulas/selfies
