-- Página siguiente de Explorar (issue #10, «Ver más casas»). search_listings recibe un cursor opcional —la clave de orden
-- de la última casa devuelta: Caribe (province = 'Limón'), created_at e id— y devuelve las que van detrás, con el mismo
-- límite de 60 (20261117130000_limite_busqueda). Cursor y no offset: no recorre las páginas anteriores ni repite o salta
-- casas si entra una nueva entre página y página. Nueva columna has_more: se eligen 61 y la de más solo dice que hay otra
-- página (no sale ni se le calcula el total). Filtros, orden, permisos y SECURITY DEFINER, iguales.
-- Cambia la firma: se borra la anterior para que no queden dos (PostgREST no elegiría bien entre sobrecargas).
drop function public.search_listings(text, date, date, text, integer, integer, public.feature[], integer, integer, integer, public.listing_kind[]);

CREATE OR REPLACE FUNCTION public.search_listings(p_zone text DEFAULT NULL::text, p_from date DEFAULT NULL::date, p_to date DEFAULT NULL::date, p_province text DEFAULT NULL::text, p_people integer DEFAULT NULL::integer, p_bedrooms integer DEFAULT NULL::integer, p_features public.feature[] DEFAULT NULL::public.feature[], p_min integer DEFAULT NULL::integer, p_max integer DEFAULT NULL::integer, p_limit integer DEFAULT NULL::integer, p_kinds public.listing_kind[] DEFAULT NULL::public.listing_kind[], p_after_caribe boolean DEFAULT NULL::boolean, p_after_created timestamp with time zone DEFAULT NULL::timestamp with time zone, p_after_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(id uuid, public_id text, kind public.listing_kind, title text, description text, province text, canton text, zone text, lat double precision, lng double precision, capacity integer, bedrooms integer, bathrooms integer, bathroom_shared boolean, features public.feature[], parking_paid boolean, accepts_nightly boolean, nightly_price_crc integer, min_nights integer, accepts_monthly boolean, monthly_mode text, monthly_price_crc integer, min_months integer, available boolean, reopen_at date, created_at timestamp with time zone, updated_at timestamp with time zone, owner_name text, owner_whatsapp_verified boolean, photos jsonb, stay_total_crc bigint, sort_rank integer, has_more boolean)
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
  -- El cursor es la clave de orden de la última casa de la página anterior: todo o nada.
  if num_nonnulls(p_after_caribe, p_after_created, p_after_id) not in (0, 3) then
    raise exception 'Revise la página.' using errcode = '22023';
  end if;
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
        -- Página siguiente: las que van detrás de la última devuelta en el mismo orden (Caribe primero, más nuevas, id).
        and (p_after_id is null or ((lp.province = 'Limón'), l.created_at, l.id) < (p_after_caribe, p_after_created, p_after_id))
      order by 2
      -- Una de más solo para saber si hay otra página; no sale ni se le calcula el total.
      limit p_limit + 1
    )
    select (pk.lp).*,
      case when p_from is not null then
        public.search_stay_total((pk.lp).id, (pk.lp).nightly_price_crc, (pk.lp).accepts_monthly, (pk.lp).monthly_price_crc, p_from, p_to)
      end,
      pk.rank,
      (select count(*) from picked) > p_limit
    from picked pk
    where pk.rank <= p_limit
    order by pk.rank;
end $function$;

revoke all on function public.search_listings(text, date, date, text, integer, integer, public.feature[], integer, integer, integer, public.listing_kind[], boolean, timestamp with time zone, uuid) from public;
grant execute on function public.search_listings(text, date, date, text, integer, integer, public.feature[], integer, integer, integer, public.listing_kind[], boolean, timestamp with time zone, uuid) to anon, authenticated, service_role;
