# Visión

## El problema
En Costa Rica la mayoría de casas de alquiler (vacacional y largo plazo) se mueven por contactos y WhatsApp. Funciona, pero:

- **Para el owner:** solo llega a su red. Para tener visibilidad nacional tiene que irse a Airbnb/Booking, ceder 12–18 % de comisión, aceptar sus reglas de precios, cancelaciones y cobros, y dejar de hablar directamente con el cliente.
- **Para el cliente:** depende de "conocer a alguien". Encontrar opciones fuera de su círculo implica grupos de Facebook, anuncios sueltos y mucho riesgo de estafa (casas que no existen, adelantos que desaparecen).

## La idea
Un catálogo nacional de casas donde el owner publica y el cliente **lo contacta directamente por WhatsApp**, como siempre. La app no toca la reserva ni el pago entre ellos. Añade lo que a WhatsApp le falta: visibilidad, búsqueda con filtros y mapa, identidad verificada del owner, y un canal para que el cliente diga qué busca y le lleguen owners que cumplen.

> "Alquilá tu casa como siempre, por WhatsApp. Pero que te vea todo el país."

## Para quién
- **Owners** de casas, apartamentos, cabinas y quintas en Costa Rica: desde la familia con una casa de playa que alquila los fines de semana hasta pequeños inversionistas con 3–5 propiedades de largo plazo. Son quienes pagan.
- **Clientes** locales (y, en v2, turistas): familias y grupos que buscan casa para vacaciones, y personas que buscan casa o apartamento para vivir.

## Principios
1. Mismas herramientas que hoy: WhatsApp para hablar, SINPE o lo que acuerden para pagar. Nada de chat interno ni pagos intermediados.
2. Confianza por identidad, no por reseñas: owners verificados con cédula a mano; sin reseñas de casas (no se puede comprobar quién se hospedó).
3. Los owners pagan, así que los owners valoran a los clientes.
4. Precios siempre orientativos. El precio final es asunto de ellos.
5. Dos modos desde el día uno: vacacional (por noche) y largo plazo (por mes).

## Alcance decidido para v1 (sesión 2026-10-02)
Respuestas al cuestionario inicial que fijan el alcance:

| Pregunta | Decisión |
|---|---|
| Plataformas | **Web y app móvil desde el día 1** (monorepo con código compartido) |
| Modelo de cobro | Owners pagan **por casa**; planes por nivel en el futuro |
| Confianza | Verificación **manual** de owners (cédula) + verificación automática de teléfono y correo. **Sin reseñas de casas** |
| Tipo de alquiler | **Vacacional y largo plazo** desde v1, como dos modos separados |
| Contacto | WhatsApp con mensaje prellenado; **el cliente necesita cuenta**; aviso a owners de no usar teléfono personal |
| Valoraciones | **Los owners valoran a los clientes** (son quienes pagan) |
| Precio y fechas | Precio orientativo por noche en un calendario que el owner mantiene; el precio final se negocia por WhatsApp |
| Búsqueda | Mapa + lista + destinos + filtros: **todos** |
| Nombre | "CasaTica" gusta (también "Pura Casa"); pendiente comprobar dominio y búsquedas |
| Estilo | Cálido y local, pero lo que más convierta clientes |
| Idioma / moneda | Español; el owner decide en qué moneda cobra; la plataforma no gestiona cobros entre partes, así que el precio es orientativo |
| Pantallas del prototipo | Cliente, owner, admin y landing: todas |

Añadido después en la misma sesión: **solicitudes de casa** (el cliente describe lo que busca y la app avisa a los owners que cumplen; el owner responde por WhatsApp), filtros reales (personas, piscina, cargador eléctrico…), presupuestos **en total** para la estadía, y el copy "sin permanencia" en lugar de "pausá cuando querrás".

## Qué es éxito
- A 6 meses: 150+ casas activas pagando, con owners en al menos 5 provincias.
- Cada casa activa recibe de media 5+ contactos por WhatsApp al mes.
- Al menos la mitad de los contactos acaban valorados por el owner (señal de que hubo conversación real).
- Churn mensual de suscripción por debajo del 5 %.
- Cero casos de estafa atribuibles a un owner marcado como verificado.
