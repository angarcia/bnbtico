# Diseño

Referencia viva: `design/prototype/casatica-prototipo.html` (abrir en el navegador; selector Cliente / Owner / Admin / Landing y Móvil / Web). Tokens en `design/tokens/tokens.json`.

## Dirección
Cálida y local, con la claridad de un marketplace. Fotos grandes sobre papel cálido, un verde selva como primario, un dorado "sol de Guanacaste" como acento escaso, y el **verde de WhatsApp reservado exclusivamente al botón de contacto** para que se reconozca al instante. Español de Costa Rica con voseo.

## Roles y navegación
- **Cliente** (móvil: tab bar inferior; web: barra superior): Explorar · Pedir casa · Favoritos · Mi cuenta.
- **Owner:** Panel · Mis casas · Calendario · Contactos (Me contactaron / Solicitudes) · Cuenta.
- **Admin:** Verificación · Casas · Owners.
- **Landing** pública para captar owners.

## Pantallas

### Cliente
- **Home:** segment Vacacional / Largo plazo, buscador, chips de provincia, mapa con pins de precio (sticky lateral en escritorio), tarjetas. Línea "N casas · precios orientativos, se negocian por WhatsApp".
- **Filtros:** provincia, personas (mín.), habitaciones (mín.), amenidades (piscina, mascotas, ⚡ cargador eléctrico, A/C, wifi, frente al mar, rancho/BBQ, accesible; en largo plazo amueblado, cochera, sin depósito), rango de precio, "solo owners verificados" activo por defecto. Nota que enlaza a "Pedí una casa".
- **Ficha:** galería (mosaico en escritorio), badges (Verificado, modo, ref CT-####), título, zona, descripción, amenidades, calendario con ocupados y temporada alta, mapa aproximado, tarjeta del owner, aviso antifraude. Panel sticky con precio "desde", fechas, personas y botón WhatsApp; en móvil barra inferior fija con precio + botón.
- **Sheet de contacto:** avatar owner verificado, burbuja estilo WhatsApp con el mensaje prellenado editable, "Abrir WhatsApp", nota de privacidad.
- **Login:** nombre, teléfono (OTP por WhatsApp), correo. Copy: "Los owners ven tu nombre y tu puntuación como cliente".
- **Pedir casa:** segment Vacaciones / Para vivir, stepper de personas, fechas, zona, chips de imprescindibles, texto libre con detección de requisitos, presupuesto **total** (vacacional) o mensual (largo), vista previa "N casas cumplen hoy" con avatares, checkbox de consentimiento, botón enviar.
- **Mis solicitudes:** criterios, texto, lista de owners que escribieron (casa, verificado, precio ofrecido) con Ver casa / Chat, aviso antifraude, cerrar solicitud.
- **Favoritos** y **Mi cuenta** (puntuación como cliente con etiquetas, casas contactadas, alertas por zona, idioma).

### Owner
- **Panel:** 4 stat tiles (vistas 30 d con sparkline, contactos, casas activas, suscripción), aviso de solicitudes nuevas, aviso de clientes sin valorar, mis casas.
- **Mis casas:** tarjetas con vistas/contactos/precio, estado (Activa / En revisión), nota de pago por casa.
- **Publicar casa (wizard 5 pasos):** Tipo → Ubicación (pin aproximado) → Detalles (amenidades, título, descripción) → Fotos (mín. 5, sin teléfonos) → Precio y WhatsApp (número de negocio, resumen de suscripción) → Enviar a revisión.
- **Calendario y precios:** marcar ocupado por día, precio especial, temporada alta, mínimo de noches.
- **Contactos / Me contactaron:** leads con puntuación previa del cliente, 5 estrellas para valorar, botón WhatsApp.
- **Contactos / Solicitudes:** solicitudes que coinciden con alguna casa del owner (cliente + ★, criterios, presupuesto, texto, "coincide con: {casa}"), "Responder por WhatsApp" (sheet con mensaje prellenado y precio total) o "No me interesa".
- **Cuenta** y **Suscripción** (desglose por casa, total, próximo cobro, anual, pausar).

### Admin
- **Cola de verificación:** tarjetas con owner, cédula/selfie, datos, casa, alertas automáticas (teléfono personal, fotos duplicadas, pocas fotos), Aprobar / Pedir más info / Rechazar. Badge de pendientes y SLA 24 h.
- **Casas** (tabla con estado, vistas, contactos, MRR) y **Owners** (pagos vencidos, churn).

### Landing
Hero con la frase de visión, 3 pasos (Publicás · Te encuentran · Cerrás por WhatsApp), caja de precio con "sin permanencia", tabla comparativa (CasaTica / plataformas con comisión / solo WhatsApp), casas recientes, FAQ.

## Sistema de diseño

### Color
| Token | Light | Dark | Uso |
|---|---|---|---|
| bg | #F7F5EF | #141917 | fondo |
| surface / surface2 | #FFFFFF / #EFEDE6 | #1C2320 / #242D29 | tarjetas / chips |
| fg / muted | #1B2420 / #5F6B64 | #EDEFEA / #A3ADA6 | texto |
| line | #DDD9CE | #2F3934 | bordes |
| jungle / jungleInk / jungleSoft | #1E6B4A / #124634 / #DCEFE4 | #4FB07F / #8FD3B0 / #1E3A2D | primario, badge Verificado |
| sun / sunSoft / sunInk | #E8A33D / #FBEFD9 / #7A4E07 | #F0B24F / #3B2E17 / #F3D6A1 | estrellas, temporada alta, avisos |
| whatsapp | #25D366 (texto #063B1E) | igual | solo CTA de contacto |
| ok / warn / bad | #2E8B57 / #C97A12 / #C2432F | iguales | estados |

### Tipografía
Bricolage Grotesque 700/800 para títulos y cifras; Nunito Sans 400/600/700 para texto. Escala 11 (eyebrow uppercase) · 12 · 13 · 15 base · 17 · 20 · 22 · 24–26 · 32/50 hero. Cifras tabulares. Formato `₡95.000` / `$120`.

### Forma
Radios: tarjetas 14–16, botones 12, inputs 10, chips 999. Espaciado base 4; padding de vista 16 móvil / 32 escritorio. Una sola sombra suave. Breakpoints por contenedor: 640 (2 columnas), 800 (nav superior, ficha en 2 columnas), 1000 (3 columnas + mapa sticky).

### Componentes clave
ListingCard · Badge Verificado · Botón WhatsApp (+ barra inferior en móvil) · Sheet de contacto · Chips de filtro · Segment control · Calendario (L K M J V S D, ocupado rayado, alta en sunSoft) · Stat tile con sparkline · Wizard de 5 pasos · Lead row con estrellas · Request form · Request card (owner) · Reply sheet · Note (aviso) · Admin queue card.

### Copy
Voseo tico, directo. Siempre "orientativo" junto al precio. Frases fijas: "Sin comisiones. Hablás directo con {owner}." · "CasaTica no procesa pagos." · "La dirección exacta la comparte el owner." · "Sin permanencia ni contratos".

### Accesibilidad
Contraste AA en ambos temas, focus ring visible (sun), `aria-label` en botones de icono, `prefers-reduced-motion`, áreas táctiles ≥ 40 px.
