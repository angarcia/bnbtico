-- bnbtico · Ronda de Ana del 2 nov, ticket 07 · total orientativo en Explorar y orden explícito.
-- search_listings devuelve ahora, además de las columnas de listings_public:
--   · stay_total_crc: el total orientativo de las noches [p_from, p_to) en colones; null sin fechas o si alguna noche no tiene
--     precio. UNA regla, la misma que `stayEstimate` (apps/app/src/domain/stay-price.ts): con 30 noches o más y precio al mes,
--     mes × noches / 30 (redondeado); si no, la suma de cada noche con el precio especial de listing_days o, sin él, el
--     precio base. Sin fechas no se calcula nada. Es bigint (no int) para que un precio especial enorme no desborde la consulta.
--   · sort_rank: la posición explícita del orden (primero las casas de Limón y, dentro de cada grupo, las más nuevas): el
--     adaptador PostgREST vuelve a pedir `.order("sort_rank")` y el orden deja de depender de que PostgREST conserve el de
--     la función (ticket 06).
-- Además la función recibe ahora TODOS los filtros del catálogo (provincia, personas, habitaciones, baños, tipos, características,
-- precio mínimo y máximo por noche) y el límite, con default null = sin filtro: ordena, limita y SOLO ENTONCES calcula el total
-- (stay_total_crc), así que el total se calcula como mucho para las `p_limit` casas que se devuelven. El cálculo vive en
-- public.search_stay_total (plpgsql, sin permisos para anon/authenticated) para poder contar sus llamadas en una prueba.
-- Cambia el tipo de retorno: se borra la función y se crea de nuevo con los mismos permisos. Las columnas de listings_public
-- se repiten a mano en `returns table` (si cambia esa vista, hay que recrear la función). Lo demás (filtros, zona a 5 km,
-- noches libres) da el mismo resultado que antes (lo que PostgREST filtraba por fuera ahora se filtra dentro, con las mismas comparaciones).
drop function public.search_listings(text, date, date);

create function public.search_stay_total(p_listing uuid, p_nightly integer, p_accepts_monthly boolean, p_monthly integer, p_from date, p_to date)
returns bigint
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_from is null then return null; end if;
  if p_to - p_from >= 30 and p_accepts_monthly and coalesce(p_monthly, 0) > 0 then
    return round(p_monthly::numeric * (p_to - p_from) / 30)::bigint;
  end if;
  return (select case when bool_or(n.price is null) then null else sum(n.price) end
          from (select coalesce(d.special_price_crc, p_nightly) as price
                from generate_series(0, p_to - p_from - 1) g(i)
                left join public.listing_days d on d.listing_id = p_listing and d.day = p_from + g.i) n);
end $$;
revoke all on function public.search_stay_total(uuid, integer, boolean, integer, date, date) from public, anon, authenticated;

create function public.search_listings(
  p_zone text default null, p_from date default null, p_to date default null,
  p_province text default null, p_people integer default null, p_bedrooms integer default null, p_bathrooms integer default null,
  p_kinds text[] default null, p_features public.feature[] default null, p_min integer default null, p_max integer default null,
  p_limit integer default null)
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
    select * into z from public.zones zn where zn.id = p_zone and zn.active;
    if not found then return; end if;
  end if;
  return query
    with picked as (
      select lp.*, (row_number() over (order by (l.province = 'Limón') desc, l.created_at desc))::int as rnk
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
        and (p_bathrooms is null or lp.bathrooms >= p_bathrooms)
        and (p_kinds is null or lp.kind::text = any (p_kinds))
        and (p_features is null or lp.features @> p_features)
        and (p_min is null or lp.nightly_price_crc >= p_min)
        and (p_max is null or lp.nightly_price_crc <= p_max)
      order by rnk
      limit p_limit
    )
    select pk.id, pk.public_id, pk.kind, pk.title, pk.description, pk.province, pk.canton, pk.zone, pk.lat, pk.lng, pk.capacity,
      pk.bedrooms, pk.bathrooms, pk.bathroom_shared, pk.features, pk.parking_paid, pk.accepts_nightly, pk.nightly_price_crc,
      pk.min_nights, pk.accepts_monthly, pk.monthly_mode, pk.monthly_price_crc, pk.min_months, pk.available, pk.reopen_at,
      pk.created_at, pk.updated_at, pk.owner_name, pk.owner_whatsapp_verified, pk.photos,
      public.search_stay_total(pk.id, pk.nightly_price_crc, pk.accepts_monthly, pk.monthly_price_crc, p_from, p_to),
      pk.rnk
    from picked pk
    order by pk.rnk;
end $$;
revoke all on function public.search_listings(text, date, date, text, integer, integer, integer, text[], public.feature[], integer, integer, integer) from public;
grant execute on function public.search_listings(text, date, date, text, integer, integer, integer, text[], public.feature[], integer, integer, integer) to anon, authenticated;
