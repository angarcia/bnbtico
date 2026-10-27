# Plan de pruebas manual · fase 3 (contacto por WhatsApp) en nueva.bnbtico.com

Fecha: 2026-10-23, revisado el 2026-10-24 tras aplicar la migración y subir `develop` (tickets 01–06 y 08 de `.scratch/fase-3/`; el 07, WhatsApp distinto por casa, está aplazado y no se prueba: cada casa usa el WhatsApp de la cuenta de su propietario). Entorno: `https://nueva.bnbtico.com` (rama `develop`, worker `bnbtico-pruebas` en Cloudflare, Supabase `bnbtico-pruebas`). Desde la red corporativa, donde `nueva.bnbtico.com` no carga, use `https://bnbtico-pruebas.ana-garcia-saiz.workers.dev` (mismo worker y misma base; no pasa por Access). Se ejecuta **desde el teléfono**, con un iPhone y un Android si es posible, después de desplegar. Complementa a `docs/pruebas-manuales-fase-r.md` (lo de la fase R no se repite aquí). Marque cada casilla y, si algo falla, anote el número del paso (ver C).

La parte A va antes, **una acción cada vez y en este orden**.

---

## A. Acciones previas (Daniel)

### A1. Migración `fase3_consultas` en `bnbtico-pruebas` · bloquea: pruebas · ✅ hecho el 2026-10-24

En el alojado están aplicadas hasta `20261023164211_admin_totp_correo` (fase R). Falta una, aditiva:

- `20261023230813_fase3_consultas.sql`: columnas nuevas de `inquiries` (número de destino, `updated_at`, `owner_opened_at`, `source`), RPCs `create_inquiry`, `mark_inquiry_opened` y `owner_inquiries`, `inquiries` cerrada a escrituras directas, políticas nuevas de `favorites` (solo casas publicadas) y el evento `inquiry_created` en la telemetría.

Desde la raíz del repo, en `develop` al día:

1. `pnpm exec supabase migration list` → `20261023230813` debe salir solo en «Local».
2. `pnpm exec supabase db push` → aplica solo esa.
3. Comprobar en Supabase → **Database → Functions** que existen `create_inquiry`, `mark_inquiry_opened` y `owner_inquiries`.

**Efecto sobre la app vieja (`pruebas.bnbtico.com`):** ninguno (no usa `inquiries` ni `favorites`).
**Si se despliega sin ella:** la ficha y los favoritos sin cuenta funcionan, pero con sesión «Abrir WhatsApp» falla y Mis consultas no carga.

### A2. Desplegar · bloquea: despliegue · ✅ `develop` subido el 2026-10-24 (falta ver el run del workflow `app` en verde)

Después de A1: `git push origin develop` (la rama lleva los commits de la fase 3). El workflow `app` pasa las pruebas y la puerta de Lighthouse y despliega en `nueva.bnbtico.com`. Comprobar que el run está verde en GitHub → Actions.

### A3. Quién hace de quién · bloquea: no (pero B6 y B7 lo necesitan)

Para ver WhatsApp abrirse **con un chat de verdad** hacen falta dos números reales:

- **Propietaria real: Ana** (`+1 778 347 8492`, número de prueba con código `123456`). Publica una casa con su cuenta (B0) para que el número de esa casa sea su WhatsApp.
- **Cliente real: Daniel** (`+1 778 347 9837`). Contacta la casa de Ana. Es además el caso de «número de otro país».

Con los números ficticios (`8888 1234` cliente, `8777 0001` propietaria de CT-1015, `8888 9999` libre) todo se puede probar igual, pero WhatsApp dirá que el número no está en WhatsApp: sirve para comprobar que se abre con el número y el mensaje correctos, no para chatear.

---

## B. Recorridos

Copy que debe verse: trato de usted, nada de «Identidad», fechas como «del 20 al 27 de diciembre». En la hoja, la nota ocre «Por su seguridad, nunca envíe dinero antes de confirmar la casa. bnbtico no procesa ni pide pagos.».

### Preparación

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B0 | Ana: entrar con su número → «Publicar mi casa» → publicar una casa corta (5 fotos). Daniel (admin): aprobarla | La casa de Ana activa, con su `CT-…`. Anote el enlace | ☐ |

### Hoja de contacto (sin sesión)

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B1 | En una pestaña privada (sin sesión de bnbtico), abrir el enlace de la casa de Ana | Ficha; el botón verde «Contactar por WhatsApp» aparece un instante apagado y enseguida activo, sin que la barra de abajo salte | ☐ |
| B2 | Tocar «Contactar por WhatsApp» | Sube la hoja «Escríbale a Ana» con Llegada, Salida, Personas, «Su mensaje» ya escrito («Hola, vi <casa> en bnbtico y me interesa. ¿Está disponible? Gracias.»), la nota ocre, «Ana verá su nombre y su WhatsApp.» y «Para escribirle necesita verificar su WhatsApp con un código. Lo que escribió se guarda.» | ☐ |
| B2a | Elegir llegada y salida y escribir 4 personas | El mensaje se reescribe solo: «¿Está disponible del … al … para 4 personas?» | ☐ |
| B2a2 | Cambiar a llegada 28 de diciembre y salida 2 de enero | «¿Está disponible del 28 de diciembre al 2 de enero para 4 personas?» | ☐ |
| B2a3 | Borrar las fechas y poner 1 persona | «¿Está disponible para 1 persona?» (singular) | ☐ |
| B2b | Tocar el mensaje y cambiar una palabra; luego cambiar la salida | El texto editado se queda (ya no se reescribe) | ☐ |
| B2c | Con el teclado abierto en el mensaje o en Personas (iPhone y Android) | El campo queda visible encima del teclado; «Abrir WhatsApp» no se mueve bajo el dedo al cerrar el teclado | ☐ |
| B2d | Poner una salida anterior a la llegada → «Abrir WhatsApp» | «La salida tiene que ser después de la llegada.» y no sale de la hoja | ☐ |
| B2d2 | Poner solo la llegada, sin salida → «Abrir WhatsApp» | «Indique la llegada y la salida, o deje las dos vacías.» | ☐ |
| B2d3 | Poner una llegada anterior a hoy → «Abrir WhatsApp» | «La llegada no puede ser antes de hoy.» | ☐ |
| B2d4 | Borrar todo el mensaje → «Abrir WhatsApp» | «Escriba un mensaje para el propietario.» | ☐ |
| B2e | Cerrar la hoja (fondo, «Cerrar» o atrás en Android) y volver a abrirla | Lo escrito sigue ahí (dura 30 minutos en la pestaña) | ☐ |

### Cuenta obligatoria y vuelta a la hoja

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B3 | Con fechas válidas → «Abrir WhatsApp» | Pantalla de cuenta con la tarjeta «Después de verificar vuelve a <casa> con su consulta tal como la dejó.» y la foto | ☐ |
| B3a | (Desde 2026-10-26 no hay «Ya tengo cuenta»: un único flujo, primero el número) País **Estados Unidos/Canadá (+1)** → `778 347 9837` (Daniel) → código `123456` | Vuelve a la ficha **con la hoja abierta** y lo mismo escrito (fechas, personas y el texto editado); ya sin el aviso del código | ☐ |
| B3b | Repetir B1–B3 en otra pestaña privada, pero con un número de prueba libre (`8888 9999`): tras el número pide el nombre («Es su primera vez en bnbtico»); luego «Ahora no · continuar» | Tras «¡Listo! Su cuenta está creada» vuelve a la hoja con lo escrito. (Cierre esa pestaña sin enviar) | ☐ |

### Abrir WhatsApp de verdad y volver

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B4 | iPhone (Safari), con la hoja de B3a: «Abrir WhatsApp» | El botón dice «Abriendo WhatsApp…» al instante; se abre la app de WhatsApp en el chat con **Ana** y el mensaje escrito en la caja, listo para enviar (no se envía solo). Envíelo | ☐ |
| B4a | Volver a Safari (barra superior «◀ Safari» o cambiando de app) | La ficha **sin la hoja** (lo escrito se borró al salir). Ningún aviso de error | ☐ |
| B4b | Android (Chrome), con Daniel u otro número: contactar otra vez la casa de Ana | Igual que B4: WhatsApp con el chat de Ana y el texto. Volver con el botón atrás → la ficha sin la hoja | ☐ |
| B4c | Contactar CT-1015 (propietaria ficticia `8777 0001`) | WhatsApp se abre con `+506 8777 0001` y el mensaje; WhatsApp avisa de que ese número no está en WhatsApp (esperado) | ☐ |
| B4d | Repetir el contacto a la casa de Ana con otro mensaje el mismo día | Abre WhatsApp igual; en Mis consultas de Ana sigue habiendo **una** consulta de Daniel para esa casa, con el mensaje nuevo y otra vez «Nueva» | ☐ |

### App instalada

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B5 | Con la app instalada (icono en inicio, fase R B17) y sesión: Explorar → casa de Ana → «Contactar por WhatsApp» → «Abrir WhatsApp» | Se abre la app de WhatsApp (no una pestaña dentro de la app instalada) con el chat y el mensaje | ☐ |
| B5a | Volver a bnbtico desde el selector de apps | La app instalada en la ficha, sin la hoja; la barra de abajo y el resto funcionan | ☐ |
| B5b | Sin sesión en la app instalada: «Abrir WhatsApp» → código → vuelta | Vuelve a la hoja dentro de la app instalada (no en el navegador) con lo escrito | ☐ |

### Casas que no se pueden contactar

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B6 | Ana: Mis casas → su casa → apagar «Disponible para consultas». Daniel, a los pocos segundos, recarga la ficha | Botón apagado «No disponible para consultas» en vez de «Contactar por WhatsApp» | ☐ |
| B6a | Daniel con la hoja ya abierta antes de que Ana apague (repetir: abrir la hoja, Ana apaga, Daniel «Abrir WhatsApp») | En la hoja: «Esta casa no está disponible para consultas.»; WhatsApp no se abre | ☐ |
| B6b | Ana vuelve a encenderlo | Vuelve «Contactar por WhatsApp» | ☐ |
| B6c | Ana (con su sesión) abre la ficha de su propia casa → «Abrir WhatsApp» | «Esta es su propia casa.»; WhatsApp no se abre | ☐ |
| B6d | Sin red (modo avión) con sesión, en la hoja: «Abrir WhatsApp» | «Sin conexión. Revise su internet e intente de nuevo.»; lo escrito sigue | ☐ |

### Favoritos

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B7 | En una pestaña privada, sin cuenta: Explorar → tocar el corazón de dos casas | El corazón se pone terracota al instante y la ficha no se abre | ☐ |
| B7a | Abrir la ficha de una de ellas desde su enlace | El corazón (botón crema junto a compartir) aparece ya marcado | ☐ |
| B7b | Barra → «Favoritos» | «2 casas · guardadas en este teléfono», tarjetas horizontales con precio (prueba ₡/$), nota «Compare y escriba directo…». Quitar una con el corazón → desaparece | ☐ |
| B7c | Recargar o cerrar y volver a abrir | La lista sigue | ☐ |
| B7d | En Favoritos → «Ingresar» → entrar con su número | Vuelve a Favoritos: «N casas guardadas» (ya en la cuenta) | ☐ |
| B7e | **En el otro teléfono** (o en el navegador del ordenador) entrar con la misma cuenta → Favoritos | Las mismas casas | ☐ |
| B7f | Añadir una en el segundo teléfono; volver al primero y abrir la app | Aparece también en el primero | ☐ |
| B7f2 | Con sesión: Mi cuenta → «Favoritos» | Abre la misma pantalla de Favoritos | ☐ |
| B7g | Cerrar sesión en el primero → Favoritos | La lista se queda («guardadas en este teléfono») | ☐ |
| B7h | Con la casa de Ana en favoritos: Ana apaga «Disponible para consultas»; después Ana la edita (deja de verse mientras se revisa) | No disponible: sigue en Favoritos. En revisión: desaparece de Favoritos sin aviso (vuelve si se aprueba y se guarda otra vez) | ☐ |

### Mis consultas (propietaria) y respuesta

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B8 | Ana, en su teléfono: abrir la app en modo propietario → Inicio | Tarjeta «1 consulta nueva» (o «N consultas nuevas») y el contador terracota en la pestaña «Consultas» | ☐ |
| B8a | Tocar la tarjeta o la pestaña | «Mis consultas»: la de Daniel arriba, con sus iniciales, «Daniel …», hace cuánto, «<casa> · <fechas> · N personas», su mensaje entre comillas y la píldora «Nueva»; nota final «Es un registro de quién le escribió…» | ☐ |
| B8b | Con consultas de dos casas: tocar el filtro de una casa y luego «Todas · N» | Solo las de esa casa; luego todas | ☐ |
| B8c | «Abrir WhatsApp» en la consulta de Daniel | WhatsApp abre el chat con **Daniel** (`+1 778 347 9837`), sin texto escrito: es la misma conversación del mensaje de B4 | ☐ |
| B8d | Responder a Daniel en WhatsApp y volver a bnbtico | La consulta ya sin «Nueva»; el contador baja (o desaparece si era la única); Inicio dice «Sin consultas nuevas». Daniel recibe la respuesta | ☐ |
| B8e | Cerrar la app; modo avión; abrir Mis consultas | Se ve la lista de la última vez | ☐ |
| B8f | Una cuenta de propietario sin consultas (p. ej. `8777 0001`, si nadie le escribió): Mis consultas | «Todavía no le han escrito. Comparta su ficha para recibir consultas.» y «Compartir ficha» si tiene una casa activa | ☐ |

### Telemetría

No se prueba a mano el tope de 20 casas distintas por cliente al día: lo cubren las pruebas automáticas (contrato contra la base).


| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B9 | Supabase → SQL Editor: `select name, count(*) from events where name in ('whatsapp_tap', 'inquiry_created') group by 1;` | Filas de los dos, aproximadamente un `whatsapp_tap` por toque del botón verde y un `inquiry_created` por WhatsApp abierto | ☐ |
| B9a | `select l.public_id, i.people, i.arrival, i.departure, i.owner_opened_at is not null as abierta from inquiries i join listings l on l.id = i.listing_id order by i.updated_at desc limit 5;` | Las consultas de B4–B8 con sus datos | ☐ |

### El número de la casa no es público

Decisión del 2026-10-23: el WhatsApp de la casa solo se entrega a un cliente con sesión al tocar «Abrir WhatsApp».

| # | Paso | Esperado | ✓ |
|---|---|---|---|
| B10 | En el ordenador, sin sesión: abrir la ficha de la casa de Ana y ver el código fuente (Ver → Código fuente, o `curl -s <enlace> \| grep -c 3478492`) | El número de Ana no aparece (0 coincidencias); sí aparece su nombre | ☐ |
| B10a | En el teléfono, compartir el enlace de la casa en un chat de WhatsApp | La vista previa (foto, título y precio) se ve como en la fase R; ningún número en ella | ☐ |

---

## C. Si algo falla

Mande por WhatsApp o en un issue de `.scratch/fase-3/` (uno por fallo):

1. El número del paso (p. ej. «B4a») y qué esperaba.
2. Captura de pantalla o grabación con la hora. Para B4/B5, si WhatsApp no se abre: qué hizo el teléfono (nada, una pestaña con `wa.me`, la tienda de apps).
3. Teléfono, sistema y navegador (p. ej. «iPhone 15, iOS 26, Safari» o «Pixel 7, Chrome, app instalada») y si tenía red.
4. Si apareció un mensaje en la hoja, el texto exacto.
5. Para errores de la app: `select build, message, count(*) from client_errors group by 1, 2 order by 3 desc limit 10;`. Para el despliegue: el enlace al run de GitHub Actions.
