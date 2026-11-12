# 14: Errores de la prueba manual (B12c, B11f, B9d)

**Qué construir:** tres arreglos que salieron de la prueba manual de la fase R en `nueva.bnbtico.com` (aprobados por Daniel el 2026-10-26).

**Bloqueado por:** —

**Status:** done (2026-10-26)

- [x] **B12c · barra del admin en Cuenta.** Un admin con sesión aal2 ve la barra del admin (Anuncios · Casas · Usuarios · Cuenta, ticket 09) también en `/cuenta`, no la de cliente. La regla del rol de la barra es una sola y vale en todas las pantallas: zona `/admin` → admin; zona `/propietario` → propietario; fuera de las zonas, admin si la sesión es aal2 y la cuenta es admin, propietario si el modo guardado es propietario, cliente si no. Prueba unitaria de la regla y Playwright: admin aal2 → Cuenta → barra del admin.
- [x] **B11f · salir del asistente.** La cabecera del asistente de publicar (pasos 1–9) tiene una salida visible «Cerrar» que espera a los guardados en curso (con «Guardando…» mientras tanto) y lleva a Mis casas; el borrador queda guardado y se retoma con «Seguir con el borrador». Playwright: rellenar un paso, «Continuar», «Cerrar» → Mis casas con el borrador y lo escrito guardado en la base.
- [x] **B9d · invitación a añadir correo.** Revisar con el código y las pruebas cuándo sale «¡Listo! Su cuenta está creada» y si una cuenta nueva sin correo puede no verla (modo entrar, redirección a `next`, cuentas creadas por la app vieja en el mismo proyecto, correo-rótulo del admin). Arreglar lo que sea un fallo y documentar el porqué en el cierre y en `docs/decisiones.md`.
- [x] `typecheck`, `test`, `test:db`, `build`, `size`, `test:e2e` y `lighthouse` en verde; capturas en Pixel 7 y a 360 px de lo tocado.

## Cierre (2026-10-26)

- **B12c:** `src/client/role.ts` con la regla única (`effectiveRole`, `barRole`) y el modo `admin` guardado; `AdminOutlet` lo fija con la sesión en aal2; `TabsFrame` y Mi cuenta/Cuenta lo usan (admin: «Cuenta», inicio `/admin`, enlace a la revisión y «Buscar una casa» para volver a cliente). Unitarias `tests/unit/role.test.ts` (6) y Playwright en `admin.spec.ts` (Cuenta con la barra del admin, también tras recargar; vuelta a cliente).
- **B11f:** «✕ Cerrar» en la cabecera de los pasos 1–9 (`publicar.tsx`, `CloseWizard`): espera `savesSettled(id)` con «Guardando…» y va a Mis casas. Playwright en `publicar.spec.ts` con el guardado retenido: sigue en el paso hasta que vuelve, luego Mis casas y el título en la base. Captura a 360 px: cabe con «Paso 6 de 9».
- **B9d:** el flujo es correcto para una cuenta nueva sin correo (lo cubren `cuenta.spec.ts` y `contacto-cuenta.spec.ts`, también con `next`). Explicación probable y el fallo contrario (cuenta existente que veía «Su cuenta está creada») en `docs/decisiones.md`; el arreglo de ese fallo llega con el flujo único del ticket 18.
- **De paso:** `no-disponible.spec.ts` ya fallaba antes de los cambios (`:focus` no ve el `input type=date` con el foco en uno de sus campos en el Chrome actual); la prueba mira `document.activeElement`.
- **Baterías:** typecheck y build en verde; unitarias 637/637; base 164/164; Playwright 101/101 (+ capturas omitidas); Lighthouse ficha 1,62 s, shell 0,26 s. Zona privada 139,6 KB gz / 150. Una vuelta suelta de `publicar.spec.ts` agotó el tiempo en «la entrada de lado…» (pasó sola y en la vuelta completa siguiente).
- Sin migraciones.
