#!/usr/bin/env bash
set -euo pipefail
batch_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd -- "$batch_dir/../.." && pwd)"
exec python3 "$repo_dir/scripts/github/importar_historias.py" "$batch_dir/feature-flags.json" "$@"
