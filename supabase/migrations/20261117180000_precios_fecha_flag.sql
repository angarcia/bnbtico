-- Precios por fecha detrás de la feature flag `date_prices` (historia #61, decisiones de Ana del 2026-11-17). Apagada:
-- 1) las lecturas del calendario (effective_calendar_days: ficha, su SSR y la hoja, anfitrión y admin) no devuelven el
--    precio especial: la noche vale el precio por noche, con su ocupación de siempre;
-- 2) el total orientativo de la búsqueda (search_stay_total) suma solo el precio por noche (la regla mensual no cambia);
-- 3) listing_days_update, el único camino que escribe un precio (save_listing_days del anfitrión y del admin), lo rechaza. Cuerpo de 20261104053836_casa_pausada_textos más esta regla.
-- Los precios guardados se conservan (listing_days no se toca) y vuelven tal cual al encenderla. Sin aviso al anfitrión.

create or replace function public.effective_calendar_days(p_listing uuid)
returns table(day date,available boolean,special_price_crc integer,manual_available boolean,imported boolean)
language sql stable security definer set search_path='' as $$
  with dates as (select public.costa_rica_today()+i as d from generate_series(0,365) i), projected as (
    select dt.d, md.available, case when (public.feature_flags()).date_prices then md.special_price_crc end as special_price_crc,
      exists(select 1 from public.airbnb_blocks b join public.airbnb_connections c using(listing_id)
        where b.listing_id=p_listing and c.connected and b.starts_on<=dt.d and b.ends_on>dt.d) as imported
    from dates dt left join public.listing_days md on md.listing_id=p_listing and md.day=dt.d)
  select d,coalesce(available,true) and not imported,special_price_crc,coalesce(available,true),imported
    from projected where available is not null or imported order by d
$$;

create or replace function public.search_stay_total(p_listing uuid, p_nightly integer, p_accepts_monthly boolean, p_monthly integer, p_from date, p_to date)
returns bigint
language plpgsql stable set search_path = '' as $$
declare
  nights integer := p_to - p_from;
  special boolean := (public.feature_flags()).date_prices;
begin
  if nights >= 30 and p_accepts_monthly and p_monthly > 0 then
    return round(p_monthly::numeric * nights / 30)::bigint;
  end if;
  -- Sin noches (no pasa: search_listings exige salida > llegada) no hay filas y sale null.
  return (
    select case when bool_and(n.price is not null) then sum(n.price) end
    from (
      select coalesce(case when special then d.special_price_crc end, p_nightly) as price
      from generate_series(0, nights - 1) as g(i)
      left join public.listing_days d on d.listing_id = p_listing and d.day = p_from + g.i
    ) n
  );
end $$;

create or replace function public.listing_days_update(l public.listings, p_days date[], p_available boolean, p_price_crc int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'America/Costa_Rica')::date;
  days date[];
  base int;
begin
  if l.status = 'rejected' then raise exception 'Este anuncio fue rechazado; publique uno nuevo.'; end if;
  if not l.available then raise exception 'La casa está pausada. Vuelva a publicarla para cambiar el calendario.'; end if;

  select array_agg(distinct d) into days from unnest(p_days) d;
  if days is null or cardinality(days) > 366 or exists (select 1 from unnest(days) d where d is null or d < today or d > today + 365) then
    raise exception 'Elija días entre hoy y dentro de un año.';
  end if;
  if p_available is null and p_price_crc is null then raise exception 'No hay cambios que guardar.'; end if;
  -- Precios por fecha apagados (feature flag `date_prices`): no se guarda uno nuevo; los guardados se conservan.
  if p_price_crc is not null and not (public.feature_flags()).date_prices then
    raise exception 'Los precios por fecha no están disponibles por ahora.';
  end if;

  base := case when l.accepts_nightly then l.nightly_price_crc end;
  if p_price_crc is not null then
    if p_price_crc < 1 or p_price_crc > 100000000 then
      raise exception 'Escriba un precio por noche en colones, mayor que cero y sin decimales.';
    end if;
    if base is null then raise exception 'Ponga primero el precio por noche de la casa para cambiar el de un día.'; end if;
  end if;

  -- Ocupar o liberar conserva el precio; el precio base quita la ★. Solo quedan las filas que difieren del habitual.
  insert into public.listing_days as ld (listing_id, day, available, special_price_crc)
  select l.id, d, coalesce(p_available, true), case when p_price_crc = base then null else p_price_crc end
    from unnest(days) d
  on conflict (listing_id, day) do update
    set available = coalesce(p_available, ld.available),
        special_price_crc = case when p_price_crc is null then ld.special_price_crc when p_price_crc = base then null else p_price_crc end;
  delete from public.listing_days where listing_id = l.id and day = any(days) and available and special_price_crc is null;

  if l.status = 'active' then perform public.purge_listing_page(l.public_id); end if;
end $$;


