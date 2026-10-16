# Publicación de alojamientos · 2026-10-12

> **Nota 2026-10-15.** Partes de este documento están superadas. Reglas vigentes en `CLAUDE.md` y `docs/plan-implementacion.md`; el prototipo (vista Móvil) es la especificación de v1. En particular: WhatsApp verificado es lo único obligatorio (Veriff opcional, fuera de v1); contacto directo por WhatsApp sin solicitud/aceptación; sin reclamaciones en la app; colones con visualización en dólares; «Mensual» en vez de «Largo plazo».


## Decisiones vigentes

- bnbtico se centra en **alquileres vacacionales**, no en dos modalidades excluyentes. Cada anuncio tiene precio por noche.
- Tipo obligatorio: **Casa, Apartamento o Habitación**. Cabina y quinta pueden describirse en el texto, no son categorías.
- **¿Aceptás largo plazo?** es obligatorio, Sí/No, **sin opción preseleccionada**. Sustituye la propuesta intermedia de No por defecto.
- Si acepta largo plazo, elegir **Indicar precio mensual orientativo** o **Consultar con el propietario**. La primera exige importe positivo; la segunda no pide importe. Mínimo de meses opcional. No se interpreta un precio desconocido como cero.
- Número de habitaciones ofrecidas y número de baños disponibles obligatorios. Apartamentos tipo estudio pueden tener 0 habitaciones. Contar solo espacios ofrecidos al huésped, no toda la vivienda cuando se anuncia una habitación.
- Uso de baños: **Privados** por defecto, **Compartidos** o **Privados y compartidos**. Privados significa exclusivos del alojamiento, no necesariamente en suite.
- **WhatsApp por casa** (corrección 2026-10-12). Al crear el borrador se copia el número de Mi cuenta en un campo editable. Si ya está verificado se reutiliza la comprobación; otro número necesita verificación antes de enviar a revisión/usarlo. Cada casa conserva su destino verificado, independiente de futuras ediciones de la cuenta u otras casas. En anuncios publicados, el anterior sigue activo hasta verificar y guardar el nuevo. Recomendación de número de negocio, no obligación. Mantener consentimiento y aceptación conforme a [contacto-whatsapp.md](contacto-whatsapp.md).

Demo: `listing-whatsapp.js`, paso Precio al crear y sección WhatsApp de esta casa en Editar. Solo números ficticios; código de ejemplo 123456, 5 minutos, 5 intentos, uso único, invalidado al editar el destino. Sin envío real ni garantía de seguridad: estado local manipulable, reiniciado al recargar. Verificar el número en Editar actualiza solo el contacto de esa casa inmediatamente en la demo; otros cambios del anuncio siguen enviados a revisión sin aplicación al catálogo. Prueba: `tests/prototype/listing-whatsapp.cjs`.

## Campos del recorrido

1. Alojamiento: tipo y respuesta explícita a largo plazo.
2. Ubicación: provincia, cantón y zona aproximada obligatorios; sin dirección exacta pública.
3. Detalles: capacidad, habitaciones, baños, uso de baños, título y descripción. Casillas inicialmente desmarcadas para **Acepta mascotas, Piscina, Wifi, Aire acondicionado y Parqueo**; se marca lo que ofrece el alojamiento. Si se marca Parqueo, aparece un menú obligatorio **Gratuito / De pago**, sin preselección. Desmarcarlo borra la tarifa elegida. **Está amueblado** se elimina, también para largo plazo. Los datos históricos de tarifa de parqueo desconocida no se convierten automáticamente en gratuito.
4. Fotos: mínimo 5 y portada. Sin contactos, enlaces o publicidad de agencias; moderación antes de publicación.
5. Precio: moneda CRC/USD, importe orientativo por noche y mínimo de noches; opciones mensuales condicionales. Mostrar el contacto de la cuenta y acceso a configurarlo, sin teléfono propio del anuncio.

Registro y borradores sin verificaciones iniciales. Antes de la primera publicación se requieren **Veriff aprobado y WhatsApp verificado mediante OTP**; reutilizar ambos para anuncios posteriores mientras sigan vigentes. Un nuevo número debe verificarse antes de usarlo como contacto. Ver [identidad-y-seguridad.md](identidad-y-seguridad.md); OTP y permisos reales aún no implementados. Verificación registral fuera de v1. Suscripción/promoción por casa sigue [business-model.md](business-model.md); esta iteración no implementa cobros ni asignación de plazas.

## Estado real de la demo

`design/prototype/publication.js` sustituye el recorrido de publicación desde `SCREENS['o-new']`: cinco pasos, validación, borrador conservado entre pasos/configuración de cuenta y resultado En revisión. Las fotos se simulan con un botón; no se suben archivos. Identidad y teléfono inicial son ejemplos. No se publican anuncios nuevos en el catálogo ni se envían datos, avisos o pagos. Recargar borra el estado.

Los envíos aparecen también en **Admin → Anuncios → Revisar anuncio**, una vez por envío. La revisión muestra todos los campos y permite ampliar las fotos de ejemplo. Aprobar exige identidad aprobada y cinco fotos; pedir cambios o rechazar exige motivo. La decisión cambia el estado visible en Mis casas, pero no añade la casa al catálogo público. El motivo queda disponible en admin; mostrarlo al propietario y permitir corregir/reenviar siguen pendientes.

Pruebas: `node tests/prototype/publication.cjs` y `node tests/prototype/admin-review.cjs`.

## Pendiente de adaptación

- Catálogo, filtros, Pedir casa y Búsqueda asistida conservan el modelo antiguo vacacional/largo plazo y datos de ejemplo. Deben pasar a catálogo vacacional con filtro Acepta largo plazo; esta iteración está acotada al formulario de publicación y la cuenta.
- Al filtrar por presupuesto mensual, una tarifa Consultar no debe contarse como precio confirmado compatible. Definir su presentación aparte, sin inventar importe.
- Esquema, matching y permisos backend todavía no implementados. Mantener WhatsApp privado a nivel de usuario, referencia desde cada anuncio y acceso solo tras consentimiento/aceptación.
- Autenticación, Veriff, moderación, suscripciones, fotos reales, ubicación en mapa y edición de anuncios existentes siguen pendientes de implementación real.
