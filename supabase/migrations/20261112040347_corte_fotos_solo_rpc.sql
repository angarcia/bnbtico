-- Corte de la fase R, paso 8 (docs/corte-fase-r.md): Vercel se retiró el 2026-11-11 y ya ningún navegador usa la app
-- vieja, la única que escribía listing_photos directamente y subía la foto única <casa>/<uuid>.jpg.
--
-- Rehecha a partir de las reglas vigentes, no del borrador de supabase/migrations-pendientes (2026-10-23): desde
-- entonces la subida de fotos usa listing_photo_uploadable (también para las fotos que van a revisión al editar una
-- casa publicada) y aquel borrador la habría devuelto a listing_editable.
--
-- 1. Las filas de listing_photos solo cambian por las RPCs security definer (add_listing_photo, remove_listing_photo,
--    reorder_listing_photos, add_edit_photo, review_edit_photo). La lectura no cambia: photos_select para el público y
--    photos_owner_read, con el mismo alcance que tenía photos_owner_write, para el dueño.
-- 2. Storage solo acepta las tres variantes <casa>/<uuid>/{480,800,1600}.jpg. Las fotos antiguas ya subidas se siguen
--    sirviendo y se pueden borrar (las políticas de lectura y borrado no miran el nombre).
--
-- Volver atrás: grant insert, update, delete on listing_photos to authenticated; recrear photos_owner_write
-- (for all using/with check listing_editable(listing_id)) y el patrón (/(480|800|1600))? en la subida.

revoke insert, update, delete on public.listing_photos from authenticated, anon;

drop policy photos_owner_write on public.listing_photos;
create policy photos_owner_read on public.listing_photos for select using (listing_editable(listing_id));

drop policy listings_photos_owner_insert on storage.objects;
create policy listings_photos_owner_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'listings'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/(480|800|1600)\.jpg$'
  and listing_photo_uploadable(((storage.foldername(name))[1])::uuid)
  and listing_folder_objects((storage.foldername(name))[1]) < 45);
