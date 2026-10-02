# CasaTica

Catálogo de casas en alquiler en Costa Rica donde los owners publican su casa y los clientes los contactan **directamente por WhatsApp**. La plataforma no procesa reservas ni pagos entre owner y cliente; cobra una **suscripción por casa activa** al owner, sin comisiones.

> Nombre provisional. Ver `docs/PENDIENTES.md`.

## Estado del proyecto (oct 2026)

- [x] Requisitos clarificados y reglas de negocio definidas → `docs/ (vision, business-model, design, architecture, roadmap, pitch)`
- [x] Prototipo navegable (cliente, owner, admin, landing; móvil y web) → `design/prototype/casatica-prototipo.html`
- [x] Sistema de diseño (tokens) → `design/tokens/tokens.json`
- [x] Esquema de base de datos inicial → `supabase/migrations/0001_init.sql`
- [ ] Scaffold del monorepo (Next.js + Expo + packages compartidos)
- [ ] Auth por teléfono (OTP) y roles
- [ ] Catálogo + filtros + ficha + botón WhatsApp (leads)
- [ ] Panel owner: publicar casa, calendario, contactos, valoración de clientes
- [ ] Solicitudes de casa (búsqueda inversa) y matching
- [ ] Admin: cola de verificación
- [ ] Suscripción por casa (pasarela local con tarjeta + SINPE Móvil)

## Cómo continuar en otro ordenador

1. Clonar/copiar esta carpeta.
2. Abrir el prototipo: `design/prototype/casatica-prototipo.html` en el navegador (no necesita servidor).
3. Leer `CLAUDE.md` y `docs/ (vision, business-model, design, architecture, roadmap, pitch)`.
4. Arrancar Claude Code en la raíz y pedirle, por ejemplo: *"Haz el scaffold del monorepo según CLAUDE.md y docs/ (vision, business-model, design, architecture, roadmap, pitch), empezando por apps/web"*.

## Estructura

```
docs/        spec, decisiones, pendientes
design/      prototipo HTML y tokens de diseño
apps/web     Next.js (web responsive + landing + SEO de fichas)
apps/mobile  Expo / React Native
packages/    ui (componentes + tokens), api-client, config
supabase/    migraciones SQL y seed de ejemplo
```
