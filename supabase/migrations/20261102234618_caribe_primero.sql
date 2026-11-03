-- bnbtico · Ronda de Ana del 2 nov, ticket 06 · «¿Dónde?» en blanco = todo el país, con el Caribe primero.
-- search_listings pone ahora el orden: primero las casas de Limón y, dentro de cada grupo, las más nuevas primero.
-- Solo cambia el `order by` (la versión vigente es la de 20261029091243_explorar_fechas_y_zona.sql). El adaptador
-- PostgREST deja de pedir `created_at desc` encima: ese orden mandaría sobre este.
create or replace function public.search_listings(p_zone text default null, p_from date default null, p_to date default null)
returns setof public.listings_public
language plpgsql stable security definer set search_path = '' as $$
declare
  today date := public.costa_rica_today();
  z public.zones;
begin
  if (p_from is null) <> (p_to is null) then raise exception 'Revise las fechas.'; end if;
  if p_from is not null and (p_to <= p_from or p_from < today or p_to > today + 366) then
    raise exception 'Revise las fechas.';
  end if;
  if p_zone is not null then
    select * into z from public.zones where id = p_zone and active;
    if not found then return; end if;
  end if;
  return query
    select lp.* from public.listings_public lp
    join public.listings l on l.id = lp.id
    where l.available
      and (p_zone is null or l.zone_id = p_zone
           or extensions.ST_DWithin(extensions.ST_SetSRID(extensions.ST_MakePoint(l.lng, l.lat), 4326)::extensions.geography,
                                    z.point::extensions.geography, 5000))
      and (p_from is null or not exists (
            select 1 from public.listing_days d
            where d.listing_id = l.id and d.day >= p_from and d.day < p_to and not d.available))
    order by (l.province = 'Limón') desc, l.created_at desc;
end $$;
