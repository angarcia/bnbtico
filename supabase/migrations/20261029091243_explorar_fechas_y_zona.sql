-- bnbtico · Explorar al estilo Airbnb (spec .scratch/explorar-airbnb/spec.md, «Data · SQL») · 2026-10-29
-- 1) search_listings: casas públicas abiertas, libres todas las noches de [p_from, p_to) y, con zona, con esa zona o a
--    5 km o menos de su punto. La distancia usa el punto real (listings.lat/lng) dentro de la función: fuera solo sale si
--    la casa está o no en el resultado; listings_public sigue dando el punto aproximado. El resto de filtros (provincia,
--    mensual, personas, habitaciones, características, precio) los añade PostgREST encima. El mensual lo pide el cliente
--    como search_listings(zona, D, D + 30).
-- 2) zones_with_listings: zonas activas con alguna casa activa y abierta a 5 km o menos (o con esa zona), con el cantón y
--    la provincia, para «¿Dónde?». Como listings_public, con los derechos de su dueño (sin security_invoker): lee listings
--    sin exponerla. Los permisos de zones y geo.admin_names no cambian.
-- 3) Telemetría: search_submit (sin casa, solo qué partes de la búsqueda iban puestas, nunca los valores), explore_map_open
--    (sin casa) y map_marker_tap (con casa).
-- Sin índice nuevo: con cientos de filas basta la clave primaria (listing_id, day) de listing_days para el not exists.

create function public.search_listings(p_zone text default null, p_from date default null, p_to date default null)
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
            where d.listing_id = l.id and d.day >= p_from and d.day < p_to and not d.available));
end $$;
revoke all on function public.search_listings(text, date, date) from public;
grant execute on function public.search_listings(text, date, date) to anon, authenticated;

create view public.zones_with_listings as
  select z.id, z.name, z.canton_code, n.name as canton, p.name as province, z.lat, z.lng, count(l.id)::int as listings
  from public.zones z
  join geo.admin_names n on n.code = z.canton_code
  join geo.admin_names p on p.code = left(z.canton_code, 1)
  join public.listings l on l.status = 'active' and l.available and l.lat is not null
    and (l.zone_id = z.id or extensions.ST_DWithin(
          extensions.ST_SetSRID(extensions.ST_MakePoint(l.lng, l.lat), 4326)::extensions.geography,
          z.point::extensions.geography, 5000))
  where z.active
  group by z.id, z.name, z.canton_code, n.name, p.name, z.lat, z.lng;
grant select on public.zones_with_listings to anon, authenticated;

alter table public.events drop constraint events_name_check;
alter table public.events add constraint events_name_check check (name in ('page_view', 'listing_view', 'whatsapp_tap', 'inquiry_created', 'wizard_step', 'search_help_tap', 'monthly_filter_tap', 'search_submit', 'explore_map_open', 'map_marker_tap'));
alter table public.events add column search_flags text[]
  check (search_flags is null or (name = 'search_submit' and search_flags <@ array['zona', 'fechas', 'personas']::text[]));
