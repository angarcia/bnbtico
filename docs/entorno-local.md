# Entorno de pruebas local

Guía para levantar 3bstays en su Mac y probarlo usted mismo, desde la terminal, sin Claude ni ningún servicio de pago. Todo corre en su ordenador:

- la base de datos es un Supabase local en Docker;
- los códigos de WhatsApp son fijos (`123456`) y no se envía nada;
- los avisos de WhatsApp y los pagos usan remitentes y pasarelas **falsos**;
- Turnstile usa la clave de prueba de Cloudflare, que siempre deja pasar.

Nada de lo que haga aquí toca `pruebas.3bstays.com`, el Supabase alojado ni a usuarios reales.

**Resumen:** en un Mac nuevo, haga una vez los pasos 1.1, 1.2, 1.4 y 1.6 (herramientas de Apple, Homebrew, Docker y descargar el código). Después, cada vez que quiera probar, basta con esto desde la carpeta `docs/` del proyecto (sección 2):

```bash
cd ~/3bstays/docs && ./preparar-entorno-local.sh
```

Y para pararlo todo al terminar: `./parar-entorno-local.sh`.

## 1. Preparación en un Mac nuevo (una sola vez)

**Gestión de calendarios (#7):** comprobación final local: tipos, 2258 unitarias, 8 DB de reserva/permisos, 23 E2E y tamaño correctos. El backend inicial pasó además sus 20 DB. Desde la copia actualizada de iCal, `bash .scratch/calendarios-externos/comprobar-reserva-07-backend.sh` prepara migraciones/tipos y contratos locales; `comprobar-cierre-reserva-07.sh` reúne la comprobación final, reutilizando el último build válido. Si cambia el código de app, ejecute de nuevo `pnpm --filter app build` antes del cierre para que E2E y tamaño midan esa versión. No hacen Git, despliegues, `--linked` ni start/reset/stop. No ejecutar los scripts `*-red.sh` como comprobación final: documentan la fase inicial que debía fallar. Contrato y evidencia: `.scratch/calendarios-externos/contrato-tecnico-07.md`, `plan-07.md` y `reservas-07.md`.

**Exportación iCal (#6):** `.scratch/calendarios-externos/comprobar-backend-06.sh` reúne pruebas unitarias/lector independiente, migración y tipos **locales**, typecheck y contratos/permisos contra Supabase local. Ana lo ejecuta desde Terminal; no usa `--linked`, ni start/reset/stop, ni despliega. Requiere el lector de pruebas `ical.js@2.2.1`, añadido como dependencia de desarrollo; no se importa en código de producción. Las suites nuevas rechazan URLs Supabase externas y limpian solo sus propias casas, conservando los datos de pruebas manuales. Backend validado localmente: 61 unitarias, tipos y 10 DB. La tarjeta aprobada supera build y los tres recorridos de `pnpm --filter app test:e2e ical-export.spec.ts` con el Chromium configurado; revisada visualmente a 375/390 px. Una URL localhost no se puede añadir en Airbnb real: esa comprobación necesita HTTPS público y ausencia de una barrera de Access en la ruta del feed.

**Pruebas de Airbnb (#5):** la primera conexión con un enlace real hace una lectura externa desde el worker. Para probar de forma reproducible sin Airbnb, use el arnés opt-in y la casa desechable de la sección IC01–IC13 de `docs/pruebas-manuales.md`. Aplica solo a Supabase local y no modifica conexiones reales. Antes, `pnpm db:al-dia` y `pnpm --filter app db:types`; estos comandos no requieren reiniciar ni resetear Supabase. Durante una reserva de la base compartida prevalecen sus restricciones: no ejecutar los comandos de start/reset/stop de las instrucciones generales de abajo.

La ruta `/api/calendarios/*` debe estar en `assets.run_worker_first` de `apps/app/wrangler.jsonc`: si falta, el servidor de assets rechaza el POST con 405 antes de llegar al importador. Después de cambiar esa configuración, reinicie `pnpm dev` si Vite no lo hace automáticamente; no hace falta reiniciar Supabase.

Esta sección parte de un Mac recién estrenado, sin nada instalado. Hágala una vez, en orden; tarda unos 30–45 minutos, casi todo descargas. Al final tendrá:

| Qué | Para qué |
| --- | --- |
| Herramientas de Apple (`git`) | descargar el código |
| Homebrew | instalar lo demás con un comando |
| Node 22 y pnpm 10 | ejecutar la app y sus pruebas (el proyecto **no funciona** con otras versiones de Node, ni más nuevas) |
| Docker Desktop | la base de datos local (Supabase) |
| Google Chrome | las pruebas automáticas |
| GitHub CLI (`gh`) | acceder al repositorio, que es privado |

Todos los comandos se escriben en la app **Terminal** (Aplicaciones → Utilidades → Terminal, o `Cmd+Espacio` y escriba «Terminal»). Copie cada bloque, péguelo y pulse Intro. Si pide la contraseña, es la de su usuario del Mac (no se ve al escribirla).

### 1.1 Herramientas de Apple

Abre una ventana; pulse «Instalar» y espere a que termine:

```bash
xcode-select --install
```

Si dice que ya están instaladas, siga.

### 1.2 Homebrew

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Al terminar, en un Mac con chip Apple (M1, M2…), deje `brew` disponible en cada terminal:

```bash
echo 'eval "$(/opt/homebrew/bin/brew shellenv)"' >> ~/.zprofile && eval "$(/opt/homebrew/bin/brew shellenv)"
```

(En un Mac con Intel no hace falta.) Compruebe que responde con un número de versión:

```bash
brew --version
```

### 1.3 Node 22 y pnpm

```bash
brew install node@22
```

Homebrew instala esta versión aparte («keg-only»). Enlácela para que `node` sea Node 22 en cualquier Terminal, sin editar ningún archivo:

```bash
brew link --overwrite --force node@22
```

Cierre la Terminal y abra una nueva.

Compruebe que dice `v22.` y algo más:

```bash
node -v
```

pnpm viene con Node a través de Corepack; actívelo:

```bash
corepack enable
```

La primera vez que use `pnpm` dentro del proyecto, Corepack preguntará si descarga pnpm 10.9.0: responda `Y`.

### 1.4 Docker Desktop

```bash
brew install --cask docker
```

Abra **Docker** desde Aplicaciones, acepte las condiciones y espere a que el icono de la ballena, arriba en la barra, deje de moverse. No hace falta crear cuenta («Skip»). En Docker → Settings → Resources, deje al menos **4 GB de memoria**.

Compruebe que Docker responde (sin error):

```bash
docker info --format '{{.ServerVersion}}'
```

Docker Desktop tiene que estar abierto cada vez que vaya a probar.

### 1.5 Google Chrome

Si no lo tiene ya:

```bash
brew install --cask google-chrome
```

### 1.6 Descargar el código

El repositorio es privado: necesita una cuenta de GitHub con acceso a `angarcia/3bstays` (pídale a Daniel que le invite).

```bash
brew install gh
```

Inicie sesión: elija «GitHub.com», «HTTPS», «Yes» a usar sus credenciales para git y «Login with a web browser»; copie el código que le muestra y péguelo en la página que se abre.

```bash
gh auth login
```

Descargue el proyecto en la carpeta `~/3bstays` y entre en la rama de trabajo:

```bash
gh repo clone angarcia/3bstays ~/3bstays
```

```bash
cd ~/3bstays && git checkout develop
```

### 1.7 Instalar las dependencias

Desde `~/3bstays`:

```bash
pnpm install --frozen-lockfile
```

### 1.8 Comprobación final

Los cuatro tienen que responder sin error: Node `v22.…`, pnpm `10.9.0`, una versión de Docker y una de Supabase.

```bash
node -v && pnpm -v && docker info --format '{{.ServerVersion}}' && pnpm exec supabase --version
```

Si alguno falla, vea la sección 8.

## 2. Todo con un comando

Con Homebrew, Docker Desktop y el repositorio ya instalados (pasos 1.1, 1.2, 1.4 y 1.6), un solo comando hace el resto: Node 22 y pnpm, dependencias, Supabase local, migraciones, las casas de prueba (5.1) y la app abierta en el navegador. Desde la carpeta `docs/`:

```bash
./preparar-entorno-local.sh
```

(o `docs/preparar-entorno-local.sh` desde la raíz). Al terminar, la Terminal muestra las cuentas de prueba y la app se abre en el navegador. La primera vez tarda unos minutos; después, menos de uno. Se puede repetir cuando quiera: salta lo que ya está hecho y vuelve a crear las casas de prueba. La app se queda corriendo en esa Terminal; se para con `Ctrl+C`.

Si el Mac ya tenía otro Node de Homebrew (la fórmula `node`), instalar `node@22` puede actualizar librerías que comparten y dejar ese otro Node sin arrancar. El script lo detecta y avisa; se repara con `brew upgrade node`.

Para pararlo todo al terminar (la app y Supabase; los datos se conservan), desde otra Terminal en `docs/`:

```bash
./parar-entorno-local.sh
```

Con `./parar-entorno-local.sh --docker` cierra también Docker Desktop. Se puede ejecutar aunque algo ya esté parado.

Lo que hace el script de arranque, paso a paso, es lo que explica la sección 3.

## 3. Arrancar a mano (cada vez que vaya a probar)

Abra Docker Desktop y, en la Terminal, entre en la carpeta del proyecto:

```bash
cd ~/3bstays
```

**Paso 1 — base de datos.** La primera vez tarda unos minutos porque descarga imágenes de Docker. Después tarda segundos. Si ya está arrancada, avisa y no pasa nada.

```bash
pnpm db:start
```

**Paso 2 — la app.** Pone la base al día con las migraciones (7), genera solo las variables locales (`apps/app/.env.local` y `apps/app/.dev.vars`) y arranca Vite con el worker en un único proceso. Deje esta terminal abierta; se para con `Ctrl+C`.

```bash
pnpm dev --port 5173 --strictPort --host 127.0.0.1
```

**Paso 3 — abrir en Chrome:**

| Dirección | Qué es |
| --- | --- |
| http://127.0.0.1:5173 | La app (Explorar). |
| http://127.0.0.1:5173/?pronto=1 | La portada estática («Pronto»). |
| http://127.0.0.1:5173/casa/CT-#### | Ficha de una casa (renderizada en el servidor). Ponga un número que exista: lo ve en la casa o en Studio, tabla `listings`, columna `public_id`. |
| http://127.0.0.1:54323 | **Supabase Studio**: ver y editar las tablas a mano. |

### Verlo como en el teléfono

La app es móvil primero. En Chrome:

1. Pulse `Cmd+Opción+I` para abrir DevTools.
2. Pulse `Cmd+Shift+M` para activar el modo dispositivo.
3. Arriba, elija **Pixel 7**, el mismo que usan las pruebas automáticas.
4. Para simular la red de Costa Rica: pestaña **Network** → «Slow 4G»; pestaña **Performance** → ⚙ → CPU «4× slowdown».

## 4. Cuentas de prueba

Al ingresar escriba el número **sin el +506**. El código siempre es **`123456`**.

**Para probar a mano**, use las cuentas de las casas de prueba (sección 5.1). Ninguna prueba automática las toca:

| Número | Quién | Qué tiene |
| --- | --- | --- |
| `8800 0001` | Marlen, anfitriona | 2 casas activas y 1 en revisión |
| `8800 0002` | Keilor, anfitrión | 1 activa, 1 inactiva, 1 con cambios pedidos y 1 borrador |
| `8800 0003` | Yendry, anfitriona | 2 activas (una en Guanacaste y una habitación) y 1 rechazada |
| `8800 0004` | Cliente | 2 casas en Favoritos |
| `8899 0001` | **Admin** | La cola de revisión (ver 5.3) |

Las pruebas automáticas usan además `8777 0001`, `8888 1234`, `8888 9999` y `+1 415 555 0100`, y **borran sus casas o la cuenta entera** al terminar. Sirven para un vistazo rápido, pero no guarde nada importante en ellas.

## 5. Llenar la base de datos

Una base local nueva (o recién reseteada) arranca **vacía**.

### 5.1 Casas de prueba con un comando

```bash
pnpm datos:prueba
```

Crea los anfitriones y el cliente de la tabla de arriba y **10 casas con fotos**, por el mismo camino que la app: el anfitrión crea la casa, sube las fotos y la envía, y el admin decide. Quedan:

- 5 activas: Cocles, Manzanillo, Playa Negra, Bribrí (habitación con baño compartido) y Tamarindo (Guanacaste, para ver que su provincia sale en los filtros);
- 1 inactiva (el anfitrión paró la suscripción), 1 en revisión, 1 con cambios pedidos, 1 rechazada y 1 borrador.

Tarda menos de un minuto. Se puede repetir cuando quiera: primero borra las casas de prueba anteriores y las vuelve a crear. Ejecútelo de nuevo después de `pnpm db:reset` o de `pnpm test:db`, que vacía **todas** las casas de la base.

Las fotos están en `supabase/datos-de-prueba/fotos/` (procedencia y licencias en `ATRIBUCIONES.md`). Puede cambiarlas por otras con el mismo nombre.

Si dice «No se pudo pedir el código», Supabase no conoce todavía los números nuevos: reinícielo una vez (los datos se conservan) y repita:

```bash
pnpm db:stop && pnpm db:start
```

### 5.2 Publicar una casa a mano

1. Ingrese con un anfitrión (`8800 0001`, por ejemplo).
2. Toque «Publicar casa» y complete los pasos. En las fotos, sirve cualquier imagen del Mac.
3. Al enviar, la casa queda **Pendiente de revisión**.

### 5.3 Hacer admin a `8899 0001` (una vez)

Si ejecutó `pnpm datos:prueba`, ya es admin: pase al paso 3. Si no:

1. Ingrese en la app con `8899 0001` y código `123456`, para que exista el usuario.
2. Ejecute en la terminal:

```bash
docker exec -i supabase_db_bnbtico psql -U postgres -c "select seed_admin('+50688990001');"
```

3. Cierre sesión y vuelva a ingresar. En **Cuenta** aparece «Revisión de anuncios · admin».
4. La primera vez le pide vincular una **app de autenticación** (Google Authenticator, 1Password…). Escanee el QR con el teléfono y escriba el código de 6 dígitos. Las siguientes veces solo le pide el código.

Si el segundo código deja de valer (por ejemplo, después de pasar las pruebas automáticas), borre el factor y vuelva a vincularlo:

```bash
docker exec -i supabase_db_bnbtico psql -U postgres -c "delete from auth.mfa_factors where user_id = (select id from profiles where phone = '+50688990001');"
```

### 5.4 Aprobar una casa

Como admin: **Anuncios** → toque la casa → «Aprobar y publicar». Con la promoción de lanzamiento, la casa pasa directamente a **Activa** y ya sale en Explorar y en su ficha `/casa/CT-####`.

Para recorridos completos (cliente, anfitrión, admin), siga `docs/pruebas-manuales.md`. Está escrita para `pruebas.3bstays.com`, pero en local vale igual: cambie la dirección por `http://127.0.0.1:5173`.

## 6. Pruebas automáticas

Todas se ejecutan desde la raíz del repositorio, con Node 22.

| Comando | Qué comprueba | Necesita | Tiempo aprox. |
| --- | --- | --- | --- |
| `pnpm typecheck` | Tipos de TypeScript | — | < 1 min |
| `pnpm test` | Lógica (Vitest) | — | < 1 min |
| `pnpm test:prototype` | Prototipo HTML | — | segundos |
| `pnpm test:db` | Reglas de la base (RLS, RPCs) | `pnpm db:start` | 1–3 min |
| `pnpm build` | Compila la app | — | < 1 min |
| `pnpm size` | Peso del JS frente al presupuesto | `pnpm build` | segundos |
| `pnpm test:e2e` | Flujos en un móvil simulado (Playwright) | `pnpm db:start` y `pnpm build` | 10–20 min |
| `pnpm lighthouse` | Velocidad (ficha y app instalada) | `pnpm db:start` y `pnpm build`, sin nada más abierto | varios min |

Antes de subir un cambio, lo mínimo es:

```bash
pnpm typecheck && pnpm test
```

Las E2E, siempre después de un build y con su Chrome:

```bash
pnpm build && CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm test:e2e
```

Una sola prueba E2E (más rápido):

```bash
CHROMIUM_PATH="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" pnpm test:e2e explorar.spec.ts
```

Informe de la última ejecución E2E, con capturas y trazas de lo que falló:

```bash
pnpm --filter app exec playwright show-report
```

Avisos:

- `test:db` y `test:e2e` escriben y borran datos de las cuentas de prueba en su base local. No las ejecute mientras está probando a mano con esas cuentas.
- Las E2E usan el puerto 4173. Si está ocupado: `E2E_PORT=4174 pnpm test:e2e`.

## 7. Mantenimiento

**Después de cada `git pull`**, ponga al día las dependencias. Si alguien añadió una, sin esto fallan las pruebas con `Cannot find package …`:

```bash
pnpm install --frozen-lockfile
```

**La base local se pone al día sola.** El esquema sale solo de `supabase/migrations/`. `pnpm dev`, `pnpm test:e2e`, `pnpm test:db`, `pnpm datos:prueba` y `preparar-entorno-local.sh` aplican antes las migraciones que falten. Eso incluye las que llegan con fecha anterior a otra ya aplicada, algo que pasa al juntar ramas. Sin migraciones nuevas no hacen nada. Para hacerlo a mano, por ejemplo después de un `git pull`:

```bash
pnpm db:al-dia
```

Si dice que la base tiene migraciones que no están en `supabase/migrations/` (pasa si renombró o rehízo una migración suya, o si viene de otra rama), su esquema ya no es el del repositorio. Déjela igual que el repositorio. Esto borra usuarios, casas y fotos locales y vuelve a crear las casas de prueba:

```bash
pnpm db:al-dia --reset
```

**Empezar de cero.** Borra **todo** (usuarios, casas, fotos) y vuelve a aplicar las migraciones. Después repita 4.2.

```bash
pnpm db:reset
```

**Parar Supabase** al terminar el día, para liberar memoria (los datos se conservan). `docs/parar-entorno-local.sh` para además la app; a mano:

```bash
pnpm db:stop
```

## 8. Problemas frecuentes

| Síntoma | Causa y solución |
| --- | --- |
| `permission denied: ./preparar-entorno-local.sh` | El archivo perdió el permiso de ejecución. Láncelo con `bash preparar-entorno-local.sh`, o devuélvaselo una vez con `chmod +x preparar-entorno-local.sh`. |
| `no such file or directory: ./preparar-entorno-local.sh` | No está en la carpeta `docs/`. Entre con `cd ~/3bstays/docs` y repita. |
| El script se para con «✗ …» | El mensaje dice qué falta y en qué paso de esta guía se arregla. Arréglelo y vuelva a lanzarlo: lo ya hecho se salta. |
| `brew: command not found` | Falta el paso de `shellenv` de 1.2. Ejecútelo y abra una Terminal nueva. |
| `node -v` no dice `v22.…`, o `Unexpected module status` y errores raros de Vite o Vitest | Node equivocado. Repita `brew link --overwrite --force node@22` (1.3) y abra una Terminal nueva. Si había otro Node de Homebrew enlazado, antes: `brew unlink node`. |
| Tras pegar un comando en `~/.zprofile`, ninguna orden funciona (`command not found`) o aparecen caracteres raros | Se añadió texto roto al final de `~/.zprofile`. En esa Terminal: `eval "$(/usr/libexec/path_helper -s)"`; copia con `/bin/cp ~/.zprofile ~/.zprofile.bak`; vea las líneas con `/bin/cat -n -v ~/.zprofile`; borre desde la primera línea rota (N) hasta el final con `/usr/bin/sed -i '' 'N,$d' ~/.zprofile` y abra una Terminal nueva. |
| `pnpm: command not found` | Ejecute `corepack enable` (1.3). Si falla, instale pnpm con npm: `npm install -g pnpm@10.9.0`. |
| `Repository not found` al clonar | Su cuenta de GitHub no tiene acceso al repositorio, o `gh auth login` no terminó. |
| Las pruebas fallan tras un `git pull` o al juntar ramas (funciones o columnas que «no existen») | La base local tenía un esquema viejo. `pnpm db:al-dia` la pone al día; si dice que tiene migraciones que no están en el repositorio, `pnpm db:al-dia --reset` (sección 7). |
| `Supabase local no está arrancado: pnpm db:start` | Ejecute `pnpm db:start`. Si falla, abra Docker Desktop. |
| `Cannot connect to the Docker daemon` | Docker Desktop está cerrado. Ábralo y espere a que arranque. |
| `Port 5173 is in use` | Hay otra app corriendo. Ciérrela, o cierre la terminal donde la dejó abierta. |
| `Cannot find package '…'` en las pruebas | Faltan dependencias: `pnpm install --frozen-lockfile`. |
| `pnpm typecheck` falla en un archivo que no está en git | TypeScript revisa también archivos locales que no se suben (por ejemplo, scripts de capturas en `tests/capturas/`). No es un fallo del proyecto: en CI no existen. Arréglelos o apártelos de la carpeta. |
| El código `123456` no funciona | Revise que el número sea uno de la tabla de la sección 4. Con otros números no llega ningún código. |
| La app muestra datos viejos | Es la caché offline. En DevTools: **Application** → «Clear site data» y recargue. |
| No sale ninguna casa en Explorar | La base está vacía o la casa no está aprobada. Siga la sección 5. |

## 9. El prototipo (referencia de diseño)

No necesita Supabase:

```bash
python3 -m http.server 8765 --bind 127.0.0.1 --directory design/prototype
```

Abra http://127.0.0.1:8765/casatica-prototipo.html y elija la vista **Móvil**.
