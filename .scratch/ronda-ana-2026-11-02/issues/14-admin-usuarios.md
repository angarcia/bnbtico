# 14 · Admin → Usuarios

Status: needs-plan (Daniel, 2026-11-04)

Hoy `/admin/usuarios` es un marcador («Muy pronto», `client/shell.tsx`). Decidido antes: 2026-10-12 (buscar, consultar, desactivar/reactivar con motivo, historial); diseño v1 (solo nombre, WhatsApp y casas, sin documentos); 2026-11-03 (el admin edita casas pero no usuarios).

## Qué (Daniel, 2026-11-04)
1. **Lista y búsqueda** por nombre o WhatsApp: nombre, WhatsApp, si es anfitrión, nº de casas.
2. **Ficha del usuario:** nombre, WhatsApp (verificado o «pendiente»), fecha de alta, sus casas (enlace a cada una en el admin) y sus consultas recientes.
3. **Desactivar / reactivar** con motivo obligatorio (registro en `admin_actions`): desactivado no puede entrar ni contactar y sus casas salen de Explorar; se conserva todo.
4. **«Escribirle por WhatsApp»** (abre `wa.me` con su número, a mano, como «Avisar a…» de las casas).
5. **Crear usuario** con nombre y WhatsApp: la persona entra después sola con su teléfono y el código (OTP de siempre). **Su WhatsApp cuenta como verificado solo cuando entra con el código**; hasta entonces «pendiente» y sus casas dicen solo «Anfitrión».
6. **Crear casas en su nombre** con el asistente en modo admin (ticket 10). Ana elige la suscripción de cada casa: **la oferta de lanzamiento** (como todas, por plazas) **o «gratis hasta <fecha>»** (no ocupa plaza de la oferta; al llegar la fecha, avisos y pago como siempre). Ana puede enviarla y aprobarla: **con periodo gratis queda activa**; **sin nada gratis queda «Pendiente de pago»** (no sale en Explorar) hasta que el propio usuario entre y añada su método de pago — nunca se le activa un cobro sin su aceptación.

## Lo que debe traer el plan
- Cómo se crea la cuenta (Auth de Supabase) sin exponer la clave de servicio: endpoint del worker (`src/server`) que comprueba que quien llama es admin en aal2 (sin «verificar JWT» a mano si se puede delegar en Postgres: p. ej. llamar a una RPC con el JWT del usuario que devuelva `is_admin()`), crea el usuario con el teléfono sin confirmar, crea el perfil, registra en `admin_actions`. Qué pasa si el número ya existe. Turnstile/abuso.
- Que la primera entrada con OTP de ese número funcione con `signInWithOtp` y `shouldCreateUser:false` como hoy, y marque `phone_verified_at`.
- Modelo de «gratis hasta <fecha>» en la suscripción sin romper la oferta, los avisos 90/30/7/0, el reloj de pruebas ni `run_subscription_day`.
- Desactivar: qué columnas/guardas existen ya (`profiles.is_active`), qué falta (Explorar, contacto, entrada).
- Pantallas y rutas del admin, reutilizando lo existente; presupuesto (zona del admin 13,9 de 14 KB: probablemente trozo propio).
- Pruebas: contrato, tests/db (permisos: solo admin aal2), e2e del recorrido de Ana, y del usuario entrando por primera vez.
- Decisiones abiertas con recomendación.
