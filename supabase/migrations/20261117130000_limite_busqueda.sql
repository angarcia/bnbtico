-- search_listings limita siempre dentro de SQL (issue #10, épica DBA #9). Antes, p_limit omitido o NULL dejaba
-- `limit NULL` (sin límite) y una llamada directa a la RPC recorría y calculaba totales para todas las casas elegibles;
-- el máximo de filas de PostgREST no evita ese trabajo. Ahora: omitido o NULL → 60; más de 60 → 60; cero o negativo →
-- error 22023 «Revise el límite.». Filtros, orden, columnas, permisos y SECURITY DEFINER, igual que en
-- 20261117090000_sin_ninos_gratis (el límite ya iba dentro de `picked`, antes de search_stay_total).
CREATE OR REPLACE FUNCTION public.search_listings(p_zone text DEFAULT NULL::text, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_province text DEFAULT NULL::text, p_people integer DEFAULT NULL::integer, p_bedrooms integer DEFAULT NULL::integer, p_features public.feature[] DEFAULT NULL::public.feature[], p_min integer DEFAULT NULL::integer, p_max integer DEFAULT NULL::integer, p_limit integer DEFAULT NULL::integer, p_kinds public.listing_kind[] DEFAULT NULL::public.listing_kind[])
 RETURNS TABLE(id uuid, public_id text, kind public.listing_kind, title text, description text, province text, canton text, zone text, lat double precision, lng double precision, capacity integer, bedrooms integer, bathrooms integer, bathroom_shared boolean, features public.feature[], parking_paid boolean, accepts_nightly boolean, nightly_price_crc integer, min_nights integer, accepts_monthly boolean, monthly_mode text, monthly_price_crc integer, min_months integer, available boolean, reopen_at date, created_at timestamp with time zone, updated_at timestamp with time zone, owner_name text, owner_whatsapp_verified boolean, photos jsonb, stay_total_crc bigint, sort_rank integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  today date := public.costa_rica_today();
  z public.zones;
begin
  if p_limit is not null and p_limit < 1 then
    raise exception 'Revise el límite.' using errcode = '22023';
  end if;
  p_limit := least(coalesce(p_limit, 60), 60);
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
        and (p_from is null or not public.listing_has_busy_nights(l.id, p_from, p_to))
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
end $function$;

revoke all on function public.search_listings(text, date, date, text, integer, integer, public.feature[], integer, integer, integer, public.listing_kind[]) from public;
grant execute on function public.search_listings(text, date, date, text, integer, integer, public.feature[], integer, integer, integer, public.listing_kind[]) to anon, authenticated, service_role;
