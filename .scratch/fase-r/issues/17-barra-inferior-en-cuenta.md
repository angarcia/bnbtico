# 17: Barra inferior en Ingresar y Mi cuenta

**Qué construir:** la barra inferior se ve en Ingresar (sin sesión) y en Mi cuenta; solo se oculta en la pantalla del código.

**Bloqueado por:** 16

**Status:** done (2026-10-26)

- [x] `/cuenta` sin sesión lleva la barra (pestaña «Mi cuenta» activa); `/cuenta/codigo` sin barra.
- [x] Las pruebas que esperaban Ingresar sin barra (`shell.spec.ts`, `explorar.spec.ts`, `cuenta.spec.ts`…) se ajustan.
- [x] Capturas Pixel 7 y 360 px de Ingresar con barra. Baterías en verde.

## Cierre (2026-10-26)

- `CuentaScreen` monta Ingresar en `TabsFrame` (antes `FlowFrame`); `/cuenta/codigo` sigue en el marco de flujo. Ajustadas `cuenta.spec.ts` (barra con «Mi cuenta» activa en Ingresar, sin barra en el código), `shell.spec.ts` y `explorar.spec.ts`. Capturas Pixel 7 y 360 px.
- **Baterías:** typecheck y build en verde; unitarias 644/644; base 164/164; Playwright 102/102; Lighthouse ficha 1,60 s, shell 0,29 s; zona privada 140,22 KB gz. Sin migraciones.
