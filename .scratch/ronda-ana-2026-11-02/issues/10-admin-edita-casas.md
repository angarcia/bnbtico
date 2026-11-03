# 10 · El admin edita las casas

Status: ready-for-agent (versión simplificada, Daniel 2026-11-03: manda la sección final)

## Qué (decisión 2026-11-02)
- El admin edita **cualquier dato de cualquier casa**, borradores incluidos (para asistir a anfitriones nuevos al crearla y con los cambios pedidos).
- Se aplica **al momento, sin revisión**.
- Cada edición queda en `admin_actions` (`listing.edit`, con los campos cambiados).
- El anfitrión ve «Editado por bnbtico» en su casa (dónde y hasta cuándo: proponga).
- Usuarios: no se editan.

## Contexto (estado actual)
- Hoy el admin solo revisa (`review_listing`, `review_edit_field`, `review_edit_photo`) y retiene (`admin_pause/resume/block/unblock/delete_listing`, `supabase/migrations/20261030233129_admin_casas_acciones.sql:723-808`), con `is_admin()` en aal2, motivo y `admin_actions`. UI en `client/admin.ts` y la hoja de «Casas» del admin.
- `listings_protect` congela el contenido fuera de `draft`/`changes`; una casa publicada cambia con `update_listing_live` o con ediciones revisadas (`listing_edits` + `listing_edit_fields`).
- Fotos: Storage `<casa>/<uuid>/<tamaño>.jpg`, políticas del propietario.

## Lo que debe traer el plan
1. RPCs (p. ej. `admin_update_listing(p_listing, p_patch jsonb)`) y cómo pasan `listings_protect` sin abrirlo a nadie más; validaciones (las mismas reglas de `listing-rules.ts` / `submit_listing`).
2. Fotos (subir, quitar, ordenar) y calendario de una casa ajena: políticas de Storage para admin.
3. Qué pasa si hay ediciones pendientes de revisión del anfitrión sobre el mismo dato.
4. UI: reutilizar las pantallas de edición/asistente en «modo admin» desde la hoja de la casa del admin, sin duplicar formularios; rutas y guardas (`is_admin`).
5. Purga de la ficha (`purge_listing_page`) tras editar una casa publicada.
6. Pruebas: contrato, `tests/db`, e2e.

## No tocar
- Flujo de revisión dato a dato del anfitrión, retención y sus RPCs.
- Segundo factor del admin (aal2) en `is_admin()`.

## Plan (2026-11-02, agente de planificación; revisado por el orquestador)

**Hallazgos.** `listings_protect` ya deja pasar a un admin aal2 (`20261030233129_admin_casas_acciones.sql:645`) y la RLS de UPDATE también: hoy un admin puede hacer PATCH directo a cualquier columna sin validar ni dejar rastro. Las RPCs del anfitrión filtran `owner_id = auth.uid()` (no se les añade rama admin). La purga de la ficha ya la hacen triggers. «Casas» del admin solo lista casas con suscripción: los borradores no aparecen. `admin_actions` solo tiene `reason`.

1. **RPCs (migración `admin_edita_casas`)**, separadas de las del anfitrión pero con las comprobaciones compartidas (cero copias): extraer `listing_check_live(l, m, keys)` de `update_listing_live` y usar `listing_edit_check`/`edit_place` para nombre, tipo, descripción y ubicación.
   - `admin_update_listing(p_listing, p_patch jsonb, p_seen_at timestamptz, p_note text) returns text[]` vía `admin_house_for_action` (aal2, `for update`). Claves permitidas: tipo, baño compartido, nombre, descripción, ubicación entera, capacidad, habitaciones, baños, características, parqueo, precios. Otras → «Ese dato no se puede cambiar aquí.». Publicada: reglas de «Editar sigue las reglas de crear». Borrador/cambios/revisión/rechazada: mismas reglas por clave, se admite vacío. `p_seen_at` caduco → «La casa cambió. Vuelva a abrirla.».
   - Fotos: `admin_add_listing_photo`, `admin_remove_listing_photo`, `admin_reorder_listing_photos` (misma regex, tope 15 contando pendientes, publicada conserva ≥ 1).
   - Calendario: `admin_save_listing_days` con el núcleo extraído de `save_listing_days` (versión tras el 04) a `listing_days_apply`.
   - `ack_admin_edit(p_listing)` para el anfitrión.
   - Permisos con el patrón de las RPCs admin; helpers internos sin grant.
2. **`listings_protect`:** las RPCs usan `app.allow_status`. Añadir `admin_edited_at`/`admin_edited_fields` a lo que el anfitrión no puede cambiar. D3: quitar `is_admin() or` del trigger.
3. **Storage:** políticas nuevas aparte `listings_photos_admin_insert/delete` con `public.is_admin()`; no se tocan las del anfitrión.
4. **Ediciones pendientes del anfitrión sobre el mismo dato:** se descartan al guardar el admin (helper `listing_edit_clear_field`; no se tocan `review_edit_*` ni `discard_edit_field`). La UI avisa antes con «Usar el del anfitrión».
5. **Auditoría:** `admin_actions.details jsonb` con campos, antes/después y descartados; una fila `listing.edit` por guardado.
6. **«Editado por bnbtico»:** columnas `listings.admin_edited_at`, `admin_edited_fields`; etiqueta en Mis casas, aviso en el detalle (y en «Revisar y enviar» si es borrador) con «Entendido»; caduca a los 14 días.
7. **UI:** rutas `/admin/casas/$id` y `/admin/casas/$id/$parte/$paso` (máx. 2, viven en el JS inicial). «Modo admin» = contexto `EditorProvider` con un puerto `ListingEditor` que usan los mismos formularios de editar y del asistente (sin copias); `AdminListingsApi.editor` con adaptador PostgREST y fake. Entradas: «Editar casa» en la hoja de la casa del admin y lista de borradores y casas sin suscripción. Todo en un trozo `admin-editar-*` con su límite.
8. **Riesgos:** R1 PATCH directo sin auditoría (D3); R2 sesión que baja a aal1 a mitad (llevar a `/admin/codigo?next=` conservando el formulario); R3 `details` solo para admin; R4 el anfitrión no borra `admin_edited_*`; R5 que el modo admin no entre en el JS inicial; R6 concurrencia (`p_seen_at`).
9. **Pruebas:** contrato `admin-edita.contract.ts` (fake y PostgREST), `tests/db/admin-edita-casas.test.ts`, regresión de editar/publicar/calendario, e2e `admin-edita-casas.spec.ts`.

### Decisiones abiertas (recomendación)
- D1 ¿El admin envía a revisión o publica el borrador de otro? **No**: edita y asiste; envía el anfitrión.
- D2 ¿Nota obligatoria al editar? **Opcional** (el antes/después ya queda registrado).
- D3 ¿Cerrar el PATCH directo del admin? **Sí**.
- D4 «Editado por bnbtico» hasta «Entendido» o **14 días**.
- D5 Editar casas rechazadas, en revisión, pausadas o bloqueadas: **sí**; eliminadas no.
- D6 Al descartar un cambio pendiente del anfitrión: **avisarle con «Editado por bnbtico»** nombrando el dato y ofrecer el botón de WhatsApp manual.
- D7 Va después del 08 (todo el 04 y el 12 ya están).

## Versión simplificada (Daniel, 2026-11-03) — MANDA sobre el plan y D1–D7 de arriba

La única admin es Ana: no hace falta controlar al propio admin.
- **Ana edita cualquier dato de cualquier casa** (cualquier estado salvo eliminada), **al momento y sin revisión**, con **las mismas pantallas** que el anfitrión: el asistente para borradores y la ficha editable / «Editar un dato» para casas publicadas, en «modo admin» (contexto o puerto, sin duplicar formularios). También fotos (subir, quitar, ordenar) y calendario de una casa ajena.
- **Las reglas de datos son las de crear/editar** (ticket 12: `requiredProblems`, `warnings`, reglas por dato, la excepción de lo publicado al momento): reutilizarlas en cliente y en SQL; nada de reglas nuevas.
- **D1:** Ana puede también **enviar a revisión** el borrador de otro (y aprobarlo con la revisión de siempre).
- **D2:** sin nota. **D3:** no se cierra la vía directa del admin; **solo una línea** en `admin_actions` por guardado (`listing.edit`, con la casa; sin antes/después). **D4:** sin «Editado por bnbtico» ni aviso al anfitrión. **D5:** cualquier estado salvo eliminada.
- **D6:** **la revisión dato a dato se queda como está** («Aprobar» / «Pedir cambios» con nota; sin «Rechazar»). Si Ana edita ella misma un dato que el anfitrión tenía pendiente, manda lo de Ana y el pendiente de ese dato se descarta, sin aviso.
- **Entradas:** «Editar casa» en la hoja de la casa del admin, y una lista de **borradores** (hoy no se ven en «Casas» porque esa consulta exige suscripción) para asistir en la creación.
- RPCs `admin_*` con `is_admin()` (aal2) que reutilizan las comprobaciones de las del anfitrión (extraer el núcleo compartido; no abrir las del anfitrión con una rama admin). Storage: políticas aparte para el admin. Purga de la ficha: la hacen los triggers.
- Presupuesto: lo nuevo en el trozo del admin o en uno propio diferido; zona privada inicial ~145 de 150 KB.
