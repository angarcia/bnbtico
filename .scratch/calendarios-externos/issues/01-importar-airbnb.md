# #5 · Importar disponibilidad desde Airbnb

Status: needs-info
Preparación: Bloqueada por contrato técnico pendiente; muestra real inspeccionada y compatible con el alcance inicial, reglas de producto consultadas aprobadas. Diseño: Listo; móvil v0.1 aprobado por Ana el 2026-11-07.
Fuente: https://github.com/angarcia/bnbtico/issues/5 · Épica: #4.

## Objetivo, usuario y diferencia

El anfitrión incorpora las noches de Airbnb sin repetir su entrada manual. Existen calendario y bloqueos manuales, no conexión ni procedencia importada. Mantener precios y flujo manual.

## Alcance y exclusiones

Conectar una casa, primera lectura y reconciliación idempotente de una lectura completa válida. Unión de ocupación en calendario privado, búsqueda y componentes públicos vigentes. No nueva pantalla pública; aplicar la corrección del criterio de #5 en [spec](../spec.md). Sin precios/datos de huéspedes, otros proveedores, exportación, botón de gestión de #7 ni cron #8.

## Condiciones de entrada

Contrato técnico preparado, pendiente de contraste final en el checkout de implementación: [#5 v0.1](../contrato-tecnico-05.md). Fija responsabilidades de worker/Postgres, procedencias, publicación atómica, permisos, descarga acotada, parser y consumidores de disponibilidad. Las decisiones técnicas propuestas se validan con pruebas al implementar, sin reabrir el diseño y producto ya aprobados.

Diseño [v0.1](../diseno-v0.1.md), apartados conectar/noches/estados, aprobado; P1–P5 resueltas; muestra anonimizada de Airbnb compatible. Definir contrato con procedencias separadas, permisos de dueño, protección de URL y descarga y publicación atómica del resultado. Tablas nuevas con políticas y pruebas antes de pantalla. No asumir que `CalendarDay.available` identifica el origen. Definir actualización/invalidez de las cachés de dueño, ficha y búsqueda.

## BDD

- **Dado** un dueño con una casa habilitada sin conexión, **cuando** conecta un enlace válido y termina la lectura, **entonces** aparece Airbnb conectado y sus noches ocupadas en esa casa.
- **Dado** un evento 10–13, **cuando** se importa, **entonces** ocupa 10, 11, 12 y no ocupa 13 por ese evento.
- **Dado** manual en 11 y Airbnb en 10–12, **cuando** una nueva lectura válida elimina el evento, **entonces** 11 sigue ocupado y los precios no cambian; quitar solo el manual tampoco libera si permanece Airbnb.
- **Dada** una lectura repetida o eventos solapados, **cuando** se aplican, **entonces** no se duplican noches; cambios y cancelaciones afectan solo a importados.
- **Dada** una reserva cancelada en Airbnb, **cuando** la siguiente lectura completa válida confirma su retirada, **entonces** desaparece su bloqueo importado en bnbtico; la noche solo queda libre si no existe otro bloqueo importado o manual. La procedencia Airbnb debe poder consultarse en el calendario privado, sin revelar datos de huéspedes.
- **Dado** un calendario completo válido vacío, **cuando** se acepta según P3, **entonces** queda conexión activa sin importados y se retiran únicamente los anteriores de esa fuente.
- **Dado** un éxito anterior, **cuando** la siguiente lectura falla, está truncada o contiene bloqueos no admitidos, **entonces** no publica cambios parciales ni altera la fecha de éxito.
- **Dado** enlace inválido, sesión vencida u otro propietario, **cuando** intenta conectar, **entonces** recibe un error sin cambiar conexión ni disponibilidad.
- **Dado** un evento que cruza la ventana, **cuando** se importa, **entonces** se aplica únicamente su intersección según P1; probar hoy, último día y fuera de ventana.
- **Dadas** noches importadas, **cuando** se busca una estancia que las incluye, **entonces** la casa no aparece para esas noches; la salida no cuenta. Los componentes públicos existentes muestran ocupación sin procedencia ni información privada.

## Validación y entrega

Muestra real comprobada el 2026-11-07: [resultado anonimizado y condiciones pendientes](../validacion-muestra.md). Incluye reservas y un período no disponible, todos de día completo. No contiene cancelaciones y todavía no se ha ejecutado un parser. Usar fixtures sintéticos, sin copiar el archivo privado al repositorio.

Contrato fake/PostgREST y permisos, parser con fixtures válidos/rotos, frontera de fechas y sincronización atómica; flujo móvil conectar/error y regresión del manual. Reconciliación posterior verificable por servicio/fixture antes de que exista Actualizar ahora. [Plan manual](../pruebas-manuales.md), casos I y R. Ana ejecuta comandos y pruebas; aquí no se ejecutaron.

## Skills necesarias

Principal `ana-backend-developer`: dominio, ingestión, migración, permisos y contrato. Apoyo `ana-frontend-developer`: conectar y procedencia con diseño aprobado; `ana-ux-ui` solo para cerrar este diseño o resolver desviaciones. `ana-product-owner` acepta reglas/alcance. No habilitar #6 hasta probar y aceptar #5.
