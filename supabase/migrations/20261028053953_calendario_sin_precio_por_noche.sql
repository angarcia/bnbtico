-- 2026-10-27: ninguna casa se alquila solo por mes (toda casa tiene precio por noche al publicarse). El precio de un día
-- solo se rechaza en un borrador que aún no tiene precio por noche: mensaje neutro, el mismo que CALENDAR_MESSAGES
-- .noNightlyPrice (apps/app/src/domain/calendar.ts). El resto de save_listing_days no cambia.
create or replace function public.save_listing_days(p_listing uuid, p_days date[], p_available boolean default null, p_price_crc int default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
  today date := (now() at time zone 'America/Costa_Rica')::date;
  days date[];
  base int;
begin
  select * into l from public.listings where id = p_listing and owner_id = auth.uid();
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if l.status = 'rejected' then raise exception 'Este anuncio fue rechazado; publique uno nuevo.'; end if;
  if not l.available then raise exception 'La casa está cerrada a consultas. Ábrala para cambiar el calendario.'; end if;

  select array_agg(distinct d) into days from unnest(p_days) d;
  if days is null or cardinality(days) > 366 or exists (select 1 from unnest(days) d where d is null or d < today or d > today + 365) then
    raise exception 'Elija días entre hoy y dentro de un año.';
  end if;
  if p_available is null and p_price_crc is null then raise exception 'No hay cambios que guardar.'; end if;

  base := case when l.accepts_nightly then l.nightly_price_crc end;
  if p_price_crc is not null then
    if p_price_crc < 1 or p_price_crc > 100000000 then
      raise exception 'Escriba un precio por noche en colones, mayor que cero y sin decimales.';
    end if;
    if base is null then raise exception 'Ponga primero el precio por noche de la casa para cambiar el de un día.'; end if;
  end if;

  -- Ocupar o liberar conserva el precio; el precio base quita la ★. Solo quedan las filas que difieren del habitual.
  insert into public.listing_days as ld (listing_id, day, available, special_price_crc)
  select p_listing, d, coalesce(p_available, true), case when p_price_crc = base then null else p_price_crc end
    from unnest(days) d
  on conflict (listing_id, day) do update
    set available = coalesce(p_available, ld.available),
        special_price_crc = case when p_price_crc is null then ld.special_price_crc when p_price_crc = base then null else p_price_crc end;
  delete from public.listing_days where listing_id = p_listing and day = any(days) and available and special_price_crc is null;

  if l.status = 'active' then perform public.purge_listing_page(l.public_id); end if;
end $$;
