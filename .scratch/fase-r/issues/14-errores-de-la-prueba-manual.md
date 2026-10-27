# 14: Errores de la prueba manual (B12c, B11f, B9d)

**Qué construir:** tres arreglos que salieron de la prueba manual de la fase R en `nueva.bnbtico.com` (aprobados por Daniel el 2026-10-26).

**Bloqueado por:** —

**Status:** ready-for-agent

- [ ] **B12c · barra del admin en Cuenta.** Un admin con sesión aal2 ve la barra del admin (Anuncios · Casas · Usuarios · Cuenta, ticket 09) también en `/cuenta`, no la de cliente. La regla del rol de la barra es una sola y vale en todas las pantallas: zona `/admin` → admin; zona `/propietario` → propietario; fuera de las zonas, admin si la sesión es aal2 y la cuenta es admin, propietario si el modo guardado es propietario, cliente si no. Prueba unitaria de la regla y Playwright: admin aal2 → Cuenta → barra del admin.
- [ ] **B11f · salir del asistente.** La cabecera del asistente de publicar (pasos 1–9) tiene una salida visible «Cerrar» que espera a los guardados en curso (con «Guardando…» mientras tanto) y lleva a Mis casas; el borrador queda guardado y se retoma con «Seguir con el borrador». Playwright: rellenar un paso, «Continuar», «Cerrar» → Mis casas con el borrador y lo escrito guardado en la base.
- [ ] **B9d · invitación a añadir correo.** Revisar con el código y las pruebas cuándo sale «¡Listo! Su cuenta está creada» y si una cuenta nueva sin correo puede no verla (modo entrar, redirección a `next`, cuentas creadas por la app vieja en el mismo proyecto, correo-rótulo del admin). Arreglar lo que sea un fallo y documentar el porqué en el cierre y en `docs/decisiones.md`.
- [ ] `typecheck`, `test`, `test:db`, `build`, `size`, `test:e2e` y `lighthouse` en verde; capturas en Pixel 7 y a 360 px de lo tocado.
