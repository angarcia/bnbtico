-- Sin «Niños pequeños gratis» (decisión 2026-11-17): la característica sale del tipo feature, no solo de la pantalla.
-- Postgres no deja quitar un valor de un enum: se crea el tipo de nuevo sin kids_free y se convierten las columnas. Las
-- vistas que leen listings.features (y las que cuelgan de ellas) y search_listings, que recibe y devuelve feature[], se
-- borran y se crean igual que estaban, con los mismos permisos. Los datos son de prueba: el valor se quita sin aviso.

-- 1. Datos: fuera de las casas (con la guarda de estado abierta, como el servicio) y de las peticiones.
select set_config('app.allow_status', 'on', true);
update public.listings set features = array_remove(features, 'kids_free') where 'kids_free' = any(features);
update public.requests set must_have = array_remove(must_have, 'kids_free') where 'kids_free' = any(must_have);

-- 2. Lo que depende del tipo y no se puede convertir en su sitio.
drop function public.search_listings(text, date, date, text, integer, integer, public.feature[], integer, integer, integer, public.listing_kind[]);
drop view public.features_with_listings;
drop view public.provinces_with_listings;
drop view public.listings_public;

-- 3. El tipo nuevo y las columnas.
alter type public.feature rename to feature_old;
create type public.feature as enum ('pool', 'pets', 'wifi', 'ac', 'parking', 'ev', 'beachfront', 'bbq');
alter table public.listings alter column features drop default;
alter table public.listings alter column features type public.feature[] using features::text[]::public.feature[];
alter table public.listings alter column features set default '{}'::public.feature[];
alter table public.requests alter column must_have drop default;
alter table public.requests alter column must_have type public.feature[] using must_have::text[]::public.feature[];
alter table public.requests alter column must_have set default '{}'::public.feature[];
drop type public.feature_old;

-- 4. Las vistas, como estaban (pg_get_viewdef de la base local al día).
create view public.listings_public as
 SELECT l.id,
    l.public_id,
    l.kind,
    l.title,
    l.description,
    l.province,
    l.canton,
    l.zone,
    (public.approx_point(l.lat, l.lng, l.public_id))[0] AS lat,
    (public.approx_point(l.lat, l.lng, l.public_id))[1] AS lng,
    l.capacity,
    l.bedrooms,
    l.bathrooms,
    l.bathroom_shared,
    l.features,
    l.parking_paid,
    l.accepts_nightly,
    l.nightly_price_crc,
    l.min_nights,
    l.accepts_monthly,
    l.monthly_mode,
    l.monthly_price_crc,
    l.min_months,
    l.available,
    l.reopen_at,
    l.created_at,
    l.updated_at,
    p.full_name AS owner_name,
    p.phone_verified_at IS NOT NULL AS owner_whatsapp_verified,
    COALESCE(( SELECT jsonb_agg(ph.path ORDER BY ph."position", ph.created_at) AS jsonb_agg
           FROM public.listing_photos ph
          WHERE ph.listing_id = l.id), '[]'::jsonb) AS photos
   FROM public.listings l
     JOIN public.profiles p ON p.id = l.owner_id
  WHERE l.status = 'active'::public.listing_status AND l.admin_hold IS NULL AND l.deleted_at IS NULL;

create view public.features_with_listings as
 SELECT DISTINCT unnest(features) AS feature
   FROM public.listings_public l
  WHERE available;

create view public.provinces_with_listings as
 SELECT province,
    count(*)::integer AS listings
   FROM public.listings_public
  GROUP BY province;

grant select on public.listings_public, public.features_with_listings, public.provinces_with_listings to anon, authenticated, service_role;

-- 5. search_listings, igual que estaba (pg_get_functiondef), con el tipo nuevo.
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
end $function$

;

revoke all on function public.search_listings(text, date, date, text, integer, integer, public.feature[], integer, integer, integer, public.listing_kind[]) from public;
grant execute on function public.search_listings(text, date, date, text, integer, integer, public.feature[], integer, integer, integer, public.listing_kind[]) to anon, authenticated, service_role;
