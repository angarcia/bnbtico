# CasaTica

Calendario, último ajuste 2026-10-12: secciones Tarifa habitual → Alta → Baja. Cada sección tiene precio por noche y precio de fin de semana opcional (viernes/sábado); vacío usa su precio por noche todos los días, sin herencia entre tarifas. Sin porcentajes ni checks. Especial siempre final. Alta/baja con inicio/fin obligatorios si se define cualquiera de sus precios. Ver `docs/design.md`.

Corrección vigente de WhatsApp (2026-10-12): cada casa guarda su propio número verificado. Al crear se copia el del usuario en campo editable; mismo número verificado no repite código, otro exige verificación. En Editar se mantiene el anterior hasta verificar el nuevo; no cambia otras casas. Sustituye todas las notas históricas de número único por usuario para anuncios. Cliente conserva teléfono de cuenta, identidad sigue ligada al usuario. Demo `listing-whatsapp.js` (sin envíos reales), prueba `tests/prototype/listing-whatsapp.cjs`, reglas `docs/publicacion.md` y `docs/contacto-whatsapp.md`.

Última actualización de calendario (2026-10-12): tarjeta con Calendario, Editar, Disponible/No disponible y Contacto directo, botones verde/rojo y verde/ámbar según estado. Activar/Desactivar se mueve a Editar. No disponible mantiene anuncio visible y cierra calendario completo sin alterar días/tarifas; bloquea nuevas consultas, conserva previas. Fecha opcional de reapertura a medianoche Costa Rica; sin fecha, manual. Reapertura no reactiva anuncio oculto. `calendar.js`: base orientativa compartida; alta/baja opcionales compartidas por fechas asignadas; especial independiente por día, asignable a varios días a la vez. Calendario de selección primero: tocar días abre panel inferior fijo con disponibilidad, precio actual editable (o Varios precios), Restaurar tarifa y Guardar cambios. Solo modifica lo elegido, permite disponibilidad y precio juntos atómicamente; precio manual ★ solo si difiere de la tarifa; restaurar previsualiza importe editable o Varios precios, y al guardar elimina excepción según fechas vigentes y fin de semana. Alta y baja con períodos opcionales inclusivos conservando especiales; Guardar tarifas colapsa el panel. Importe de fin de semana opcional por tarifa habitual/alta/baja, nunca especial, solo viernes/sábado; vacío usa el precio por noche. Sin porcentajes ni checks. Verde/rojo para disponibilidad, saturación alta intensa/baja suave (sin patrones), estrella especial. Diciembre 2026 fijo, estado por casa solo en memoria; programación mientras página abierta, backend pendiente. Especificación vigente `docs/design.md`, prueba `tests/prototype/calendar.cjs`. Esto sustituye notas antiguas de tarifas por selección y Desactivar en tarjeta.

## Decisión vigente · contacto por casa · 2026-10-12

Mis casas: Calendario, Editar, Activar/Desactivar y **Contacto directo: Sí/No**, No por defecto. La preferencia es por casa, NO por cuenta; el teléfono sigue siendo por usuario. Sí equivale al consentimiento previo del propietario y evita aceptación individual; el cliente debe seguir verificado (identidad + WhatsApp) y consentir compartir contacto. No conserva el flujo de solicitud/aceptación descrito más abajo. Solicitudes masivas no cambian; contactos ya aceptados no se revocan. Sin notificaciones ni botones de aceptación integrados en WhatsApp Business. Demo en `house-controls.js`, prueba `tests/prototype/house-controls.cjs`, especificación `docs/contacto-whatsapp.md`. Pausa local, sin facturación real; edición como borrador para revisión, sin sustitución automática en catálogo. Recargar borra cambios.

Catálogo de casas en alquiler en Costa Rica (vacacional y largo plazo). Los owners publican; los clientes los contactan **por WhatsApp directo, tras solicitar y aceptar el contacto**. La app no gestiona reservas ni pagos entre partes; cobra una suscripción por casa activa al owner, sin comisiones.

## Documentación (leer antes de tocar código)
- `docs/vision.md` — problema, usuarios, principios, qué es éxito
- `docs/business-model.md` — quién paga, precio, cómo se cobra, riesgos
- `docs/design.md` — pantallas, flujos, sistema de diseño, copy
- `docs/architecture.md` — stack, modelo de datos, reglas de negocio en backend
- `docs/roadmap.md` — v1 como checklist, v2, quizás nunca, pendientes
- `docs/pitch.md` — pitch a owners, objeciones y respuestas
- `docs/decisiones.md` — por qué se decidió cada cosa
- `docs/resumen-sesion-2026-10-02.md` — decisiones finales, alternativas descartadas y estado real
- `docs/identidad-y-seguridad.md` — identidad de ambos roles con Veriff, titularidad opcional y seguridad propuesta
- `docs/guia-verificacion-finca.md` — guía para owners: segunda verificación opcional por finca
- `docs/privacidad-verificaciones.md` — acceso a datos de Veriff, requisitos de privacidad y revisión jurídica pendiente
- `docs/reclamaciones.md` — reportes sin gestión de dinero, usuarios administrables, WhatsApp de soporte y límites de la demo

Referencias: prototipo navegable en `design/prototype/casatica-prototipo.html` (abrir en navegador; no es código de producción; también publicado como artifact "CasaTica Prototipo" en claude.ai), tokens en `design/tokens/tokens.json`, esquema en `supabase/migrations/0001_init.sql`, seed en `supabase/seed/seed.sql`.

## Estado actual
Fase de definición e iteración (2026-10-02): no hay código de aplicación todavía. `apps/` y `packages/` contienen solo READMEs. El siguiente paso es el scaffold (ver `docs/roadmap.md › v1 › Base`).

## Contexto de trabajo actualizado · 2026-10-02
- Repositorio real: `/Users/anagarciasaiz/Documents/GitHub/CasaTica`, remoto esperado `https://github.com/angarcia/CasaTica`. No confundir con el repo vacío creado inicialmente bajo `Documents/Codex/2026-10-02/me-x20/CasaTica`.
- `AGENTS.md` es un enlace simbólico a este archivo (`CLAUDE.md`); mantener una única fuente de instrucciones y preservar el enlace.
- Prioridad actual de la usuaria: iterar sobre el prototipo existente antes de arrancar el scaffold. No implementar el roadmap ni renombrar la marca automáticamente.
- Enfoque expresado por la usuaria: que los propietarios hagan comunidad local. Aún falta definir las interacciones entre propietarios; recomendaciones de huéspedes, consejos y proveedores son ideas, no requisitos aprobados. El prototipo actual conecta propietarios con clientes, pero no implementa esa comunidad entre propietarios.
- Dirección de marca: bnbtico, rana sonriente sobre hoja en rojo coral. Se exploraron Nidaluma, Ticosticos y Localtico; son alternativas históricas. Dominio/marca legal pendientes de confirmar; no renombrar archivos automáticamente.
- La usuaria indicó que `casalo.com` no está disponible y que comprobaría dominios en GoDaddy. No presentar consultas antiguas ni propuestas creativas como disponibilidad actual confirmada. El estado de `ticosticos.com` no está confirmado de forma inequívoca.

### Ejecutar y revisar el prototipo
- Archivo único: `design/prototype/casatica-prototipo.html`; HTML/CSS/JS con datos de ejemplo, sin instalación ni build. No existe aún un `npm run dev` de la aplicación.
- Vista local HTTP, solo loopback y sirviendo únicamente la carpeta del prototipo:
  `python3 -m http.server 8765 --bind 127.0.0.1 --directory design/prototype`
- Abrir `http://127.0.0.1:8765/casatica-prototipo.html`. Si el puerto está ocupado, comprobar qué sirve antes de reutilizarlo; no terminar procesos ajenos.
- Selectores superiores: Cliente / Owner / Admin / Landing y Móvil / Web. Inicio por defecto: Cliente, Móvil. Estado solo en memoria; recargar restablece la demo.
- Puntos de entrada en el HTML: `HOUSES` (datos), `S` (estado), `home`, `detail`, `request`, `oDash`, `oRequests`, `landing`, `SCREENS`, `render` y el manejador de clics por atributos `data-*`.
- Filtros, favoritos y navegación son interactivos. Fotos son degradados; mapa, subida de archivos, autenticación y pagos son simulaciones. Los botones de contacto muestran mensajes de demo: no asumir que abren WhatsApp realmente. Ver `docs/design.md` para el alcance detallado.
- Estética actual (2026-10-05): bnbtico, logo original rana sobre hoja en `design/prototype/assets/bnbtico-original.png` (panel inferior encuadrado con CSS), coral `#FF385C`, acciones `#D92349`, papel cálido `#F7F5EF`. Verde para WhatsApp/estados positivos y mostaza para avisos/estrellas; Bricolage Grotesque y Nunito Sans (fallback local). No regenerar el logo elegido: el original ya está guardado en el repo.
- Para cada iteración: revisar el estado de Git, leer los documentos relevantes antes de modificar código, preservar cambios existentes y verificar los flujos afectados en móvil y web. No dar por verificado el renderizado por leer solo el HTML.

## Principios que no se negocian
1. WhatsApp directo, sin chat interno ni números intermediarios. Cliente → Solicitar contacto (consiente compartir teléfono); owner → Contactar por WhatsApp (acepta) o No me interesa. Demo en `relay.js`, sin envíos ni números reales. No hay contacto propietario → propietario.
2. No prometer números ocultos en WhatsApp. Recomendar número de negocio y advertir antes de salir. En Pedir casa se exige consentimiento explícito para que un máximo de 10 owners verificados compatibles accedan al contacto y respondan por WhatsApp. Especificación vigente: `docs/contacto-whatsapp.md`.
3. Precios siempre orientativos; nunca "total a pagar" ni pagos entre partes.
4. Los owners valoran a los clientes; no hay reseñas de casas.
5. Identidad obligatoria para clientes y propietarios (documento + rostro + liveness): antes de contactar/enviar solicitudes o publicar/responder. Registro y borradores sin esa barrera inicial. Veriff elegido como dirección de producto, no contratado/integrado; Essential candidato de plan. Segunda comprobación opcional de titularidad registral por casa/finca, sin verificar autorización de alquiler. No solicitarla no bloquea publicación. Ver `docs/identidad-y-seguridad.md` y `docs/privacidad-verificaciones.md`; revisión jurídica pendiente antes de recoger datos reales.
6. UI en español de Costa Rica con voseo. Colones por defecto.
7. Una solicitud de contacto activa por cliente y casa durante 7 días desde su envío (configurable). Reintentar abre la existente sin otro aviso. «No me interesa» no reinicia el plazo ni bloquea futuras solicitudes. Caducidad no elimina historial ni cierra conversaciones. Demo y especificación: `relay.js` y `docs/contacto-whatsapp.md`. El límite no restringe mensajes fuera de bnbtico.

## Convenciones de código
- Monorepo pnpm + Turborepo: `apps/web` (Next.js), `apps/mobile` (Expo), `packages/ui|api-client|config`, `supabase/`.
- TypeScript estricto. Entidades en inglés (`Listing`, `Lead`, `Request`); copy en español.
- Dinero como entero + `currency` (`CRC` | `USD`); formato `₡95.000` / `$120`; cifras tabulares.
- Amenidades como enum: `pool, pets, ev_charger, ac, wifi, beachfront, bbq, parking, furnished, garage, accessible, no_deposit`.
- IDs públicos de casa `CT-####`.
- Tests: Vitest (matching, dinero, extracción de requisitos); Playwright (buscar → ficha → contactar).
- Commits en español, imperativo. Si cambias una decisión, anótala en `docs/decisiones.md`.

## Orden sugerido

Decisión 2026-10-12: se descartan por ahora las notificaciones automáticas y el botón de aceptar dentro de WhatsApp Business. Solicitar/aceptar/descartar en bnbtico y después WhatsApp directo; no implementar las plantillas o redirecciones de aceptación exploradas en el chat. Se conserva OTP de WhatsApp + Veriff y el soporte manual. No había integración real que retirar; no prometer esta alternativa para v2.

Aclaración 2026-10-12: el único estado público **«Identidad verificada» engloba Veriff + WhatsApp verificados**. Separar pasos pendientes solo para informar al usuario y estados técnicos para permisos/soporte, no en dos sellos públicos. No publicar casas ni habilitar contacto sin ambas comprobaciones. Requisito documentado, todavía no aplicado íntegramente a la demo.

Decisión 2026-10-12: **Veriff + WhatsApp por OTP obligatorios para propietarios y clientes**, antes de contactar/enviar solicitudes/publicar/responder; registro/login y borradores sin verificaciones iniciales. WhatsApp por usuario, no por casa; acceso al número no equivale a identidad ni consentimiento para compartirlo. Fuente: `docs/identidad-y-seguridad.md`. Solo documentado: pantallas OTP e integración Meta/Veriff pendientes. Propiedad registral sigue fuera de v1. La API para OTP no supone chat interno ni intermediación entre usuarios.

Iteración 2026-10-12: `admin-users.js` añade Admin → Usuarios (clientes/propietarios), búsqueda, ficha, desactivar/reactivar con motivo y confirmación. Bloqueo de catálogo/contacto/publicación solo en memoria; conserva ayuda/historial/reportes. WhatsApp de soporte bnbtico separado, número ficticio, vistas previas y notas internas; no abre ni envía WhatsApp. `claims.js` ya NO gestiona importes/devoluciones/comprobantes ni confirmaciones de dinero: solo reportes, respuestas, decisiones y cierre de revisión. Pedidos económicos solo texto libre y acuerdo fuera de bnbtico. Prevalece sobre notas históricas de devoluciones. Pruebas: `admin-users.cjs` y `claims.cjs`.

Iteración 2026-10-12: `admin-review.js` añade Admin → Anuncios → Revisar anuncio completo (fotos de ejemplo ampliables, descripción y todos los campos). Aprobar requiere abrir la revisión, identidad aprobada y cinco fotos; cambios/rechazo requieren motivo. Envíos de `publication.js` se incorporan una vez a la cola y reflejan su estado en Mis casas, sin publicar realmente. Motivo para el propietario y corrección/reenvío pendientes. Prueba: `node tests/prototype/admin-review.cjs`.

Decisión IA · 2026-10-12: búsqueda asistida pendiente de evaluar, no aprobada para incorporación, fuera de v1 y sin compromiso para v2. No mostrar tarjeta, pestaña ni ruta de IA. Mantener Pedir casa sin IA. `assisted-search.js` sigue cargado por las funciones compartidas de matching/formulario; el simulador histórico se conserva oculto. Ver `docs/busqueda-asistida.md`.

Vista v1 · 2026-10-12: no cargar `property.js` ni mostrar Verificar propiedad/cola registral, planes por nivel o descuentos por volumen. Código y documentos históricos conservados para v2. Admin muestra moderación de anuncios y estado de identidad simulado de Veriff, sin documentos ni aprobación de identidad manual. Prueba de entrada: `tests/prototype/v1-scope.cjs`. No reintroducir funciones futuras visibles sin petición expresa.

Iteración 2026-10-12: `design/prototype/publication.js` sustituye el wizard por publicación vacacional, tipos Casa/Apartamento/Habitación, Acepta largo plazo Sí/No sin preselección, mensual importe/consultar, habitaciones/baños obligatorios y baño privado por defecto. WhatsApp único por usuario en Mi cuenta. Ver `docs/publicacion.md` y `tests/prototype/publication.cjs`. Borrador/revisión en memoria, fotos/identidad simuladas. Catálogo y búsquedas aún conservan modalidades antiguas; adaptación anotada, no implementada en esta iteración.

Decisión 2026-10-12: **verificar titularidad de la casa queda fuera de v1**, aunque las secciones históricas describan la segunda comprobación. Mantener identidad obligatoria de clientes y owners. No incluir finca, certificado literal, cola registral ni sello de propiedad en v1. El recorrido de `property.js` se conserva como exploración futura; ocultarlo en la experiencia v1 del prototipo está pendiente. Fuente vigente: `docs/identidad-y-seguridad.md` y `docs/roadmap.md`.

Iteración 2026-10-07: dos entradas en Explorar, **Pedir casa** (formulario gratuito con filtros obligatorios) y **Búsqueda asistida** (simulador guiado, no IA real). Extensión `design/prototype/assisted-search.js`, especificación `docs/busqueda-asistida.md`, prueba `tests/prototype/assisted-search.cjs`. No consume créditos ni envía contactos automáticamente. WhatsApp directo se conserva. Las notas libres del formulario ya no marcan imprescindibles por palabras sueltas.
Iteración de titularidad 2026-10-05: `design/prototype/property.js` añade **Owner → Mis casas → Verificar propiedad**, guía de 3 pasos o atajo al código, aviso/consentimiento y revisión simulada por casa. Solo código ficticio; no datos reales, aprobación ni conexión con admin. Progreso en memoria, recargar lo borra. Prueba: `node tests/prototype/property-verification.cjs`. Los dos sellos y sus textos aprobados están en `docs/identidad-y-seguridad.md`; su despliegue público sigue pendiente.

Iteración 2026-10-05: claims.js añade reclamaciones por rol y confirmación de recepción de devolución. Medidas solo registradas como decisiones simuladas; no bloquean cuentas en la demo. No se sube la cuota por denuncias. No hay transferencias reales ni garantía de reembolso.

Actualización de producto: marca `bnbtico`, logo de rana sobre hoja monocromo rojo coral (no la rana saltando), aplicado al prototipo el 2026-10-05. No cambiar assets como parte de una tarea de mensajería. Nombre del repo, archivo HTML e IDs CT se conservan.

Última iteración 2026-10-07: vuelta al flujo sencillo de WhatsApp directo. Sin bandeja de mensajes ni conversación interna. Mi cuenta → Mis contactos conserva solicitudes; Owner → Contactos permite contactar o descartar. Consentimiento del cliente al solicitar y del owner al contactar, sin selector de canal ni pantalla de negociación. Caducidad de 7 días y deduplicación conservadas. Demo en memoria sin API ni aperturas reales. Copia recuperable de la versión con chat en `backups/bnbtico-antes-volver-whatsapp-2026-10-07.tar.gz`.

Se descartan de nuevo para esta versión los puentes, números por cliente/owner y almacenamiento de conversaciones. `docs/chat-privado.md` conserva únicamente la alternativa histórica.

La política nueva de identidad aún no está reflejada en todas las pantallas ni migraciones. Las passkeys y demás medidas de protección de cuentas son propuestas pendientes de aprobación/diseño.

Scaffold + tokens + Supabase local → catálogo web + contacto + identidad y auth → panel owner + admin → solicitudes y matching → suscripción → móvil.
