# 05 · Interfaz: verificar WhatsApp al contactar y al publicar

Status: needs-triage
Type: task
Blocked by: 04, **puerta UX** (revisión UI/UX de las pantallas de `spec.md` §6 y, si hace falta, `docs/diseno-v1.md` actualizado)

## Qué

Construir las pantallas de §6.1 (hoja «Verifique su WhatsApp», espera, éxito, vencido, QR en escritorio, respaldo), reemplazar el formulario actual de `client/sign-in.tsx`, integrar el nuevo paso en `shared/contact-flow.ts` (la consulta se registra y WhatsApp del anfitrión se abre al terminar) y en el paso de fotos de «Publicar» (regla del 2026-11-04). Español de Costa Rica, trato de **usted**, sin voseo ni tuteo. Respetar tokens y estilos de `design/tokens/tokens.json` 0.2.2.

## Proceso

1. Mostrar capturas en vista móvil y obtener visto bueno **antes** de la e2e completa; correr la e2e una vez antes del commit.
2. Actualizar `docs/pruebas-manuales.md` con los recorridos de cliente y anfitrión.

## No tocar

Los métodos añadidos (ticket 06); la pantalla de Cuenta; `MfaApi`; las reglas de contacto (`create_inquiry`) más allá de lo necesario.

## Hecho cuando

Un invitado nuevo contacta con un solo paso de verificación en Playwright (Pixel 7) con el endpoint fake; sin violaciones de CSP ni avisos de hidratación; el embudo de telemetría de §8 emite sus eventos.
