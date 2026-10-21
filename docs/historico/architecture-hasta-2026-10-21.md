# Arquitectura

> **Nota 2026-10-21.** Documento histórico. La arquitectura vigente es la decidida el 2026-10-21 en `docs/decisiones.md` (app client-first con Vite + React + TanStack, un worker Hono en Cloudflare Workers con SSR solo en `/casa/CT-####`, Supabase directo desde el navegador con RLS y RPCs) y su resumen en la sección «Stack» de `docs/plan-implementacion.md`. Nada de lo que sigue (monorepo, Expo, MapLibre, passkeys) está vigente.

> **Nota 2026-10-15.** Partes de este documento están superadas. Reglas vigentes en `CLAUDE.md` y `docs/plan-implementacion.md`; el prototipo (vista Móvil) es la especificación de v1. En particular: WhatsApp verificado es lo único obligatorio (Veriff opcional, fuera de v1); contacto directo por WhatsApp sin solicitud/aceptación; sin reclamaciones en la app; colones con visualización en dólares; «Mensual» en vez de «Largo plazo».


Calendario/cierre (2026-10-12): separar `Listing.active` (visibilidad), `acceptingInquiries` (cierre temporal) y `reopenAt` opcional, de los estados diarios `{date, available, tariff, specialPrice?}`. Tarifas compartidas por casa `{base, high?, low?, currency}` y precios opcionales de fin de semana `{base?, high?, low?}`; alta/baja opcionales, sin copiar sus precios a fechas. Importe derivado: especial si existe; en otro caso, viernes/sábado usan el precio de fin de semana de la tarifa asignada si está definido, o su precio por noche. Domingo usa precio por noche. Sin porcentajes, checks ni herencia entre tarifas. Al quitar una temporada sus fechas vuelven a base; excepciones especiales intactas. El cierre nunca reescribe los días; la reapertura cambia solo el cierre y no activa publicaciones. Tarifas y disponibilidad independientes, cambios atómicos y autorizados. Reapertura a medianoche `America/Costa_Rica`, validación de futuro y tarea idempotente de servidor pendiente. Anuncio cerrado no admite nuevas consultas/propuestas; historial previo no se borra. En la demo, `house-controls.js` y `calendar.js` mantienen todo en memoria (diciembre 2026); no migración ni scheduler de producción todavía.

Actualización 2026-10-12: añadir a `Listing` preferencia `directContactEnabled` (false inicial), estado de publicación/pausa y consentimiento previo del propietario auditable por anuncio. Cada anuncio tiene destino WhatsApp verificado (copia inicial del teléfono del usuario) y candidato pendiente independiente. Vincular verificación a cuenta, anuncio/finalidad, teléfono normalizado, vencimiento y uso único. Activar el candidato solo tras comprobación en servidor; mantener el destino anterior mientras tanto. Cambiar teléfono de cuenta no reescribe anuncios. Contacto requiere identidad del propietario y destino de casa verificado, cliente con identidad/WhatsApp verificados, cuentas activas y anuncio aprobado/activo; autorización explícita del cliente y aceptación individual del owner **o** preferencia directa vigente. Registrar origen/fecha de consentimiento e intento de apertura, no mensaje entregado. Cambiar a No no revoca contactos ya aceptados ni teléfonos conocidos. Deduplicación cliente/casa por 7 días y Solicitudes compartidas se conservan. Demo: `house-controls.js` y `listing-whatsapp.js`; esquema, OTP real y backend pendientes, sin nuevas integraciones externas.

> Decisión vigente 2026-10-07: WhatsApp directo, sin chat interno ni números intermediarios. Solicitud consentida por cliente y aceptación del owner; especificación en `contacto-whatsapp.md`. Demo en memoria; backend e identidad reales pendientes.

## Stack
- **Monorepo** pnpm + Turborepo.
  - `apps/web`: Next.js (App Router, TypeScript). Fichas públicas con SSR para SEO; landing; checkout de suscripción.
  - `apps/mobile`: Expo / React Native (expo-router). Mismas pantallas que web salvo checkout (enlace a web).
  - `packages/ui`: componentes y tokens compartidos (Tamagui o NativeWind, por decidir). Tokens generados desde `design/tokens/tokens.json`.
  - `packages/api-client`: tipos generados de la BD + funciones de acceso.
  - `packages/config`: eslint, tsconfig, prettier.
- **Backend:** Supabase. Postgres con RLS, autenticación pendiente de validar (passkeys propuestas; OTP no basta como identidad), Storage de fotos; preferir captura de documentos/biometría en el proveedor sin duplicarlos innecesariamente, Edge Functions o pg_cron para jobs.
- **Mapa:** MapLibre + proveedor de tiles (web); react-native-maps (móvil). Ubicación con jitter/radio ~500 m.
- **WhatsApp directo:** backend autoriza el contacto tras solicitud consentida y aceptación del owner y genera `https://wa.me/<E164>?text=<urlencoded>`. No hay relay ni almacenamiento de conversaciones entre usuarios. La demo no genera enlaces reales. El OTP de WhatsApp requiere una integración de mensajería separada, pendiente.
- **Pagos de suscripción:** pasarela local (Tilopay / ONVO Pay / Greenpay) con tarjeta recurrente y SINPE Móvil; webhooks → `subscriptions.status`.
- **Notificaciones:** push (Expo) como propuesta pendiente. Se descartan por ahora los avisos automáticos y botones de aceptación por WhatsApp Business (2026-10-12). El OTP de verificación del número es un flujo separado que se conserva; no añadir SMS como sustitución automática de los avisos descartados.

## Roles y auth

El estado público «Identidad verificada» se deriva de **Veriff aprobado Y WhatsApp actual verificado**, nunca de una sola comprobación. Los estados internos separados sirven para permisos/soporte y para explicar al propio usuario qué falta, no para dos sellos públicos. Publicar/activar un anuncio y habilitar contacto exigen ambas condiciones en servidor; no basta ocultar botones. Es una regla pendiente de implementar, no una garantía de la demo actual.

Requisito 2026-10-12: propietarios y clientes necesitan **Veriff aprobado y WhatsApp verificado mediante OTP** antes de contactar/enviar solicitudes/publicar/responder. Registro, login y borradores siguen sin esa barrera inicial. Aplicar ambas condiciones en backend y mantener estados separados para identidad y número actual. Alcance: [identidad-y-seguridad.md](identidad-y-seguridad.md). Meta Cloud API directa es la vía considerada para OTP, pendiente de integrar; no supone intermediación en las conversaciones ni elige proveedor de login.
Ver identidad-y-seguridad.md: identidad separada de autenticación, teléfono y titularidad registral opcional por casa. Veriff elegido como dirección de producto y Essential candidato de plan; contratación, integración y cambios de esquema pendientes. Mapa propuesto de datos y requisitos jurídicos: privacidad-verificaciones.md. Passkeys y recuperación reforzada son propuestas, no capacidades confirmadas del stack. La integración de WhatsApp para OTP sigue pendiente; no confundirla con el contacto directo por wa.me ni con las notificaciones automáticas descartadas.

| Rol | Auth | Acceso |
|---|---|---|
| Visitante | ninguna | catálogo y fichas (sin número del owner) |
| Cliente | Cuenta; identidad aprobada antes de contactar/enviar solicitud | explorar/favoritos sin verificación de identidad; contacto condicionado |
| Owner | Cuenta; identidad aprobada antes de publicar/responder | borradores sin verificación inicial; titularidad por finca opcional, no requisito para publicar |
| Admin | cuenta interna | cola de verificación, casas, owners, reportes |

## Modelo de datos
Decisión 2026-10-12: [publicacion.md](publicacion.md) sustituye el modo vac/largo por alquiler vacacional con `acceptsLongTerm`, precio nocturno obligatorio y opción mensual importe/consultar. Tipos Casa/Apartamento/Habitación; cantidad de habitaciones/baños y uso privado/compartido/mixto. WhatsApp único del usuario, referenciado desde anuncios, no duplicado en ellos. Esquema y matching de abajo son históricos y requieren migración; solo el formulario de demo está adaptado.

Esquema inicial en `supabase/migrations/0001_init.sql`, pendiente de adaptar a identidad para ambos roles. No representa todavía los requisitos nuevos de `identidad-y-seguridad.md`. Entidades iniciales:

- `profiles` (rol, teléfono verificado) · `owner_profiles` (cédula, documentos, estado de verificación, WhatsApp de negocio) · `client_scores` (media, conteo, etiquetas).
- `listings` (public_id `CT-####`, modo vac/largo, tipo, ubicación aproximada, capacidad, amenidades enum[], fotos, moneda, precio base por noche o mes, mínimo de noches, estado draft/review/active/paused/rejected) · `availability` (día, ocupado, precio especial, etiqueta).
- `leads` (casa, cliente, owner, origen listing/request, fechas, personas) · `ratings` (owner → cliente, 1–5 + etiquetas).
- `requests` (modo, personas, fechas, zona, imprescindibles, presupuesto total o mensual, texto, consentimiento, máx. owners, caducidad) · `request_matches` (estado new/dismissed/replied, precio ofrecido).
- `subscriptions` (por casa, estado trial/active/paused/past_due/canceled, proveedor, renovación).
- `reports` · `admin_actions`.

Amenidades (enum): `pool, pets, ev_charger, ac, wifi, beachfront, bbq, parking, furnished, garage, accessible, no_deposit`.

## Reglas de negocio a implementar en backend

Actualización 2026-10-12: estado de cuenta activo/desactivado separado de identidad, anuncio y suscripción; cambios solo admin con motivo, confirmación e historial. En servidor, bloquear publicación/contactos/respuestas y ocultar anuncios de cuentas desactivadas; conservar acceso a ayuda, historial y reclamaciones. Demo en `admin-users.js` con identidad por nombre de ejemplo; producción requiere IDs persistentes, RLS, auditoría y permisos reales. Soporte por WhatsApp de bnbtico separado del contacto entre usuarios, sin captura automática de chats. Reportes sin campos ni ciclo de devoluciones; ver `reclamaciones.md`.
1. **Contactar requiere cuenta e identidad aprobada**, también para el owner receptor. Enviar la solicitud con consentimiento crea/reutiliza un lead por cliente/casa durante 7 días. El owner acepta al contactar o marca «No me interesa» sin reiniciar el plazo. El enlace de WhatsApp exige ambas aceptaciones; abrirlo no acredita envío, entrega ni reserva. Ver `contacto-whatsapp.md`.
2. **El número del owner nunca sale en la API pública**; se entrega al participante autorizado tras aceptar el contacto. No basta estar autenticado.
3. **Valoraciones:** un owner solo puede valorar a un cliente con el que exista `lead`; una valoración por lead. `client_scores` se recalcula por trigger.
4. **Publicación:** moderación del anuncio más identidad aprobada de la persona mediante proveedor. Separar estados de anuncio, identidad y titularidad registral opcional por casa; esta última no condiciona la publicación por defecto. No comprobar autorización de alquiler. Responder a clientes también exige identidad aprobada. El esquema de la comprobación por finca aún debe diseñarse; no emitir sellos por datos aportados solo por el navegador.
5. **Matching de solicitudes:** función `match_listings_for_request()` (modo, capacidad ≥ personas, `amenities @> must_have`, zona). Job al crear la solicitud y diario para solicitudes abiertas vs. casas nuevas. Notifica como máximo `max_owners` (10) y máximo 10 solicitudes/día por owner.
6. **Número del cliente:** compartir solo en la solicitud autorizada cuando el owner acepta. En Pedir casa, consentimiento específico para hasta 10 owners verificados compatibles. No prometer ocultar números en WhatsApp ni retirar datos ya compartidos.
7. **Suscripción:** `listings.status = active` requiere `subscriptions.status in (trial, active)`. Webhooks de la pasarela actualizan estado; `past_due` tiene 5 días de gracia y luego `paused`.
8. **Pedir casa:** requiere identidad aprobada. Su plazo inicial de 14 días (vacacional) / 30 (largo), máx. 3 abiertas, corresponde a búsquedas, no a avisos de contacto: estos caducan a los 7 días por cliente/casa.
9. **Extracción de requisitos del texto libre:** reglas por palabras clave en v1 (piscina, cargador/eléctrico, perro/gato/mascota, aire, wifi, playa, cochera, amueblad, "somos N"); el cliente confirma los chips antes de enviar.

## Ciclos de vida

### Casa (`listings.status`)
`draft` → (owner envía) `review` → (admin aprueba y owner verificado) `active` ↔ `paused` (owner pausa, o suscripción `past_due` vence la gracia) · `review` → `rejected` (con motivo; el owner puede corregir y reenviar).

### Suscripción (`subscriptions.status`)
`trial` (oferta de lanzamiento por casa: posiciones 1–50, 12 meses; 51–100, 6 meses; 101–200, 3 meses) → `active` al contratar la suscripción → `past_due` (cobro fallido o SINPE no recibido; recordatorio 3 días antes, 5 días de gracia) → `paused` (casa oculta, sin cobro) → `active` al pagar · `canceled` por el owner en cualquier momento (sin permanencia; efecto al final del ciclo pagado).

Condiciones vigentes en [business-model.md](business-model.md). El cupo global es de 200 casas; cada casa ocupa una plaza, aunque el owner o agencia tenga varias. Propuesta de asignación: primera publicación aprobada, con cómputo desde ese momento; criterio definitivo y tratamiento de duplicados o republicaciones pendientes. El cálculo del período gratuito y su finalización están pendientes de implementación; no interpretar el diagrama como autorización automática de cobro. El alta sin tarjeta y el tratamiento al vencer sin contratación siguen pendientes de concretar. La casa 201 en adelante no tiene un período gratuito aprobado en esta promoción.

### Solicitud (`requests.status`)
`open` al crearse (caduca a 14 días vac / 30 largo) → `closed` por el cliente o `expired` por job. Al cerrar, los `request_matches` en `new` dejan de poder ver el número del cliente.

## Notificaciones
| Evento | Destinatario | Canal |
|---|---|---|
| Código OTP para verificar WhatsApp | cliente / owner | WhatsApp; SMS no sustituye esta comprobación |
| Casa aprobada / rechazada / más info | owner | push propuesto; sin aviso automático por WhatsApp |
| Nuevo contacto (lead) | owner | bnbtico; push propuesto; aceptar/descartar dentro de bnbtico |
| Nueva solicitud que coincide | owner | bnbtico; push propuesto; sin aviso automático por WhatsApp |
| Un owner te escribió (match → replied) | cliente | push |
| Recordatorio de pago SINPE (D-3) / cobro fallido | owner | canal pendiente; no WhatsApp automático en el alcance actual |
| Recordatorio "valorá a tus clientes" | owner | push semanal |

## Mensajes prellenados de WhatsApp directo (solo tras aceptación bilateral; no plantillas de API)
Ver `docs/design.md › Flujos detallados`. Se generan en backend (para registrar el lead/match antes de devolver la URL) y el cliente puede editarlas antes de abrir `wa.me`. Codificar con `encodeURIComponent`; el emoji final es opcional.

## Extracción de requisitos del texto libre (v1)
Reglas por palabras clave, en minúsculas y sin tildes: `piscina→pool`, `cargador|electrico→ev_charger`, `perro|gato|mascota→pets`, `aire|a/c→ac`, `wifi→wifi`, `playa|frente al mar→beachfront`, `cochera|garaje→garage`, `amueblad→furnished`, `accesible|silla de ruedas→accessible`; `somos (\d+)` → personas. Nunca sobreescribe lo que el cliente desmarcó a mano. Candidato a LLM en v2.

## SEO web
Fichas indexables con SSR, sitemap por provincia y destino, Open Graph con foto de portada, URLs `/c/CT-1042-villa-brisa-tamarindo`.

## Entornos
Supabase local (CLI) para desarrollo; proyecto `staging` y `prod`. Secretos solo en variables de entorno; nunca en el repo.

## Testing
Vitest para matching, formateo de dinero y extracción de requisitos. Playwright para "buscar → ficha → contactar" y el wizard de publicación. Revisión manual del prototipo como referencia de aceptación visual.
# 2026-10-07 · Búsqueda asistida separada

La demo añade `design/prototype/assisted-search.js`: estado independiente del formulario Pedir casa, coincidencias estructuradas compartidas y conversación simulada sin API ni persistencia. No es chat entre cliente y owner. Producción requiere extracción/validación de filtros en backend, autorización, cuotas y contabilidad de uso; ver `busqueda-asistida.md`. La IA no debe decidir por sí sola a quién compartir contacto.
