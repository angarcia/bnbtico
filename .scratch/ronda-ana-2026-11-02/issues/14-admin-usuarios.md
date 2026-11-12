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

## Plan (2026-11-04, agente de planificación; resumen)
- **Ya existe:** `handle_new_user`/`handle_phone_confirmed` (0001_init.sql:190-207) crean el perfil y marcan `phone_verified_at` al confirmar el teléfono; la entrada por OTP con `shouldCreateUser:false` ya encuentra a un usuario sin confirmar. `profiles.is_active` existe pero Explorar, `listing_link_state`, `create_inquiry` (para el anfitrión) y la entrada no lo miran.
- **Crear cuenta:** `POST /api/admin/usuarios` en el worker (patrón de `/api/pago/sesion`): Origin + Bearer; puerta RPC `admin_user_create_check` con el JWT de Ana (`is_admin()` aal2, tope 30/h, número existente → 409 «Ese WhatsApp ya tiene cuenta.» con «Ver su ficha»); con la service role, `POST /auth/v1/admin/users` `{phone, phone_confirm:false, user_metadata:{full_name}}`; registro `admin_user_created` → `admin_actions user.create`. Sin Turnstile (no envía mensajes). Logs sin teléfono.
- **«Gratis hasta»:** tabla `listing_billing_terms(listing_id, free_until, set_by, set_at)` (solo lectura dueño/admin; escribe `admin_set_billing_terms` aal2, solo casas nunca aprobadas, ≤ 24 meses) y `subscriptions.source ('offer'|'admin')`. `review_listing`: con fecha → `plan='promo'`, `promo_slot` null (no ocupa plaza), `promo_ends_on = free_until` → activa; sin nada → `plan='paid'` → Pendiente de pago hasta que el usuario añade método (`apply_payment_event` ya activa). Avisos, `run_subscription_day`, reloj de pruebas y Stripe sin cambios.
- **Desactivar:** `admin_set_user_active(p_user, p_active, p_reason)` (aal2, motivo, no a sí mismo ni a otro admin): `is_active`, `auth.users.banned_until`, borra sesiones, purga fichas; guardas en `listings_public`, `zones_with_listings`, `listing_visible`, `listing_link_state` (410), `create_inquiry`; mensaje «Su cuenta está desactivada. Escríbanos por WhatsApp.» al entrar.
- **Pantallas** (trozo `usuarios-*`): `/admin/usuarios`, `/admin/usuarios/nuevo`, `/admin/usuarios/$id`; RPCs `admin_users(p_q)`, `admin_user(p_user)`; «Crear casa a su nombre» con `admin_create_draft(p_owner)` → asistente en modo admin; fila «Suscripción de esta casa» en el modo admin; «Ver anfitrión» en la hoja de la casa.
- **Riesgos:** número mal tecleado (confirmación con el número grande); service role solo en el worker; escribir `auth.users` desde SQL (comprobar en pruebas; plan B por la API de admin).
- **Entregas:** (1) lista, ficha, WhatsApp, desactivar/reactivar; (2) crear usuario y su casa; (3) «gratis hasta» y Pendiente de pago.
- Decisiones técnicas tomadas por recomendación: opción «Sin periodo gratis» explícita; número existente → 409; condiciones también para casas que empezó el anfitrión (nunca aprobadas); desactivar bloquea la entrada (ban + sesiones); periodo gratis corre con la cuenta desactivada; mismos textos de aviso.
