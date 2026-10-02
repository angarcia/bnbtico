# CasaTica — Especificación de producto y diseño (v1)

> Documento para implementar con Claude Code. Nombre **provisional**: "CasaTica" (pendiente verificar dominio .com/.cr y registro de marca). El prototipo navegable de referencia está en `casatica-prototipo.html`; este documento es la fuente de verdad para reglas de negocio, pantallas y sistema de diseño.

---

## 1. Qué es

Catálogo de casas en alquiler en Costa Rica. Los **owners** publican su casa; los **clientes** la encuentran y los contactan **directamente por WhatsApp** para negociar fechas, precio y pago. La plataforma **no procesa reservas ni pagos** entre owner y cliente. Replica el modelo informal que ya existe en CR (contactos + WhatsApp) añadiendo visibilidad nacional y confianza.

**Modelo de negocio:** suscripción que paga el owner, **por casa activa** (v1). Sin comisiones por reserva. Planes por nivel (destacados, más fotos, estadísticas) quedan para v2.

**Precio de referencia v1:** ₡9.900 / casa / mes (configurable). Primer mes gratis. Opción anual con 2 meses gratis. Casas en revisión o pausadas no se cobran.

## 2. Roles

| Rol | Qué hace | Autenticación |
|---|---|---|
| Visitante | Navega el catálogo sin cuenta | Ninguna |
| Cliente | Guarda favoritos, contacta owners por WhatsApp, recibe alertas | Teléfono verificado por OTP (WhatsApp/SMS) + correo opcional |
| Owner | Publica casas, gestiona calendario/precios, ve y valora clientes, paga suscripción | Teléfono + correo verificados + **verificación manual de identidad (cédula)** |
| Admin | Aprueba/rechaza owners y casas, gestiona reportes, ve métricas | Cuenta interna |

## 3. Reglas de negocio clave

1. **Contactar requiere cuenta de cliente.** Al tocar "Contactar por WhatsApp" sin sesión, se pide registro con teléfono verificado. Motivo: los owners (que pagan) quieren saber quién les escribe, y se necesita identidad para que puedan valorar al cliente.
2. **Cada contacto se registra como "lead"** (cliente, casa, fecha, mensaje prellenado) antes de abrir `https://wa.me/<numero>?text=<mensaje>`. El lead es lo que el owner ve en "Contactos" y lo que habilita la valoración.
3. **Owners valoran clientes, no al revés.** No hay reseñas de casas porque no se puede comprobar quién se hospedó. El cliente tiene una puntuación (1–5) y etiquetas positivas ("Responde rápido", "Cumplió fechas", "Cuidó la casa"). Un owner solo puede valorar a un cliente que lo contactó (existe lead). Puntuación visible para otros owners y para el propio cliente.
4. **Precio orientativo.** El owner fija un precio base por noche (vacacional) o por mes (largo plazo), en ₡ o $, y opcionalmente precios por fecha. Se muestra siempre como "desde / orientativo". El precio final se negocia por WhatsApp.
5. **Calendario manual.** El owner marca días ocupados y precios especiales a mano. No hay reservas en la app.
6. **El número de WhatsApp del owner nunca se muestra** en la ficha ni en fotos; solo se abre al tocar el botón. En el alta se recomienda número de negocio (WhatsApp Business) y se avisa que no se use personal.
7. **Verificación de owners (obligatoria antes de publicar):** teléfono y correo verificados automáticamente + revisión manual por admin de cédula (frente) y selfie con cédula. La primera casa de un owner también pasa revisión manual (fotos, texto sin teléfonos/enlaces, no duplicada de otra plataforma). SLA objetivo: 24 h. Casas siguientes: revisión ligera.
8. **Ubicación aproximada.** La ficha muestra un radio (~500 m), nunca la dirección exacta.
9. **Dos modos de catálogo desde v1:** Vacacional (por noche) y Largo plazo (por mes). Cambian filtros, unidad de precio y copy.
10. **Avisos antifraude** visibles en la ficha y en la landing: CasaTica nunca pide pagos; no transferir sin confirmar.
11. **Reportar anuncio** disponible en toda ficha; los reportes van a la cola de admin.
12. **Solicitudes de casa (búsqueda inversa).** El cliente puede publicar una solicitud estructurada (modo, personas, fechas, zona, imprescindibles, presupuesto opcional **expresado en total para la estadía** en vacacional, o por mes en largo plazo; nunca por noche) más un texto libre ("somos 3, queremos piscina y cargador eléctrico"). La app calcula las casas que cumplen (`mode`, `capacity ≥ ppl`, todas las amenidades imprescindibles, zona si se indicó) y **notifica solo a esos owners**. **El owner responde por WhatsApp directamente al cliente** (`wa.me/<cliente>?text=…` con mensaje prellenado: casa, zona, enlace a la ficha y **precio total para las fechas pedidas**, p. ej. "las 3 noches en ₡270.000 en total"; en largo plazo, precio mensual). El presupuesto del cliente se muestra al owner como badge en la solicitud. La app solo registra que respondió (`RequestMatch.state = replied`) y crea un lead con `source: request` para que luego pueda valorar al cliente. Nada de chat interno: la conversación vive en WhatsApp.
    Protección del cliente: al enviar la solicitud acepta explícitamente recibir WhatsApps de owners verificados; la app notifica como máximo a **10 owners** por solicitud (los de mejor coincidencia / más recientes primero); solo owners con cédula verificada reciben el número; en "Mis solicitudes" el cliente ve la lista de owners avisados y cuáles ya le escribieron, para identificar los chats; puede cerrar la solicitud en cualquier momento (los owners que no respondieron dejan de ver el número). Límites antispam: máx. 3 solicitudes activas por cliente, caducan a los 14 días (vacacional) o 30 (largo plazo); un owner recibe como máximo 10 solicitudes/día y puede silenciar por zona. Del texto libre se extraen requisitos automáticamente (reglas por palabras clave en v1; LLM en v2) y el cliente confirma los chips antes de enviar.
13. **Filtros funcionales del catálogo (v1):** modo, provincia/destino, personas (mín.), habitaciones (mín.), rango de precio, y amenidades: piscina, mascotas, **cargador eléctrico**, aire acondicionado, wifi, frente al mar, rancho/BBQ, accesible; en largo plazo además amueblado, cochera, sin depósito; "solo owners verificados" activo por defecto.

## 4. Flujos principales

### Cliente
1. Home → elige modo (Vacacional / Largo plazo) → busca por texto, provincia/destino, filtros, o mapa.
2. Toca una casa → Ficha (galería, badges, precio orientativo, amenidades, calendario, mapa aproximado, owner verificado, aviso antifraude).
3. Elige fechas/personas → "Contactar por WhatsApp".
   - Sin sesión → Registro (nombre, teléfono, OTP) → vuelve a la ficha con el sheet de contacto abierto.
   - Con sesión → Sheet "Se abrirá WhatsApp" con mensaje prellenado editable → se registra lead → abre `wa.me`.
4. Favoritos (corazón) y alertas por zona (v1 simple: provincia + modo).
5. Perfil: datos, puntuación como cliente con etiquetas, casas contactadas, favoritos, idioma.
6. **Pedir casa** (tab propio): formulario modo / personas (stepper) / fechas / zona / chips de imprescindibles / texto libre / presupuesto. Vista previa "N casas cumplen hoy tus requisitos" con avatares de owners. Checkbox de consentimiento ("Acepto que hasta N owners verificados me escriban por WhatsApp"). Enviar requiere cuenta. → **Mis solicitudes**: estado, criterios, texto, lista de owners que ya escribieron (casa, verificado, precio orientativo) con "Ver casa" y acceso al chat; aviso antifraude; cerrar solicitud.

Mensaje prellenado por defecto:
`Hola {nombreOwner}, vi tu casa «{título}» en CasaTica (ref {id}). ¿Está disponible del {llegada} al {salida} para {personas} personas? Gracias 🙂`
(Largo plazo: `…¿Sigue disponible a partir de {mes}? Somos {personas} personas.`)

### Owner
1. Registro owner → verificación automática (teléfono/correo) → sube cédula + selfie → estado "En revisión".
2. Publicar casa (wizard 5 pasos): Tipo (vac/largo + casa/apto/cabina/quinta) → Ubicación (provincia, cantón, zona, pin aproximado) → Detalles (capacidad, habitaciones, baños, amenidades, título, descripción) → Fotos (mín. 5, validación de texto/teléfonos) → Precio y WhatsApp (precio base, moneda, número de negocio, resumen de suscripción) → "Enviar a revisión".
3. Panel: vistas 30 d, contactos, casas activas, estado de suscripción, recordatorio de clientes sin valorar.
4. Calendario y precios: marcar ocupado por día, precio especial, temporada alta, mínimo de noches.
5. Contactos (leads): lista por casa, mensaje, puntuación previa del cliente, valorar 1–5 + etiquetas, botón para abrir WhatsApp con ese cliente.
5b. Contactos → pestaña **Solicitudes**: solicitudes que coinciden con alguna casa del owner (cliente + puntuación, criterios, texto, "coincide con: {casa}"). Acciones: "Responder por WhatsApp" (sheet: elegir casa, vista previa del mensaje prellenado editable, botón verde "Abrir WhatsApp" → `wa.me` del cliente) o "No me interesa". Notificación push/WhatsApp al owner cuando llega una solicitud que coincide.
6. Suscripción: desglose por casa, total, próximo cobro, pagar anual, pausar/cancelar casa. **Sin permanencia:** cancelar o pausar detiene el cobro del siguiente ciclo. Pagos gestionados por la plataforma vía pasarela local (ONVO Pay, Tilopay o Greenpay; decidir en implementación):
   - **Tarjeta:** tokenizada, renovación automática mensual/anual.
   - **SINPE Móvil:** pago iniciado por el owner cada ciclo (no es recurrente); la pasarela confirma el pago por webhook. La app recuerda por WhatsApp 3 días antes del vencimiento; si no paga, la casa pasa a `pastDue` con 5 días de gracia y luego a `paused`.
   - Realizar el checkout en la **web** (enlace desde la app) para evitar las comisiones y reglas de compras in-app de Apple/Google; validar antes del lanzamiento si la suscripción califica como "servicio fuera de la app".

### Admin
1. Cola de verificación: tarjetas con owner, documentos, datos, casa, alertas automáticas (teléfono personal detectado, fotos duplicadas, pocas fotos). Acciones: Aprobar / Pedir más info / Rechazar (con motivo).
2. Casas: tabla con estado, vistas, contactos; pausar o despublicar.
3. Owners: estado de pago, churn, nuevos.
4. Reportes de clientes sobre anuncios.

### Landing (marketing, pública)
Hero con propuesta ("Alquilá tu casa como siempre, por WhatsApp. Pero que te vea todo el país."), 3 pasos, caja de precio, tabla comparativa (CasaTica vs plataformas con comisión vs solo WhatsApp), casas recientes, FAQ (por qué no hay reseñas, adelantos, varias casas). CTAs: "Publicar mi casa" y "Buscar una casa".

## 5. Mapa de pantallas

**Cliente:** `home`, `filters`, `detail/:id`, `request` (pedir casa), `my-requests`, `favs`, `login`, `profile`.
**Owner:** `o-dash`, `o-houses`, `o-new` (wizard), `o-house/:id` (vista previa), `o-cal`, `o-leads`, `o-requests`, `o-profile`, `o-sub`.
**Admin:** `a-queue`, `a-houses`, `a-owners`.
**Público:** `landing`.

Navegación: móvil = tab bar inferior (Cliente: Explorar / Favoritos / Mi cuenta; Owner: Panel / Mis casas / Calendario / Contactos / Cuenta). Web = barra superior con las mismas secciones y CTA principal a la derecha.

## 6. Modelo de datos (mínimo)

```
User        { id, role: guest|owner|admin, name, phone (verificado), email, locale, createdAt }
OwnerProfile{ userId, idNumber (cédula), idDocUrl, selfieUrl, verificationStatus: pending|approved|rejected, businessWhatsapp, payoutNotes }
ClientScore { userId, avg, count, tags: {respondeRapido, cumplioFechas, cuidoCasa} }
Listing     { id (CT-####), ownerId, mode: vac|largo, kind: casa|apto|cabina|quinta, title, description,
              province, canton, zone, lat, lng (aprox), capacity, bedrooms, bathrooms,
              amenities[] (enum: pool, pets, ev_charger, ac, wifi, beachfront, bbq, parking, furnished, garage, accessible, no_deposit),
              photos[], currency: CRC|USD, basePrice, unit: night|month, minNights,
              status: draft|review|active|paused|rejected, views30d, createdAt }
Availability{ listingId, date, state: free|busy, priceOverride?, label?: alta }
Lead        { id, listingId, clientId, ownerId, message, checkIn?, checkOut?, people?, source: listing|request, requestId?, createdAt }
Request     { id, clientId, mode, people, dateFrom?, dateTo?, zone?, mustHave[] (amenities), budgetTotal? (vac: total estadía; largo: por mes), budgetCurrency?, text, status: open|closed|expired, expiresAt, createdAt }
Request     += { consentWhatsapp: true, maxOwners: 10 }
RequestMatch{ requestId, listingId, ownerId, notifiedAt, state: new|dismissed|replied, repliedAt?, offeredPrice? }
             // "replied" se marca al abrir wa.me; genera Lead{source:request}. No hay mensajería interna.
Rating      { leadId, ownerId, clientId, stars 1–5, tags[], comment?, createdAt }
Subscription{ ownerId, listingId, pricePerMonth, status: trial|active|paused|pastDue, renewsAt, provider, externalId }
Report      { listingId, reporterId?, reason, status }
AdminAction { targetType, targetId, action: approve|reject|requestInfo|pause, reason, adminId, createdAt }
```

## 7. Sistema de diseño

**Dirección:** cálida y local, con la claridad de un marketplace. Fotos grandes, mucho blanco cálido, un verde selva como primario, un dorado "sol" como acento escaso, y el verde WhatsApp reservado exclusivamente al CTA de contacto para que sea reconocible al instante.

### Color (light / dark)
| Token | Light | Dark | Uso |
|---|---|---|---|
| `--bg` | #F7F5EF | #141917 | Fondo de página |
| `--surface` | #FFFFFF | #1C2320 | Tarjetas, barras |
| `--surface-2` | #EFEDE6 | #242D29 | Chips inactivos, celdas |
| `--fg` | #1B2420 | #EDEFEA | Texto |
| `--muted` | #5F6B64 | #A3ADA6 | Texto secundario |
| `--line` | #DDD9CE | #2F3934 | Bordes |
| `--jungle` | #1E6B4A | #4FB07F | Primario (botones, tabs activos, pin activo) |
| `--jungle-ink` | #124634 | #8FD3B0 | Texto sobre `--jungle-soft` |
| `--jungle-soft` | #DCEFE4 | #1E3A2D | Badge "Verificado", fondos suaves |
| `--sun` | #E8A33D | #F0B24F | Acento: estrellas, temporada alta, focus ring |
| `--sun-soft` | #FBEFD9 | #3B2E17 | Notas/avisos, temporada alta |
| `--wa` | #25D366 | #25D366 | Solo botón "Contactar por WhatsApp" (texto #063B1E) |
| `--ok / --warn / --bad` | #2E8B57 / #C97A12 / #C2432F | iguales | Estados semánticos |

### Tipografía
- Display: **Bricolage Grotesque** 700/800 (títulos, cifras grandes). Fallback: system-ui.
- Body: **Nunito Sans** 400/600/700. Fallback: system-ui.
- Escala: 11 (eyebrow, uppercase, tracking .1em) · 12 · 13 · 15 (base) · 17 · 20 · 22 (h2) · 24–26 (h1 app) · 32/50 (hero landing).
- Cifras con `font-variant-numeric: tabular-nums`. Formato colones `₡95.000` (es-CR), dólares `$120`.

### Forma y espaciado
- Radios: tarjetas 14–16 px, botones 12 px, chips/badges 999 px, galería 12 px.
- Espaciado base 4 px; gaps habituales 8 / 10 / 12 / 14 / 16; padding de vista 16 px móvil, 32 px web.
- Sombra única y suave: `0 1px 2px rgba(27,36,32,.06), 0 8px 24px -12px rgba(27,36,32,.18)`.
- Breakpoints (por contenedor): ≥640 px → 2 columnas de tarjetas; ≥800 px → nav superior, layout ficha en 2 columnas (contenido + panel sticky de contacto), galería mosaico; ≥1000 px → 3 columnas + mapa sticky lateral en home.

### Componentes
- **ListingCard:** foto 16:11 con corazón flotante arriba a la derecha, título + badge Verificado, línea de meta (zona · personas · hab), precio `₡95.000 / noche · orientativo`.
- **Badge Verificado:** escudo + "Verificado" sobre `--jungle-soft`. "En revisión" en gris.
- **Botón WhatsApp:** ancho completo, `--wa`, icono WhatsApp, texto "Contactar por WhatsApp". En móvil se repite en una barra inferior sticky con el precio.
- **Sheet de contacto:** avatar owner + verificado, burbuja estilo WhatsApp con el mensaje prellenado, textarea editable, botón "Abrir WhatsApp", nota de privacidad.
- **Chips de filtro:** pill, estado activo relleno `--jungle`.
- **Segment control:** Vacacional / Largo plazo (y en el prototipo, Móvil / Web).
- **Calendario:** 7 columnas (L K M J V S D, convención tica), día ocupado con rayado diagonal, temporada alta en `--sun-soft`, precio pequeño bajo el número.
- **Stat tile:** etiqueta, número grande display, sparkline con área al 15 %, variación en verde/rojo.
- **Wizard:** barra de 5 segmentos, un card por paso, botones Atrás / Continuar, último paso "Enviar a revisión".
- **Lead row:** avatar, nombre + puntuación ★ 4.8 (6), casa · cuándo · mensaje, 5 estrellas para valorar, botón WhatsApp.
- **Note (aviso):** fondo `--sun-soft`, icono, texto 13 px. Usar para avisos antifraude y de número de negocio.
- **Request form:** segment Vacaciones / Para vivir, stepper de personas (− N +), fechas, select de zona, chips de imprescindibles (mismo enum de amenidades), textarea con detección de requisitos (al salir del campo se marcan chips y se muestra toast "Detectamos requisitos en tu texto"), presupuesto opcional, línea de vista previa "N casas cumplen hoy" con avatares, botón primario.
- **Request card (owner):** avatar + nombre + ★ puntuación, resumen (modo · personas · fechas · zona), chips de requisitos, texto en cursiva, "Coincide con: {casa}", badge Nueva / Respondiste, acciones Responder con precio / No me interesa.
- **Reply sheet (owner):** cliente + puntuación, select de casa, burbuja WhatsApp con el mensaje prellenado, textarea editable, botón verde "Abrir WhatsApp".
- **Owner-wrote row (cliente):** avatar + owner + verificado, casa · zona · precio orientativo, botones Ver casa / Chat (verde WA).
- **Admin queue card:** avatar, estado, 2 miniaturas de documentos, datos, alertas automáticas en rojo, acciones Aprobar / Pedir más info / Rechazar.

### Copy y tono
- Español de Costa Rica, voseo ("Tocá", "Alquilá", "Pausá cuando querrás"). Inglés en v2.
- Directo y cercano; sin jerga. Siempre decir "orientativo" junto al precio.
- Microcopy fijo: "Sin comisiones. Hablás directo con {owner}." · "CasaTica no procesa pagos." · "La dirección exacta la comparte el owner."

### Accesibilidad
- Contraste AA en ambos temas; focus ring visible (`--sun`); botones de icono con `aria-label`; `prefers-reduced-motion` respetado; áreas táctiles ≥ 40 px.

## 8. Stack sugerido (ambas plataformas desde el día 1)

- **Monorepo** (Turborepo/pnpm): `apps/web` (Next.js, SSR para SEO de fichas), `apps/mobile` (Expo / React Native), `packages/ui` (tokens + componentes compartidos con Tamagui o NativeWind), `packages/api-client`.
- **Backend:** Supabase (Postgres + Auth OTP por teléfono + Storage para fotos) o NestJS + Postgres. Row-level security por rol.
- **Mapa:** MapLibre + tiles (web) / react-native-maps (móvil). Pins con precio; ubicación con jitter/radio.
- **WhatsApp:** deep link `wa.me`; sin API de WhatsApp en v1.
- **Pagos de suscripción:** pasarela local con SINPE Móvil + tarjeta; webhooks → `Subscription.status`.
- **Notificaciones:** push (Expo) + WhatsApp/SMS para "casa aprobada", "nuevo contacto", "nueva solicitud que coincide" (owner) y "un owner respondió tu solicitud" (cliente).
- **Matching de solicitudes:** job al crear la solicitud (y diario para solicitudes abiertas vs. casas nuevas): consulta SQL por `mode`, `capacity ≥ people`, `amenities @> mustHave`, zona (provincia/cantón o radio), `status = active`; crea `RequestMatch` y encola notificaciones con límite por owner/día.
- **SEO web:** fichas públicas indexables, sitemap por provincia/destino, Open Graph con foto de portada.

## 9. Fuera de alcance v1
Reservas y pagos en la app · reseñas de casas · planes por nivel / destacados · chat interno · multi-idioma · integración con calendarios externos (iCal) — candidatos para v2.

## 10. Métricas de éxito
Owners verificados activos · casas activas pagando · leads por casa/mes · % de leads valorados · tiempo de aprobación (SLA 24 h) · churn mensual de suscripción · tasa de reportes por casa.

## 11. Pendientes para Daniel
- Confirmar nombre y comprobar dominio (`casatica.com`, `casatica.cr`, `.co.cr`) y marca en el Registro Nacional. Alternativas: "Pura Casa", "Casa Pura Vida".
- Confirmar precio por casa y duración del trial.
- Elegir pasarela de pago con SINPE Móvil.
- Definir política de datos para cédulas (cifrado, retención, quién accede).
