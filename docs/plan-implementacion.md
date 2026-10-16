# Plan de implementación · bnbtico v1

Acordado el 2026-10-15. Este documento manda sobre `roadmap.md` (histórico) en todo lo que se contradigan.

## Qué es la v1

**La v1 es el prototipo** (`design/prototype/casatica-prototipo.html` con sus módulos), tal como se ve hoy en la vista Móvil, con dos excepciones:

- **Sin Veriff.** Nada de identidad en v1: ni sello «Identidad verificada», ni sugerencia al contactar o publicar, ni orden del catálogo por verificadas. Solo «WhatsApp verificado». Veriff completo pasa a la **v1.1**. El prototipo lo conserva porque es la referencia de hacia dónde va.
- **Sin cobro real.** La pantalla de método de pago existe y guarda la tarjeta, pero la pasarela se conecta después del lanzamiento. Con 12 meses gratis, el primer aviso llega a los 9 meses y el primer cargo al año: hay margen.

Todo lo que el prototipo oculta (reclamaciones, titularidad registral, planes por nivel, búsqueda con IA) queda fuera, igual que hoy.

## Cómo se construye

- **Móvil primero.** Web hecha para el teléfono, en **bnbtico.com**, que la gente abre desde el enlace de WhatsApp y puede añadir a su pantalla de inicio (PWA). La vista web existe pero es un derivado. La app en tiendas (envoltorio de esta misma web) viene después del lanzamiento.
- **Las fases son de construcción, no de lanzamiento.** Nadie de fuera ve nada hasta que todo esté. Cada fase se despliega en `pruebas.bnbtico.com` (protegida con contraseña) para probarla con el móvil; `bnbtico.com` muestra «muy pronto» hasta el día del lanzamiento.
- **Cada fase deja un flujo completo que se puede probar de punta a punta**, con sus pruebas automáticas en verde, su entrada en `decisiones.md` si cambió algo, y su commit.
- **El prototipo es la especificación.** Ante duda de comportamiento o copy, se mira el prototipo (vista Móvil) y sus pruebas en `tests/prototype/`. Si el prototipo y un documento se contradicen, manda el prototipo; si dos documentos se contradicen, manda el más reciente.

## Stack

- `apps/web`: **Next.js** (App Router, TypeScript estricto), desplegado en **Vercel**. Fichas públicas con SSR para que el enlace se vea bien en WhatsApp y Google.
- `supabase/`: **Supabase** (Postgres con RLS, Storage para fotos, Edge Functions para lo que no pueda ir en el cliente). Proyecto local para desarrollar, uno de pruebas y uno de producción.
- **Códigos por WhatsApp:** Twilio Verify (canal WhatsApp) para arrancar; cuenta de empresa de Meta tramitándose desde la fase 0 para pasar a la API oficial cuando esté aprobada. Los avisos de suscripción salen por el mismo canal.
- **Pruebas:** Vitest para lógica (filtros, dinero, estados de casa, redacción de mensajes) y Playwright en viewport móvil para los flujos (publicar → aprobar → ver ficha → contactar). Las pruebas del prototipo (`tests/prototype/*.cjs`) siguen siendo la referencia de comportamiento.
- Se retiran del repo `apps/mobile`, `packages/*` y Turborepo: una sola app, pnpm simple.

## Fases

### Fase 0 · Base limpia
**Objetivo:** que exista un sitio donde desplegar y un repo que diga la verdad.
**Incluye:** reescritura de `CLAUDE.md` y alineación de docs (hecho el 2026-10-15); limpieza del monorepo; scaffold de `apps/web` con tokens de `design/tokens/tokens.json`, fuentes y logo; Supabase local con la migración inicial reescrita según el prototipo (casas, fotos, usuarios, consultas, suscripciones, calendario); Vercel conectado al repo; dominio bnbtico.com con «muy pronto» y `pruebas.bnbtico.com` con contraseña; Vitest y Playwright configurados con una prueba de humo cada uno.
**No incluye:** ninguna pantalla del producto.
**Hecho cuando:** `pnpm dev` levanta la web vacía con los tokens aplicados, `pnpm test` pasa, bnbtico.com responde con «muy pronto» y pruebas.bnbtico.com pide contraseña y muestra la misma web.

### Fase 1 · Cuenta con WhatsApp verificado
**Objetivo:** que una persona pueda crear su cuenta con su WhatsApp y volver a entrar.
**Incluye:** registro con nombre y número, código por WhatsApp (Twilio Verify), sesión persistente, Mi cuenta simplificada (como el prototipo: nombre, número, sello «WhatsApp verificado», editar perfil, cerrar sesión), botón «Escribile a bnbtico por WhatsApp» con los dos números por rol, cambio de rol cliente/propietario dentro de la misma cuenta.
**No incluye:** Veriff, recuperación de cuenta más allá de volver a pedir código.
**Hecho cuando:** desde un móvil real se crea una cuenta, llega el código por WhatsApp, se entra, se cierra sesión y se vuelve a entrar; la prueba de Playwright lo hace con un número de prueba de Twilio.
**Primer paso de la fase:** comprobar en una tarde que Twilio Verify por WhatsApp entrega códigos a números de Costa Rica. Si no, se usa SMS para los códigos y WhatsApp solo para el resto.

### Fase 2 · Publicar una casa, aprobarla y verla
**Objetivo:** que un propietario real publique su casa y, una vez aprobada, cualquiera la vea por su enlace.
**Incluye:** formulario de publicación del prototipo (tipo, zona, dirección aproximada, capacidad, características de la lista única, fotos a Storage, precio en colones, mensual importe/consultar), estado «Pendiente de revisión»; admin mínimo (cola, revisión completa, aprobar/pedir cambios/rechazar con motivo); la casa aprobada aparece en el catálogo con su provincia y su `CT-####`; Explorar con los filtros del prototipo (Zona → Para quiénes → Qué necesitan → Precio, plegado en móvil), Limón por defecto, solo provincias con casas; colones con visualización en dólares; ficha pública móvil (precio una vez, calendario de solo lectura, lo que ofrece, mapa aproximado, tarjeta del owner, una sola nota) con enlace `bnbtico.com/casa/CT-xxxx` y vista previa para WhatsApp; Mis casas con tarjeta ligera y detalle de gestión (editar, disponible/no disponible, compartir ficha).
**No incluye:** contacto, calendario editable, suscripción.
**Hecho cuando:** un propietario publica desde el móvil, el admin aprueba, y el enlace de la ficha abre en otro teléfono con la casa completa; el flujo entero está en Playwright.

### Fase 3 · Contacto por WhatsApp
**Objetivo:** que un cliente escriba a un propietario y el propietario lo vea.
**Incluye:** botón «Contactar por WhatsApp» (único, en la barra fija), hoja con llegada/salida/personas y el mensaje redactado solo que se actualiza al cambiar datos, consentimiento, apertura de `wa.me` con el número del owner; registro de la consulta; Mis consultas del owner (abre WhatsApp directo con el cliente); favoritos; contacto directo por casa según el prototipo; cuenta obligatoria para contactar (si no hay sesión, se registra y vuelve a la hoja con lo que había escrito).
**No incluye:** Veriff y su sugerencia, valoraciones de clientes.
**Hecho cuando:** desde un móvil con sesión se abre WhatsApp con el mensaje correcto y el owner ve la consulta en su lista.

### Fase 4 · Calendario del propietario
**Objetivo:** que el owner mantenga disponibilidad y precios y la ficha lo refleje.
**Incluye:** el calendario del prototipo (`docs/design.md`): disponibilidad por día, tarifa habitual/alta/baja con fin de semana opcional, precio especial por día, no disponible con fecha de reapertura; la ficha pública muestra solo los días con precio distinto al base.
**Hecho cuando:** un cambio hecho en el móvil del owner se ve en la ficha pública al instante y las reglas del prototipo (`tests/prototype/calendar.cjs`) pasan portadas a Vitest.

### Fase 5 · Suscripción, estados y avisos
**Objetivo:** que las casas tengan el ciclo de vida del prototipo sin cobrar todavía.
**Incluye:** oferta gratuita de lanzamiento (12 meses / 6 / 3 por tramos de 50 casas), estados pendiente de revisión → pendiente de pago → activa → inactiva, parar y reactivar, el enlace de la ficha deja de funcionar si la suscripción está parada o pendiente de pago, aviso en la app y por WhatsApp a 90/30/7/0 días con el enlace `#pago=`, pantalla «Promoción y suscripción» en Mi cuenta, «Añadir método de pago» solo en ventana de aviso y sin método; guardar la tarjeta en la pasarela elegida en modo de pruebas (tokenización), sin cargar.
**No incluye:** cargos reales, facturas.
**Hecho cuando:** con el reloj adelantado en pruebas, una casa recorre todos los estados, llegan los avisos por WhatsApp a un número de prueba y el enlace bloqueado muestra «Este enlace ya no está activo».

### Fase 6 · Búsqueda asistida («Buscan casa»)
**Objetivo:** lo que queda del prototipo.
**Incluye:** el cliente publica lo que busca (zona, fechas, personas, imprescindibles, presupuesto), los propietarios compatibles lo ven en su panel y le escriben por WhatsApp con consentimiento del cliente; caducidad y límites del prototipo.
**Hecho cuando:** un «Buscan casa» creado desde un móvil aparece al owner de una casa compatible y no al de una incompatible.

### Fase 7 · Lanzamiento
**Objetivo:** abrir bnbtico.com.
**Incluye:** borrar datos de prueba, cargar las primeras casas reales con sus propietarios (ellos publican; nosotros acompañamos), privacidad y condiciones de uso publicadas, números de WhatsApp de bnbtico reales, Meta aprobada o Twilio en producción, copias de seguridad de la base, un panel mínimo de salud (errores y registros), landing abierta.
**Hecho cuando:** un cliente que no conocemos escribe a un owner que no conocemos.

## Después del lanzamiento (en este orden salvo que cambie)

1. **v1.1 · Veriff opcional**: sello «Identidad verificada», sugerencia saltable al contactar y publicar, orden del catálogo. Requiere contrato con Veriff y la revisión jurídica pendiente (`privacidad-verificaciones.md`).
2. **Cobro real**: pasarela local (Tilopay / ONVO Pay / Greenpay, por decidir con sus condiciones) con tarjeta recurrente y SINPE Móvil; ₡9.900 al mes por casa. Requiere empresa y cuenta bancaria en Costa Rica.
3. **App en tiendas**: envoltorio de la web (Capacitor) con compartir nativo y apertura nativa de WhatsApp, publicado en Google Play y App Store.

## En paralelo desde ya (no es código, y tarda más que el código)

- Empresa y cuenta bancaria en Costa Rica (pasarela, Meta, facturación).
- Cuenta de empresa de Meta para WhatsApp (verificación del negocio y plantillas); mientras, Twilio.
- Textos legales: privacidad y condiciones de uso, antes de la fase 7.
- Números de WhatsApp de bnbtico para clientes y para propietarios.

## Cómo trabajamos cada fase

1. Antes de tocar código, se repasa la pantalla en el prototipo (vista Móvil) y sus pruebas.
2. Primero la prueba (Vitest o Playwright), luego el código.
3. Se despliega a `pruebas.bnbtico.com` y se prueba con el móvil de verdad.
4. Decisiones nuevas a `docs/decisiones.md`; cambios de alcance a este plan.
5. Commit por fase o por paso completo, en español e imperativo.
