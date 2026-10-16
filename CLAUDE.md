# bnbtico (repo CasaTica)

Catálogo de casas en alquiler en Costa Rica, con foco inicial en el Caribe (Limón). Los propietarios publican; los clientes les escriben **por WhatsApp directo**. bnbtico no gestiona reservas ni pagos entre partes: cobra una suscripción por casa activa al propietario, sin comisiones. `AGENTS.md` es un enlace simbólico a este archivo: una sola fuente de instrucciones.

## Lo primero

1. **El prototipo es la especificación de la v1.** `design/prototype/casatica-prototipo.html` + módulos JS, vista **Móvil**. Si el prototipo y un documento se contradicen, manda el prototipo; si dos documentos se contradicen, manda el más reciente. Las pruebas en `tests/prototype/*.cjs` describen el comportamiento esperado (`node tests/prototype/<x>.cjs`; todas deben pasar).
2. **Móvil primero.** Web para el teléfono en bnbtico.com (PWA); la vista web es un derivado. App en tiendas después del lanzamiento, envolviendo la misma web.
3. **El plan de construcción está en `docs/plan-implementacion.md`.** Fases 0–7, qué entra en v1 y qué no. No lanzar a trozos: todo se prueba en `pruebas.bnbtico.com` y bnbtico.com se abre cuando la v1 esté completa.
4. **Las decisiones y su porqué están en `docs/decisiones.md`** (la más reciente arriba). Si cambias una decisión, anótala ahí el mismo día.
5. Trabajamos en español. UI en español de Costa Rica con voseo.

## Reglas de producto vigentes (2026-10-15)

- **WhatsApp es el único canal.** Cliente → propietario: botón «Contactar por WhatsApp» que abre `wa.me` con un mensaje redactado (casa, fechas, personas). Propietario → cliente: desde Mis consultas, directo a WhatsApp. Usuarios → bnbtico: dos números de WhatsApp, uno para clientes y otro para propietarios. Sin chat interno, sin números intermediarios, sin flujo de reclamaciones en la app.
- **WhatsApp verificado por código es lo único obligatorio** para publicar o contactar. Explorar y guardar favoritos no requiere cuenta.
- **Veriff (identidad) es opcional y queda fuera de la v1** (va en v1.1). En v1 no se muestra nada de identidad.
- **Estados de una casa:** Pendiente de revisión → Pendiente de pago → Activa → Inactiva (si el propietario para la suscripción). Las casas con oferta gratuita saltan «Pendiente de pago» hasta que termina la oferta. Avisos por WhatsApp y en la app a 90/30/7/0 días del fin de la oferta, con enlace `#pago=CT-xxxx` a la pantalla de método de pago. El enlace de una ficha parada o pendiente de pago deja de funcionar. «Añadir método de pago» solo aparece mientras no hay método y toca avisar.
- **Precios en colones**, siempre orientativos; el cliente puede verlos convertidos a dólares (solo visualización). Nunca «total a pagar».
- **Caribe por defecto:** Explorar arranca en Limón; en los filtros solo aparecen provincias con casas; una casa aprobada de otra zona añade su provincia.
- **Características (una sola lista, igual al publicar y al filtrar):** Piscina, Mascotas, Wifi, Aire acondicionado, Parqueo, Cargador eléctrico, Niños pequeños gratis, Frente al mar, Rancho/BBQ.
- «Mensual» en vez de «Largo plazo» en toda la UI (la landing no se toca).
- Los propietarios podrán valorar a los clientes; no hay reseñas de casas.
- Promoción de lanzamiento: primeras 50 casas 12 meses gratis, siguientes 50 seis meses, siguientes 100 tres meses; después ₡9.900 al mes por casa, sin permanencia.

## Convenciones de código (aplicación real, desde la fase 0)

- `apps/web`: Next.js (App Router) + TypeScript estricto, en Vercel. `supabase/`: Postgres con RLS, Storage, Edge Functions. Sin `apps/mobile`, sin `packages/*`, sin Turborepo.
- Entidades en inglés (`Listing`, `Inquiry`, `Subscription`); copy en español.
- Dinero como entero en colones + `currency`; formato `₡95 000`; cifras tabulares. Dólares solo al mostrar.
- IDs públicos de casa `CT-####`. Enlaces `bnbtico.com/casa/CT-####`.
- Pruebas: Vitest (lógica) y Playwright en viewport móvil (flujos). Primero la prueba, luego el código.
- Commits en español, imperativo. Un commit por paso completo con pruebas en verde.

## Convenciones del prototipo (mientras siga siendo la referencia)

- Servirlo con `python3 -m http.server 8765 --bind 127.0.0.1 --directory design/prototype` y abrir `http://127.0.0.1:8765/casatica-prototipo.html`. Estado solo en memoria salvo lo guardado en `localStorage` (cuenta, estado de casas).
- Cada cambio va en un módulo nuevo `design/prototype/<tema>.js` que envuelve `SCREENS[...]` o la función global que toque (`{const previous=X; X=(...)=>...}`) y termina con `render();`. Los cambios de hoy que afectan solo a móvil comprueban `S.dev==='phone'`. Se añade el `<script>` al final del HTML y una prueba `tests/prototype/<tema>.cjs`.
- No regenerar el logo (`design/prototype/assets/bnbtico-original.png`); tokens en `design/tokens/tokens.json`.
- No dar por verificado un cambio de UI por leer el HTML: abrirlo (Playwright o navegador) en vista Móvil.

## Documentación

- `docs/plan-implementacion.md` — fases de construcción, alcance de v1, stack. **Manda sobre `roadmap.md`.**
- `docs/decisiones.md` — registro de decisiones con fecha, la más reciente arriba.
- `docs/design.md` — pantallas, flujos, calendario, sistema de diseño.
- `docs/configuracion-supabase.md` — cómo crear el proyecto de Supabase, Twilio Verify y las variables de Vercel para `pruebas.bnbtico.com`.
- `docs/publicacion.md`, `docs/contacto-whatsapp.md`, `docs/busqueda-asistida.md` — reglas por área. Donde hablen de identidad obligatoria, solicitud/aceptación o reclamaciones, están superadas por las reglas de arriba.
- `docs/architecture.md`, `docs/business-model.md`, `docs/vision.md`, `docs/pitch.md`, `docs/marketing.md` — contexto; revisar contra las reglas vigentes antes de citarlos.
- `docs/identidad-y-seguridad.md`, `docs/privacidad-verificaciones.md`, `docs/guia-verificacion-finca.md` — Veriff y titularidad: v1.1 y después.
- `docs/reclamaciones.md`, `docs/chat-privado.md`, `docs/contacto-privado.md`, `docs/roadmap.md`, `docs/resumen-*.md`, `docs/historico/` — históricos. `docs/historico/CLAUDE-hasta-2026-10-12.md` es la versión anterior de este archivo, con todas las notas fechadas.

## Dirección de producto fuera del lanzamiento

Veriff opcional (v1.1), cobro real con pasarela local (Tilopay / ONVO / Greenpay), app en tiendas, valoraciones de clientes, comunidad entre propietarios (idea, no requisito), titularidad registral opcional (exploración, no v1).
