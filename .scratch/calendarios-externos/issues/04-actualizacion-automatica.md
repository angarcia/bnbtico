# #8 · Actualización automática cada tres horas

Status: needs-info
Preparación: Bloqueada por dependencias y condiciones técnicas de entrada; reglas de producto consultadas aprobadas. Diseño: Listo; móvil v0.1 aprobado por Ana el 2026-11-07.
Fuente: https://github.com/angarcia/bnbtico/issues/8 · Épica: #4.

## Objetivo y alcance

Mantener las noches de Airbnb sin intervención del anfitrión. Reutilizar el servicio de lectura y reconciliación #5 y exclusión/estado #7; no un segundo parser o lógica de ocupación. Ejecutar por ciclo de tres horas, conservar el último conjunto válido al fallar, registrar error y reintentar en el siguiente ciclo. No imponer frecuencia de lectura a Airbnb ni enviar avisos WhatsApp/correo fuera de alcance.

## Entrada y diseño

#7 probada/aceptada; P5/P6 y operación acordadas: horario, tolerancia, límites por ciclo, tratamiento de retrasos, observabilidad y recuperación. Diseño [v0.1](../diseno-v0.1.md), estado de periodicidad, aprobado. Contrastar el cron horario ya existente: no sustituirlo ni interrumpir trabajos de suscripciones/telemetría. Acordar entorno y fixtures seguros; no cambiar infraestructura alojada desde esta preparación.

## BDD

- **Dada** conexión activa y evento nuevo, **cuando** llega su siguiente ciclo de tres horas, **entonces** se aplica la lectura válida sin tocar Actualizar y se actualiza el último éxito.
- **Dado** fallo en un ciclo, **cuando** termina el intento, **entonces** conserva bloques y fecha de éxito, registra el error y vuelve a intentar en el siguiente ciclo.
- **Dada** actualización manual en curso, **cuando** llega el ciclo, **entonces** no se ejecutan dos lecturas simultáneas ni se sobreescribe un resultado más reciente.
- **Dada** conexión desconectada, **cuando** llega el ciclo o termina un trabajo antiguo, **entonces** no vuelve a importar.
- **Dada** una casa con fallo y otra sana, **cuando** corre el ciclo, **entonces** el fallo de una no impide procesar la otra, y no se exponen sus URLs privadas en registros.
- **Dado** un ciclo retrasado, **cuando** se muestra el estado, **entonces** la UI muestra tiempos reales y nunca declara éxito sin lectura válida.

## Validación y skills necesarias

[Plan manual](../pruebas-manuales.md), A y R; reloj controlado para ciclos y fallo/recuperación, y una prueba real del programador en entorno autorizado. Registrar hora prevista, intento y resultado sin secretos; revisión de observabilidad y procedimiento para detener/reanudar el trabajo. Ana ejecuta comandos. No dar por verificados tres horas reales por pasar una prueba de reloj simulado.

Principal `ana-backend-developer`: servicio y trabajo programado. Apoyo `ana-devops`: configuración del programador, operación y verificación sin afectar cron vigente; `ana-frontend-developer` para texto/estado de periodicidad aprobado. Revisar `docs/architecture.md`, `docs/telemetria.md`, configuración y guía manual con la implementación.
