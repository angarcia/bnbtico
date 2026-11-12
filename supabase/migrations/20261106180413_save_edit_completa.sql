-- Guardar un cambio de una casa publicada en un solo viaje (auditoría de viajes a Supabase, punto 8, 2026-11-06).
--
-- save_edit devuelve la fila de listing_edits, sin el estado de cada dato ni las fotos nuevas, y la app tenía que volver a
-- leer la edición. Pedírselas embebidas a PostgREST en la misma llamada no sirve: las lee en la misma sentencia y ve el
-- estado de antes de guardar. save_edit_full llama a save_edit y arma la edición en una sentencia aparte (ya ve lo
-- guardado), con la forma de EDIT_SELECT de la app (domain/rows.ts) más listing_id. null si la edición quedó vacía.
--
-- save_edit no cambia (sus reglas, su firma y sus permisos siguen igual): la app que ya está desplegada la sigue usando
-- hasta que llegue la nueva.

create or replace function public.save_edit_full(p_listing uuid, p_patch jsonb) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare
  e public.listing_edits;
begin
  e := public.save_edit(p_listing, p_patch);
  if e.listing_id is null then return null; end if;
  -- Lectura con los permisos de quien llama (RLS de las tablas de la edición), como la que sustituye.
  return (
    select jsonb_build_object(
      'listing_id', le.listing_id,
      'status', le.status,
      'title', le.title,
      'kind', le.kind,
      'bathroom_shared', le.bathroom_shared,
      'description', le.description,
      'lat', le.lat,
      'lng', le.lng,
      'zone', le.zone,
      'zone_id', le.zone_id,
      'zone_source', le.zone_source,
      'listing_edit_fields', coalesce((
        select jsonb_agg(jsonb_build_object('field', f.field, 'status', f.status, 'review_note', f.review_note, 'submitted_at', f.submitted_at))
        from public.listing_edit_fields f where f.listing_id = le.listing_id
      ), '[]'::jsonb),
      'listing_edit_photos', coalesce((
        select jsonb_agg(jsonb_build_object('id', p.id, 'path', p.path, 'position', p.position, 'status', p.status, 'review_note', p.review_note, 'submitted_at', p.submitted_at) order by p.position)
        from public.listing_edit_photos p where p.listing_id = le.listing_id
      ), '[]'::jsonb)
    )
    from public.listing_edits le
    where le.listing_id = p_listing
  );
end $$;

revoke execute on function public.save_edit_full(uuid, jsonb) from public, anon;
grant execute on function public.save_edit_full(uuid, jsonb) to authenticated;
