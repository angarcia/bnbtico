-- PENDIENTE DEL CORTE DE LA FASE R (docs/corte-fase-r.md, paso 8). No está en supabase/migrations/ a propósito: la app
-- vieja de Vercel (apps/web) todavía inserta, actualiza y borra filas de listing_photos directamente y sube fotos con el
-- nombre antiguo <casa>/<uuid>.jpg. Aplicarla antes de retirar la app vieja rompe la subida de fotos en pruebas.bnbtico.com.
--
-- El día del corte, cuando ningún navegador use ya la app vieja:
--   pnpm exec supabase migration new corte_fotos_solo_rpc < /dev/null
--   (copiar este archivo encima del generado, borrar este y la carpeta si queda vacía)
--   pnpm exec supabase migration up --local && pnpm --filter web db:types   # sin cambios de tipos esperados
--   pruebas en verde (ver el guion: cambia una prueba de tests/db/cliente-directo-fotos.test.ts) y después db push.
--
-- Qué hace (nota del ticket 08):
-- 1. Las filas de listing_photos solo cambian por las RPCs security definer add_listing_photo, remove_listing_photo y
--    reorder_listing_photos (posición, topes, dueño y estado en SQL). El borrado en cascada al descartar una casa no
--    depende de estos privilegios. Lectura sin cambios (photos_select y la vista pública).
-- 2. Storage solo acepta las tres variantes <casa>/<uuid>/{480,800,1600}.jpg. Las fotos antiguas ya subidas siguen
--    sirviéndose y pueden quitarse (la política de delete no mira el nombre).

revoke insert, update, delete on listing_photos from authenticated;
-- La política «for all» del dueño queda solo como lectura de sus fotos; sin privilegios de escritura ya no aplica a ellas.
drop policy photos_owner_write on listing_photos;
create policy photos_owner_read on listing_photos for select using (listing_editable(listing_id));

drop policy listings_photos_owner_insert on storage.objects;
create policy listings_photos_owner_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'listings'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/(480|800|1600)\.jpg$'
  and listing_editable(((storage.foldername(name))[1])::uuid)
  and listing_folder_objects((storage.foldername(name))[1]) < 45);
