# Modelo de negocio

## Quién paga
El **owner**, por cada casa activa. El cliente nunca paga. La plataforma no cobra comisión por reserva ni interviene en el pago entre owner y cliente.

## Precio (v1)
| Concepto | Valor de referencia |
|---|---|
| Suscripción por casa activa | ₡9.900 / mes |
| Primer mes | Gratis |
| Pago anual | 10 meses (2 gratis) |
| Casa en revisión o pausada | ₡0 |
| Permanencia | Ninguna: cancelar o pausar detiene el cobro del siguiente ciclo |

Argumento de venta: una reserva de fin de semana paga el mes. Cero comisiones aunque alquile 30 noches.

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
"CasaTica" es el nombre provisional; "Pura Casa" es la alternativa. Una búsqueda web rápida (2026-10-02) no encontró plataformas de alquiler con ninguno de los dos nombres en Costa Rica, pero falta: disponibilidad de `casatica.com` / `casatica.cr` / `.co.cr`, redes sociales, volumen de búsquedas, y marca en el Registro Nacional.

## Economía unitaria (orientativa)
- Ingreso por casa: ₡9.900/mes (≈ $19). 150 casas activas ≈ ₡1,5 M/mes de MRR.
- Retorno para el owner: una noche de la casa media del catálogo (₡80–150k) ya cubre el mes.
- Coste variable por owner nuevo: OTP (~céntimos) + revisión manual (~10 min de una persona).

## Futuro (v2+)
- Planes por nivel: destacar casas en los primeros resultados, más fotos, estadísticas avanzadas.
- Descuento por volumen para owners con muchas casas.
- Posible plan para inmobiliarias pequeñas.

## Costes principales
- Infraestructura (Supabase, hosting web, tiles de mapa): bajos al inicio.
- OTP por WhatsApp/SMS: coste por verificación.
- Comisión de pasarela por cobro de suscripción.
- **Revisión manual** de owners y casas: es el coste operativo real. Al inicio lo hace el fundador; con volumen, una persona a tiempo parcial con SLA de 24 h.

## Riesgos del modelo
- Owners que publican y no renuevan si no reciben contactos en el primer mes → el onboarding debe garantizar visibilidad temprana (solicitudes de clientes que coinciden, alertas por zona).
- Fuga a WhatsApp: el contacto se va de la app por diseño, así que las métricas de valor son leads y valoraciones, no transacciones.
- Fraude: la verificación con cédula es la barrera principal; un caso de estafa con sello "Verificado" daña la marca más que cualquier otra cosa.
