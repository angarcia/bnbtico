# Plan de pruebas manual · fase R en nueva.bnbtico.com

Fecha: 2026-10-23 (tickets 01–12). Entorno: `https://nueva.bnbtico.com` (rama `develop`, worker `bnbtico-pruebas` en Cloudflare, Supabase `bnbtico-pruebas`). Sustituye a `docs/pruebas-manuales-fase-2.md` para la app nueva. Se ejecuta **de una vez, desde el teléfono**, después de desplegar. Marque cada casilla y, si algo falla, anote el número del paso (ver C).

La parte A es para hacer antes, en orden. Cada acción dice si **bloquea** algo:

- **despliegue**: sin ella el workflow no despliega o despliega algo roto.
- **pruebas**: el despliegue sale, pero algún recorrido de B falla hasta hacerla.
- **no**: se puede dejar para después (lo dice el paso).

---

## A. Acciones previas (Daniel)

### A1. Migraciones en `bnbtico-pruebas` · bloquea: pruebas

En el alojado están aplicadas hasta `20261023051419_cliente_directo`. Faltan, en este orden:

1. `20261023070407_listings_alta_segura.sql` (una casa nueva nace como borrador, con el WhatsApp del perfil)
2. `20261023073359_cliente_directo_fotos.sql` (RPCs de fotos, tope de 15 fotos y de 5 borradores, política de Storage)
3. `20261023075549_admin_aal2_y_purga.sql` (admin solo con segundo código; `pg_net` y purga de la ficha)
4. `20261023084120_telemetria.sql` (tablas `web_vitals`, `client_errors`, `events`)

Desde la raíz del repo, en `develop` al día: `pnpm exec supabase migration list` (comprobar que esas cuatro salen solo en «Local») y `pnpm exec supabase db push`.

**Efecto sobre la app vieja (`pruebas.bnbtico.com`, Vercel):** desde la 3, **el admin de la app vieja ya no puede revisar** (no pide segundo código). Se revisa solo desde `nueva.bnbtico.com`. Lo demás de la app vieja sigue funcionando.

### A2. Segundo código por teléfono (MFA) · bloquea: pruebas (admin)

Supabase → proyecto `bnbtico-pruebas` → **Authentication → Multi-Factor** (en algunos paneles: Sign In / Providers → Multi-Factor) → **Phone**: activar **«Enroll»** y **«Verify»** → Save. Usa el proveedor de teléfono ya configurado (Twilio Verify). La app pide el código por el canal `whatsapp`.

**Importante: el admin de prueba `8899 0001` no sirve en el alojado para el segundo código.** Los códigos fijos (`123456`) solo valen para ingresar; el segundo código lo genera Supabase y Twilio lo **envía de verdad** al número del admin, que no es suyo (y cuesta). Use como admin su propia cuenta con su WhatsApp real: créela en B6 y, justo después, en el SQL Editor `select seed_admin('+506XXXXXXXX');` (su número con `+506`, como en `profiles.phone`). Si su número no es de Costa Rica, ponga el prefijo que corresponda. Opcional: quitarle el admin a la cuenta de prueba con `update profiles set is_admin = false where phone = '+50688990001';`.

### A3. Secretos de Vault para la purga de la ficha · bloquea: pruebas (B12, ficha actualizada en segundos)

Supabase → SQL Editor, dos sentencias:

```sql
select vault.create_secret('https://nueva.bnbtico.com', 'worker_purge_url');
select vault.create_secret('<el mismo valor que el secreto PURGE_SECRET de GitHub>', 'worker_purge_secret');
```

Comprobar también que en GitHub (Settings → Secrets and variables → Actions) existen los secretos `PURGE_SECRET`, `CLOUDFLARE_ZONE_ID` y `CLOUDFLARE_PURGE_TOKEN` (token con permiso «Zone → Cache Purge» en `bnbtico.com`). Sin ellos el worker responde 503 a la purga y la ficha tarda hasta 24 h (o el siguiente despliegue) en reflejar un cambio. Al cortar a producción: `select vault.update_secret((select id from vault.secrets where name = 'worker_purge_url'), 'https://bnbtico.com');`.

### A4. Cloudflare Access: rutas sin PIN · bloquea: pruebas (B1, B12)

Cloudflare → Zero Trust → Access → Applications → la aplicación de `nueva.bnbtico.com`. Añadir (o comprobar) aplicaciones o reglas **Bypass · Everyone** para:

- `nueva.bnbtico.com/casa/*` (ficha pública y vista previa de WhatsApp; pendiente desde el ticket 03).
- `nueva.bnbtico.com/_purge/*` (lo llama Postgres con `pg_net`; el endpoint ya exige el secreto).
- Opcional: `nueva.bnbtico.com/sw.js` y `nueva.bnbtico.com/manifest.webmanifest`. Si la sesión de Access caduca, Access intercepta estos dos y el registro del service worker falla en silencio (la app sigue). Recomendado para B19–B20.

Pendiente aparte (ticket 01): la URL `*.workers.dev` y las de vista previa no pasan por Access. Worker → Settings → Domains & Routes → desactivar `workers.dev` y «Preview URLs», o «Enable Access» ahí.

### A5. Turnstile · bloquea: no (pero el orden importa)

1. Cloudflare → **Turnstile → Add widget**: nombre `bnbtico`, dominios `nueva.bnbtico.com` (y `bnbtico.com` al cortar), modo **Managed**. Guarde la sitekey y la secret key.
2. GitHub → Settings → Secrets and variables → Actions: `TURNSTILE_SITE_KEY` = la **sitekey** (variable o secreto: el workflow acepta los dos).
3. Desplegar (push a `develop` o «Re-run» del último workflow `app` de `develop`).
4. Solo después: Supabase → **Authentication → Attack Protection** (o «Bot and Abuse Protection») → **Enable Captcha protection**, proveedor **Turnstile**, con la **secret key** → Save.

Si se hace el 4 antes del 3, nadie puede pedir códigos en la app nueva. **Efecto sobre la app vieja:** desde el 4, `pruebas.bnbtico.com` **ya no puede enviar códigos** (no manda token). Hágalo cuando ya solo se pruebe `nueva.bnbtico.com`.

### A6. Números de atención por WhatsApp · bloquea: no

GitHub → Secrets and variables → Actions: `WA_OWNERS` (línea de propietarios) y `WA_GUESTS` (línea de clientes), en formato `50688887777` (variable o secreto). Desplegar. Sin ellos, «Ayuda por WhatsApp» muestra el botón deshabilitado.

### A7. Telemetría: clave de servicio del worker · bloquea: no (pero B23 falla sin ella)

Comprobar que existe el secreto de GitHub `SUPABASE_SERVICE_ROLE_KEY` (la service role de `bnbtico-pruebas`). El workflow la sube al worker; sin ella las balizas se descartan sin error.

### A8. Filas por petición · bloquea: no

Supabase → **Project Settings → Data API → Max rows** = `200` → Save.

### A9. Alerta de gasto en Twilio · bloquea: no

Twilio Console → Billing → **Usage Triggers** (o alertas de gasto): por ejemplo 20 USD al mes, aviso por correo.

### A10. Copia diaria a R2 · bloquea: no

1. Cloudflare → **R2 → Create bucket** `bnbtico-copias` (privado). Opcional: Settings → Object lifecycle rules → borrar a los 31 días.
2. R2 → **Manage API tokens → Create API token**: «Object Read & Write», solo ese bucket. Anote Access Key ID y Secret Access Key.
3. GitHub → Secrets: `SUPABASE_DB_URL` (Supabase → Connect → **Session pooler**, `postgresql://postgres.<ref>:<contraseña>@aws-0-<región>.pooler.supabase.com:5432/postgres`), `R2_ACCOUNT_ID` (id de la cuenta de Cloudflare), `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`. Opcionales (variable o secreto): `R2_BUCKET` (por defecto `bnbtico-copias`), `BACKUP_PREFIX` (por defecto `bnbtico-pruebas`).
4. La ejecución manual va en B24.

### A11. Desplegar · bloquea: despliegue

Push a `develop` con todo lo anterior hecho (o «Re-run» del último workflow). El workflow ahora tiene una **puerta de Lighthouse** antes del despliegue (LCP de la ficha < 2,0 s y del shell instalado < 2,5 s en el runner). Si falla, no se despliega: la tabla está en el resumen del job y los informes en el artefacto «lighthouse».

---

## B. Recorridos

Números de prueba con código `123456` para ingresar (no se envía nada): `8888 1234` (cliente), `8777 0001` (propietaria «Yorleny Prueba», dueña de CT-1015), `8888 9999` (libre). Para el registro (B6) use **su propio WhatsApp**; esa cuenta será también el **admin** (ver A2). Conviene un segundo teléfono o una pestaña privada para separar propietaria y admin.

Copy que debe verse en toda la app: trato de usted, precios en colones `₡95 000`, nada de «Identidad», «Mensual» en vez de «Largo plazo».

### Ficha pública y WhatsApp (sin sesión)

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B1 | En una pestaña privada (sin sesión de Access) abrir `https://nueva.bnbtico.com/casa/CT-1015` | Ficha sin pedir PIN: fotos (la primera aparece enseguida), título, precio en colones, mapa aproximado tras un momento, «Contactar por WhatsApp» (deshabilitado en esta fase) | ☐ |
| B2 | Mandarse por WhatsApp el enlace `https://nueva.bnbtico.com/casa/CT-1015` | La vista previa muestra **la foto de portada y el título** de la casa | ☐ |
| B3 | Abrir `https://nueva.bnbtico.com/casa/CT-999999` | «Este enlace no existe» | ☐ |
| B4 | En la ficha, tocar el precio («Ver en dólares») | Precio en dólares; tocar otra vez vuelve a colones. Al recargar recuerda la elección | ☐ |

### Explorar, Filtros y moneda

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B5a | Abrir `https://nueva.bnbtico.com/` (pasa el PIN de Access) | Explorar «¿Para dónde va?», arranca en Limón, CT-1015 en la lista con su foto | ☐ |
| B5b | «Más filtros» | Filtros: en Zona solo provincias con casas; «Ver N casas» cuenta en vivo al tocar Piscina, Personas o precio | ☐ |
| B5c | Precio mínimo mayor que el máximo → «Ver N casas» | Se intercambian solos; vuelve a Explorar con chips y la URL lo refleja; «Limpiar» los quita | ☐ |
| B5d | Cambiar a dólares en una tarjeta, entrar a la ficha | La ficha también en dólares (preferencia compartida) | ☐ |

### Cuenta

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B6 | Mi cuenta → «Crear una cuenta»: su nombre y **su WhatsApp real** → «Recibir código por WhatsApp» | Llega un WhatsApp con el código (Twilio Verify, canal whatsapp). Pantalla «Introduzca el código». Si activó Turnstile, puede aparecer la casilla de Cloudflare | ☐ |
| B7 | Código erróneo, luego el bueno → «Verificar y continuar» | Error «Ese código no es correcto o caducó.»; con el bueno «¡Listo! Su cuenta está creada». Ahora márquela como admin (A2, `seed_admin`) | ☐ |
| B8 | Cerrar la app/pestaña del todo y volver a abrir `nueva.bnbtico.com/cuenta` | Sigue con la sesión (Mi cuenta con su nombre) | ☐ |
| B9 | «Cerrar sesión» | Vuelve a Ingresar («Su nombre y su WhatsApp. Nada más.») y la barra en modo cliente | ☐ |
| B10 | «Ya tengo cuenta · entrar con mi WhatsApp» con `8888 9999` | Aviso de que no hay cuenta con ese número | ☐ |

### Propietaria: publicar (teléfono con `8777 0001`)

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B11a | Entrar con `8777 0001` → «Publicar mi casa» | Modo propietario: barra Inicio, Mis casas, Calendario, Consultas, Cuenta; Inicio con su casa CT-1015 | ☐ |
| B11b | Inicio → «Publicar casa» (si ofrece «Tiene un borrador sin enviar», «Empezar otro») | «Paso 1 de 9». Recorra las nueve pantallas: tipo y modalidad, dónde, mapa (pin arrastrable, «Usar mi ubicación»), capacidad, características, nombre y descripción, fotos, precios, revisión. Ninguna pantalla necesita scroll con el teclado cerrado; con teclado, el campo activo queda visible | ☐ |
| B11c | Paso 7: «Añadir fotos» con 5–6 fotos reales del carrete, **incluida una HEIC** si es iPhone | Cada foto muestra su progreso y aparece en la rejilla. La HEIC llega convertida (iPhone) o sale «Ese formato no se puede subir. Use JPG o PNG.» (Android con HEIC). Tocar una foto → «Hacer portada», «Después →», «Quitar foto n» funcionan | ☐ |
| B11d | En el paso 5 o 6, cerrar la app del todo; volver a abrir → Inicio → «Publicar casa» | «Tiene un borrador sin enviar» → «Seguir con el borrador» retoma lo escrito y las fotos | ☐ |
| B11e | Terminar y «Enviar a revisión» | Pantalla «Enviada»; en Mis casas la casa «en revisión» | ☐ |
| B11f | Empezar otra casa, rellenar el paso 1 y volver; en Mis casas, «Descartar» ese borrador | Confirma «¿Descartar este borrador? No se puede deshacer.» y desaparece | ☐ |

### Admin (su cuenta real marcada como admin, en una pestaña privada o un segundo teléfono)

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B12a | Entrar con su WhatsApp real → Mi cuenta → «Revisión de anuncios · admin» | Pantalla «Confirme que es usted» con su número; llega un **segundo código por WhatsApp** (distinto del de ingresar) | ☐ |
| B12b | Código bueno → «Verificar y entrar» | Cola «Anuncios»: la casa de B11e en «Por revisar» como «Nueva» | ☐ |
| B12c | Abrirla → «Aprobar y publicar» | Vuelve a la cola sin la casa al instante y «Aprobada y publicada». En otro teléfono, su ficha `/casa/CT-…` se ve activa | ☐ |
| B12d | **Purga:** en el detalle de la propietaria, apagar «Disponible para consultas» de CT-1015; abrir la ficha en otro dispositivo a los pocos segundos | La ficha refleja el cambio en segundos (sin esperar 24 h). Si no: en el SQL Editor `select status_code, content from net._http_response order by id desc limit 5;` dice qué respondió el worker | ☐ |
| B12e | Volver a encender «Disponible para consultas» | La ficha vuelve a estar disponible | ☐ |

### Pedir cambios y corregir

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B13 | Propietaria: enviar otra casa (o reutilizar el borrador). Admin: abrirla, escribir un motivo → «Pedir cambios» | Sin motivo: «Escriba un motivo de hasta 2000 caracteres…». Con motivo: pasa a «Cambios pedidos» | ☐ |
| B14 | Propietaria: Mis casas | La casa con «Le pedimos cambios» y el motivo; «Corregir y reenviar» abre el asistente relleno; corregir y enviar | ☐ |
| B15 | Admin: la cola | La casa vuelve como «Corregida» | ☐ |
| B16 | Propietaria: casa activa → editar | Confirma «Su casa dejará de verse mientras la revisamos. ¿Quiere editarla?»; al aceptar, la ficha pública deja de funcionar («Este enlace ya no está activo») | ☐ |

### App instalada y sin red

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B17 | Chrome Android: menú → «Instalar app». iPhone (Safari): Compartir → «Agregar a inicio» | Icono terracota; abre a pantalla completa en Explorar | ☐ |
| B18 | Abrir la app instalada una vez con red; cerrarla; **modo avión**; abrirla | Abre Explorar con las casas de la última vez; tocar una tarjeta muestra la ficha; Mi cuenta abre | ☐ |
| B19 | Aún sin red, propietaria → detalle de una casa activa → tocar «Disponible para consultas» | «Sin conexión. Revise su internet e intente de nuevo.» y el interruptor vuelve a su sitio. Con red de nuevo, nada cambió en la base | ☐ |
| B20 | Hacer un segundo despliegue (cualquier push a `develop`); con la app abierta, salir y volver a ella | Aviso «Hay una versión nueva · Actualizar» (no aparece dentro del asistente). «Actualizar» recarga y el aviso desaparece | ☐ |

### Telemetría y copia

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B21 | Tras navegar un rato, SQL Editor: `select name, count(*) from web_vitals group by 1; select name, count(*) from events group by 1;` | Filas de LCP/INP/CLS/FCP/TTFB y de `page_view`/`listing_view` con `country = 'CA'` (o el país desde el que pruebe) | ☐ |
| B22 | `select build, message, count(*) from client_errors group by 1, 2 order by 3 desc limit 10;` | Vacío o errores conocidos; anote los que salgan | ☐ |
| B23 | Al día siguiente (el cron corre a las 03:17 de Costa Rica): Cloudflare → Workers → `bnbtico-pruebas` → Logs | Una línea `{"event":"keepalive","ok":true,...}` | ☐ |
| B24 | GitHub → Actions → **copia** → «Run workflow» (rama `develop`) | Job verde; resumen «Copia bnbtico-pruebas-AAAA-MM-DD.dump: … bytes, N tablas con datos»; el archivo está en R2 → `bnbtico-copias/bnbtico-pruebas/` | ☐ |

---

## C. Si algo falla

Mande por WhatsApp o en un issue de `.scratch/fase-r/` (uno por fallo):

1. El número del paso (p. ej. «B11c») y qué esperaba.
2. Captura de pantalla o grabación, con la hora.
3. Teléfono y navegador (p. ej. «iPhone 15, Safari» o «Pixel 7, Chrome, app instalada»), y si tenía red.
4. Para B12d: la salida de `net._http_response`. Para errores de la app: la consulta de B22. Para el despliegue: el enlace al run de GitHub Actions.
5. Si el fallo es de un número que no recibe código: Twilio Console → Monitor → Logs → Verify, con el estado del envío.
