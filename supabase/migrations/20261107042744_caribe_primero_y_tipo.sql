-- bnbtico · Ronda de Ana del 2 nov, ticket 06 (rehecho el 2026-11-06): «¿Dónde?» en blanco = todo el país, con el Caribe
-- primero, y filtro de tipo de alojamiento.
--
-- Parte de la versión vigente de search_listings (20261103071821_total_orientativo_en_busqueda.sql) y solo cambia:
-- 1. El orden (`sort_rank`): primero las casas de Limón y, dentro de cada grupo, las más nuevas primero. Se ordena antes
--    del límite, así que con más de p_limit casas entran antes las del Caribe.
-- 2. `p_kinds` (opcional, al final): solo casas de esos tipos. La app manda ['completo','casa','apartamento'] para
--    «Alojamiento completo» (casa y apartamento son valores anteriores al diseño v1) y ['habitacion'] para «Habitación».
--
-- Añadir un parámetro cambia la firma: se borra la función vieja (si quedaran las dos, PostgREST no sabría cuál elegir).
-- La app ya desplegada la sigue llamando igual, sin p_kinds.

drop function public.search_listings(text, date, date, text, integer, integer, public.feature[], integer, integer, integer);

create function public.search_listings(
  p_zone text default null, p_from date default null, p_to date default null,
  p_province text default null, p_people integer default null, p_bedrooms integer default null,
  p_features public.feature[] default null, p_min integer default null, p_max integer default null,
  p_limit integer default null, p_kinds public.listing_kind[] default null)
returns table (
  id uuid, public_id text, kind public.listing_kind, title text, description text, province text, canton text, zone text,
  lat double precision, lng double precision, capacity integer, bedrooms integer, bathrooms integer, bathroom_shared boolean,
  features public.feature[], parking_paid boolean, accepts_nightly boolean, nightly_price_crc integer, min_nights integer,
  accepts_monthly boolean, monthly_mode text, monthly_price_crc integer, min_months integer, available boolean, reopen_at date,
  created_at timestamptz, updated_at timestamptz, owner_name text, owner_whatsapp_verified boolean, photos jsonb,
  stay_total_crc bigint, sort_rank integer
)
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
    -- Calificado: los nombres de `returns table` (id, zone…) son variables dentro de la función.
    select * into z from public.zones zn where zn.id = p_zone and zn.active;
    if not found then return; end if;
  end if;
  return query
    with picked as materialized (
      select lp, (row_number() over (order by (lp.province = 'Limón') desc, l.created_at desc, l.id desc))::integer as rank
      from public.listings_public lp
      join public.listings l on l.id = lp.id
      where l.available
        and (p_zone is null or l.zone_id = p_zone
             or extensions.ST_DWithin(extensions.ST_SetSRID(extensions.ST_MakePoint(l.lng, l.lat), 4326)::extensions.geography,
                                      z.point::extensions.geography, 5000))
        and (p_from is null or not exists (
              select 1 from public.listing_days d
              where d.listing_id = l.id and d.day >= p_from and d.day < p_to and not d.available))
        and (p_province is null or lp.province = p_province)
        and (p_people is null or lp.capacity >= p_people)
        and (p_bedrooms is null or lp.bedrooms >= p_bedrooms)
        and (p_kinds is null or lp.kind = any (p_kinds))
        and (p_features is null or lp.features @> p_features)
        and (p_min is null or lp.nightly_price_crc >= p_min)
        and (p_max is null or lp.nightly_price_crc <= p_max)
      order by 2
      limit p_limit
    )
    select (pk.lp).*,
      case when p_from is not null then
        public.search_stay_total((pk.lp).id, (pk.lp).nightly_price_crc, (pk.lp).accepts_monthly, (pk.lp).monthly_price_crc, p_from, p_to)
      end,
      pk.rank
    from picked pk
    order by pk.rank;
end $$;
revoke all on function public.search_listings(text, date, date, text, integer, integer, public.feature[], integer, integer, integer, public.listing_kind[]) from public;
grant execute on function public.search_listings(text, date, date, text, integer, integer, public.feature[], integer, integer, integer, public.listing_kind[]) to anon, authenticated;
