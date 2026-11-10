#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/../.."
# Solo lectura de Git. Ana ejecuta; no añade, confirma, cambia ramas ni publica.
git status --short --branch
git log -1 --oneline
git diff --stat
git diff --cached --stat
git ls-files --others --exclude-standard
git diff --check
