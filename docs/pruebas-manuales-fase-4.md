# Plan de pruebas manual · fase 4 (calendario del propietario) en nueva.bnbtico.com

Fecha: 2026-10-23 (tickets 01–06 de `.scratch/fase-4/`). Entorno: `https://nueva.bnbtico.com` (rama `develop`, worker `bnbtico-pruebas` en Cloudflare, Supabase `bnbtico-pruebas`). Desde la red corporativa, donde `nueva.bnbtico.com` no carga, use `https://bnbtico-pruebas.ana-garcia-saiz.workers.dev` (mismo worker y misma base; no pasa por Access). Se ejecuta **desde el teléfono**, con un iPhone y un Android si es posible, después de desplegar. Complementa a `docs/pruebas-manuales-fase-r.md` y `docs/pruebas-manuales-fase-3.md` (lo de esas fases no se repite aquí). Marque cada casilla y, si algo falla, anote el número del paso (ver C).

**Frescura de la ficha:** la purga borra la copia de la ficha guardada en el borde para el dominio al que apunta el secreto `worker_purge_url` (hoy `https://nueva.bnbtico.com`). Los pasos B6 y B9 («la ficha se actualiza en segundos») se comprueban en `nueva.bnbtico.com`, desde los datos del teléfono (fuera de la red corporativa). En `workers.dev` la purga no apunta a ese dominio: si allí una ficha sale vieja, no es un fallo de la fase 4 (anótelo igual, con el dominio).

La parte A va antes, **una acción cada vez y en este orden**.

---

> **Nota (2026-10-26, ticket 20 de la fase R):** el interruptor «Disponible para consultas» se llama ahora «Anuncio visible»; la hoja, «Pausar anuncio» («¿Cuándo vuelve a verse? (opcional)»); apagado dice «Pausado…» y en Mis casas «Pausado»; la ficha muestra «No disponible por ahora» y **la casa deja de salir en Explorar** (sigue en Favoritos). Donde los pasos de abajo digan el copy antiguo, espere el nuevo.

## A. Acciones previas (Daniel)

### A1. Migración `fase4_calendario` en `bnbtico-pruebas` · bloquea: pruebas

Falta una migración, aditiva salvo en dos puntos (se cierran las escrituras directas en `listing_days` y `listing_rates`, que ninguna de las dos apps usa):

- `20261024024441_fase4_calendario.sql`: RPC `save_listing_days` (única vía para escribir días), `set_listing_available` con fecha de reapertura opcional (sustituye a la de dos argumentos; las dos apps la llaman por nombre y siguen funcionando), `public_listing_days` (días de la ficha pública), `reopen_due_listings` y la extensión **`pg_cron`** con el trabajo nocturno `bnbtico-reabrir-casas`.

Desde la raíz del repo, en `develop` al día:

1. `pnpm exec supabase migration list` → `20261024024441` debe salir solo en «Local».
2. `pnpm exec supabase db push` → aplica solo esa.
3. Supabase → **Database → Cron** (o Integrations → Cron): existe el trabajo **`bnbtico-reabrir-casas`** con `0 6 * * *` (06:00 UTC = 00:00 en Costa Rica) y activo. Si la pantalla no sale, en el SQL Editor: `select jobname, schedule, active from cron.job;`.
4. Supabase → **Database → Functions**: existen `save_listing_days`, `public_listing_days`, `reopen_due_listings` y `set_listing_available`.

**Efecto sobre la app vieja (`pruebas.bnbtico.com`):** ninguno (no escribe días y llama a `set_listing_available` con los dos argumentos de siempre).
**Si se despliega sin ella:** la ficha sale bien pero sin la sección «Disponibilidad» (y sin guardarse en la caché); el calendario del propietario no carga y cerrar con fecha falla.

### A2. Secretos de Vault de la purga · bloquea: pruebas (B6 y B9)

Se crearon en la fase R (`docs/pruebas-manuales-fase-r.md`, A3). Comprobar que siguen ahí, en el SQL Editor de `bnbtico-pruebas`:

```sql
select name, decrypted_secret = '' as vacio from vault.decrypted_secrets where name in ('worker_purge_url', 'worker_purge_secret');
```

Deben salir **las dos filas** con `vacio = false`, y `worker_purge_url` debe ser `https://nueva.bnbtico.com` (`select decrypted_secret from vault.decrypted_secrets where name = 'worker_purge_url';`). Sin ellos el calendario se guarda igual, pero la ficha pública puede tardar hasta un día en reflejarlo.

### A3. Desplegar · bloquea: despliegue

Después de A1: `git push origin develop`. El workflow `app` pasa las pruebas y la puerta de Lighthouse y despliega en `nueva.bnbtico.com`. Comprobar que el run está verde en GitHub → Actions. (En el runner de Linux la prueba de frescura de punta a punta, `frescura.spec.ts` y `fase4.spec.ts`, se omite porque la base de Docker no llega al preview: es esperado; en el Mac pasan.)

---

## B. Recorridos

Quién hace de quién: **Ana** (`+1 778 347 8492`) de propietaria con su casa activa de la fase 3 (o una nueva, B0); **Daniel** de cliente, sin sesión, en una pestaña privada. Con la propietaria ficticia (`8777 0001`) se puede probar todo igual.

Copy que debe verse: trato de usted; nada de «temporada», «fin de semana» ni «Configurar tarifas»; fechas como «20–22 dic», «Diciembre 2026», «Vuelve a estar disponible el 15 de enero».

### Preparación

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B0 | (Si Ana no tiene casa activa.) Ana: «Publicar mi casa» → enviar a revisión | «¡Listo! Su casa está en revisión» con el botón «Marcar las noches ocupadas» | ☐ |
| B0a | Tocar «Marcar las noches ocupadas» | Se abre el Calendario **de esa casa** (su nombre en la píldora de arriba), aunque aún esté en revisión. Marque una noche ocupada y guarde. Daniel (admin) la aprueba después | ☐ |

### Calendario de la propietaria (pantalla 17)

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B1 | Ana: pestaña «Calendario» | Título «Calendario», píldora con el nombre de la casa, el mes actual entre flechas (p. ej. «‹ Octubre 2026 ›»), «Toque los días para editarlos», cabecera «L K M J V S D», cada día con su precio («95k») y la leyenda «Disponible · Ocupado · ★ Precio distinto». Sin panel abajo | ☐ |
| B1a | Mirar los días anteriores a hoy | Atenuados; al tocarlos no pasa nada | ☐ |
| B1b | «‹» en el mes actual; «›» doce veces | «‹» apagada en el mes actual; «›» se apaga al llegar al mismo mes del año que viene | ☐ |
| B2 | Tocar tres días seguidos del mes que viene | Cada día con borde terracota; sube el panel «3 noches · 10–12 <mes>» con «Cancelar», Disponible / Ocupado (Disponible marcado), «Precio por noche» con el precio de la casa y «Guardar cambios» apagado | ☐ |
| B2a | «Ocupado» → «Guardar cambios» | Al instante (sin esperar a la red): el panel se cierra y los tres días salen en terracota claro con «ocupado» | ☐ |
| B2b | Cerrar la app del todo y volver a abrir el Calendario | Los tres días siguen ocupados | ☐ |
| B3 | Tocar un día libre → escribir `150000` en el precio (teclado numérico; iPhone y Android) | El campo queda visible encima del teclado; al cerrar el teclado el botón no salta bajo el dedo | ☐ |
| B3a | «Guardar cambios» | El día muestra «★» junto al número y «150k» | ☐ |
| B3b | Tocar ese día otra vez | El precio dice «150 000» y aparece el enlace «Usar el precio base (₡95 000)» (con el precio de la casa) | ☐ |
| B3c | Tocar «Usar el precio base…» → «Guardar cambios» | La ★ desaparece y vuelve el precio normal | ☐ |
| B4 | Poner otra vez una ★ en un día. Luego seleccionar ese día y un día normal | El precio sale vacío con «Varios precios» | ☐ |
| B4a | Sin tocar el precio: «Ocupado» → «Guardar cambios» | Los dos ocupados; la ★ y su precio se conservan (el otro sigue con el precio normal) | ☐ |
| B4b | Seleccionar días y tocar «Cancelar» | El panel se cierra y nada cambia | ☐ |
| B4c | Seleccionar un día y escribir `0` como precio → «Guardar cambios» | Mensaje «Escriba un precio por noche en colones, mayor que cero y sin decimales.»; nada cambia | ☐ |
| B5 | Modo avión → seleccionar un día → «Ocupado» → «Guardar cambios» | El día cambia un momento y vuelve atrás con «Sin conexión. Revise su internet e intente de nuevo.» | ☐ |
| B5a | Con dos casas (si Ana tiene otra): tocar la píldora y elegir la otra | Se ven solo los días de la otra casa; al volver al Calendario otro día, recuerda la última elegida | ☐ |

### La ficha pública (cliente)

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B6 | Daniel, pestaña privada, en `nueva.bnbtico.com`: abrir el enlace de la casa de Ana | La ficha aparece tan rápido como antes. Tras las características, «Disponibilidad»: la rejilla del mes (sin botones), y al pasar al mes de B2 los tres días «ocupado»; la ★ de B4 con su cifra («★150k»); los demás días sin cifra; «Precio base ₡95 000 por noche; los días con ★ tienen otro precio.» | ☐ |
| B6a | Mientras carga, mirar si la página salta cuando aparece la rejilla | La caja tiene ya su alto: nada salta. Tampoco al cambiar de mes | ☐ |
| B6b | Tocar «Ver en dólares» | Las cifras ★ y la línea del precio base salen en dólares | ☐ |
| B6c | Ana libera uno de los días ocupados y cambia la ★ a `180000`. Daniel, **a los pocos segundos**, abre otra pestaña privada con el enlace (o recarga) | El día liberado ya no sale ocupado y la ★ dice «180k» | ☐ |
| B6d | Compartir el enlace en un chat de WhatsApp | La vista previa (foto, título y precio) se ve como antes | ☐ |

### Cerrar a consultas con fecha (pantalla 19)

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B7 | Ana: Mis casas → su casa → apagar «Disponible para consultas» | Sube la hoja «Cerrar a consultas» con «¿Cuándo vuelve a abrir? (opcional)», «Sin fecha, queda cerrada hasta que usted la abra.», «Cerrar a consultas» y «Cancelar». El interruptor aún no cambia | ☐ |
| B7a | «Cancelar» (y otra vez, tocando el fondo oscuro) | La hoja se cierra; la casa sigue abierta | ☐ |
| B7b | Apagar otra vez → la fecha de hoy → «Cerrar a consultas» | «La fecha de reapertura debe ser a partir de mañana y dentro de un año.» (si el selector deja elegirla) | ☐ |
| B7c | Elegir **mañana** → «Cerrar a consultas» | Interruptor apagado; debajo «Cerrada hasta el <mañana>». En Mis casas la píldora «No disponible». La fila «Calendario y precios» dice «<Mes>: N noches ocupadas» | ☐ |
| B8 | Ana: pestaña «Calendario» | «Esta casa está cerrada a consultas hasta el <mañana>. Ábrala para cambiar el calendario; sus noches y precios se conservan.» y «Abrir a consultas»; los días atenuados y sin poder tocarlos | ☐ |
| B9 | Daniel, a los pocos segundos, en una pestaña privada nueva: la ficha de la casa de Ana | Botón apagado «No disponible para consultas» con «Vuelve a estar disponible el <mañana>»; en «Disponibilidad», «Calendario cerrado» y la misma fecha (sin rejilla). La ficha se sigue viendo | ☐ |

### Reapertura a medianoche (se comprueba a la mañana siguiente)

La reapertura la hace el trabajo `bnbtico-reabrir-casas` a las **00:00 de Costa Rica** (06:00 UTC; en Vancouver, las 23:00 hasta el 1 de noviembre y las 22:00 después). No toque la casa entre B7c y B10.

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B10 | A la mañana siguiente, Ana: Mis casas → su casa | «Disponible para consultas» encendido, sin «Cerrada hasta…»; sin píldora «No disponible» en Mis casas | ☐ |
| B10a | Ana: Calendario | Editable otra vez, con **los mismos** días ocupados y la misma ★ de antes de cerrar | ☐ |
| B10b | Daniel, pestaña privada: la ficha | «Contactar por WhatsApp» activo; «Disponibilidad» con la rejilla, los ocupados y la ★ de antes | ☐ |
| B10c | Supabase → SQL Editor: `select status, return_message, start_time from cron.job_run_details where jobid = (select jobid from cron.job where jobname = 'bnbtico-reabrir-casas') order by start_time desc limit 3;` | La ejecución de esa noche, `succeeded`, hacia las 06:00 UTC | ☐ |

### Cerrar sin fecha y abrir a mano

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B11 | Ana: apagar el interruptor → sin fecha → «Cerrar a consultas» | «Cerrada a consultas». A la mañana siguiente sigue cerrada | ☐ |
| B11a | Encender el interruptor | Un toque, sin hoja; vuelve «Disponible para consultas». Daniel, al poco, ve «Contactar por WhatsApp» | ☐ |
| B11b | Cerrar con una fecha de dentro de varios días y, antes de esa fecha, «Abrir a consultas» desde el Calendario | Abierta al instante; la fecha se olvida (no vuelve a cerrarse ni a abrirse sola) | ☐ |

### App instalada y sin red

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B12 | App instalada (icono en inicio), con sesión de Ana: pestaña Calendario, cambiar de mes varias veces | Los meses cambian al instante, sin esperar a la red | ☐ |
| B12a | Cerrar la app; modo avión; abrir el Calendario | Se ve el calendario de la última vez | ☐ |

---

## C. Si algo falla

Mande por WhatsApp o en un issue de `.scratch/fase-4/` (uno por fallo):

1. El número del paso (p. ej. «B6c») y qué esperaba.
2. Captura de pantalla o grabación con la hora. Para B6c y B9: el dominio (`nueva.bnbtico.com` o `workers.dev`), cuántos segundos esperó y si recargó o abrió una pestaña nueva.
3. Teléfono, sistema y navegador (p. ej. «iPhone 15, iOS 26, Safari» o «Pixel 7, Chrome, app instalada») y si tenía red.
4. Si apareció un mensaje (en el panel del calendario, en la hoja o abajo como aviso), el texto exacto.
5. Para B10: la salida de la consulta de B10c y `select public_id, available, reopen_at from listings where public_id = 'CT-…';`. Para la purga: `select id, status_code, created from net._http_response order by id desc limit 5;` justo después de guardar.
6. Para errores de la app: `select build, message, count(*) from client_errors group by 1, 2 order by 3 desc limit 10;`. Para el despliegue: el enlace al run de GitHub Actions.
