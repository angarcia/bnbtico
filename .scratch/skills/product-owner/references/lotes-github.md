# Preparar un lote de bnbtico

Lea este archivo solo al preparar nuevas tarjetas o su importación. **Ana ejecuta la revisión y la carga desde su terminal; el PO prepara los archivos y comandos.** También cuando pida «cargar» o «publicar» historias, entregue los comandos sin ejecutarlos. La implementación vigente de `scripts/github/importar_historias.py` y su `README.md` determinan el formato ejecutable; `docs/agents/historias-listas.md` determina preparación. Consúltelos antes de generar el lote. Adapte los campos a cambios comprobados, sin reconstruir el importador ni cambiar el proyecto por iniciativa propia.

## Acceso y consulta

- Repositorio: https://github.com/angarcia/bnbtico
- Proyecto: https://github.com/users/angarcia/projects/1
- Carpeta predeterminada: `/Users/anagarciasaiz/Documents/GitHub/bnbtico`.

Use GitHub CLI `gh`. Para comprobar sesión y, solo si hace falta, completar acceso, facilite estos comandos a Ana cuando ella ejecute la terminal:

```bash
gh auth status
gh auth login
gh auth refresh -s repo,project
```

No inicie ni renueve autorizaciones por iniciativa propia. Para consultas permitidas, `gh issue list --repo angarcia/bnbtico --state all --search 'término del tema' --json number,title,state,url` permite buscar posibles duplicados. Inspeccione candidatos completos, épica, dependencias y campos del proyecto; una lista de títulos no demuestra ausencia de duplicados ni preparación. Respete paginación y declare límites de cobertura. `gh project field-list 1 --owner angarcia --format json` permite consultar campos; si no hay acceso, use los últimos valores conocidos señalando que no se han confirmado.

## Organización y campos

Épica = objetivo agrupador, historias/tareas = sub-issues nativas, dependencias = `blocked by`, versión = milestone (`V1`, `V1.1`, `V2`…), etiqueta `epic:<nombre>` = filtro de épica. Una versión no es una épica. Cada historia/tarea debe identificar su épica y etiqueta correspondiente. Reutilice la épica existente cuando corresponda; no cree otra por lote. Si no puede resolver su referencia estructural, declare la relación pendiente según el contrato JSON siguiente.

| Campo | Valores acordados |
| --- | --- |
| Status | `Todo` para todas las tarjetas nuevas |
| Prioridad | `P0 · Crítica`, `P1 · Alta`, `P2 · Media` |
| Tipo de trabajo | `Desarrollo · Backend`, `Desarrollo · Frontend`, `Desarrollo · Frontend y backend`, `Diseño`, `Producto`, `Investigación técnica`, `Validación técnica`, `Operación`, `Épica` |
| Diseño | `No necesario`, `Pendiente`, `Listo` |
| Preparación | `Por definir`, `Bloqueada`, `Lista para trabajar` |

Prioridad es la única fuente: sin etiquetas P0/P1/P2 ni clasificación duplicada `Área`. Justifique la propuesta: P0 para impedimento crítico o riesgo grave demostrado; P1 para siguiente trabajo de alto valor o habilitador relevante; P2 para mejoras aplazables. Son criterios de recomendación, no nuevas decisiones de producto. Épicas: `Preparación: Por definir`. No imponga cadenas de dependencias a investigaciones independientes.

Diseño `Listo` exige referencia final y aprobación trazable. Para `No necesario`, cite la referencia existente y explique por qué basta. Una tarea de diseño pendiente bloquea la implementación visual, aunque tenga enlace. No fabrique URLs de maquetas todavía no publicadas.

## Archivos de salida obligatorios

1. `.scratch/<epica>/spec.md` y `.scratch/<epica>/issues/<NN>-<slug>.md`, uno por tarjeta. Conserve rutas existentes cuando ya haya preparación. Cada issue tiene `Status:` de triage según `docs/agents/triage-labels.md`; este valor no sustituye Status del proyecto ni Preparación.
2. `.scratch/importaciones/<lote>.json`, con descripciones Markdown completas exportadas de esos archivos, claves estables y relaciones. No mantenga estados de ejecución paralelos después de importar.
3. `.scratch/importaciones/<lote>.sh`, lanzador que reutiliza el importador. Sin argumentos hace vista previa; solo `--apply` importa.
4. Resumen con tarjetas, prioridades propuestas, bloqueos, decisiones pendientes, referencias y comandos exactos de revisión/importación desde la carpeta real.

## Contrato JSON actual

Objeto raíz: `schema_version: 1`, `repository: "angarcia/bnbtico"`, `project: {"owner": "angarcia", "number": 1}`, `items` no vacío; `labels` y `new_fields` solo cuando sean necesarios. No cree campos nuevos sin petición expresa; si el proyecto ha cambiado, adapte el lote a sus campos comprobados y señale incompatibilidades con lo acordado.

Cada item lleva `key`, `title`, `body`, los cinco `fields` anteriores y `labels`. Use `milestone` para versión; `parent` para clave de épica; `depends_on` para claves previas; `design_ref` para la clave de tarea de diseño pendiente, también incluida en `depends_on`. Para diseño ya aprobado, enlace el resultado en el cuerpo y no use `design_ref` para generar un aviso de diseño pendiente.

- `key` estable de 3–100 caracteres: empieza con letra minúscula o dígito y solo usa `[a-z0-9.-]`. No la cambie al renombrar ni reintentar. Título no vacío de hasta 256 caracteres.
- Todas las referencias estructurales deben existir en el mismo lote; sin ciclos. No use números de issue ni URLs en `parent`, `depends_on` o `design_ref`.
- Para una épica o dependencia de un lote anterior, reutilice su registro original con la misma `key` y contenido de preparación, si está disponible y es adecuado. Distinga tarjetas de contexto reutilizadas de tarjetas nuevas. El importador conserva las ya importadas; no las recree con otra clave.
- Si no puede representar una relación remota sin duplicar trabajo, consérvela en el cuerpo con URL/número real y declare que falta establecer la relación nativa. No presente el lote como completo ni la implementación como lista mientras siga pendiente una dependencia necesaria. Prepare lo independiente; no amplíe el importador sin petición.
- Defina en `labels` raíz las etiquetas utilizadas que todavía falten; respete nombres/colores existentes. No arrastre lotes enteros para reutilizar una sola épica.

El importador no actualiza cuerpo, etiquetas, milestone ni campos ya informados de tarjetas existentes. Para mejorar o repriorizar una issue importada, entregue la propuesta de edición y los comandos específicos para que Ana los revise y ejecute. Reimportar el JSON no sincroniza esos cambios.

## Lanzador y comprobación

Al generar `<lote>.sh`, sustituya `nombre-del-lote` por el nombre real. El lanzador y JSON quedan juntos, de modo que funciona desde cualquier directorio:

```bash
#!/usr/bin/env bash
set -euo pipefail
batch_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
repo_dir="$(cd -- "$batch_dir/../.." && pwd)"
exec python3 "$repo_dir/scripts/github/importar_historias.py" \
  "$batch_dir/nombre-del-lote.json" "$@"
```

Revise JSON, claves/referencias/ciclos, campos, BDD, preparación, diseño y enlaces locales. Entregue comandos con nombres reales, por ejemplo:

```bash
cd /Users/anagarciasaiz/Documents/GitHub/bnbtico
# Vista previa local: sin red ni cambios en GitHub
python3 scripts/github/importar_historias.py .scratch/importaciones/nombre-del-lote.json
# Importación, cuando Ana decida ejecutarla
python3 scripts/github/importar_historias.py .scratch/importaciones/nombre-del-lote.json --apply
```

Indique también que `bash .scratch/importaciones/<lote>.sh` y el mismo comando con `--apply` usan ese importador. Entregue ambos comandos con el nombre real del lote. No ejecute la vista previa ni `--apply`: Ana los ejecuta y puede compartir la salida para resolver errores. No afirme validación ejecutada sin resultado. La vista previa comprueba estructura local, no permisos, opciones remotas ni relaciones realmente creadas. Un fallo se reanuda con las mismas claves y archivo, secuencialmente; conserve el recibo `.resultado.json` y no anuncie importación completa si faltan relaciones o verificaciones.
