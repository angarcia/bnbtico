# Copia anterior al chat privado · 2026-10-07

## Copia de la versión con chat antes de volver a WhatsApp

`bnbtico-antes-volver-whatsapp-2026-10-07.tar.gz` conserva `design/`, `docs/`, `tests/`, `CLAUDE.md` y el enlace `AGENTS.md` antes de restaurar el contacto sencillo. Incluye la prueba retirada `private-chat.cjs`. No incluye `.git`, no es un commit y no se ha subido. Extraer primero a una carpeta temporal y comparar antes de restaurar; no sobrescribir cambios posteriores. Archivo comprobado con `gzip -t`.

## Copia previa al experimento

`bnbtico-antes-chat-privado-2026-10-07.tar.gz` conserva la versión del prototipo antes de implementar el chat privado con WhatsApp opcional. Incluye los cambios locales, aunque todavía no estuvieran en un commit:

- `design/`: HTML, scripts, logo y tokens.
- `docs/`: requisitos y decisiones existentes.
- `tests/`: pruebas del prototipo.
- `CLAUDE.md` y el enlace simbólico `AGENTS.md`.

El cambio al chat privado quedó detenido por petición de la usuaria; no se modificó el prototipo antes de hacer esta copia. No es un respaldo de `.git` ni de todo el monorepo. No se ha subido a GitHub.

Para recuperar, extraer primero en una carpeta nueva y comparar con los archivos actuales; no sobrescribir el trabajo posterior sin revisarlo:

```sh
snapshot_destination=$(mktemp -d /private/tmp/bnbtico-restauracion.XXXXXX)
tar -xzf /Users/anagarciasaiz/Documents/GitHub/CasaTica/backups/bnbtico-antes-chat-privado-2026-10-07.tar.gz -C "$snapshot_destination"
```
