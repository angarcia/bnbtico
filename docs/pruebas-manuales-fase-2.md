# Plan de pruebas manual · fases 0, 1 y 2 en pruebas.bnbtico.com

Fecha: 2026-10-20 (diseño v1 «Sol y sal», copy en usted). Entorno: `https://pruebas.bnbtico.com` (rama `develop`, Supabase `bnbtico-pruebas`). Se prueba **desde el móvil**; cada bloque dice qué ver y qué debe pasar. Marque ✅ / ❌ y anote el paso donde falla.

## Antes de empezar

- **Contraseña de pruebas:** la de siempre (usuario cualquiera). Los iconos y el manifest de la PWA quedan fuera, así que «Añadir a pantalla de inicio» funciona.
- **Códigos:** los números de prueba reciben siempre el código `123456` sin enviar WhatsApp. Un número real sí necesita Twilio (pendiente): use los de prueba.

| Número | Papel en estas pruebas | Nota |
|---|---|---|
| `8777 0001` | **Propietaria** (publica la casa) | Cuenta nueva; si ya existe, entra igual |
| `8888 1234` | **Cliente** (explora y abre la ficha) | Ya existe en pruebas como «Ana» |
| `8899 0001` | **Admin** (revisa y aprueba) | Ya es admin en pruebas y en local (`is_admin`); nombre «Admin bnbtico» |
| `8888 9999` | Libre | Para probar «número sin cuenta» |

- Conviene tener **dos teléfonos** (o un teléfono y una pestaña privada) para separar propietaria y cliente. El admin puede ir en una pestaña privada.
- Las casas se guardan de verdad en la base de pruebas. Se borran antes del lanzamiento.
- **Aspecto general a vigilar en todas las pantallas:** fondo crema, botones verdes píldora (uno relleno por pantalla), chips arena/salvia, pestaña activa en terracota, tipografía redonda en los títulos. Nada en rojo coral ni botones negros.

## Bloque A · Base y PWA (fase 0)

| # | Paso | Esperado |
|---|---|---|
| A1 | Abrir `https://pruebas.bnbtico.com` | Pide usuario y contraseña; tras ponerla, redirige a **Explorar** («¿Para dónde va?») |
| A2 | Abrir `https://pruebas.bnbtico.com/?pronto=1` | Portada «Muy pronto» con la foto de Playa Negra, el logo de la rana en crema y la etiqueta ocre «Muy pronto» |
| A3 | Menú del navegador → «Añadir a pantalla de inicio» | Icono terracota con la rana; al abrir desde el icono carga a pantalla completa, sin barra del navegador |
| A4 | Modo oscuro del sistema | La app sigue legible con la paleta oscura |

## Bloque B · Cuenta con WhatsApp verificado (fase 1) — teléfono de la propietaria

| # | Paso | Esperado |
|---|---|---|
| B1 | Pestaña **Mi cuenta** → «Ingresar»: nombre `Yorleny Prueba`, WhatsApp `8777 0001` (el prefijo +506 ya está puesto) → **«Recibir código por WhatsApp»** | Pantalla «Introduzca el código» con el número `+506 8777 0001`, seis casillas y la cuenta atrás «Puede pedir otro en 0:30» |
| B2 | Código `000000` → «Verificar y continuar» | Error «Ese código no es correcto…» sin salir de la pantalla |
| B3 | Código `123456` | «¡Listo! Su cuenta está creada» → «Ahora no · continuar» → Explorar |
| B4 | Mi cuenta | Avatar con iniciales, nombre, «WhatsApp verificado · +506 8777 0001», lista Mi perfil / Favoritos / Ayuda por WhatsApp, tarjeta arena «¿Tiene una casa en el Caribe?». Sin nada de «Identidad» |
| B5 | «Editar» → descripción `Casa en Manzanillo` → Guardar → «Listo» | «Guardado.»; al volver no aparece el campo descripción |
| B6 | «Ayuda por WhatsApp» | Canal de **atención a clientes** |
| B7 | «Publicar mi casa» (botón de la tarjeta arena) | Pasa a modo propietario: barra con Inicio, Mis casas, Calendario, Consultas, Cuenta; Inicio dice «Publique su casa» |
| B8 | Cuenta → «Ayuda por WhatsApp» | Canal de **atención a propietarios** |
| B9 | Cuenta → «Cerrar sesión» | Vuelve a «Ingresar» (Su nombre y su WhatsApp. Nada más.) y la barra vuelve a modo cliente |
| B10 | «Ya tengo cuenta · entrar con mi WhatsApp» con `8888 9999` → «Recibir código por WhatsApp» | Aviso «No hay una cuenta con ese WhatsApp…» |
| B11 | Entrar con `8777 0001`, código `123456` | Mi cuenta con «Yorleny Prueba» |

## Bloque C · Publicar una casa (fase 2) — teléfono de la propietaria

| # | Paso | Esperado |
|---|---|---|
| C1 | Mi cuenta → «Publicar mi casa» → en Inicio, **«Publicar casa»** | «Publicar casa · Paso 1 de 9», barra de progreso de 9 segmentos, botones fijos Atrás (apagado) y Continuar. **Ninguna pantalla del formulario debe necesitar scroll** (salvo la rejilla de fotos por dentro) |
| C2 | «Continuar» sin tocar nada | Aviso «Elija Alojamiento completo o Habitación.» (nada viene preseleccionado) |
| C3 | Tocar la tarjeta **Alojamiento completo** → Continuar | Aviso «Marque Vacacional, Mensual o las dos.» y la tarjeta **sigue** marcada |
| C4 | Tocar **Vacacional** y **Mensual** → Continuar | Paso 2 «¿Dónde está?» |
| C4b | Cantón: abrir la lista con Limón | Solo los 6 cantones de Limón; al cambiar la provincia a Puntarenas el cantón se vacía y la lista cambia |
| C5 | Provincia Limón, cantón **Talamanca** (de la lista), zona `Manzanillo`; al escribir la zona el teclado no tapa el campo y la tecla dice «Listo» → tocarla | Pasa al paso 3 «Ubicación en el mapa» (el mapa ocupa toda la pantalla) → Continuar sin tocar el mapa: aviso «Marque en el mapa la ubicación aproximada.» |
| C6 | Tocar el mapa cerca de la costa; arrastrar el pin con el dedo; probar «Usar mi ubicación» (botón redondo) | Pin terracota con un círculo verde alrededor; píldora «Arrastre el pin»; el arrastre va suave y no mueve toda la página |
| C7 | Continuar | Paso 4 «¿Cuántos caben?» |
| C8 | Contadores: Personas +5, Habitaciones +2, Baños +2 | Los números suben y bajan con − / + |
| C8b | Continuar | Paso 5 «Características» |
| C9 | Chip **Parqueo** | Aparece «Tipo de parqueo»; al quitar el chip desaparece |
| C10 | Parqueo → Gratuito; chips **Frente al mar** y **Wifi** → Continuar | Paso 6 «Nombre y descripción» |
| C10b | Nombre `Casa Manzanillo, a pie de playa` → tecla «Siguiente» del teclado | El foco pasa a la descripción sin tocar la pantalla; el teclado no la tapa |
| C10c | Descripción de dos líneas (el contador «n / 2000» avanza; Enter hace salto de línea) → Continuar | Paso 7 «Fotos» con «0 de 5–15» |
| C11 | «Añadir» → **Cámara** → una foto | La foto aparece grande como «Portada»; «1 de 5–15» |
| C12 | «Añadir» → **Galería** → elegir 4 de golpe (en iPhone, las HEIC se convierten; si una no entra, aviso «Ese formato no se puede subir. Use JPG o PNG.») | «5 de 5–15» en unos segundos, sin recargar |
| C13 | «Quitar» una foto (la X); «Hacer portada» en otra | La cuadrícula se actualiza; la nueva portada queda grande |
| C14 | Volver a dejar 5 fotos; **recargar la página** | Las 5 fotos siguen ahí |
| C15 | Con 4 fotos, Continuar | Aviso «Agregue al menos 5 fotos.» |
| C16 | Con 5, Continuar | Paso 8 «Precio» con «Por noche» y «Por mes» (eligió las dos modalidades) |
| C17 | Por noche `85.000` → «Siguiente» → por mes `900.000` → «Listo» | Teclado numérico; «Siguiente» salta al mes y «Listo» pasa al paso 9 «Enviar a revisión»: tarjeta «WhatsApp de esta casa» con `+506 8777 0001 · Verificado · el de su cuenta» y tarjeta arena de la oferta «₡0 · 12 meses» |
| C18 | «Enviar a revisión» | Pantalla **«¡Listo! Su casa está en revisión»** con la foto redonda y los tres pasos; botones «Marcar las noches ocupadas» e «Ir a Mis casas» |
| C19 | «Ir a Mis casas» | Casillas «0 activa · 0 por pagar · 1 en revisión»; tarjeta con miniatura, «En revisión», nombre, «₡85 000 / noche», «Enviada hoy. Le avisamos por WhatsApp.» |
| C20 | Cerrar la app y volver desde el icono → Mis casas | La casa sigue «En revisión» |
| C21 | «Nueva» → aparece el paso 1 → volver → Mis casas | «Borrador sin título» con «Seguir» y «Descartar» |
| C22 | «Descartar» → confirmar | El borrador desaparece |
| C23 | Con un borrador pendiente, «Nueva» | Pantalla «Tiene un borrador sin enviar» con «Seguir con el borrador» y «Empezar otro»; recargarla **no** crea borradores |

## Bloque D · Revisión del admin — pestaña privada o segundo teléfono

| # | Paso | Esperado |
|---|---|---|
| D1 | Mi cuenta → «Ya tengo cuenta · entrar con mi WhatsApp» con `8899 0001`, código `123456` | Entra como «Admin bnbtico»; en la lista aparece **«Revisión de anuncios · admin»** |
| D2 | (Con la propietaria o la cliente) escribir `pruebas.bnbtico.com/admin` | Página **no encontrada** (404) |
| D3 | Admin → «Revisión de anuncios» | «Anuncios» con la etiqueta «Admin», casillas (1 por revisar), chips «Por revisar · 1 / Cambios pedidos / Rechazados», tarjeta con miniatura, `CT-####`, «Nueva», nombre, «Yorleny Prueba · WhatsApp verificado», «Manzanillo · 5 personas · 5 fotos · ₡85 000» |
| D4 | Tocar la tarjeta | Tira de fotos deslizable, nombre, «Vacacional · Mensual · Alojamiento completo · Manzanillo, Talamanca · 5 personas · 2 hab · 2 baños», precio, tarjeta de la propietaria, descripción con chips, lista «Antes de decidir», mensaje para el propietario, botones fijos «Aprobar y publicar» / «Pedir cambios» / «Rechazar». **Nada de identidad** |
| D5 | «Pedir cambios» sin mensaje | Error «Escriba un motivo de hasta 2000 caracteres…»; nada cambia |
| D6 | Mensaje `Necesitamos una foto de la cocina.` → «Pedir cambios» | Tarjeta «Cambios pedidos» con el motivo; desaparecen los botones; en Anuncios, 0 por revisar |
| D7 | **Propietaria:** Mis casas | «Cambios pedidos», «Nota de bnbtico: …», botón «Corregir y reenviar»; el detalle lo repite en una tarjeta ocre |
| D8 | «Corregir y reenviar» → recorrer las 9 pantallas con Continuar → «Enviar a revisión» | Pantalla «¡Listo!…» → Mis casas «En revisión» |
| D9 | **Admin:** Anuncios → tarjeta marcada «Corregida» → «Aprobar y publicar» | Tarjeta «Activa»; en Anuncios «No hay anuncios pendientes.» |
| D10 | **Propietaria:** Inicio | «Su casa, en marcha»: tarjeta de la casa «Activa · Publicada hoy», «Comparta su ficha» con el enlace, botón **«Compartir ficha por WhatsApp»**, tarjeta «Oferta de lanzamiento · Quedan N de 50» con barra ocre |

## Bloque E · Ficha pública y WhatsApp — teléfono de la cliente (o sin sesión)

| # | Paso | Esperado |
|---|---|---|
| E1 | **Propietaria:** Inicio → «Compartir ficha por WhatsApp» | Hoja nativa de compartir (o «Enlace copiado») con `https://pruebas.bnbtico.com/casa/CT-####` |
| E2 | Mandar el enlace por WhatsApp a otro teléfono | **Vista previa** con la foto de portada, el nombre y «Alojamiento completo en Manzanillo, Limón · 5 personas · ₡85 000 por noche · orientativo» |
| E3 | Abrir el enlace en el otro teléfono (pide la contraseña una vez) | Foto grande con botones redondos crema (volver, compartir) y contador «1 / 5»; etiquetas «WhatsApp verificado» y «Vacacional · Mensual»; nombre; «Manzanillo, Talamanca · ubicación aproximada»; «5 personas · 2 habitaciones · 2 baños»; descripción |
| E4 | Deslizar las fotos | El contador cambia (2 / 5…) |
| E5 | Rejilla de características | Solo lo marcado, con icono: Wifi, Parqueo gratis, Frente al mar. **No** aparece Piscina ni la referencia CT |
| E6 | «Zona aproximada» | Mapa con un **círculo** rojo, sin pin, cerca de donde se marcó pero no exacto |
| E7 | Barra fija inferior | «₡85 000 / noche», al lado «≈ $167 · el precio final lo acuerda con el propietario», debajo «Mensual: ₡900 000 / mes» y el botón verde WhatsApp «Contactar por WhatsApp · disponible pronto» (deshabilitado). Sin pestañas debajo; el final de la página se puede leer |
| E8 | Tocar «≈ $167» | La barra pasa a «$167 / noche» y «≈ ₡85 000»; volver a tocar regresa a colones |
| E9 | Escribir el enlace en minúsculas (`/casa/ct-####`) | Abre la misma ficha |
| E10 | Escribir `/casa/CT-0001` | Página no encontrada |

## Bloque F · Explorar — teléfono de la cliente

| # | Paso | Esperado |
|---|---|---|
| F1 | Pestaña Explorar | «¿Para dónde va?» con botón «Ingresar» si no hay sesión; buscador blanco «Limón · Cualquier fecha · cualquier grupo»; chips Vacacional / Mensual / Piscina / Mascotas / Frente al mar / Más filtros; «1 casa en Limón · ₡ Colones · $ Dólares»; rejilla de dos columnas con la foto, «₡85 000 / noche», nombre y «Manzanillo · 5 pers. · Wifi» |
| F2 | Chip **Piscina** | Recarga sola: «Sin resultados con esos filtros.»; el buscador dice «1 filtro»; volver a tocar Piscina lo quita |
| F3 | Chip **Mensual** | La casa sigue (acepta las dos modalidades) |
| F4 | Tocar el buscador (o «Más filtros») | Pantalla **Filtros**: Zona (Todas / Limón), Personas, Habitaciones, los 9 chips, Precio por noche, botón fijo «Ver 1 casa», «Limpiar» arriba |
| F5 | Personas → 6+ → «Ver 1 casa» | «Sin resultados con esos filtros.» |
| F6 | «Más filtros» → «Limpiar» | Vuelve «1 casa en Limón» |
| F7 | «$ Dólares» | La tarjeta muestra «$167 / noche» y la nota de conversión; «₡ Colones» regresa |
| F8 | Tocar la tarjeta | Abre la ficha; la flecha vuelve a Explorar |
| F9 | Favoritos | Sigue siendo el marcador de la fase 3 (esperado), con la cabecera del diseño |

## Bloque G · Gestión del propietario — teléfono de la propietaria

| # | Paso | Esperado |
|---|---|---|
| G1 | Mis casas → tocar el nombre | Detalle: flecha + nombre + «Ver ficha»; foto con «Activa», «₡85 000 / noche» y `CT-####`; lista Compartir ficha / Calendario y precios / Editar la ficha / WhatsApp de esta casa / Disponible para consultas (interruptor verde) |
| G2 | Apagar el interruptor | Pasa a gris; en el otro teléfono la ficha sigue abierta con la etiqueta «No disponible por ahora» |
| G3 | Encender el interruptor | Vuelve a verde y la etiqueta desaparece |
| G4 | «Editar la ficha» | Diálogo «Su casa dejará de verse mientras la revisamos. ¿Quiere editarla?» → aceptar → paso 1 |
| G5 | En el otro teléfono, recargar la ficha | «Ficha no disponible · Este enlace ya no está activo»; Explorar ya no la muestra |
| G6 | Mis casas | «Borrador» con «Estuvo publicada: al enviarla volverá a revisión» y **sin** «Descartar» |
| G7 | «Seguir» → cambiar la descripción → Continuar hasta el 5 → «Enviar a revisión» | «¡Listo!…» → «En revisión» |
| G8 | **Admin:** aprobar de nuevo | La ficha vuelve a abrir con la descripción nueva; Explorar la muestra |

## Bloque H · Lo que NO debe pasar (5 minutos)

| # | Paso | Esperado |
|---|---|---|
| H1 | Cliente con sesión: pegar `pruebas.bnbtico.com/propietario/casas/<id>` con el id de la URL del detalle de la propietaria | Página no encontrada |
| H2 | Cliente: `pruebas.bnbtico.com/propietario/publicar` | Abre la pantalla de publicar **para su propia cuenta**, nunca datos de otra |
| H3 | Sin sesión: `/propietario/casas` | Pide ingresar y, tras entrar, vuelve a Mis casas |
| H4 | En la ficha pública, buscar el número de la propietaria | El número **no** aparece en ninguna parte |

## Qué anotar si algo falla

- Pantalla y paso (por ejemplo «C12 en iPhone 13, Safari»), qué vio (captura) y qué esperaba.
- Si fue en fotos: tamaño aproximado y origen (cámara / galería / HEIC).
- Hora aproximada: los registros del proyecto de Supabase se pueden consultar después.
