# #7 · Estado y gestión de conexiones

Status: needs-info
Preparación: Bloqueada por dependencias y condiciones técnicas de entrada; reglas de producto consultadas aprobadas. Diseño: Listo; móvil v0.1 aprobado por Ana el 2026-11-07.
Fuente: https://github.com/angarcia/bnbtico/issues/7 · Épica: #4.

## Objetivo y alcance

El anfitrión conoce el último resultado y mantiene control independiente de importación y exportación. Reutilizar conexión/ingestión #5 y feed #6. Añadir último éxito y error posterior, Actualizar ahora, sustitución validada, desconexión confirmada y revocación confirmada. No construir cron ni afirmar cuándo Airbnb leyó el feed.

## Entrada y diseño

#6 probada/aceptada; P3–P6 resueltas y diseño [v0.1](../diseno-v0.1.md), estado/sustituir/confirmaciones, aprobado. Definir exclusión de trabajos y versionado de conexión: desconectar/sustituir debe impedir que una respuesta vieja vuelva a aplicar noches. Resolver fallo ambiguo de red leyendo estado real antes de repetir una operación irreversible sobre el token.

## BDD

- **Dado** éxito a las 09:17 y fallo a las 12:17, **cuando** abre gestión, **entonces** ve ambos momentos diferenciados y no una fecha de éxito falsa.
- **Dada** una actualización en vuelo, **cuando** otra pestaña o botón solicita otra, **entonces** solo se ejecuta una lectura para esa conexión y la UI comunica progreso.
- **Dado** un enlace conectado, **cuando** sustituye por uno inválido, **entonces** conserva enlace, bloqueos y último éxito; con uno válido sustituye atómicamente solo sus importados.
- **Dado** manual y precio especial coincidentes con importados, **cuando** confirma desconectar, **entonces** se retiran solo importados, cesan actualizaciones y se conservan manual, precio y exportación.
- **Dada** desconexión o sustitución mientras había lectura vieja, **cuando** llega esa respuesta, **entonces** no restaura la conexión ni aplica los bloques antiguos.
- **Dado** enlace exportado, **cuando** cancela revocar, **entonces** sigue funcionando; al confirmar, el antiguo deja de acceder incluso con cachés y la importación no cambia.
- **Dada** revocación correcta, **cuando** vuelve a generar, **entonces** recibe un enlace distinto y se le informa que debe retirar el antiguo de Airbnb, sin prometer liberación inmediata allí.
- **Dado** fallo al gestionar, **cuando** termina la operación, **entonces** no se muestra éxito, se conserva o recupera el estado real y se permite reintentar sin duplicados.

## Validación y skills necesarias

[Plan manual](../pruebas-manuales.md), G y R; carreras con lectura retenida, dos pestañas, permisos, revocación con caché y regresión de importación/exportación. Cubrir sin red y foco en diálogos.

Principal `ana-backend-developer`: transiciones atómicas, exclusión e invalidación. Apoyo `ana-frontend-developer`: estado y confirmaciones según diseño; `ana-ux-ui` si hay desviación. Actualizar guía manual y documentación de recuperación. #8 comienza solo tras aceptación.
