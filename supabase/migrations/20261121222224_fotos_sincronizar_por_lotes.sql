-- Historia #69, corrección del 2026-11-21. En pruebas, la primera pasada del cron movió 10 de 30 fotos: cada foto costaba
-- 5 subpeticiones (3 copias, anotar, borrar) y el plan gratuito de Workers corta en 50 por invocación. La décima quedó
-- anotada como privada con sus objetos aún en el público (se cortó antes de borrar) y ya no salía como pendiente.
-- 1. photo_sync_pending también devuelve las fotos bien anotadas que conservan objetos en el bucket que no les toca: una
--    pasada cortada en cualquier punto se termina en la siguiente.
-- 2. set_photo_buckets anota un lote en una sola llamada.

create or replace function public.photo_sync_pending()
returns table(kind text, id uuid, listing_id uuid, path text, from_bucket text, to_bucket text)
language sql stable security definer set search_path = '' as $$
  with photos as (
    select 'listing'::text as kind, ph.id, ph.listing_id, ph.path, ph.bucket,
           case when l.status = 'active' and l.admin_hold is null and l.deleted_at is null then 'public' else 'private' end as target
      from public.listing_photos ph join public.listings l on l.id = ph.listing_id
    union all
    select 'edit'::text, ep.id, ep.listing_id, ep.path, ep.bucket, 'private' from public.listing_edit_photos ep
  )
  select p.kind, p.id, p.listing_id, p.path,
         -- Fuera de sitio: se mueve desde donde está anotada. Bien anotada pero con restos en el otro bucket: se limpia
         -- desde ese (copiar no hace nada si ya está, y después se borra el resto).
         case when p.bucket <> p.target then p.bucket else case p.target when 'public' then 'private' else 'public' end end,
         p.target
    from photos p
   where p.bucket <> p.target
      or exists (
        select 1 from storage.objects o
         where o.bucket_id = case p.target when 'public' then 'listings-privadas' else 'listings' end
           and (o.name = p.path or starts_with(o.name, p.path || '/')))
   order by 1, 2
   limit 500
$$;

create function public.set_photo_buckets(p_items jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  item jsonb;
begin
  if p_items is null or jsonb_typeof(p_items) <> 'array' then raise exception 'Lote no válido.'; end if;
  for item in select * from jsonb_array_elements(p_items) loop
    perform public.set_photo_bucket(item->>'kind', (item->>'id')::uuid, item->>'bucket');
  end loop;
end $$;

revoke all on function public.set_photo_buckets(jsonb) from public, anon, authenticated;
grant execute on function public.set_photo_buckets(jsonb) to service_role;
