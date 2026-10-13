# Visión

> Lanzamiento ligero aprobado 2026-10-13: primero captar propietarios con publicación sencilla, ficha compartible y consultas directas. Web móvil, calendario sencillo, identidad/WhatsApp obligatorios antes de publicar/contactar, moderación y soporte. Búsquedas compartidas, reparto, valoraciones, tarifas avanzadas y apps nativas se aplazan. Probar clientes con un catálogo pequeño en una zona sin esperar a v2. Alcance vigente en [roadmap.md](roadmap.md); sustituye las prioridades históricas inferiores, no elimina las exploraciones.

> Alcance vigente 2026-10-12: catálogo de alquileres **vacacionales**, con atributo opcional Acepta largo plazo (respuesta Sí/No obligatoria al publicar). Ya no son dos modalidades excluyentes. Tipos: Casa, Apartamento, Habitación. Las referencias antiguas a dos modos quedan sustituidas por [publicacion.md](publicacion.md); adaptación de las búsquedas pendiente.

## El problema
En Costa Rica la mayoría de casas de alquiler (vacacional y largo plazo) se mueven por contactos y WhatsApp. Funciona, pero:

- **Para el owner:** solo llega a su red. Para tener visibilidad nacional tiene que irse a Airbnb/Booking, ceder 12–18 % de comisión, aceptar sus reglas de precios, cancelaciones y cobros, y dejar de hablar directamente con el cliente.
- **Para el cliente:** depende de "conocer a alguien". Encontrar opciones fuera de su círculo implica grupos de Facebook, anuncios sueltos y mucho riesgo de estafa (casas que no existen, adelantos que desaparecen).

## La idea
Un catálogo nacional de casas donde el owner publica y el cliente **solicita contacto para hablar directamente por WhatsApp si el owner acepta**. La app no toca la reserva ni el pago entre ellos. Añade lo que a WhatsApp le falta: visibilidad, búsqueda con filtros y mapa, identidad verificada de propietarios y clientes, y un canal para que el cliente diga qué busca y le lleguen owners que cumplen.

> "Tu casa, a la vista de todo el país. Tu contacto, bajo tu control."

## Para quién
- **Owners** de casas, apartamentos, cabinas y quintas en Costa Rica: desde la familia con una casa de playa que alquila los fines de semana hasta pequeños inversionistas con 3–5 propiedades de largo plazo. Son quienes pagan.
- **Clientes** locales (y, en v2, turistas): familias y grupos que buscan casa para vacaciones, y personas que buscan casa o apartamento para vivir.

## Principios
1. Contacto directo sencillo por WhatsApp: el cliente consiente al solicitar y el owner al responder. Sin chat interno ni intermediario. SINPE o lo que acuerden para pagar fuera de la app; sin pagos intermediados.
2. Identidad obligatoria para ambos roles mediante Veriff; comprobación opcional de titularidad registral por casa/finca desde el 2026-10-05. No se verifica autorización para alquilar ni se garantiza la estancia o el pago. Ver `identidad-y-seguridad.md`.
3. Los owners pagan, así que los owners valoran a los clientes.
4. Precios siempre orientativos. El precio final es asunto de ellos.
5. Dos modos desde el día uno: vacacional (por noche) y largo plazo (por mes).

## Alcance decidido para v1 (sesión 2026-10-02)
Respuestas al cuestionario inicial que fijan el alcance:

| Pregunta | Decisión |
|---|---|
| Plataformas | **Web y app móvil desde el día 1** (monorepo con código compartido) |
| Modelo de cobro | Owners pagan **por casa**; planes por nivel en el futuro |
| Confianza | Actualizado 2026-10-05: identidad de owners y clientes mediante Veriff; teléfono no equivale a identidad. Segunda comprobación opcional de titularidad registral por finca. No autorización de alquiler. |
| Tipo de alquiler | **Vacacional y largo plazo** desde v1, como dos modos separados |
| Contacto | Solicitud de contacto y WhatsApp directo al aceptar el owner; **el cliente necesita cuenta e identidad verificada**; aviso a owners de no usar teléfono personal |
| Valoraciones | **Los owners valoran a los clientes** (son quienes pagan) |
| Precio y fechas | Precio orientativo por noche en un calendario que el owner mantiene; el precio final se acuerda entre las partes |
| Búsqueda | Mapa + lista + destinos + filtros: **todos** |
| Nombre | bnbtico aplicado al prototipo; CasaTica permanece como nombre del repo y archivo HTML; dominio y marca pendientes |
| Estilo | Cálido y local, pero lo que más convierta clientes |
| Idioma / moneda | Español; el owner decide en qué moneda cobra; la plataforma no gestiona cobros entre partes, así que el precio es orientativo |
| Pantallas del prototipo | Cliente, owner, admin y landing: todas |

Añadido después en la misma sesión: **solicitudes de casa** (el cliente describe lo que busca y la app avisa a los owners que cumplen; el owner responde por WhatsApp), filtros reales (personas, piscina, cargador eléctrico…), presupuestos **en total** para la estadía, y el copy "sin permanencia" en lugar de "pausá cuando querrás".

## Qué es éxito
- A 6 meses: 150+ casas activas pagando, con owners en al menos 5 provincias.
- Cada casa activa recibe de media 5+ consultas al mes.
- Al menos la mitad de los contactos acaban valorados por el owner (señal de que hubo conversación real).
- Churn mensual de suscripción por debajo del 5 %.
- Medir y reducir reportes de fraude; el sello de identidad no garantiza ausencia de estafas. Ver `identidad-y-seguridad.md`.
