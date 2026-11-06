#!/usr/bin/env bash
# Para lo que arranca preparar-entorno-local.sh (docs/entorno-local.md):
#
#   ./parar-entorno-local.sh            para la app y Supabase local (los datos se conservan)
#   ./parar-entorno-local.sh --docker   además cierra Docker Desktop
#
# Se puede ejecutar aunque algo ya esté parado. Para volver a empezar: ./preparar-entorno-local.sh
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"
PORT=5173

paso() { printf '\n\033[1m▶ %s\033[0m\n' "$1"; }
ok() { printf '  ✓ %s\n' "$1"; }
aviso() { printf '  ! %s\n' "$1"; }

CERRAR_DOCKER=false
for arg in "$@"; do
  case "$arg" in
    --docker) CERRAR_DOCKER=true ;;
    *) printf 'Opción desconocida: %s\nUso: %s [--docker]\n' "$arg" "$0" >&2; exit 2 ;;
  esac
done

# Node 22 de Homebrew para el CLI de Supabase, igual que en preparar-entorno-local.sh.
if command -v brew >/dev/null && [[ -x "$(brew --prefix)/opt/node@22/bin/node" ]]; then
  export PATH="$(brew --prefix)/opt/node@22/bin:$PATH"
fi

paso "App (puerto $PORT)"
PIDS="$(lsof -ti "tcp:$PORT" -sTCP:LISTEN 2>/dev/null || true)"
if [[ -z "$PIDS" ]]; then
  ok "No estaba corriendo"
elif curl -fsS -o /dev/null "http://127.0.0.1:$PORT/robots.txt" 2>/dev/null; then
  kill $PIDS 2>/dev/null || true
  for _ in $(seq 1 10); do lsof -ti "tcp:$PORT" -sTCP:LISTEN >/dev/null 2>&1 || break; sleep 1; done
  if lsof -ti "tcp:$PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    kill -9 $PIDS 2>/dev/null || true
  fi
  ok "Parada"
else
  aviso "El puerto $PORT lo usa otro programa que no es la app de bnbtico: no lo toco."
fi

paso "Supabase local"
if ! command -v docker >/dev/null || ! docker info >/dev/null 2>&1; then
  ok "Docker no está corriendo: Supabase ya está parado"
elif pnpm exec supabase stop >/dev/null 2>&1; then
  ok "Parado (los datos se conservan; se borran solo con pnpm db:reset)"
else
  aviso "No se pudo parar con pnpm. Pruebe: cd $ROOT && pnpm db:stop"
fi

if $CERRAR_DOCKER; then
  paso "Docker Desktop"
  if pgrep -xq "Docker Desktop" || pgrep -xq "Docker"; then
    osascript -e 'quit app "Docker"' >/dev/null 2>&1 && ok "Cerrado" || aviso "No pude cerrarlo: ciérrelo desde el icono de la ballena."
  else
    ok "No estaba abierto"
  fi
fi

printf '\nListo. Para volver a arrancar: ./preparar-entorno-local.sh\n'
