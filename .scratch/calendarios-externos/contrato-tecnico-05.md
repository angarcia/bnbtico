# #5 · Contrato técnico de preparación · v0.1

Fecha: 2026-11-07. Especificación técnica propuesta tras inspección del código y muestra real; **no implementada ni verificada mediante pruebas**. Conserva las reglas de producto y el diseño móvil aprobados. Las firmas y nombres internos pueden ajustarse al implementar sin cambiar este comportamiento. No habilita #6–#8 antes de aceptar sus entregas previas.

## Evidencia y límites

Referencias locales: `src/domain/calendar.ts`, `src/domain/api.ts`, `src/data/postgrest/calendar.ts`, `src/client/calendar-days.ts`, `src/client/screens/calendario.tsx`, `src/shared/listing-calendar.tsx`, `src/data/postgrest/billing-service.ts` y `docs/architecture.md`, dentro de `apps/app` cuando corresponda.

SQL: `20261024024441_fase4_calendario`, `20261102215706_anfitrion_en_consultas`, `20261103230900_admin_edita_casas`, `20261104053836_casa_pausada_textos` y `20261107042744_caribe_primero_y_tipo`. Las versiones más recientes mandan: no copiar la versión inicial de una RPC y perder modificaciones posteriores.

La muestra real tiene eventos de día completo con UID y fin explícito, incluyendo reservas y un período no disponible. No contiene nombre de alojamiento ni una cancelación verificable. No copiar la muestra privada al repo: [comprobación anonimizada](validacion-muestra.md).

Base normativa consultada: [RFC 5545](https://www.rfc-editor.org/rfc/rfc5545), §3.1 (líneas continuadas), §3.6.1 (inicio incluido y fin excluido) y §3.8.2.7 (transparencia). El soporte de bnbtico es deliberadamente un subconjunto: no afirmar que acepta todos los archivos válidos de iCalendar.

## Responsabilidades

- Navegador: elige la casa, introduce URL, muestra progreso y resultado; nunca descarga Airbnb ni envía listas de noches calculadas por él para que se consideren importadas.
- Worker: integración externa, límites y validación de descarga, parser sin contenido personal y coordinación del intento. Inyección de `fetch`/reloj para pruebas. No verificar JWT por una vía nueva: PostgREST valida el JWT y una RPC autoriza al dueño antes de cualquier acceso privilegiado.
- Postgres: permisos, casa y estado, exclusión por conexión, versión de intento, publicación atómica de bloques y disponibilidad efectiva. Todo cambio mediante migración y RPC; no escrituras directas desde navegador a tablas importadas.
- Dominio TypeScript puro: parser/normalización y reglas de unión/procedencia para el fake y las pruebas. No añadir bibliotecas/parser al JS privado inicial del cliente si solo hacen falta en el worker.

Un endpoint específico de integración sigue el patrón del pago existente; no crear una API intermedia para el CRUD ordinario del calendario. Lecturas de gestión siguen por PostgREST con JWT.

## Datos e invariantes

1. `listing_days` conserva únicamente la capa manual y precios especiales existentes. Migración aditiva: no reinterpretar filas antiguas como Airbnb.
2. Una conexión Airbnb por casa, con dueño derivado de la casa, versión, URL privada, estado, último intento, último éxito y código de error sin texto remoto. Guardar URL en almacenamiento/columnas de servicio no seleccionables mediante REST por anon/authenticated. La respuesta de gestión no contiene token ni URL completa.
3. Bloqueos importados separados con conexión, UID privado, inicio y fin exclusivo. Sin `SUMMARY`, `DESCRIPTION`, datos de teléfono ni enlace de reserva. Un UID es único dentro de la conexión; nunca global entre casas.
4. Ocupar una noche equivale a manual ocupado **o** pertenencia a algún rango importado. Liberar manual no borra importados; retirar un UID no libera una noche cubierta por otro UID. El precio siempre sale del manual/base.
5. Conservar rangos de origen sin expandir eventos largos en memoria; proyectar únicamente su intersección con hoy CR…hoy+365 al leer noches. Esto permite que la ventana avance sin perder el final de un evento que la cruzaba. Las fechas fuera de la ventana no se muestran ni se exportan.
6. Aplicar una instantánea completa en una transacción: sustituir solo el conjunto de esa conexión y actualizar éxito/estado juntos. Una instantánea vacía válida retira sus bloqueos. Fallo conserva conjunto y fecha de éxito.
7. El origen no se publica. El dueño recibe manual/importado por día para que el panel no diga «Disponible» si solo se retiró el manual. El feed futuro de #6 lee solo la capa manual.

## Operación y permisos

Interfaz conceptual: `connectAirbnb(listingId, url, requestId)` devuelve estado del intento; `calendarOverview(listingId)` devuelve estado de importación y días con ocupación efectiva/procedencia. No requiere firmas públicas nuevas con estos nombres exactos.

Flujo propuesto:

1. Validar forma de la URL y pedir a una RPC con JWT del usuario autorización y reserva de intento para la casa. La RPC deriva usuario de `auth.uid()`, no de un `ownerId` aportado por el navegador. Confirmar que no es borrador nunca enviado, rechazada o bloqueada; no exigir `available=true`, pues la pausa mantiene sincronización.
2. RPC devuelve un identificador opaco de intento con versión. La URL candidata no constituye conexión activa hasta completar lectura válida. Una repetición del mismo `requestId` recupera su resultado, sin segundo intento concurrente.
3. El worker obtiene solo el contexto reservado mediante RPC de servicio, vuelve a validar el destino, descarga y normaliza. Los endpoints nunca permiten aportar una URL cualquiera junto a un ID de intento ajeno y usar autoridad de servicio sin relación comprobada en SQL.
4. RPC de servicio aplica solo si intento/versión siguen vigentes, casa existe y no pasó a bloqueada/rechazada. Publica bloques, conexión activa y último éxito juntos. Una lectura obsoleta no puede ganar a una desconexión, sustitución o eliminación futura.
5. Si falla, cerrar intento con código seguro, sin modificar disponibilidad. En primer intento fallido no hay conexión activa. Si se pierde la respuesta, consultar el intento antes de repetir: no deducir fallo por timeout del navegador.

Anon, otro dueño y admin sobre casa ajena no pueden conectar ni leer secretos. Admin con aal2 conserva su edición manual vigente, pero no gana gestión iCal. Separar estado suspendido por bnbtico de desconexión voluntaria; la recuperación aprobada solo afecta al primero. Jobs expirados deben poder recuperarse por una nueva petición explícita con versión nueva y descartar cualquier respuesta antigua. El cron de tres horas no se añade en #5.

## Descarga acotada

Elecciones técnicas iniciales propuestas para implementar y probar: HTTPS; hosts exactos `www.airbnb.ca` y `www.airbnb.com` (la muestra usa `.ca`); ruta `/calendar/ical/<id-numérico>.ics` y token `t`; sin credenciales de URL, puertos alternativos ni fragmentos. No inferir el nombre ni comprobar propiedad de la cuenta Airbnb por el ID de la ruta. Otros dominios regionales requieren ampliar explícitamente la lista tras comprobarlos, no aceptar cualquier sufijo que contenga «airbnb».

No seguir redirecciones automáticamente: rechazar redirecciones en este alcance inicial y pedir el enlace directo. El worker no es un proxy a destinos arbitrarios. Límites iniciales: 10 segundos para lectura completa, 1 MiB de cuerpo leído/descomprimido y 5.000 eventos; abortar al superar cualquiera, aunque el servidor no envíe `Content-Length`. No guardar el cuerpo ni seguir enlaces encontrados en él. Error HTTP, cuerpo ausente, HTML, exceso o stream incompleto no son calendario vacío. No aceptar una respuesta parcial como instantánea completa.

Estos valores son decisiones técnicas propuestas, no límites comerciales aprobados por Ana; ajustarlos con evidencia si fallan una muestra legítima y conservar un límite probado. No pedirle que elija librerías, límites de memoria o nombres de RPC.

## Contrato del parser

- Exigir un VCALENDAR completo versión 2.0 y estructura cerrada; normalizar continuaciones antes de interpretar propiedades. Aceptar metadatos inocuos, incluido `DTSTAMP` con hora.
- Eventos bloqueantes: UID, inicio y fin válidos `VALUE=DATE`, fin posterior. Excluir la salida y recortar solo al proyectar la ventana. No depender del idioma o título `Reserved`; `Airbnb (Not available)` también bloquea.
- Según la semántica del formato, los eventos explícitamente cancelados o transparentes no aportan ocupación. No interpretar palabras libres del título como cancelaciones. Reconciliar su retirada con el conjunto anterior solo tras aceptar el archivo completo.
- Rechazar esta versión si hay eventos con horas, recurrencias, excepciones de recurrencia, DURATION en vez de fin explícito, campos obligatorios ausentes o valores contradictorios. Rechazar toda la lectura; nunca saltarse silenciosamente un bloqueo no soportado. La muestra real no contiene estos casos: cubrirlos con fixtures.
- UID idéntico con fechas/estado idénticos no duplica; UID idéntico contradictorio falla completo. Rangos solapados se unen al calcular noches, sin perder identidad por UID.
- No conservar ni devolver el cuerpo remoto o campos ignorados en excepciones, logs, respuestas de error o fixtures versionados. Comparar errores mediante código seguro.

## Disponibilidad y caché

Actualizar conjuntamente estos consumidores, conservando sus permisos actuales:

| Consumidor | Cambio exigido |
| --- | --- |
| Calendario del dueño | Una lectura por casa para días efectivos y origen; conserva precio manual y el guardado manual actual |
| `public_listing_days` y ficha/hoja de contacto | Unión efectiva sin origen privado, con misma ventana y casas públicas actuales |
| `search_listings` | Excluir estancias que pisen cualquier noche ocupada por cualquiera de las dos capas, con salida excluida |
| Reglas de contacto en SQL | Revisar la versión vigente de `create_inquiry` y cualquier comprobación de noches: usar la misma disponibilidad donde se compruebe; no añadir reservas automáticas |
| Edición manual/admin | Continúa escribiendo solo manual/precio; ninguna edición libera un importado |
| Caché | Invalidar calendario privado, días de ficha y búsquedas pertinentes tras éxito. Purga por casa en el camino existente; no limitarse al trigger sobre `listing_days` si cambia otra tabla |

La ocupación importada permanece aplicada durante una suspensión administrativa aunque no se sirva exportación. La pausa del anfitrión conserva importación y no se convierte en bloqueo manual de todas las noches. No cambiar por efecto lateral las reglas de suscripción o publicación vigentes.

## Pruebas primero y corte por historia

Para #5: fixtures sintéticos del archivo observado, fechas/fronteras, fin excluido, continuidad de líneas, eliminación/cancelación, vacío válido frente a fallo, superposición manual/importado, dos UID solapados, no fuga de descripción, permisos, solicitud repetida y bloqueo administrativo durante lectura. Suite de contrato fake/PostgREST para autorización y publicación atómica, más Playwright móvil para conectar/error/origen y regresión manual.

Probar la ingestión repetida por el servicio/arnés de pruebas sin añadir «Actualizar ahora» a la UI antes de #7. #6 reutiliza capa manual; #7 añade acciones de gestión sobre versión/reserva ya seguras; #8 reutiliza el mismo servicio con el programador, sin segundo parser.

La implementación debe crear migración, regenerar tipos y actualizar fake/adaptadores, pruebas y guías en el mismo paso. Ana ejecuta comandos: entregar los pertinentes al empezar el trabajo; no se ejecutaron builds, pruebas ni migraciones en esta preparación.

## Estado de entrada

Producto, diseño móvil y muestra: disponibles. Este contrato hace revisable el trabajo técnico; no acredita que esté implementado ni que las pruebas pasen. Antes de marcar #5 «Lista para trabajar», revisar este documento contra la versión del checkout donde se vaya a implementar, fijar las firmas finales y comprobar que ninguna regla de estados o privacidad contradice lo aprobado. No hace falta otra aprobación de producto para resolver nombres internos o límites técnicos rutinarios; sí consultar cualquier cambio del alcance aprobado.
