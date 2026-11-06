#!/usr/bin/env bash
# Deja bnbtico listo para probar en este Mac con un solo comando (docs/entorno-local.md):
#
#   ./preparar-entorno-local.sh          desde la carpeta docs/
#   docs/preparar-entorno-local.sh       desde la raíz del repositorio
#
# Da por hecho que Homebrew, Docker Desktop y el repositorio ya están (sección 1 de la guía, pasos 1.1, 1.2, 1.4 y 1.6).
# Hace el resto: Node 22 y pnpm, dependencias, Supabase local, migraciones, casas de prueba y la app abierta en el
# navegador. Se puede repetir cuando quiera: lo que ya está hecho se salta y las casas de prueba se vuelven a crear.
# La app se queda corriendo en esta Terminal; se para con Ctrl+C.
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PORT=5173
URL="http://127.0.0.1:$PORT"

paso() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
ok() { printf '  ✓ %s\n' "$1"; }
aviso() { printf '  ! %s\n' "$1"; }
error() { printf '\n\033[31m✗ %s\033[0m\n' "$1" >&2; exit 1; }

[[ "$(uname)" == "Darwin" ]] || error "Este script es para macOS."
[[ -f supabase/config.toml && -f apps/app/package.json ]] || error "No encuentro el repositorio de bnbtico en $ROOT."

paso "Homebrew"
command -v brew >/dev/null || error "Falta Homebrew. Siga el paso 1.2 de docs/entorno-local.md y vuelva a ejecutar este script."
ok "$(brew --version | head -1)"

paso "Node 22"
DEFAULT_NODE="$(command -v node || true)"
DEFAULT_VERSION=""
[[ -n "$DEFAULT_NODE" ]] && DEFAULT_VERSION="$("$DEFAULT_NODE" -v 2>/dev/null || true)"
[[ -n "$DEFAULT_NODE" && -z "$DEFAULT_VERSION" ]] && DEFAULT_VERSION="desconocida"
if [[ ! -x "$(brew --prefix)/opt/node@22/bin/node" ]]; then
  echo "  Instalando node@22 con Homebrew (unos minutos)…"
  LOG="$(mktemp -t bnbtico-brew)"
  HOMEBREW_NO_ENV_HINTS=1 brew install --quiet node@22 >"$LOG" 2>&1 || { tail -20 "$LOG"; error "No se pudo instalar node@22 (registro completo: $LOG)."; }
  # Instalar node@22 puede actualizar librerías compartidas (simdjson…) y dejar roto otro Node de Homebrew ya instalado.
  if brew list --formula node >/dev/null 2>&1 && ! "$(brew --prefix)/opt/node/bin/node" -v >/dev/null 2>&1; then
    aviso "Homebrew actualizó librerías que usa su otro Node (fórmula «node») y ahora no arranca."
    aviso "Para repararlo, cuando quiera: brew upgrade node"
  fi
fi
NODE22_BIN="$(brew --prefix)/opt/node@22/bin"
if [[ -z "$DEFAULT_NODE" ]]; then
  brew link --overwrite --force node@22 >/dev/null
  ok "Node 22 enlazado: ya es el Node de cualquier Terminal nueva."
elif [[ "$DEFAULT_VERSION" != v22.* ]]; then
  aviso "Su Terminal usa Node $DEFAULT_VERSION ($DEFAULT_NODE). Este script usa Node 22 por su cuenta."
  aviso "Para los comandos de la guía fuera del script, vea el paso 1.3 (brew link --overwrite --force node@22)."
fi
export PATH="$NODE22_BIN:$PATH"
ok "Node $(node -v)"

paso "pnpm"
export COREPACK_ENABLE_DOWNLOAD_PROMPT=0
command -v corepack >/dev/null || error "Node 22 no trae corepack. Instale pnpm con: npm install -g pnpm@10.9.0"
corepack enable >/dev/null 2>&1 || corepack enable --install-directory "$NODE22_BIN"
ok "pnpm $(pnpm -v)"

paso "Docker"
command -v docker >/dev/null || error "Falta Docker Desktop. Siga el paso 1.4 de docs/entorno-local.md."
if ! docker info >/dev/null 2>&1; then
  echo "  Abriendo Docker Desktop…"
  open -a Docker || error "No pude abrir Docker Desktop. Ábralo a mano y repita."
  for _ in $(seq 1 90); do docker info >/dev/null 2>&1 && break; sleep 2; done
  docker info >/dev/null 2>&1 || error "Docker no arrancó en 3 minutos. Ábralo, espere a que la ballena deje de moverse y repita."
fi
ok "Docker $(docker info --format '{{.ServerVersion}}')"

paso "Dependencias"
pnpm install --frozen-lockfile --reporter=silent
ok "Instaladas"

paso "Supabase local (la primera vez descarga imágenes: unos minutos)"
pnpm exec supabase start >/dev/null 2>&1 || { pnpm exec supabase start 2>&1 | tail -20; error "Supabase no arrancó."; }
ok "En marcha en http://127.0.0.1:54321 (Studio: http://127.0.0.1:54323)"

paso "Base local al día con supabase/migrations"
# Aplica las migraciones nuevas (también las que llegan con fecha anterior al juntar ramas) y para con el error a la vista
# si la base no cuadra con el repositorio. Ver apps/app/scripts/base-local.mjs.
pnpm --silent db:al-dia || error "La base local no está al día con las migraciones (arriba, el motivo y cómo arreglarlo)."

paso "Casas de prueba"
if ! pnpm --silent datos:prueba; then
  # Si Supabase ya estaba arrancado antes de añadir los números de prueba a config.toml, no los conoce: reinicio y repito.
  aviso "Reiniciando Supabase para que lea los números de prueba (los datos se conservan)…"
  pnpm exec supabase stop >/dev/null 2>&1
  pnpm exec supabase start >/dev/null 2>&1 || error "Supabase no arrancó."
  pnpm --silent datos:prueba || error "No se pudieron crear las casas de prueba."
fi

paso "App"
if lsof -ti ":$PORT" >/dev/null 2>&1; then
  if curl -fsS -o /dev/null "$URL/robots.txt"; then
    ok "Ya estaba corriendo en $URL"
    open "$URL"
    exit 0
  fi
  error "El puerto $PORT está ocupado por otro programa. Ciérrelo y repita."
fi
# Abre el navegador cuando la app responda; la app se queda en primer plano en esta Terminal.
( for _ in $(seq 1 60); do curl -fsS -o /dev/null "$URL/robots.txt" 2>/dev/null && { open "$URL"; exit 0; }; sleep 1; done ) &
printf '\n  App en \033[1m%s\033[0m (se abre sola en el navegador). Para pararla: Ctrl+C.\n' "$URL"
printf '  Vista de teléfono: DevTools (Cmd+Opción+I) → Cmd+Shift+M → Pixel 7.\n\n'
exec pnpm dev --port "$PORT" --strictPort --host 127.0.0.1
