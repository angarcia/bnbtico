# Artefactos Playwright locales

Esta utilidad sanea outputs nuevos de pruebas locales desechables. No autoriza publicar artefactos de hosted ni datos canónicos.

## Contrato

Se ejecuta con Node que incluya `node:zlib.crc32` (Node 22.2 o posterior). Comprueba Playwright 1.64.1, yauzl 3.4.0 y yazl 3.3.1. Solo usa sus APIs públicas. No requiere Python ni comandos ZIP externos.

Desde `apps/app`:

```sh
node scripts/sanitize-playwright-artifacts.mjs init --root "$PW_ARTIFACT_ROOT"
node scripts/sanitize-playwright-artifacts.mjs sanitize --root "$PW_ARTIFACT_ROOT" --input raw --output clean
node scripts/sanitize-playwright-artifacts.mjs sanitize --root "$PW_ARTIFACT_ROOT" --input render --output publish
```

`init` exige una ruta absoluta inexistente dentro de `os.tmpdir()` o `RUNNER_TEMP`. Su padre debe existir. Crea raíz, marcador, `raw` y `render` privados. No use una carpeta previamente creada por `mktemp -d` como raíz.

`sanitize` admite entradas `raw` o `render`, y salidas `clean` o `publish`. Los valores predeterminados son `raw` y `publish`. La combinación `render → clean` está prohibida. No sobrescribe destinos existentes.

La utilidad descubre secretos en memoria antes de transformar archivos. La pasada de `render` vuelve a leer `raw` para encontrar copias reintroducidas por el renderer. Reabre los ZIP generados, comprueba CRC y contenido, y compara los archivos escritos. Finalmente promueve el directorio completo con `rename`. Un error previo impide esa promoción. El bloqueo de ejecución evita dos saneamientos simultáneos sobre la misma raíz.

## Enganche para el coordinador de 05

Este documento no modifica el workflow ni `playwright.config.ts`. El coordinador debe conectar todas las rutas de diagnóstico, incluidas las del JSON normalizado.

1. Genere una raíz distinta por job, intento y shard.
2. Inicialícela antes de capturar cualquier output.
3. Envíe resultados, adjuntos y logs del runner exclusivamente a `raw`.
4. Capture el código E2E sin imprimir su stdout/stderr sin sanear.
5. Mantenga los casos, workers, retries y `trace: retain-on-failure` aprobados. No desactive trazas.
6. Sanee antes de ejecutar cualquier renderer.
7. Genere HTML y JSON desde el blob saneado.
8. Ejecute el normalizador de CI sobre el JSON saneado. Escriba su resultado en `render`, nunca en un path público independiente.
9. Ejecute la segunda pasada. No publique hasta que termine correctamente.

Esqueleto Bash para los pasos de captura y saneamiento, desde `apps/app`:

```sh
set -eu
umask 077
export PW_ARTIFACT_ROOT="${RUNNER_TEMP:-$(node -p 'require("node:os").tmpdir()')}/pw-$(node -p 'require("node:crypto").randomUUID()')"
node scripts/sanitize-playwright-artifacts.mjs init --root "$PW_ARTIFACT_ROOT"
e2e_rc=0
PLAYWRIGHT_BLOB_OUTPUT_DIR="$PW_ARTIFACT_ROOT/raw/blob" \
  pnpm exec playwright test --reporter=blob --output="$PW_ARTIFACT_ROOT/raw/results" \
  >"$PW_ARTIFACT_ROOT/raw/runner.log" 2>&1 || e2e_rc=$?
printf '%s\n' "$e2e_rc" >"$PW_ARTIFACT_ROOT/raw/e2e-exit.txt"
node scripts/sanitize-playwright-artifacts.mjs sanitize --root "$PW_ARTIFACT_ROOT" --output clean
PLAYWRIGHT_HTML_OPEN=never \
PLAYWRIGHT_HTML_OUTPUT_DIR="$PW_ARTIFACT_ROOT/render/html" \
PLAYWRIGHT_JSON_OUTPUT_FILE="$PW_ARTIFACT_ROOT/render/e2e.json" \
  pnpm exec playwright merge-reports --reporter=html,json "$PW_ARTIFACT_ROOT/clean/blob" \
  >"$PW_ARTIFACT_ROOT/render/renderer.log" 2>&1
cp "$PW_ARTIFACT_ROOT/clean/runner.log" "$PW_ARTIFACT_ROOT/render/runner.log"
cp "$PW_ARTIFACT_ROOT/clean/e2e-exit.txt" "$PW_ARTIFACT_ROOT/render/e2e-exit.txt"
```

Aquí el coordinador debe ejecutar su normalizador, con salida exacta `$PW_ARTIFACT_ROOT/render/e2e-normalized.json`. No sustituya su implementación ni su contrato. Exija que el comando termine correctamente y que produzca un archivo válido. Después:

```sh
test -f "$PW_ARTIFACT_ROOT/render/e2e-normalized.json"
node scripts/sanitize-playwright-artifacts.mjs sanitize --root "$PW_ARTIFACT_ROOT" --input render --output publish
```

En GitHub Actions, exponga la ruta y `e2e_rc` como outputs del paso. Emita `safe_to_upload=true` **solo después** de esa última orden.

La subida debe exigir ese output y apuntar exclusivamente a `$PW_ARTIFACT_ROOT/publish`. Después de la subida, restaure el fallo E2E mediante `exit "$e2e_rc"`.

Un error de saneamiento o render debe bloquear la subida y fallar el job. No use un `always()` sin esa puerta. No confunda `sanitization.json` con una firma de confianza.

No modifique `publish` ni añada archivos después de la promoción. Elimine la raíz temporal propia al terminar el job. No incluya el workspace, raw, clean o render en uploads, caches ni logs públicos.

## Diagnosticar un rechazo en CI

El coordinador `ci-artifacts.mjs` imprime `Playwright: código de salida N.` antes del saneamiento: `0` indica que el proceso terminó correctamente; otro valor indica un fallo o una interrupción. Las puertas posteriores siguen siendo obligatorias. Este dato permite conocer el resultado del proceso incluso si no se puede publicar el diagnóstico.

Los rechazos de entradas ZIP se distinguen por códigos fijos: `zip-duplicate` (nombre repetido), `zip-encrypted` (entrada cifrada), `zip-compression` (método no admitido) y `zip-type` (tipo de archivo no admitido). No se imprimen nombres, rutas ni contenido del ZIP. Todos estos rechazos siguen bloqueando la publicación y el job.

Si el saneamiento falla, los logs de Actions conservan únicamente este diagnóstico limitado. El paso de limpieza elimina la raíz privada y no se suben los artefactos rechazados. Para investigar el formato concreto, reproduzca el caso con datos desechables; no publique `raw`, trazas ni logs privados para saltarse el bloqueo.

## Alcance y rechazo seguro

- ZIP de traza versión 10, blob versión 2 y ZIP anidados del HTML de Playwright 1.64.1.
- JSON/JSONL, errores, fuentes y recursos textuales UTF-8. JSON serializado, base64/base64url y URI canónicos se inspeccionan también.
- Campos Auth reconocidos, Authorization/Basic/Bearer, API keys, cookies, storageState y parámetros POST. Se eliminan copias de los valores descubiertos en el conjunto.
- Los cuerpos de `/auth/v1/` se sustituyen por `Auth payload omitted`. Se conservan referencias `_file`/`_sha1`, estados y tiempos. Los nombres de recurso siguen siendo identificadores del original, no hashes del cuerpo saneado.
- PNG/JPEG/GIF/WebP y fuentes WOFF/WOFF2/TTF conservan sus bytes. Un secreto conocido dentro de esos bytes bloquea la salida.
- Un secreto conocido en un frame DOM bloquea la publicación por riesgo de capturas sensibles. No hay OCR ni lectura de QR, canvas o vídeo. No declare publicable una captura de credenciales que requiera esas capacidades.
- No se promete detectar secretos arbitrarios sin estructura reconocida, codificaciones privadas ni datos personales generales. Revisar una nueva fuente o formato exige ampliar pruebas antes de habilitarlo.
- Rechaza formatos binarios desconocidos, versiones incompatibles, enlaces, nombres peligrosos o repetidos, CRC incorrecto, errores de descompresión y destinos existentes.
- Límites: 32 MiB por archivo, 256 MiB agregados incluyendo expansión, 20.000 entradas, ocho niveles de contenedores y relación de compresión máxima 200. Credenciales reconocidas de menos de cuatro caracteres se rechazan.

## Pruebas y entrega

```sh
pnpm install --frozen-lockfile
pnpm --dir apps/app test tests/unit/playwright-artifacts.test.ts
pnpm --dir apps/app typecheck
```

Los dos últimos comandos parten de la raíz del repositorio. Chromium debe estar disponible antes de la suite unitaria. Se usa `CHROMIUM_PATH`, Chrome local en macOS, o el Chromium instalado de Playwright en Linux. No hay skips si falta el navegador.

La prueba hermética usa un servidor de loopback, canarios ficticios, un único worker y cero retries. Genera un fallo deliberado, inspecciona su red real, verifica todas las salidas y abre HTML y Trace Viewer saneados. Compara estados y tiempos antes y después de cada pasada. El merge nativo puede introducir una diferencia de redondeo submilisegundo en la duración agregada.

El parche del saneador comprende este documento, el `.mjs`, su `.d.mts` y `tests/unit/playwright-artifacts.test.ts`. El piloto mantiene sus tres archivos separados. No incluya cambios de la base ni de las dependencias aprobadas en esos parches.
