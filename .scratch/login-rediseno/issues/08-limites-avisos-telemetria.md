# 08 · Límites, avisos de nuevo dispositivo y telemetría

Status: needs-triage
Type: task
Blocked by: 03, 06

## Qué

Ajustar los límites de `spec.md` §4.9 con los datos reales de los tickets anteriores; aviso de nuevo dispositivo por **correo** (texto §6.7) a las cuentas con correo; **sin aviso por WhatsApp** (D1 resuelta: no avisar; los invitados quedan sin aviso, riesgo aceptado); eventos y alarmas de §8 en `docs/telemetria.md`; consultas p75 del embudo. Verificar que un fallo de firma del webhook se alerta.

## Primero las pruebas

Nuevo dispositivo detectado frente a dispositivo conocido; el aviso no se envía en la creación de cuenta; los límites devuelven errores neutros; los eventos no llevan datos personales.

## No tocar

El texto prellenado de A′ (debe seguir siendo el de §6.1); `reminders.ts`.

## Hecho cuando

El aviso de nuevo dispositivo funciona por correo para las cuentas que lo tienen, el webhook nunca envía nada por WhatsApp, y el riesgo aceptado para invitados está registrado en `docs/decisiones.md`.
