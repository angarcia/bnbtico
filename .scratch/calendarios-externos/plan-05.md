# #5 · Plan de implementación

> Ejecución en esta sesión con `superpowers:executing-plans`, reutilizando el checkout actual. Ana ejecuta los comandos salvo autorización expresa para las comprobaciones locales. Preparar la prueba antes del código y observar el fallo antes de implementar según TDD; no confundir pruebas escritas con pruebas ejecutadas.

**Objetivo:** conectar Airbnb por casa e importar ocupación sin tocar bloqueos manuales ni precios; búsqueda y contacto deben usar la unión efectiva.

**Arquitectura:** parser puro y descarga acotada en el worker. Postgres autoriza, reserva intentos y publica instantáneas atómicamente. El navegador lee la gestión por PostgREST y envía la conexión al worker siguiendo el patrón del pago. No interfaces #7/#8, exportación #6 ni cron nuevo.

**Stack:** TypeScript estricto, React/TanStack Query, Hono, PostgREST/Postgres.

**Spec:** `spec.md`, `diseno-v0.1.md` y `contrato-tecnico-05.md` en esta carpeta. Solo móvil, días completos, inicio incluido/fin excluido, hoy CR…hoy+365; fallos conservan último válido, sin datos personales.

## Evidencia de ejecución (Ana ejecuta los comandos)

- Rama inspeccionada mediante `.git/HEAD`: `codex/integracion-ical`; sin operaciones de Git del agente.
- Primera ejecución: módulos ausentes; las dos suites no llegaron a ejecutar sus casos. No se presenta como fallo de comportamiento observado.
- Primera implementación: 60 casos correctos y dos errores de los tests (comparación contra cadena vacía y argumento de provincias ausente). Corregidos; la siguiente ejecución dio **70/70** en cinco suites puntuales, incluido endpoint.
- Migraciones locales aplicadas y tipos generados por Ana. Único error de typecheck: `p_error: null` en una prueba de permisos; corregido omitiendo el argumento opcional.
- Contrato Airbnb real y permisos: **12/12**. Regresión Postgres de calendario, consultas y edición admin: **45/45**.
- Suite general comunicada por Ana: **2.187 correctas y siete timeouts** en `ci-e2e.test.ts` (inventario 336, unknown, shard-error y JSON nativo) y `private-sheets.test.ts` (confirm, pausa/reserva y selector 390). Ambas suites aisladas con un worker dieron después **47/47**; no se cambiaron sus timeouts ni el CI. La suite completa original no se presenta como una ejecución íntegramente verde.
- Revisión independiente de fuente: no encontró fallos concretos de SSRF, permisos o secretos. Hallazgo P3: panel no distinguía visualmente capa manual/ambas. Corregido con metadatos/precarga manual y comprobado en el recorrido e2e. Ana aprobó además la marca de enlace y leyenda visibles en la rejilla.
- Comprobaciones finales: tipos y prueba de rejilla como condiciones previas del build, arquitectura y compilación correctas; tamaño calendario **8,48/8,5 kB**, Airbnb **3,85/5 kB**; recorrido móvil **2/2** y revisión visual local a 375 px. Primera lectura real local comprobada: **24 noches** en una casa de prueba. Guía IC01–IC13 disponible para aceptación manual. No se ha desplegado, modificado GitHub ni creado commit de implementación.

Ruling: Ana indicó «me voy y luego ejecutamos pruebas»; se continuó escribiendo implementación con verificaciones pendientes y se retomaron las ejecuciones al volver. Se mantiene la preferencia de comandos ejecutados por Ana, sin afirmar que hubo ciclos rojo/verde no observados.

## Riesgos de revisión

- Una actualización tardía no debe revivir una conexión tras suspensión o eliminación.
- Un bloqueo importado no puede desaparecer por liberar manualmente la noche.
- Un cuerpo truncado o evento no soportado no puede convertirse en instantánea vacía.
- URL, token y descripción no deben aparecer en errores/telemetría/caché privada persistida.
- La misma noche debe rechazarse en búsqueda y contacto, incluida una consulta que compita con una importación.

## 1 · Parser y descarga

Archivos nuevos: `apps/app/tests/fixtures/airbnb-ical.ts`, `apps/app/tests/unit/airbnb-ical.test.ts`, `apps/app/tests/unit/airbnb-download.test.ts`; implementación futura en `src/domain/ical.ts` y `src/server/ical-download.ts`.

Interfaces: `parseAirbnbCalendar(text): ImportedBlock[]`, `ImportedBlock = {uid, start, end}`, `validateAirbnbUrl(raw): string`, `readAirbnbCalendar(url, {fetch, timeoutMs?, maxBytes?}): Promise<ImportedBlock[]>`. `IcalError` solo lleva código y mensaje seguro.

- [ ] Escribir fixtures sintéticos y pruebas de fechas, cancelaciones, duplicados, continuación de líneas, datos descartados, archivo vacío válido frente a inválido, URL y descarga acotada.
- [ ] Observar fallo inicial de las pruebas, sin peticiones externas reales.
- [ ] Implementar parser y descarga mínimos.
- [ ] Verificar las dos suites; no afirmar verde sin resultado.

## 2 · Persistencia y disponibilidad efectiva

Archivos: migración nueva en `supabase/migrations/` (nombre generado por CLI por Ana), `src/domain/api.ts`, `src/domain/calendar.ts`, adaptadores fake/PostgREST y suite `tests/contract/airbnb.contract.ts` con ejecutores unit/db. Regenerar `database.types.ts` desde la migración aplicada.

Interfaces: reserva autorizada de intento por casa, contexto de servicio, finalización transaccional y lectura privada de estado/días con origen. Los nombres finales se fijarán antes del test de contrato; tomar tipos generados, sin conversiones para ocultar tipos incompletos.

- [ ] Pruebas de contrato de dueño/otro/anon/admin, primera lectura, repetición, cambios, cancelación, coincidencias y último válido.
- [ ] Observar fallos de contrato.
- [ ] Separar conexiones/rangos importados de `listing_days`; RLS/grants restrictivos y RPCs con `search_path` fijo. Reserva con exclusión, requestId y versión; finalización rechaza trabajos obsoletos.
- [ ] Actualizar lectura privada/pública, búsqueda y contacto, y conservar edición manual/admin. La eliminación en este checkout es lógica (`deleted_at`): aplicar la regla aprobada también al retirar la casa, no esperar a un DELETE físico.
- [ ] Purga y cachés deben reaccionar a la tabla importada.
- [ ] Aplicar migración y generar tipos con comandos de Ana; ejecutar contratos, incluida regresión de calendario/contacto.

## 3 · Motor y endpoint

Archivos nuevos de worker/servicio PostgREST y `tests/unit/airbnb-worker.test.ts`; conectar en `server/app.ts` e `index.ts` con dependencias inyectadas.

- [ ] Pruebas de autorización previa al fetch, repetición de requestId, carreras, errores seguros y ningún cambio parcial.
- [ ] Observar fallo e implementar el servicio reutilizable y el endpoint de primera conexión. Sin sustitución/desconexión/actualización manual pública de #7.
- [ ] Arnés controlado de repetición con fixture en pruebas locales, sin habilitar un proxy arbitrario ni una ruta insegura en producción.
- [ ] Verificar suites del worker, parser y contrato.

## 4 · Interfaz móvil

Archivos: Calendario y componentes existentes, módulo diferido de conexiones/hoja, adaptador/consulta privada y pruebas Playwright pertinentes.

- [ ] Antes de la pantalla, contratos de tablas y permisos comprobados.
- [ ] Prueba de conexión por casa, carga, URL inválida, lectura fallida, vacío válido y origen.
- [ ] Implementar solo Importar desde Airbnb del diseño aprobado; conservar contexto de casa/mes y guardado de selección. No exponer enlace privado en estado persistido, errores o navegación.
- [ ] No permitir que la edición optimista muestre libre una noche importada. Releer disponibilidad efectiva tras guardado.
- [ ] Verificación visual en móvil mediante servidor local existente o arrancado por Ana; no afirmar verificada por leer JSX.

## 5 · Entrega y verificación

Validación final compartida por Ana: `tests/e2e/airbnb.spec.ts`, 2/2 en verde (11,8 s), con Chrome local y un worker. Cubre conexión/carga, importación por casa, contexto al volver, icono/leyenda/precio y edición del manual coincidente, además del error de lectura sin anunciar éxito. El último build y tamaño están en verde: calendario 8,48/8,5 kB, Airbnb 3,85/5 kB. Tipos y prueba de rejilla fueron condiciones previas del comando que generó ese build. La revisión manual de los demás casos IC01–IC13 sigue disponible para aceptación; no se ha desplegado ni modificado GitHub.

Build final confirmado tras el recuento centralizado: calendario 8,48/8,5 kB y Airbnb 3,85/5 kB; el registro de tamaño ya no presenta excesos ni error final. Ana ejecutó el bloque condicionado por tipos y pruebas de rejilla antes del build. Los límites se mantienen. Falta el recorrido e2e de conexión y edición tras la extracción de componentes y los demás pendientes indicados en este plan.

La medida posterior de Ana confirmó build correcto y un exceso restante de 7 B en calendario (Airbnb 3,78/5 kB). Se centraliza el recuento manual/importado en la integración con una sola pasada y una prueba de coincidencias, manuales independientes y fechas sin fila. Pendiente volver a verificar tipos, rejilla, build y tamaño.

Agrupación confirmada por build de Ana: Airbnb 3,69/5 kB, calendario 8,53/8,5 kB (31 B de exceso). La leyenda específica y su comprobación de noches importadas pasan también a la integración; `MonthLegend` mantiene solo sus estados compartidos y un espacio de contenido adicional. Pendiente comprobación final de límites y pruebas tras este ajuste.

La segunda medida del build de Ana dio calendario 8,66/8,5 kB (163 B de exceso), Airbnb 4,41/5 kB. Se agrupan consulta, fila, controles y pantalla de Airbnb con `codeSplitting.groups` de Vite, siguiendo los grupos existentes; el calendario importa la integración desde ese chunk sin dos envoltorios lazy/Suspense adicionales. El grupo no incluye dependencias recursivas ni código de dominio/descarga del servidor; conserva el presupuesto de 5 kB. Esta agrupación sustituye la carga separada previa de fila y controles. Pendiente verificar build, límites y recorrido.

Primera separación verificada por el build de Ana: inicial 154,07/160 kB, Airbnb 4,03/5 kB; calendario aún 8,81/8,5 kB (312 B por encima). Se trasladaron también los controles y textos específicos de selección importada a `AirbnbAvailability`, en el mismo módulo diferido de integración; el campo de precio se compone desde el panel existente y no cambia su guardado. Pendiente medir de nuevo y ejecutar el recorrido e2e del panel.

Build corregido confirmado en `/tmp/bnbtico-build.log` y 12/12 pruebas de rejilla compartidas por Ana. El chequeo del build nuevo midió calendario 8,99/8,5 kB (exceso 489 B), Airbnb 3,29/5 kB e inicial 153,94/160 kB. Se separó la fila/consulta de Airbnb como módulo diferido específico `airbnb-calendar-row.tsx`, con espacio de carga en la tarjeta de acciones. Su coste sigue incluido en el presupuesto de Airbnb de 5 kB por el patrón `airbnb-*.js`; no se elevan límites ni se excluye código de todos los presupuestos. Pendiente repetir tipos, build y tamaño.

El build ejecutado por Ana se detuvo en la regla de arquitectura de `month-grid.tsx`: la importación de `./icons` añadida para la marca privada no estaba permitida. Se conserva la regla: la pantalla proporciona el icono compartido como `ReactNode`, y rejilla/leyenda solo lo presentan. Pendiente repetir build y la prueba de rejilla sobre esta corrección. Los tamaños compartidos anteriormente procedían del build anterior: faltaba el chunk de Airbnb y no validan esta entrega.

Resultado compartido por Ana: `worker-config.test.ts` (4) y `month-grid.test.tsx` (12), 16/16 en verde. Cubre la configuración de la ruta y la marca privada de Airbnb, incluida la variante pública sin proveedor. No se recibió en esta salida el resultado de typecheck; build, tamaño y e2e siguen pendientes.

Ajuste visual posterior aprobado: icono de enlace por noche importada y leyenda privada «Bloqueado por Airbnb», con número y precio conservados. Comprobado en navegador local con la conexión real ya importada, incluido ancho de 375 px: leyenda envuelve y las casillas muestran precio e icono sin solaparse. Añadida cobertura en `month-grid.test.tsx` y en el recorrido e2e; ejecución pendiente por Ana. La ficha pública conserva la variante sin proveedor al no recibir `importedIcon`.

Comprobación local con navegador: el intento real devolvía HTTP 405 antes del importador porque faltaba `/api/calendarios/*` en `assets.run_worker_first`. Añadida la ruta y una regresión en `worker-config.test.ts` (pendiente de ejecutar por Ana). Tras la recarga automática de Vite, la misma casa de prueba y el enlace real completaron la conexión: la pantalla mostró «Airbnb conectado» y 24 noches bloqueadas. El diagnóstico temporal registró únicamente el estado HTTP y se retiró; no se copiaron el enlace ni datos de huéspedes a esta guía. Esto verifica la primera lectura real, no sustituye las comprobaciones restantes del plan.

- [ ] Guía reproducible en `docs/pruebas-manuales.md` con archivo sintético y pasos para primera lectura/repetición/cambios/cancelaciones/fallo.
- [ ] Actualizar contrato técnico, arquitectura, entorno y guía visual según lo efectivamente implementado; decisiones solo si cambia algo aprobado.
- [ ] Ana ejecuta `pnpm typecheck`, suites pertinentes, `pnpm test`, build/size y e2e pertinentes. No start/reset/stop de Supabase compartido, Git remoto ni deploy.
- [ ] Revisión final y correcciones con pruebas antes de proponer commit. No declarar lista o completa mientras falten verificaciones necesarias.
