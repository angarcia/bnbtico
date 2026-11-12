-- Textos de la casa pausada (decisión de Daniel, 2026-11-03): tras «Pausar la casa» (ticket 04 de la ronda del 2 nov), los
-- mensajes que aún decían «cerrada a consultas» y «reapertura» pasan a «pausada» y «volver a publicarla». Solo cambian los
-- textos; cada función es copia exacta de su versión vigente:
--   - listing_days_update (save_listing_days y admin_save_listing_days): 20261103230900_admin_edita_casas.
--   - set_listing_available: 20261030233129_admin_casas_acciones.
-- create_inquiry no cambia («Esta casa no está disponible para consultas.»). Los mismos textos, en CALENDAR_MESSAGES
-- (apps/app/src/domain/calendar.ts) y en el fake.

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

CREATE OR REPLACE FUNCTION public.set_listing_available(p_listing uuid, p_available boolean, p_reopen_at date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  today date := (now() at time zone 'America/Costa_Rica')::date;
begin
  perform public.assert_listing_open(p_listing);
  if not exists (select 1 from public.listings where id = p_listing and owner_id = auth.uid() and status = 'active') then
    raise exception 'Solo puede cambiar la disponibilidad de una casa activa.';
  end if;
  if p_available and p_reopen_at is not null then raise exception 'La fecha para volver a publicarla solo se pone al pausar la casa.'; end if;
  if p_reopen_at is not null and (p_reopen_at <= today or p_reopen_at > today + 365) then
    raise exception 'La fecha para volver a publicarla debe ser a partir de mañana y dentro de un año.';
  end if;
  perform set_config('app.allow_status', 'on', true);
  -- Abrir a mano cancela la fecha. El trigger listings_purge_page refresca la ficha.
  update public.listings set available = p_available, reopen_at = case when p_available then null else p_reopen_at end where id = p_listing;
end $function$;
