# CasaTica

Catálogo de casas en alquiler en Costa Rica (vacacional y largo plazo). Los owners publican; los clientes los contactan **por WhatsApp**. La app no gestiona reservas ni pagos entre partes; cobra una suscripción por casa activa al owner, sin comisiones.

## Documentación (leer antes de tocar código)
- `docs/vision.md` — problema, usuarios, principios, qué es éxito
- `docs/business-model.md` — quién paga, precio, cómo se cobra, riesgos
- `docs/design.md` — pantallas, flujos, sistema de diseño, copy
- `docs/architecture.md` — stack, modelo de datos, reglas de negocio en backend
- `docs/roadmap.md` — v1 como checklist, v2, quizás nunca, pendientes
- `docs/pitch.md` — pitch a owners, objeciones y respuestas
- `docs/decisiones.md` — por qué se decidió cada cosa

Referencias: prototipo navegable en `design/prototype/casatica-prototipo.html` (abrir en navegador; no es código de producción; también publicado como artifact "CasaTica Prototipo" en claude.ai), tokens en `design/tokens/tokens.json`, esquema en `supabase/migrations/0001_init.sql`, seed en `supabase/seed/seed.sql`.

## Estado actual
Fase de definición terminada (2026-10-02): no hay código de aplicación todavía. `apps/` y `packages/` contienen solo READMEs. El siguiente paso es el scaffold (ver `docs/roadmap.md › v1 › Base`).

## Principios que no se negocian
1. Todo contacto humano ocurre en WhatsApp (`wa.me`). Sin chat interno.
2. El número del owner nunca se muestra; el del cliente solo lo reciben owners verificados con su consentimiento.
3. Precios siempre orientativos; nunca "total a pagar" ni pagos entre partes.
4. Los owners valoran a los clientes; no hay reseñas de casas.
5. Nada se publica sin verificación manual del owner (cédula).
6. UI en español de Costa Rica con voseo. Colones por defecto.

## Convenciones de código
- Monorepo pnpm + Turborepo: `apps/web` (Next.js), `apps/mobile` (Expo), `packages/ui|api-client|config`, `supabase/`.
- TypeScript estricto. Entidades en inglés (`Listing`, `Lead`, `Request`); copy en español.
- Dinero como entero + `currency` (`CRC` | `USD`); formato `₡95.000` / `$120`; cifras tabulares.
- Amenidades como enum: `pool, pets, ev_charger, ac, wifi, beachfront, bbq, parking, furnished, garage, accessible, no_deposit`.
- IDs públicos de casa `CT-####`.
- Tests: Vitest (matching, dinero, extracción de requisitos); Playwright (buscar → ficha → contactar).
- Commits en español, imperativo. Si cambias una decisión, anótala en `docs/decisiones.md`.

## Orden sugerido
Scaffold + tokens + Supabase local → catálogo web + contacto + OTP → panel owner + admin → solicitudes y matching → suscripción → móvil.
