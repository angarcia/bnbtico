# Plan de pruebas manual · fases 0, 1 y 2 en pruebas.bnbtico.com

Fecha: 2026-10-19. Entorno: `https://pruebas.bnbtico.com` (rama `develop`, Supabase `bnbtico-pruebas`). Se prueba **desde el móvil**; cada bloque dice qué ver y qué debe pasar. Marcá ✅ / ❌ y anotá el paso donde falla.

## Antes de empezar

- **Contraseña de pruebas:** la de siempre (usuario cualquiera). Los iconos y el manifest de la PWA quedan fuera, así que «Añadir a pantalla de inicio» funciona.
- **Códigos:** los números de prueba reciben siempre el código `123456` sin enviar WhatsApp. Un número real sí necesita Twilio (pendiente): usá los de prueba.

| Número | Papel en estas pruebas | Nota |
|---|---|---|
| `8777 0001` | **Propietaria** (publica la casa) | Cuenta nueva; si ya existe, entra igual |
| `8888 1234` | **Cliente** (explora y abre la ficha) | Ya existe en pruebas como «Ana» |
| `8899 0001` | **Admin** (revisa y aprueba) | Ya es admin en pruebas y en local (`is_admin`); nombre «Admin bnbtico» |
| `8888 9999` | Libre | Para probar «número sin cuenta» |

- Conviene tener **dos teléfonos** (o un teléfono y una pestaña privada del navegador del teléfono) para separar propietaria y cliente. El admin puede ir en una pestaña privada.
- Las casas se guardan de verdad en la base de pruebas. Al terminar, el admin puede dejarlas; se borran antes del lanzamiento.

## Bloque A · Base y PWA (fase 0)

| # | Paso | Esperado |
|---|---|---|
| A1 | Abrir `https://pruebas.bnbtico.com` | Pide usuario y contraseña; tras ponerla, redirige a **Explorar** («¿A dónde vas?») |
| A2 | Abrir `https://pruebas.bnbtico.com/?pronto=1` | Se ve la portada «Muy pronto» con la foto de Playa Negra y el logo |
| A3 | Menú del navegador → «Añadir a pantalla de inicio» | Icono de bnbtico; al abrir desde el icono carga a pantalla completa, sin barra del navegador |
| A4 | Girar el teléfono / modo oscuro del sistema | La app sigue legible; colores oscuros si el sistema está en oscuro |

## Bloque B · Cuenta con WhatsApp verificado (fase 1) — teléfono de la propietaria

| # | Paso | Esperado |
|---|---|---|
| B1 | Pestaña **Mi cuenta** → «Creá tu cuenta»: nombre `Yorleny Prueba`, WhatsApp `8777 0001` → «Crear cuenta» | Pantalla «Verificá tu WhatsApp» con «Para +506 8777 0001»; «Pedir otro código» deshabilitado con cuenta atrás |
| B2 | Código `000000` → «Verificar y continuar» | Error «Ese código no es correcto…» sin salir de la pantalla |
| B3 | Código `123456` | «Tu cuenta está lista» → «Ahora no · continuar» → Explorar |
| B4 | Mi cuenta | Nombre, número `+506 8777 0001`, sello «✓ WhatsApp verificado», sin nada de «Identidad» |
| B5 | «Editar perfil» → descripción `Casa en Manzanillo` → Guardar | «Guardado»; al volver no aparece el campo descripción (solo al editar) |
| B6 | «Escribile a bnbtico por WhatsApp» | Pantalla de ayuda con el canal para **buscadores de alojamiento** (modo cliente) |
| B7 | «¿Tenés una casa? Publicala» | Pasa a modo propietario: barra inferior con Inicio, Mis casas, Calendario, Mis consultas, Cuenta; «Tu panel» con el botón «Publicar casa» |
| B8 | Cuenta → «Escribile a bnbtico por WhatsApp» | Canal de **atención a propietarios** |
| B9 | «Cerrar sesión» | Vuelve a «Creá tu cuenta» y la barra vuelve a modo cliente (Explorar, Favoritos, Mi cuenta) |
| B10 | «Ya tengo cuenta · Iniciar sesión» con `8888 9999` → «Recibir código» | Aviso «No hay una cuenta con ese WhatsApp…» |
| B11 | Iniciar sesión con `8777 0001`, código `123456` | Entra directo a Mi cuenta con «Yorleny Prueba» |

## Bloque C · Publicar una casa (fase 2) — teléfono de la propietaria

| # | Paso | Esperado |
|---|---|---|
| C1 | Mi cuenta → «¿Tenés una casa? Publicala» → en Tu panel, **«Publicar casa»** | Abre «Publicar alojamiento · Paso 1 de 5 · Alojamiento», barra de 5 segmentos con el primero en rojo |
| C2 | «Continuar» sin tocar nada | Aviso «Elegí Casa, Apartamento o Habitación.» (nada viene preseleccionado) |
| C3 | Tipo **Casa** → Continuar | Aviso «Respondé si aceptás alquiler mensual.» y el tipo **sigue** en Casa (no se borra) |
| C4 | «¿Aceptás alquiler mensual?» **Sí** → Continuar | Paso 2 «¿Dónde está?» |
| C5 | Provincia Limón, cantón `Talamanca`, zona `Manzanillo` → Continuar sin tocar el mapa | Aviso «Marcá en el mapa la ubicación aproximada.» |
| C6 | Tocar el mapa cerca de la costa; arrastrar el pin con el dedo | Pin rojo donde tocaste; el mapa hace zoom; texto «Pin colocado. Arrastralo si hace falta.» El arrastre va suave y no mueve toda la página |
| C7 | Continuar | Paso 3 «Detalles del alojamiento» |
| C8 | Personas `5`, habitaciones `2`, baños `2`; marcar **Parqueo** | Aparece «Tipo de parqueo *» debajo; desmarcar Parqueo lo oculta |
| C9 | Parqueo → Gratuito; marcar **Frente al mar** y **Wifi**; título `Casa Manzanillo, a pie de playa`; descripción de dos líneas → Continuar | Paso 4 «Fotos del alojamiento» |
| C10 | Antes de guardar el paso 3, probar el teclado: en «Máximo de personas» debe salir el teclado numérico | Teclado numérico en personas, habitaciones, baños y precios |
| C11 | «Agregar fotos» → **Cámara** → una foto | La foto aparece en la cuadrícula con la etiqueta «Portada»; «1 fotos» |
| C12 | «Agregar fotos» → **Galería** → elegir 4 de golpe (si el teléfono es iPhone con HEIC, el navegador las convierte; si una no entra, aparece «Ese formato no se puede subir. Usá JPG o PNG.») | «5 fotos» en unos segundos; sin recargar la página |
| C13 | «Quitar» una foto; «Hacer portada» en otra | La cuadrícula se actualiza; la nueva portada queda primera con su etiqueta |
| C14 | Volver a dejar 5 fotos; **recargar la página** | Las 5 fotos siguen ahí (están guardadas) |
| C15 | Con 4 fotos, Continuar | Aviso «Agregá al menos 5 fotos.» |
| C16 | Con 5, Continuar | Paso 5 «Precio orientativo» |
| C17 | Precio por noche `85.000` (con punto), estancia mínima `2`; «Precio mensual» → **Consultar con el propietario** | Aparece «Se mostrará «Consultar precio mensual con el propietario».»; tarjeta «WhatsApp de tu cuenta» con `+506 8777 0001` en solo lectura |
| C18 | Cambiar a «Indicar precio mensual orientativo» → aparece el importe; volver a «Consultar» | El campo de importe aparece y desaparece |
| C19 | «Enviar a revisión» | Vuelve a **Mis casas** con el aviso «Anuncio enviado a revisión…»; la tarjeta muestra la portada, «Pendiente de revisión», «Manzanillo, Limón», «₡85 000 / noche · orientativo» |
| C20 | Cerrar la app y volver a abrirla desde el icono → Mis casas | La casa sigue «Pendiente de revisión» |
| C21 | Mis casas → **«Nueva»** → aparece el paso 1 → volver atrás → Mis casas | Hay un «Borrador sin título» con «Seguir» y «Descartar» |
| C22 | «Descartar» → confirmar | El borrador desaparece |
| C23 | Tu panel → «Publicar casa» otra vez con un borrador pendiente (crear uno con «Nueva», salir, y volver a «Publicar casa») | Pantalla «Tenés un borrador sin enviar» con «Seguir con el borrador» y «Empezar otro»; recargar esa pantalla **no** crea borradores nuevos (Mis casas sigue con uno) |

## Bloque D · Revisión del admin — pestaña privada o segundo teléfono

| # | Paso | Esperado |
|---|---|---|
| D1 | Mi cuenta → «Ya tengo cuenta · Iniciar sesión» con `8899 0001`, código `123456` | Entra como «Admin bnbtico»; en Mi cuenta aparece el botón **«Revisión de anuncios · admin»** |
| D2 | (Con la cuenta de la propietaria o la cliente) escribir `pruebas.bnbtico.com/admin` a mano | Página **no encontrada** (404) |
| D3 | Admin → «Revisión de anuncios» | «1 pendientes»; tarjeta con «Yorleny Prueba», el título, «Enviado …», estado «Pendiente de revisión», botón «Revisar» |
| D4 | «Revisar» | Ficha completa: estado y `CT-####`, título, «Publicado por Yorleny Prueba», «Fotos (5)», descripción, Ubicación y alojamiento, mapa con círculo (no un pin exacto), Características (las 9 con Sí/No; Parqueo «Gratuito»), Precios y condiciones («₡85 000 · orientativo», «Consultar con el propietario»). **Nada de identidad / Veriff** |
| D5 | Tocar una foto → «Foto 1 de 5 · Portada»; «Siguiente»; «Cerrar ampliación» | La ampliación navega y se cierra |
| D6 | «Pedir cambios» sin motivo | Error «Escribí un motivo de hasta 2000 caracteres…»; nada cambia |
| D7 | Motivo `Necesitamos una foto de la cocina.` → «Pedir cambios» | Tarjeta «Cambios solicitados» con el motivo; desaparecen los botones; en la cola, «0 pendientes» |
| D8 | **Propietaria:** Mis casas | «Cambios solicitados» y la **Nota de bnbtico** con el motivo; tocar el título → detalle con «Corregir y reenviar» |
| D9 | «Corregir y reenviar» → recorrer los 5 pasos con Continuar (los datos siguen) → «Enviar a revisión» | «Pendiente de revisión» otra vez |
| D10 | **Admin:** Revisar → «Aprobar anuncio» (sin motivo) | Tarjeta «Activa»; en la cola «0 pendientes» y la casa listada como decidida |
| D11 | **Propietaria:** Mis casas | «Activa», botón **«Compartir ficha»**. En Mi cuenta ya no cambia nada visible (el `is_owner` es interno) |

## Bloque E · Ficha pública y WhatsApp — teléfono de la cliente (o sin sesión)

| # | Paso | Esperado |
|---|---|---|
| E1 | **Propietaria:** Mis casas → «Compartir ficha» | Se abre la hoja nativa de compartir (o «Enlace copiado») con `https://pruebas.bnbtico.com/casa/CT-####` |
| E2 | Mandar ese enlace por WhatsApp a otro teléfono | **Vista previa** en el chat con la foto de portada, el título y «Casa en Manzanillo, Limón · 5 personas · ₡85 000 por noche · orientativo» (puede tardar unos segundos en aparecer) |
| E3 | Abrir el enlace en el otro teléfono (pide la contraseña de pruebas una vez) | Ficha completa: galería, «✓ WhatsApp verificado», «Ref CT-####», título, «Manzanillo, Talamanca, Limón», descripción |
| E4 | «Lo que ofrece» | Solo lo marcado: 5 personas, 2 habitaciones, 2 baños, Wifi, Parqueo · gratuito, Frente al mar. **No** aparece Piscina ni nada tachado |
| E5 | «Disponibilidad y precio orientativo» | Calendario del mes actual sin cifras por día; nota «₡85 000 por noche, salvo los días marcados… Estancia mínima: 2 noches.»; línea «Mensual: consultar precio con el propietario» |
| E6 | Selector **$ Dólares** | Barra fija y nota pasan a `$167`; aviso «Precios convertidos a dólares solo para orientarte (≈ ₡510 por US$1)…»; volver a **₡ Colones** |
| E7 | «Ubicación aproximada» | Mapa con un **círculo** rojo, sin pin, cerca de donde se marcó pero no exacto; texto «La dirección exacta la comparte el propietario.» |
| E8 | Tarjeta del propietario y nota | «Yorleny Prueba · WhatsApp verificado · en bnbtico desde 2026»; una sola nota «Sin comisiones…» |
| E9 | Barra fija inferior | Precio una sola vez («₡85 000 / noche · orientativo») y botón «Contactar por WhatsApp» **deshabilitado** con «Disponible pronto». La barra queda **por encima** de las pestañas, sin taparlas, y el final de la página se puede leer |
| E10 | Escribir el enlace en minúsculas (`/casa/ct-####`) | Abre la misma ficha |
| E11 | Escribir `/casa/CT-0001` | Página no encontrada |
| E12 | Botón «Compartir» arriba a la derecha de la ficha | Hoja nativa o «Enlace copiado» |

## Bloque F · Explorar — teléfono de la cliente

| # | Paso | Esperado |
|---|---|---|
| F1 | Pestaña Explorar | «¿A dónde vas?»; chips de Zona: solo **Todas** y **Limón** (Limón marcado); «1 casa en Limón · precios orientativos…»; tarjeta de la casa con portada, zona, «5 personas · 2 habitaciones», precio |
| F2 | «Más filtros» | Se despliegan «Qué necesitan» (9 chips) y «Precio por noche»; el botón pasa a «Menos filtros» |
| F3 | Chip **Piscina** | Recarga sola: «Sin resultados con esos filtros.»; «Menos filtros» muestra el contador «1»; aparece «Limpiar» |
| F4 | «Limpiar» | Vuelve «1 casa en Limón» |
| F5 | Personas → `6+` | Sin resultados; `Cualquiera` la devuelve |
| F6 | Precio mín `90.000` → Aplicar | Sin resultados; mín `30.000` y máx `100.000` → 1 casa |
| F7 | Chip **Todas** | Misma casa; la línea dice «1 casa · precios orientativos…» |
| F8 | **$ Dólares** junto a la línea de resultados | La tarjeta muestra `$167 / noche`; nota de conversión; volver a colones |
| F9 | Tocar la tarjeta | Abre la ficha; «Volver» regresa a Explorar con los filtros que había |
| F10 | Favoritos | Sigue siendo el marcador de la fase 3 (esperado) |

## Bloque G · Gestión del propietario — teléfono de la propietaria

| # | Paso | Esperado |
|---|---|---|
| G1 | Mis casas → tocar el título | Detalle: portada, «₡85 000 / noche» y «Activa», «Visible en bnbtico. Compartí el enlace…», `CT-####`, tarjeta «Ficha» con «Compartir ficha», tarjeta «Gestión» |
| G2 | «Marcar no disponible» | Badge «No disponible»; en la ficha pública (otro teléfono, recargar) aparece «No disponible por ahora» pero la ficha sigue abierta |
| G3 | «Marcar disponible» | Vuelve a «Activa» |
| G4 | «Editar» | Diálogo «Tu casa dejará de verse mientras la revisamos. ¿Querés editarla?» → aceptar → paso 1 del formulario |
| G5 | En el otro teléfono, recargar la ficha | «Ficha no disponible · Este enlace ya no está activo» con «Explorar otras casas»; en Explorar ya no sale la casa |
| G6 | Mis casas | La casa aparece como «Borrador» con el texto «Estuvo publicada: al enviarla volverá a revisión» y **sin** botón «Descartar» |
| G7 | «Seguir» → cambiar la descripción en el paso 3 → Continuar hasta el 5 → «Enviar a revisión» | «Pendiente de revisión» |
| G8 | **Admin:** aprobar de nuevo | La ficha vuelve a abrir en el otro teléfono con la descripción nueva; Explorar la muestra |

## Bloque H · Lo que NO debe pasar (seguridad básica, 5 minutos)

| # | Paso | Esperado |
|---|---|---|
| H1 | Cliente (`8888 1234`) con sesión: pegar en la barra `pruebas.bnbtico.com/propietario/casas/<id>` copiando el id de la URL del detalle de la propietaria | Página no encontrada: no se ve la gestión de una casa ajena |
| H2 | Cliente: `pruebas.bnbtico.com/propietario/publicar` | Pide crear cuenta / o abre la pantalla de publicar **para su propia cuenta** (nunca datos de otra) |
| H3 | Sin sesión: `/propietario/casas` | Redirige a crear cuenta y, tras entrar, vuelve a Mis casas |
| H4 | En la ficha pública, ver el código fuente o buscar el número de la propietaria | El número de WhatsApp **no** aparece en ninguna parte de la ficha |

## Qué anotar si algo falla

- Pantalla y paso (por ejemplo «C12 en iPhone 13, Safari»).
- Qué viste (captura) y qué esperabas.
- Si fue en la subida de fotos: tamaño aproximado y origen (cámara / galería / HEIC).
- Hora aproximada: los registros del proyecto de Supabase se pueden consultar después.
