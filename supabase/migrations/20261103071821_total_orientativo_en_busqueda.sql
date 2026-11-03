-- bnbtico · Ronda de Ana del 2 nov, ticket 07 · fin del modo mensual en Explorar y total orientativo de la estancia.
-- Parte de la versión vigente de search_listings (20261029091243_explorar_fechas_y_zona.sql, repuesta tal cual por
-- 20261103055921_revertir_ronda_2_nov.sql). Lo que ya hacía (casas públicas abiertas, zona a 5 km con el punto real, todas
-- las noches de [p_from, p_to) libres, «Revise las fechas.») no cambia. Cambia:
--   1) Recibe también los filtros que antes ponía PostgREST encima (provincia, personas, habitaciones, características,
--      precio mínimo y máximo por noche) y el límite, todos con default null = sin filtro; filtra, ordena y limita dentro.
--      Ya no hay filtro de alquiler mensual (el modo mensual de Explorar se fue el 2026-11-02).
--   2) sort_rank: el orden explícito (las más nuevas primero; el id desempata) para que el adaptador pida
--      `.order("sort_rank")` y no dependa de que PostgREST conserve el orden de la función.
--   3) stay_total_crc: con fechas, el total orientativo de las noches [p_from, p_to) en colones; null sin fechas o si alguna
--      noche no tiene precio. Lo calcula public.search_stay_total, la misma regla que `stayEstimate`
--      (apps/app/src/domain/stay-price.ts): con 30 noches o más y precio al mes, mes × noches / 30 redondeado al colón; si
--      no, la suma de cada noche con su precio especial de listing_days o, sin él, el precio por noche. Se calcula DESPUÉS
--      de filtrar, ordenar y limitar (CTE materializada), solo para las filas que se devuelven; sin fechas no se llama.
--      bigint y no int: 366 noches de un precio alto no caben en un int.
-- Cambia el tipo de retorno (setof listings_public → table): se borra la función de 3 argumentos y se crea la nueva, con los
-- mismos permisos. Una app vieja en caché que llame con (p_zone, p_from, p_to) y filtre, ordene y limite con PostgREST sigue
-- funcionando: los demás argumentos tienen default y las columnas de listings_public siguen ahí. Esas columnas se repiten
-- en `returns table`: si cambia listings_public hay que recrear esta función (tests/db/total-orientativo.test.ts lo vigila).
drop function public.search_listings(text, date, date);

-- Sin security definer: solo la llama search_listings (que corre como su dueño). plpgsql y no sql para que no se expanda
-- en línea: así sus llamadas se pueden contar (pg_stat_user_functions) en la prueba.
create function public.search_stay_total(p_listing uuid, p_nightly integer, p_accepts_monthly boolean, p_monthly integer, p_from date, p_to date)
returns bigint
language plpgsql stable set search_path = '' as $$
declare
  nights integer := p_to - p_from;
begin
  if nights >= 30 and p_accepts_monthly and p_monthly > 0 then
    return round(p_monthly::numeric * nights / 30)::bigint;
  end if;
  -- Sin noches (no pasa: search_listings exige salida > llegada) no hay filas y sale null.
  return (
    select case when bool_and(n.price is not null) then sum(n.price) end
    from (
      select coalesce(d.special_price_crc, p_nightly) as price
      from generate_series(0, nights - 1) as g(i)
      left join public.listing_days d on d.listing_id = p_listing and d.day = p_from + g.i
    ) n
  );
end $$;
revoke all on function public.search_stay_total(uuid, integer, boolean, integer, date, date) from public, anon, authenticated;

create function public.search_listings(
  p_zone text default null, p_from date default null, p_to date default null,
  p_province text default null, p_people integer default null, p_bedrooms integer default null,
  p_features public.feature[] default null, p_min integer default null, p_max integer default null,
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
    -- Calificado: los nombres de `returns table` (id, zone…) son variables dentro de la función.
    select * into z from public.zones zn where zn.id = p_zone and zn.active;
    if not found then return; end if;
  end if;
  return query
    with picked as materialized (
      select lp, (row_number() over (order by l.created_at desc, l.id desc))::integer as rank
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
revoke all on function public.search_listings(text, date, date, text, integer, integer, public.feature[], integer, integer, integer) from public;
grant execute on function public.search_listings(text, date, date, text, integer, integer, public.feature[], integer, integer, integer) to anon, authenticated;
