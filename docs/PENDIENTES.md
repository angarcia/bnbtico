# Pendientes y preguntas abiertas

## Negocio
- [ ] **Nombre definitivo.** Candidatos: CasaTica, Pura Casa. Comprobar dominio (`.com`, `.cr`, `.co.cr`), redes y marca en el Registro Nacional. Una búsqueda rápida no mostró plataformas de alquiler con esos nombres, pero no sustituye la comprobación formal.
- [ ] Precio por casa (ref. ₡9.900/mes) y duración del primer mes gratis.
- [ ] Descuento anual (ref. 2 meses gratis).
- [ ] Pasarela de pago: Tilopay vs ONVO Pay vs Greenpay (tarjeta recurrente + SINPE Móvil + webhooks).
- [ ] Confirmar con las guías de App Store / Play Store si la suscripción de owners puede cobrarse fuera de compras in-app.
- [ ] Política de datos personales para cédulas y selfies (cifrado, retención, acceso), conforme a la Ley 8968 de protección de datos de Costa Rica.
- [ ] Términos de uso: dejar claro que la plataforma no interviene en pagos ni reservas.

## Producto
- [ ] ¿Total orientativo en la ficha al elegir fechas (noches × precio)? Hoy solo "desde ₡X / noche".
- [ ] Zonas para solicitudes: lista cerrada de destinos vs provincia/cantón vs radio en mapa.
- [ ] Extracción de requisitos del texto libre: reglas por palabras clave en v1; evaluar LLM en v2.
- [ ] Qué pasa con una solicitud cuando se publican casas nuevas que coinciden (re-matching diario: sí/no).
- [ ] Alertas de nuevas casas para clientes (provincia + modo) — incluido en v1 como simple, confirmar.
- [ ] Inglés para turistas: v2.

## Técnico
- [ ] Elegir librería UI compartida web+móvil (Tamagui vs NativeWind).
- [ ] Proveedor de OTP por WhatsApp/SMS en Costa Rica (Twilio, Meta Cloud API, proveedor local).
- [ ] Tiles de mapa (MapLibre + proveedor) y jitter de ubicación aproximada.
- [ ] Detección automática de fraude en fotos (teléfonos, duplicados en otras plataformas): alcance v1.
