# 10 · El admin edita las casas

Status: needs-plan (el agente primero propone el plan; se implementa tras aprobarlo)

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
