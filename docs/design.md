# Diseño

Referencia viva: `design/prototype/casatica-prototipo.html` (abrir en el navegador; selector Cliente / Owner / Admin / Landing y Móvil / Web). También publicado como artifact privado en claude.ai (gallery → "CasaTica Prototipo"). Tokens en `design/tokens/tokens.json`.

## Cómo usar el prototipo
- Es un único HTML sin dependencias: datos de ejemplo en JS, pantallas renderizadas por función, navegación por `data-go`. Los selectores de arriba cambian rol y dispositivo; la misma pantalla se adapta con container queries (390 px en marco de teléfono, ancho completo en web).
- Lo que **sí** funciona: cambiar modo, filtros reales (provincia, personas, habitaciones, piscina, mascotas, cargador eléctrico, A/C, wifi), favoritos, abrir ficha, flujo de contacto (login → sheet → toast), pedir casa con detección de requisitos, mis solicitudes, wizard de 5 pasos, calendario (tocar días), valorar clientes, solicitudes del owner con sheet de respuesta, aprobar/rechazar en admin.
- Lo que **no**: buscador de texto, rango de precio, mapa real, subida de fotos, pagos. Son decorativos.
- Las "fotos" son degradados con etiqueta; en producción van imágenes reales 16:11 en tarjeta y 4:3 en galería.

## Flujos detallados

### Contactar por WhatsApp (cliente)
1. En la ficha elige llegada, salida y personas (vacacional) o "desde cuándo" (largo plazo) y toca **Contactar por WhatsApp**.
2. Sin sesión → pantalla de registro (nombre, teléfono, OTP por WhatsApp, correo opcional). Al verificar vuelve a la ficha con el sheet abierto.
3. Sheet "Se abrirá WhatsApp": avatar y nombre del owner con badge Verificado, burbuja con el mensaje prellenado, textarea editable, botón verde **Abrir WhatsApp**, nota "Registramos este contacto para que {owner} pueda valorarte".
4. Se crea el lead y se abre `wa.me`. Toast: "WhatsApp abierto · contacto registrado".

Mensaje prellenado (vacacional):
> Hola {nombreOwner}, vi tu casa «{título}» en CasaTica (ref {CT-####}). ¿Está disponible del {llegada} al {salida} para {personas} personas? Gracias 🙂

Largo plazo:
> Hola {nombreOwner}, vi tu {tipo} «{título}» en CasaTica (ref {CT-####}). ¿Sigue disponible a partir de {mes}? Somos {personas} personas.

### Pedir casa (cliente) → responder (owner)
1. Cliente: elige Vacaciones / Para vivir, personas (stepper), fechas o "desde cuándo", zona, chips de imprescindibles, texto libre, presupuesto **total** (vacacional) o mensual (largo plazo).
2. Al salir del texto libre, la app detecta requisitos ("piscina", "cargador", "perro", "somos 3") y marca chips; toast "Detectamos requisitos en tu texto". El cliente puede corregir.
3. Vista previa: "N casas cumplen hoy tus requisitos · sus owners recibirán tu solicitud" con avatares.
4. Checkbox de consentimiento: "Acepto que hasta {min(10, N)} owners verificados que cumplan mis requisitos me escriban por WhatsApp. Puedo cerrar la solicitud cuando quiera."
5. Enviar (requiere cuenta). Toast "Enviada a N owners". → Mis solicitudes.
6. Owner: recibe notificación; en Contactos → Solicitudes ve la tarjeta (cliente + ★, modo · personas · fechas · zona, chips, badge de presupuesto, texto, "Coincide con: {casa}"). Toca **Responder por WhatsApp**.
7. Sheet: elige casa, ve el mensaje prellenado editable, **Abrir WhatsApp**. Se marca `replied`. Alternativa: "No me interesa".
8. Cliente, en Mis solicitudes: lista de owners que escribieron (casa, verificado, precio ofrecido) con Ver casa / Chat; aviso "revisá que el chat venga de un owner de esta lista"; Cerrar solicitud.

Mensaje prellenado del owner:
> Hola {nombreCliente}, soy {owner} de CasaTica. Vi que buscan casa para {personas} personas ({fechas}) con {requisitos}. Mi casa «{título}» en {zona} cumple todo: {enlace ficha}. Les puedo dejar las {n} noches en {precio total} en total. ¿Les sirve?

### Publicar casa (owner)
Wizard de 5 pasos con barra de progreso: **Tipo** (vacacional/largo + casa/apto/cabina/quinta) → **Ubicación** (provincia, cantón, zona, pin aproximado; aviso de radio ~500 m) → **Detalles** (personas, habitaciones, baños, chips de amenidades con nota "marcá bien las amenidades: así te llegan solicitudes", título con hint "evitá MAYÚSCULAS", descripción) → **Fotos** (mín. 5, horizontales, sin marcas de agua ni teléfonos; aviso de que se rechazan) → **Precio y WhatsApp** (precio por noche/mes, moneda ₡/$, número de WhatsApp de negocio con aviso de no usar personal, resumen "₡9.900/mes, se cobra solo al aprobarse") → **Enviar a revisión**. Toast "te avisamos en menos de 24 h"; la casa aparece como "En revisión".

### Verificación (admin)
Tarjeta por owner pendiente: cédula (frente) y selfie con cédula, número de cédula, WhatsApp (marcado si parece personal), casa enviada, alertas automáticas en rojo ("Teléfono parece personal", "Fachada coincide con anuncio en otra plataforma", "Solo 2 fotos") o "Sin alertas automáticas". Acciones: Aprobar (publica), Pedir más info, Rechazar. Badge con pendientes y SLA 24 h.

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
