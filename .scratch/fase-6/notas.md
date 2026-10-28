# Fase 6 · «Buscan casa» · notas para retomarla

Status: wontfix (aplazada por Daniel el 2026-10-27 hasta después del lanzamiento; ver `docs/decisiones.md`)

Lo leído y analizado el 2026-10-27 antes de aplazarla, para no repetirlo. Al retomarla: releer las decisiones posteriores a esta fecha y los datos del sustituto (`issues/01-no-encuentra-whatsapp.md`: cuántas veces se abre el WhatsApp de «¿No encuentra lo que busca?»).

## Qué decía el plan

El cliente publica lo que busca (zona, fechas, personas, imprescindibles, presupuesto), los propietarios con casas compatibles lo ven en su panel y le escriben por WhatsApp con el consentimiento del cliente; caducidad y límites del prototipo. Hecho cuando: una búsqueda creada desde un móvil aparece al propietario de una casa compatible y no al de una incompatible.

## Decisiones antiguas y cuál manda (la más reciente)

- 2026-10-02 «Solicitudes de casa»: consentimiento explícito del cliente, máx. 10 propietarios, el propietario responde por WhatsApp con mensaje prellenado; «Presupuestos en total, no por noche» (vacacional: total de la estancia; mensual: por mes). «Decisión final de contacto»: consentimiento explícito para responder por WhatsApp en Pedir casa. Siguen valiendo.
- 2026-10-12 «Distinguir interés directo y búsquedas compartidas»: responder a una búsqueda **no** crea una consulta de interés directo. «IA como posibilidad»: la búsqueda con IA queda fuera (sin cambio).
- 2026-10-13 «Distribución escalonada»: tandas (primero propietarios sin consultas en esas fechas, a las 24 h el resto hasta 10; inmediato si la llegada es en ≤ 48 h o sin fechas exactas; desempate por menos envíos en 30 días; excluir al propietario con consulta directa del mismo cliente en fechas solapadas, aunque la descartara). «Buscan casa en calendario» (barras amarillas): la fase 4 lo dejó fuera. «Consultas directas y búsquedas en pestañas independientes»: Mis consultas y Buscan casa separadas; límite 10 (reducir a 5 no se aprobó). «Lanzamiento ligero»: aplazaba Pedir casa — lo contradijo el plan del 2026-10-15 y lo recupera la decisión del 2026-10-27.

## Esquema (`0001_init.sql`)

`requests` (client_id, province, zone, people, arrival, departure, must_have feature[], budget_total_crc, notes, consent_whatsapp, max_owners, status open/closed/expired, expires_at) y `request_matches` (request_id, listing_id, owner_id, seen_at, contacted_at), con RLS. Vacías también en `bnbtico-pruebas` (2026-10-27): se pueden rehacer.

- **Falta:** modalidad (vacacional/mensual) y presupuesto según modalidad, cantón, tipo (completo/habitación), fecha del consentimiento, «No me interesa» del propietario, fecha en que se entregó el número, caducidad aplicada por un trabajo.
- **Sobra / cerrar:** `requests_client for all` deja escribir directamente en la tabla; todo debe ir por RPC (crear, cerrar, entregar el número como `create_inquiry`, caducar y repartir con `pg_cron`). `max_owners` como columna.

## Prototipo (vista Móvil; `assisted-search.js`, `request-distribution.js`, `calendar-searches.js` y sus pruebas)

- Compatibilidad: modalidad, personas ≤ capacidad, todos los imprescindibles (una característica sin dato no cumple), zona, presupuesto (vacacional: precio por noche × noches ≤ total; sin noches no hay comparación), propietario verificado; con fechas exactas, todas las noches disponibles (salida excluida). Nunca relajar filtros sin avisar.
- Límites: máx. 3 búsquedas abiertas por cliente; consentimiento obligatorio; sin coincidencias no se envía; cerrar o «Ya encontré alojamiento» cancela y retira el consentimiento sin retirar números ya compartidos. Sin caducidad definida.
- Pantallas del prototipo: Pedir casa (pestaña del cliente), Mis solicitudes, Buscan casa (pestaña del propietario, «Ofrecer mi casa por WhatsApp» / «Ahora no»). El diseño v1 no tiene ninguna de estas pantallas y su barra tiene 3 pestañas (cliente) y 5 (propietario).

## Propuesta que quedó sin decidir (recomendaciones del 2026-10-27)

- Pantallas derivadas de Mis consultas, la hoja de contacto y Filtros, aprobadas con capturas; «Buscan casa» como segunda pestaña dentro de Consultas; el cliente entra desde Explorar y desde Mi cuenta.
- Compatible estricto: provincia (+ cantón opcional), modalidad, personas, todos los imprescindibles, presupuesto si lo hay, ninguna noche ocupada en las fechas, casa activa y visible, nunca la propia.
- Reparto: hasta 10 propietarios al crear (una casa por propietario, primero quien menos recibió en 30 días) y, opcional, completar cada hora; sin tandas mientras el catálogo sea pequeño.
- Aviso al propietario: contador en la app; WhatsApp (outbox de la fase 5, máx. uno al día) opcional y apagado en producción hasta tener plantilla de Meta.
- Privacidad: el propietario ve nombre de pila y criterios, nunca el número hasta tocar «Escribirle por WhatsApp» (RPC que lo registra, solo si la búsqueda está abierta y su casa la recibió); casilla de consentimiento sin marcar; máx. 3 abiertas; caduca el día de llegada (vacacional) o a los 30 días (mensual); el contacto queda aparte de Mis consultas.
- Versión mínima posible: formulario + entrada desde Explorar + «Mis búsquedas» en Mi cuenta; «Buscan casa» en Consultas + contador; reparto al crear, número al escribir, caducidad nocturna.
