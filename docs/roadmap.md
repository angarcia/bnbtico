# Roadmap

## Hecho (sesión 2026-10-02, Cowork)
- [x] Cuestionario de requisitos y alcance v1 (ver `vision.md`)
- [x] Prototipo navegable con 21 pantallas (cliente, owner, admin, landing; móvil y web), publicado como artifact y guardado en `design/prototype/`
- [x] Sistema de diseño y tokens
- [x] Modelo de datos y migración inicial con función de matching
- [x] Decisiones: pago por casa, sin reseñas, owners valoran clientes, WhatsApp en ambas direcciones, presupuestos en total, copy "sin permanencia"
- [x] Investigación rápida de nombre (sin conflictos evidentes; falta dominio y marca)

## v1 — lanzamiento

### Base
- [ ] Scaffold monorepo (pnpm, Turborepo, Next.js, Expo, packages/ui con tokens)
- [ ] Supabase: migración inicial, seed, RLS, Storage (público/privado)
- [ ] Auth OTP por teléfono (WhatsApp/SMS) y roles

### Cliente
- [ ] Home: modo vacacional / largo plazo, buscador, chips de provincia, lista de tarjetas
- [ ] Mapa con pins de precio (web sticky; móvil toggle)
- [ ] Filtros: personas, habitaciones, precio, amenidades (incl. cargador eléctrico), solo verificados
- [ ] Ficha: galería, amenidades, calendario, mapa aproximado, owner, aviso antifraude
- [ ] Botón "Contactar por WhatsApp" → login si hace falta → sheet con mensaje prellenado → lead → `wa.me`
- [ ] Favoritos
- [ ] Mi cuenta con puntuación como cliente
- [ ] Alertas simples de nuevas casas (provincia + modo)
- [ ] Pedir casa: formulario + detección de requisitos en texto + consentimiento + vista previa de coincidencias
- [ ] Mis solicitudes: owners que escribieron, cerrar solicitud
- [ ] Reportar anuncio

### Owner
- [ ] Registro owner + subida de cédula y selfie → estado "en revisión"
- [ ] Wizard de publicación (5 pasos) con validación de fotos (sin teléfonos/enlaces)
- [ ] Panel con vistas, contactos, casas activas, suscripción
- [ ] Calendario: ocupado, precio especial, temporada alta, mínimo de noches
- [ ] Contactos: leads, valorar cliente (estrellas + etiquetas), abrir WhatsApp
- [ ] Solicitudes: coincidencias, responder por WhatsApp con mensaje prellenado y precio total, descartar
- [ ] Notificaciones: casa aprobada, nuevo contacto, nueva solicitud
- [ ] Suscripción por casa: checkout web (tarjeta recurrente + SINPE Móvil), recordatorios, gracia, pausar/cancelar

### Admin
- [ ] Cola de verificación con alertas automáticas (teléfono personal, pocas fotos, duplicados)
- [ ] Aprobar / pedir más info / rechazar con motivo
- [ ] Tabla de casas y de owners (pagos vencidos)
- [ ] Reportes de clientes

### Landing y lanzamiento
- [ ] Landing pública (hero, 3 pasos, precio, comparativa, FAQ)
- [ ] SEO: SSR de fichas, sitemap, Open Graph
- [ ] Términos, privacidad (Ley 8968), política antifraude
- [ ] Onboarding de los primeros 20–30 owners a mano (Guanacaste, Jacó, GAM)

## v2
- [ ] Planes por nivel (destacados, más fotos, estadísticas)
- [ ] Descuento por volumen
- [ ] Inglés para turistas y precios en dólares por defecto en zonas turísticas
- [ ] Total orientativo en la ficha al elegir fechas (noches × precio)
- [ ] Extracción de requisitos del texto con LLM
- [ ] Re-matching diario de solicitudes abiertas con casas nuevas
- [ ] Detección automática de fraude en fotos (búsqueda inversa, teléfonos en imagen)
- [ ] Importar calendario externo (iCal) para marcar ocupados

## Quizás nunca
- Reservas y pagos dentro de la app (rompe el modelo sin comisiones)
- Reseñas de casas (no verificables sin reserva en la app)
- Chat interno (la gente ya está en WhatsApp)
- Seguro o garantía de depósito

## Pendientes de decisión
- [ ] **Nombre definitivo** (CasaTica / Pura Casa): dominio `.com`/`.cr`/`.co.cr`, redes, marca en el Registro Nacional
- [ ] Precio por casa (ref. ₡9.900) y duración del trial
- [ ] Pasarela: Tilopay vs ONVO Pay vs Greenpay
- [ ] Confirmar reglas de App Store / Play sobre cobrar la suscripción fuera de compras in-app
- [ ] Librería UI compartida: Tamagui vs NativeWind
- [ ] Proveedor de OTP (Twilio, Meta Cloud API, local)
- [ ] Zonas para solicitudes: lista cerrada de destinos vs provincia/cantón vs radio
- [ ] Política de retención y acceso a cédulas/selfies
