# Modelo de negocio

> **Nota 2026-10-15.** Partes de este documento están superadas. Reglas vigentes en `CLAUDE.md` y `docs/plan-implementacion.md`; el prototipo (vista Móvil) es la especificación de v1. En particular: WhatsApp verificado es lo único obligatorio (Veriff opcional, fuera de v1); contacto directo por WhatsApp sin solicitud/aceptación; sin reclamaciones en la app; colones con visualización en dólares; «Mensual» en vez de «Largo plazo».


## Quién paga
El **owner**, por cada casa activa. El cliente puede explorar, filtrar y pedir casa gratis. Se contempla cobrar únicamente búsquedas asistidas adicionales opcionales, tras agotar las incluidas; tarifa y cupos pendientes de validación (ver `busqueda-asistida.md`). La plataforma no cobra comisión por reserva ni interviene en el pago entre owner y cliente.

## Precio (v1)
Referencia actual, sin aumento aprobado. La usuaria acepta evaluar una subida para financiar verificación de calidad de clientes y owners. Medir volumen, mínimo mensual, reintentos y soporte antes de fijarla; precios de proveedores y fuentes en identidad-y-seguridad.md.

| Concepto | Valor de referencia |
|---|---|
| Suscripción por casa activa | ₡2.900 / mes (decidido el 2026-10-27; antes, referencia de ₡9.900) |
| Oferta de lanzamiento | Primeras 50 casas: 1 año gratis; siguientes 50: 6 meses; siguientes 100: 3 meses |
| Pago anual | 10 meses (2 gratis) |
| Casa en revisión o pausada | ₡0 |
| Permanencia | Ninguna: cancelar o pausar detiene el cobro del siguiente ciclo |

Argumento de venta: una reserva de fin de semana paga el mes. Cero comisiones aunque alquile 30 noches.

### Oferta de lanzamiento · decisión 2026-10-07

La promoción se limita a **200 casas en total**, con estos tramos:

| Posición de la casa en la promoción | Cupo del tramo | Período gratuito |
|---|---|---|
| 1–50 | 50 casas | 1 año (12 meses) |
| 51–100 | 50 casas | 6 meses |
| 101–200 | 100 casas | 3 meses |

- Cada casa ocupa una plaza, aunque varias pertenezcan al mismo propietario o agencia. El beneficio se asigna por casa: una cuenta no obtiene automáticamente el mismo período para todas sus propiedades.
- Criterio propuesto: asignar plaza y comenzar el período al publicarse por primera vez la casa aprobada. El evento exacto de asignación y las reglas sobre duplicados o republicación aún deben concretarse; crear una cuenta no asegura una plaza bajo esta propuesta.
- El beneficio es publicar la casa durante ese período sin pagar la suscripción; no se limita al registro de la cuenta. La identidad obligatoria y los requisitos de publicación se mantienen.
- Sustituye tanto el primer mes gratis anterior como las propuestas de tres meses para todas las casas o de cupos por propietario. Para la casa 201 en adelante no se ha aprobado un período gratuito en esta promoción. La cuota posterior es ₡2.900/mes por casa (decidido el 2026-10-27; hasta entonces la referencia era ₡9.900).
- Una posible fecha límite adicional al cupo y la combinación con el descuento anual siguen pendientes. Empezar sin tarjeta y requerir aceptación de la suscripción al terminar son propuestas por concretar en el flujo de cobro, no funciones implementadas.
- Primero se desarrollará la app; el contacto comercial con propietarios y agencias comenzará cuando esté funcionando. Preparación y mensajes en [marketing.md](marketing.md).

### Tarifas para agencias · propuesta del 2026-10-12

Se estudia un descuento por volumen manteniendo la suscripción por casa activa, sin comisión por alquiler. La usuaria cuestionó los paquetes iniciales demasiado baratos, tomando US$20 por casa como referencia y preguntando si tendría que ser «a partir de 7». La respuesta interpretó esa cifra como un posible mínimo de **US$7 por casa al mes para agencias**; esa interpretación y el cálculo definitivo siguen pendientes de confirmar. Guardar esta conversación no convierte la propuesta en una tarifa contratada o implementada.

Última tabla orientativa conversada:

| Casas de la agencia | Referencia mensual por casa |
|---|---:|
| 1–9 | US$20 |
| 10–24 | US$15 |
| 25–49 | US$10 |
| 50 o más | US$7 |

**Esta tabla no es todavía una regla de facturación.** Aplicar cada precio a todas las casas provocaría bajadas al añadir propiedades: nueve a US$20 suman US$180, mientras diez a US$15 suman US$150. También hay saltos en 25 y 50. Hay que definir un cálculo que evite que el total disminuya al aumentar las casas, sin prometer una fórmula aún no acordada.

El ejemplo «50 casas a US$7 = US$350/mes» ilustra un descuento uniforme; no es el resultado de una escala marginal. Si se eligen tramos marginales, US$7 se aplicaría solo a las casas de ese tramo y cambiaría el total. Resolver esa diferencia antes de mostrar precios o implementar cobros.

- US$20 es una referencia redonda usada en la conversación, no una conversión fija de ₡9.900. La tarifa individual pasó a ₡2.900/mes el 2026-10-27 (antes, ₡9.900 como referencia).
- La promoción sigue asignándose por casa: 12, 6 o 3 meses según su posición. No cobrar durante el período gratuito propio de cada casa. Definir cómo cuentan las casas gratuitas al calcular un descuento y cómo se gestionan los vencimientos distintos dentro de una agencia.
- Casas en revisión o pausadas mantienen la regla vigente de ₡0. Definir también altas, bajas, cambio de tramo y relación con el descuento anual antes de contratar.
- Validar soporte, verificaciones, moderación, pasarela y consultas recibidas antes de fijar un precio sostenible. No se ha demostrado rentabilidad a US$7.
- Propuesta anterior cuestionada por la usuaria y sustituida como recomendación: paquetes de hasta 10 casas por ₡29.900, 25 por ₡59.900 y 50 por ₡99.900 al mes. Se conserva solo como historial, no como oferta vigente.

Como referencia consultada, [Costa Rica MLS](https://www.re.cr/es/agency-packages?set_language=es) publica un plan básico de US$89 con pago mensual y anuncios ilimitados; US$74/mes corresponde al compromiso anual mostrado. Sus servicios son distintos y esta comparación no demuestra cuánto estarían dispuestas a pagar las agencias por bnbtico. Resumen comercial en [resumen-marketing-2026-10-12.md](resumen-marketing-2026-10-12.md).

## Cómo se cobra
La plataforma sí gestiona el cobro de la suscripción, con una pasarela costarricense (Tilopay, ONVO Pay o Greenpay; pendiente elegir):

- **Tarjeta:** tokenizada, renovación automática mensual o anual.
- **SINPE Móvil:** no es recurrente. Cada ciclo el owner paga desde su banco; la pasarela confirma por webhook. La app recuerda por WhatsApp 3 días antes; si no paga, la casa pasa a `past_due` con 5 días de gracia y luego a `paused`.
- El checkout se hace en la **web** (enlace desde la app) para evitar las comisiones y reglas de compras in-app de Apple/Google. Validar antes de lanzar si la suscripción califica como "servicio consumido fuera de la app".

## Aclaraciones de la sesión
- **"¿Se puede pagar por esos medios desde la app?"** Sí: la app gestiona el cobro de la suscripción (es dinero para la plataforma, no entre owner y cliente). Tarjeta = recurrente automático. SINPE Móvil = el owner inicia el pago cada ciclo; la pasarela lo confirma por API, así no hay conciliación manual. Vale la pena mantener SINPE porque muchos owners no usan tarjeta online.
- **Copy de la landing.** "Pausá cuando querrás" era ambiguo; lo que se quiere decir es que **no hay permanencia**. Copy actual: *"Sin permanencia ni contratos: cancelá o pausá una casa cuando quieras y dejás de pagar. Pagá con tarjeta (renovación automática) o SINPE Móvil."*
- **Apple / Google.** Las suscripciones "digitales" en apps nativas deben pasar por compras in-app (15–30 %). Una suscripción para publicar una casa física suele caer en la excepción de servicios consumidos fuera de la app (como las tarifas de anfitrión de Airbnb), pero hay que confirmarlo. Mientras tanto: checkout en web.

## Nombre y marca
Marca bnbtico, rana sobre hoja en rojo coral, aplicada al prototipo el 2026-10-05. CasaTica permanece como nombre del repositorio y archivo HTML. Disponibilidad de dominio, redes y marca pendientes; no considerar propuestas anteriores como disponibilidad confirmada.

## Economía unitaria (orientativa)
- Ingreso por casa que paga la tarifa individual: ₡2.900/mes (desde el 2026-10-27). 150 casas de pago a esa tarifa suman ₡435.000/mes antes de costes (con la referencia anterior de ₡9.900 eran ₡1.485.000). Las casas gratuitas y los futuros descuentos para agencias cambian ese cálculo; no equiparar casas publicadas y casas de pago.
- Retorno para el owner: una noche de la casa media del catálogo (₡80–150k) ya cubre el mes.
- Coste de identidad de ambos roles: altas de clientes y propietarios, reintentos facturables y reverificaciones justificadas, además del mínimo mensual del proveedor. No cobrar ni repetir por cada casa o cada conversación. Ver `identidad-y-seguridad.md`.

## Futuro (v2+)
- Posible plan más barato de comunidad sin anuncio: alcance y precio pendientes. No acceso gratuito por identidad verificada ni año gratis a verificados.
- Planes por nivel: destacar casas en los primeros resultados, más fotos, estadísticas avanzadas.
- Descuento por volumen para owners con muchas casas y agencias: propuesta conversada el 2026-10-12 en la sección de tarifas para agencias; fórmula e inclusión en v1 pendientes.

## Costes principales
- Infraestructura (Supabase, hosting web, tiles de mapa): bajos al inicio.
- OTP por WhatsApp/SMS: coste por verificación.
- Comisión de pasarela por cobro de suscripción.
- Proveedor de identidad, atención a casos dudosos y moderación de anuncios. Se añade comprobación opcional de titularidad por finca, no autorización para alquilar. Coste registral, revisión manual, responsable del pago y posible cargo al owner pendientes; no asumir que lo incluye Veriff. Tiempo de soporte y SLA pendientes de medir.

## Riesgos del modelo
- Owners que no contratan al terminar el período gratuito de cada casa si no reciben consultas → preparar la captación de clientes y medir consultas por casa durante la promoción, sin garantizar contactos o alquileres.
- WhatsApp directo: una vez compartido el contacto puede seguir fuera de bnbtico. No se puede impedir que una agencia proponga otras casas por ese canal. Las métricas de valor son consultas y valoraciones, no transacciones. Se cobra visibilidad y contactos mediante suscripción; no se añade chat interno, intermediación ni comisión por alquiler.
- Fraude: identidad verificada no equivale a vivienda legítima; no se comprueba derecho a alquilar. El sello debe explicar ese límite.
