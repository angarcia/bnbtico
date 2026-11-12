# Copias de seguridad de la base

El plan gratuito de Supabase no guarda copias. Desde la fase R (ticket 11) una copia diaria sale de la base alojada a
Cloudflare R2 con GitHub Actions (`.github/workflows/backup.yml`, workflow «copia»).

## Qué hace

- Todos los días a las 08:23 UTC (02:23 en Costa Rica), y a mano desde Actions → copia → «Run workflow».
- `pg_dump` de Postgres 17 (imagen `postgres:17`, la versión del proyecto) en formato *custom*, esquemas `public`
  (casas, perfiles, fotos, telemetría…), `auth` (usuarios, identidades, factores MFA) y `storage` (metadatos de los
  objetos), con privilegios y sin dueños. **Las fotos no van en la copia** (son objetos de Storage, no filas); las
  migraciones del repositorio reconstruyen esquema, RLS, grants y funciones.
- Comprueba que la copia tiene más de 10 tablas con datos, la sube a `r2://<R2_BUCKET>/<BACKUP_PREFIX>/<prefijo>-AAAA-MM-DD.dump`,
  comprueba el tamaño en R2 y borra las copias de más de **30 días** de ese prefijo (por la fecha del nombre).
- Sin los secretos, el job termina en verde con un aviso «Copia omitida: faltan secretos …» en el resumen.

## Secretos y variables de GitHub

| Nombre | Tipo | Qué es |
|---|---|---|
| `SUPABASE_DB_URL` | secreto | Cadena de conexión del **Session pooler** del proyecto (panel → Connect → Session pooler; `postgresql://postgres.<ref>:<contraseña>@aws-0-<región>.pooler.supabase.com:5432/postgres`). La conexión directa es solo IPv6 y los runners de GitHub no la alcanzan. |
| `R2_ACCOUNT_ID` | secreto | Id de la cuenta de Cloudflare (endpoint `https://<id>.r2.cloudflarestorage.com`). |
| `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY` | secretos | Token de API de R2 con «Object Read & Write» limitado al bucket de copias. |
| `R2_BUCKET` | variable (opcional) | Bucket; por defecto `bnbtico-copias`. Privado. |
| `BACKUP_PREFIX` | variable (opcional) | Carpeta y prefijo del archivo; por defecto `bnbtico-pruebas`. Al cortar a producción: `3bstays-prod` (y `SUPABASE_DB_URL` del proyecto de producción). |

Opcional además: una regla de ciclo de vida en el bucket (R2 → bucket → Settings → Object lifecycle rules → borrar a los 31 días) como segunda red por si el job deja de correr.

## Prueba mensual de restauración (primer lunes de cada mes)

Hace falta Docker y Supabase local arrancado (`pnpm db:start`). Unos 10 minutos.

1. Descargar la copia más reciente: `aws s3 cp s3://bnbtico-copias/bnbtico-pruebas/<archivo>.dump /tmp/copia.dump --endpoint-url https://<R2_ACCOUNT_ID>.r2.cloudflarestorage.com` (con `AWS_ACCESS_KEY_ID`/`AWS_SECRET_ACCESS_KEY` del token de R2), o desde el panel de R2.
2. Restaurar en una base aparte del Postgres local (tiene los roles de Supabase):
   ```sh
   docker cp /tmp/copia.dump supabase_db_bnbtico:/tmp/copia.dump
   docker exec -i supabase_db_bnbtico psql -U postgres -c "drop database if exists restore_test" -c "create database restore_test"
   docker exec -i supabase_db_bnbtico pg_restore -U postgres -d restore_test --no-owner /tmp/copia.dump
   ```
   Terminan con «errors ignored on restore: 7»: el esquema `public` ya existe y `postgres` no puede cambiar los privilegios por defecto de los roles internos. Cualquier otro error es un fallo de la prueba.
3. Comparar recuentos con el proyecto (SQL Editor del proyecto, o la API de administración):
   ```sql
   select (select count(*) from public.listings) as casas, (select count(*) from public.profiles) as perfiles,
          (select count(*) from auth.users) as usuarios, (select count(*) from storage.objects) as objetos,
          (select count(*) from public.listing_photos) as fotos;
   ```
   En local: `docker exec -i supabase_db_bnbtico psql -U postgres -d restore_test -c "<la misma consulta>"`. Deben coincidir con el día de la copia (o ser menores solo por lo creado después).
4. Limpiar: `docker exec -i supabase_db_bnbtico psql -U postgres -c "drop database restore_test"` y borrar `/tmp/copia.dump`.
5. Anotar la fecha y el resultado al final de este archivo.

Comprobado en local el 2026-10-23 con una copia de Supabase local hecha con los mismos parámetros: recuentos idénticos (casas, perfiles, usuarios, objetos, telemetría) y los 7 errores esperados.

## Restaurar de verdad (desastre)

1. Crear un proyecto nuevo de Supabase (`docs/configuracion-supabase.md`) y aplicar las migraciones: `pnpm exec supabase link --project-ref <nuevo> && pnpm exec supabase db push`.
2. Cargar solo los datos, sin disparar triggers (no se reenvían avisos ni se purga nada):
   ```sh
   pg_restore --data-only --no-owner --disable-triggers -n public -n auth -n storage \
     --exclude-table=schema_migrations --exclude-table=migrations -d "<SUPABASE_DB_URL del nuevo>" copia.dump
   ```
   Si `--disable-triggers` no está permitido para `postgres` en el alojado, usar `pg_restore -f datos.sql` y `psql -c "set session_replication_role = replica" -f datos.sql`. Filas que ya crean las migraciones (el bucket `listings`) dan un error de clave duplicada que se puede ignorar.
3. Volver a subir las fotos si se perdió Storage (no están en la copia), volver a crear los secretos de Vault (`worker_purge_url`, `worker_purge_secret`) y apuntar las variables del worker y de GitHub al proyecto nuevo.

## Registro de pruebas

| Fecha | Copia | Resultado |
|---|---|---|
| 2026-10-23 | local (no alojada) | Procedimiento comprobado. Falta la primera ejecución real del workflow (Daniel). |
