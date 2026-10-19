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

## Entornos y herramientas (2026-10-19)

- `main` → bnbtico.com (solo portada hasta el lanzamiento); `develop` → pruebas.bnbtico.com (contraseña, Supabase `bnbtico-pruebas`, GA apagado). Cambios de portada: en `main` y luego merge a `develop`.
- Supabase local: `pnpm db:start` / `pnpm db:reset`; `apps/web/.env.local` (no versionado) apunta a él y lleva `SUPABASE_SERVICE_ROLE_KEY` (clave de servicio local, solo para las pruebas `tests/db` y `casas.spec.ts`; la app nunca la usa). Sin variables la app usa el proveedor demo (código 123456) y las pantallas de casas avisan que necesitan Supabase. Números de prueba `8888 1234`, `8777 0001`, `8888 9999` y `8899 0001` (**admin**, en local y en pruebas, marcado por `seed_admin`) con código 123456. Tras tocar `config.toml`: `supabase stop && supabase start` (`db reset` no lo recarga). `supabase migration new` lee de stdin si no es terminal: en scripts, `< /dev/null`.
- Esquema: nuevas migraciones con `pnpm exec supabase migration new <nombre>` y `pnpm exec supabase db push`; `0001_init.sql` no se edita más. Los cambios de estado de una casa pasan por las RPCs (`submit_listing`, `review_listing`); el trigger `listings_protect` bloquea cualquier otro camino y congela el contenido fuera de `draft`/`changes`. Admin = `profiles.is_admin`. Columnas sensibles: `revoke`/`grant` por columna o vista, además de RLS (la tabla `listings` solo la leen dueño y admin; el público usa `listings_public`).
- Local: `.claude/launch.json` arranca la web; Playwright con `CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`, un solo worker (comparte base y números de prueba) y en Playwright el aviso de los formularios se localiza con `.note[role="alert"]` (Next añade su propio `role="alert"`); `/?pronto=1` muestra la portada. `apps/web/AGENTS.md` lo genera Next y no se versiona.
- Commits sin línea de coautoría. No acceder a pruebas.bnbtico.com desde herramientas: las comprobaciones del despliegue las hace Daniel; los logs y datos del proyecto Supabase sí se consultan con la API de administración (sesión de la CLI).

## Convenciones del prototipo (mientras siga siendo la referencia)

- Servirlo con `python3 -m http.server 8765 --bind 127.0.0.1 --directory design/prototype` y abrir `http://127.0.0.1:8765/casatica-prototipo.html`. Estado solo en memoria salvo lo guardado en `localStorage` (cuenta, estado de casas).
- Cada cambio va en un módulo nuevo `design/prototype/<tema>.js` que envuelve `SCREENS[...]` o la función global que toque (`{const previous=X; X=(...)=>...}`) y termina con `render();`. Los cambios de hoy que afectan solo a móvil comprueban `S.dev==='phone'`. Se añade el `<script>` al final del HTML y una prueba `tests/prototype/<tema>.cjs`.
- No regenerar el logo (`design/prototype/assets/bnbtico-original.png`); tokens en `design/tokens/tokens.json`.
- No dar por verificado un cambio de UI por leer el HTML: abrirlo (Playwright o navegador) en vista Móvil.

## Documentación

- `docs/plan-implementacion.md` — fases de construcción, alcance de v1, stack. **Manda sobre `roadmap.md`.**
- `docs/decisiones.md` — registro de decisiones con fecha, la más reciente arriba.
- `docs/design.md` — pantallas, flujos, calendario, sistema de diseño.
- `docs/configuracion-supabase.md` — cómo crear el proyecto de Supabase, Twilio Verify y las variables de Vercel para `pruebas.bnbtico.com`; paso 8: migraciones de la fase 2 y cuenta admin.
- `docs/pruebas-manuales-fase-2.md` — plan de pruebas manual desde el móvil en pruebas.bnbtico.com (fases 0–2), con los números de prueba y su papel.
- `docs/publicacion.md`, `docs/contacto-whatsapp.md`, `docs/busqueda-asistida.md` — reglas por área. Donde hablen de identidad obligatoria, solicitud/aceptación o reclamaciones, están superadas por las reglas de arriba.
- `docs/architecture.md`, `docs/business-model.md`, `docs/vision.md`, `docs/pitch.md`, `docs/marketing.md` — contexto; revisar contra las reglas vigentes antes de citarlos.
- `docs/identidad-y-seguridad.md`, `docs/privacidad-verificaciones.md`, `docs/guia-verificacion-finca.md` — Veriff y titularidad: v1.1 y después.
- `docs/reclamaciones.md`, `docs/chat-privado.md`, `docs/contacto-privado.md`, `docs/roadmap.md`, `docs/resumen-*.md`, `docs/historico/` — históricos. `docs/historico/CLAUDE-hasta-2026-10-12.md` es la versión anterior de este archivo, con todas las notas fechadas.

## Dirección de producto fuera del lanzamiento

Veriff opcional (v1.1), cobro real con pasarela local (Tilopay / ONVO / Greenpay), app en tiendas, valoraciones de clientes, comunidad entre propietarios (idea, no requisito), titularidad registral opcional (exploración, no v1).
