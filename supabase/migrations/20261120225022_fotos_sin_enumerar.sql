-- Historia #67, decisión D4 (2026-11-20): mitigación inmediata hasta #69. La política `listings_photos_public_read`
-- (`for select to public`, 20261019192540_fase2_casas.sql) dejaba a cualquiera enumerar el bucket: la raíz daba el uuid de
-- todas las casas, también borradores, y cada carpeta sus fotos pendientes. Se sustituye por lectura del dueño de la casa y
-- del admin (is_admin() exige aal2). Borrar un objeto exige también poder leerlo, por eso no basta con quitarla.
-- No cambia la descarga por URL pública: el bucket sigue público y Storage la sirve sin políticas (la ficha, Explorar y el
-- OG siguen igual). Esa parte la cierra #69 con un bucket privado para lo no aprobado.
drop policy listings_photos_public_read on storage.objects;

create policy listings_photos_owner_read on storage.objects for select to authenticated using (
  bucket_id = 'listings'
  and exists (select 1 from public.listings l where l.id::text = (storage.foldername(name))[1] and l.owner_id = auth.uid()));

create policy listings_photos_admin_read on storage.objects for select to authenticated using (
  bucket_id = 'listings'
  and public.is_admin());
