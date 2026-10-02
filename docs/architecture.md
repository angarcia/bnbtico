# Arquitectura

## Stack
- **Monorepo** pnpm + Turborepo.
  - `apps/web`: Next.js (App Router, TypeScript). Fichas públicas con SSR para SEO; landing; checkout de suscripción.
  - `apps/mobile`: Expo / React Native (expo-router). Mismas pantallas que web salvo checkout (enlace a web).
  - `packages/ui`: componentes y tokens compartidos (Tamagui o NativeWind, por decidir). Tokens generados desde `design/tokens/tokens.json`.
  - `packages/api-client`: tipos generados de la BD + funciones de acceso.
  - `packages/config`: eslint, tsconfig, prettier.
- **Backend:** Supabase. Postgres con RLS, Auth OTP por teléfono, Storage (fotos públicas; cédulas/selfies en bucket privado), Edge Functions o pg_cron para jobs.
- **Mapa:** MapLibre + proveedor de tiles (web); react-native-maps (móvil). Ubicación con jitter/radio ~500 m.
- **WhatsApp:** deep links `https://wa.me/<E164>?text=<urlencoded>`. Sin API de WhatsApp en v1.
- **Pagos de suscripción:** pasarela local (Tilopay / ONVO Pay / Greenpay) con tarjeta recurrente y SINPE Móvil; webhooks → `subscriptions.status`.
- **Notificaciones:** push (Expo) + WhatsApp/SMS transaccional para "casa aprobada", "nuevo contacto", "nueva solicitud que coincide" y "un owner te escribió".

## Roles y auth
| Rol | Auth | Acceso |
|---|---|---|
| Visitante | ninguna | catálogo y fichas (sin número del owner) |
| Cliente | OTP teléfono | contactar, favoritos, solicitudes, perfil |
| Owner | OTP + correo + verificación manual (cédula) | casas, calendario, contactos, solicitudes, suscripción |
| Admin | cuenta interna | cola de verificación, casas, owners, reportes |

## Modelo de datos
Esquema completo en `supabase/migrations/0001_init.sql`. Entidades:

- `profiles` (rol, teléfono verificado) · `owner_profiles` (cédula, documentos, estado de verificación, WhatsApp de negocio) · `client_scores` (media, conteo, etiquetas).
- `listings` (public_id `CT-####`, modo vac/largo, tipo, ubicación aproximada, capacidad, amenidades enum[], fotos, moneda, precio base por noche o mes, mínimo de noches, estado draft/review/active/paused/rejected) · `availability` (día, ocupado, precio especial, etiqueta).
- `leads` (casa, cliente, owner, origen listing/request, fechas, personas) · `ratings` (owner → cliente, 1–5 + etiquetas).
- `requests` (modo, personas, fechas, zona, imprescindibles, presupuesto total o mensual, texto, consentimiento, máx. owners, caducidad) · `request_matches` (estado new/dismissed/replied, precio ofrecido).
- `subscriptions` (por casa, estado trial/active/paused/past_due/canceled, proveedor, renovación).
- `reports` · `admin_actions`.

Amenidades (enum): `pool, pets, ev_charger, ac, wifi, beachfront, bbq, parking, furnished, garage, accessible, no_deposit`.

## Reglas de negocio implementadas en backend
1. **Contactar requiere cuenta.** El botón WhatsApp crea un `lead` y devuelve el `wa.me` del owner; sin sesión → OTP primero.
2. **El número del owner nunca sale en la API pública**; solo en la respuesta del endpoint de contacto autenticado.
3. **Valoraciones:** un owner solo puede valorar a un cliente con el que exista `lead`; una valoración por lead. `client_scores` se recalcula por trigger.
4. **Publicación:** `listings.status` pasa a `active` solo por `admin_actions.approve` y con `owner_profiles.verification_status = approved`.
5. **Matching de solicitudes:** función `match_listings_for_request()` (modo, capacidad ≥ personas, `amenities @> must_have`, zona). Job al crear la solicitud y diario para solicitudes abiertas vs. casas nuevas. Notifica como máximo `max_owners` (10) y máximo 10 solicitudes/día por owner.
6. **Número del cliente:** se expone al owner solo mediante vista/función que compruebe `request_matches` + `consent_whatsapp` + owner aprobado. Al cerrar la solicitud, los owners que no respondieron dejan de verlo.
7. **Suscripción:** `listings.status = active` requiere `subscriptions.status in (trial, active)`. Webhooks de la pasarela actualizan estado; `past_due` tiene 5 días de gracia y luego `paused`.
8. **Caducidad de solicitudes:** 14 días (vacacional) / 30 (largo). Máx. 3 abiertas por cliente.
9. **Extracción de requisitos del texto libre:** reglas por palabras clave en v1 (piscina, cargador/eléctrico, perro/gato/mascota, aire, wifi, playa, cochera, amueblad, "somos N"); el cliente confirma los chips antes de enviar.

## SEO web
Fichas indexables con SSR, sitemap por provincia y destino, Open Graph con foto de portada, URLs `/c/CT-1042-villa-brisa-tamarindo`.

## Entornos
Supabase local (CLI) para desarrollo; proyecto `staging` y `prod`. Secretos solo en variables de entorno; nunca en el repo.

## Testing
Vitest para matching, formateo de dinero y extracción de requisitos. Playwright para "buscar → ficha → contactar" y el wizard de publicación. Revisión manual del prototipo como referencia de aceptación visual.
