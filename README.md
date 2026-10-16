# bnbtico (repo CasaTica)

Casas en alquiler en el Caribe de Costa Rica. Los propietarios publican; los clientes les escriben **directo por WhatsApp**. bnbtico no procesa reservas ni pagos entre partes; cobra una suscripción por casa activa, sin comisiones.

- **Qué se construye y en qué orden:** `docs/plan-implementacion.md`
- **Reglas vigentes y convenciones:** `CLAUDE.md`
- **Especificación de la v1:** el prototipo `design/prototype/casatica-prototipo.html` (vista Móvil) y sus pruebas en `tests/prototype/`

## Estructura

```
apps/web/        Next.js (App Router, TypeScript) · la web móvil de bnbtico.com
supabase/        migraciones, seed y configuración del proyecto Supabase
design/          prototipo HTML (especificación), tokens, logo
docs/            plan, decisiones, diseño, contexto
tests/prototype/ pruebas del prototipo (node)
```

## Desarrollo

Requisitos: Node 22 (`.nvmrc`), pnpm 10 (`corepack enable` lo activa), Docker solo si querés Supabase local (`supabase start`).

```sh
pnpm install
cp apps/web/.env.example apps/web/.env.local   # rellenar cuando haya proyecto Supabase
pnpm dev                 # http://127.0.0.1:3000
pnpm test                # Vitest (lógica)
pnpm test:e2e            # Playwright en viewport móvil (la primera vez: pnpm --filter web exec playwright install chromium)
pnpm test:prototype      # pruebas del prototipo
```

`PREVIEW_PASSWORD` activa la contraseña de `pruebas.bnbtico.com`; vacía en local y en producción.

## Prototipo

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory design/prototype
# http://127.0.0.1:8765/casatica-prototipo.html
```
