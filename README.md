# CasaTica

Catálogo de casas en alquiler en Costa Rica donde los owners publican su casa y los clientes los contactan **directamente por WhatsApp**. La plataforma no procesa reservas ni pagos entre owner y cliente; cobra una **suscripción por casa activa** al owner, sin comisiones.

> Nombre provisional. Ver pendientes en `docs/roadmap.md`.

## Estado del proyecto (oct 2026)

- [x] Visión, modelo de negocio, diseño, arquitectura, roadmap y pitch → `docs/`
- [x] Prototipo navegable (cliente, owner, admin, landing; móvil y web) → `design/prototype/casatica-prototipo.html`
- [x] Tokens de diseño → `design/tokens/tokens.json`
- [x] Esquema de base de datos inicial y seed → `supabase/`
- [ ] Scaffold del monorepo (Next.js + Expo + packages compartidos)
- [ ] Resto del v1: ver `docs/roadmap.md`

## Cómo continuar en otro ordenador

1. Clonar/copiar esta carpeta (es un repo git).
2. Abrir el prototipo: `design/prototype/casatica-prototipo.html` en el navegador (no necesita servidor). También está publicado como artifact privado "CasaTica Prototipo" en claude.ai (gallery → claude.ai/code/artifacts).
3. Leer `CLAUDE.md` y los documentos de `docs/`.
4. Arrancar Claude Code en la raíz y pedirle, por ejemplo: *"Haz el scaffold del monorepo según CLAUDE.md y docs/architecture.md, empezando por apps/web"*.

## Estructura

```
CLAUDE.md            contexto corto para Claude Code + convenciones
docs/
  vision.md          problema, usuarios, principios, qué es éxito
  business-model.md  quién paga, precio, cómo se cobra, riesgos
  design.md          pantallas, flujos, sistema de diseño, copy
  architecture.md    stack, modelo de datos, reglas en backend
  roadmap.md         v1 checklist, v2, quizás nunca, pendientes
  pitch.md           pitch a owners, objeciones y respuestas
  decisiones.md      registro de decisiones
design/
  prototype/         prototipo HTML navegable
  tokens/            tokens.json
apps/web             Next.js (web responsive + landing + SEO)
apps/mobile          Expo / React Native
packages/            ui, api-client, config
supabase/            migrations/, seed/
```
