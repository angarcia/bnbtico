# bnbtico (repo CasaTica)

Casas en alquiler en el Caribe de Costa Rica. Los propietarios publican; los clientes les escriben **directo por WhatsApp**. bnbtico no procesa reservas ni pagos entre partes; cobra una suscripción por casa activa, sin comisiones.

- **Qué se construye y en qué orden:** `docs/plan-implementacion.md`
- **Reglas vigentes y convenciones:** `CLAUDE.md`
- **Especificación de la v1:** el prototipo `design/prototype/casatica-prototipo.html` (vista Móvil) y sus pruebas en `tests/prototype/`

## Estructura

```
apps/app/        Vite + React + Hono · navegador y Cloudflare Worker, paquete app
supabase/        migraciones, seed y configuración del proyecto Supabase
design/          prototipo HTML (especificación), tokens, logo
docs/            plan, decisiones, diseño, contexto
tests/prototype/ pruebas del prototipo (node)
```

## Desarrollo

Requisitos: Node 22 (`.nvmrc`), pnpm 10 (`corepack enable` lo activa) y Docker para Supabase local. La aplicación no tiene modo demo.

En un entorno local propio, inicie Supabase antes de la aplicación:

```sh
pnpm install --frozen-lockfile
pnpm db:start
pnpm dev
```

`pnpm dev` abre Vite y el worker en `http://127.0.0.1:5173`. Genera `apps/app/.env.local` para el navegador y `.dev.vars` para el worker desde Supabase local. Ninguno se versiona. La clave de servicio nunca lleva el prefijo `VITE_`. `.env.example` enumera solo variables públicas del navegador; los secretos del despliegue se configuran según `docs/configuracion-supabase.md`, sección 10.

Los números locales `8888 1234`, `8777 0001`, `8888 9999` y `8899 0001` aceptan el código `123456` sin enviar mensajes. Consulte `supabase/config.toml` para la configuración completa.

Comprobaciones desde la raíz:

```sh
pnpm typecheck
pnpm test
pnpm test:prototype
pnpm test:db
pnpm dev:vars
pnpm build
pnpm size
pnpm test:e2e
pnpm lighthouse
```

Playwright usa viewport móvil. Instale Chromium con `pnpm --filter app exec playwright install chromium`, o indique `CHROMIUM_PATH`. `pnpm preview` sirve el build local. Los alias existentes `*:app` siguen disponibles. `start` y `lint` eran comandos de Next y se retiran; `build` conserva la prueba de arquitectura y seguridad de la aplicación activa.

**Durante el refactor:** no ejecute `db:start`, `db:reset` ni `db:stop`. La única instancia autorizada es `bnbtico_refactor_01` (API 55321, DB 55322). Antes de `dev`, `dev:vars`, `test:db`, E2E o cualquier acceso a esa instancia, adquiera la reserva común y siga `referencia-01.md` del worktree baseline. Las suites modifican datos sintéticos. Nunca deben apuntar a Supabase alojado. Lighthouse requiere además que no haya otros navegadores o builds concurrentes.

## Retirada de Next

El paquete antiguo `apps/web` se retira del repositorio. La aplicación activa conserva `apps/app` y el nombre `app`. No se borran archivos locales, secretos ni directorios.

Vercel conserva su proyecto y el despliegue vigente, con los builds desactivados según confirmó Daniel. Esta retirada no mueve DNS ni publica cambios de portada. El corte de infraestructura sigue pendiente de autorización separada en `docs/corte-fase-r.md`.

## Prototipo

```sh
python3 -m http.server 8765 --bind 127.0.0.1 --directory design/prototype
# http://127.0.0.1:8765/casatica-prototipo.html
```
