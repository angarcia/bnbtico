-- bnbtico · fase 4, ticket 02 · calendario del propietario y reapertura automática en la base · 2026-10-23
--
-- 1) listing_days y listing_rates ya no se escriben por REST: fuera las políticas de escritura del dueño (sin rango, sin
--    validar precio, sin todo o nada) y los grants de escritura. Se leen como antes (days_select / rates_select).
--    listing_rates (temporadas, fin de semana) queda fuera de v1: sin RPC.
-- 2) save_listing_days: la única forma de cambiar días. Mismas reglas, orden y mensajes que validateChange y applyChange
--    (apps/app/src/domain/calendar.ts, CALENDAR_MESSAGES). Una purga de la ficha al final si la casa está activa (sin
--    trigger por fila: guardar 30 días no encola 30 purgas).
-- 3) set_listing_available con fecha de reapertura opcional (sustituye a la de dos argumentos).
-- 4) pg_cron: reopen_due_listings abre a consultas cada noche (00:00 en Costa Rica) las casas cuya fecha llegó. Nunca
--    toca el estado: una casa oculta o en revisión sigue igual, solo deja de estar cerrada a consultas.
-- 5) public_listing_days: días de una casa publicada para la ficha (worker y SPA); listings_public no cambia.

-- ---------- 1. Escrituras directas cerradas ----------
drop policy days_owner_write on public.listing_days;
drop policy rates_owner_write on public.listing_rates;
revoke insert, update, delete, truncate on table public.listing_days from public, anon, authenticated;
revoke insert, update, delete, truncate on table public.listing_rates from public, anon, authenticated;

-- ---------- 2. Guardar días ----------
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
    if base is null then raise exception 'Esta casa se alquila solo por mes: no lleva precio por noche.'; end if;
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

revoke all on function public.save_listing_days(uuid, date[], boolean, int) from public, anon;
grant execute on function public.save_listing_days(uuid, date[], boolean, int) to authenticated;

-- ---------- 3. Disponible para consultas, con fecha de reapertura ----------
drop function public.set_listing_available(uuid, boolean);
create function public.set_listing_available(p_listing uuid, p_available boolean, p_reopen_at date default null)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'America/Costa_Rica')::date;
begin
  if not exists (select 1 from public.listings where id = p_listing and owner_id = auth.uid() and status = 'active') then
    raise exception 'Solo puede cambiar la disponibilidad de una casa activa.';
  end if;
  if p_available and p_reopen_at is not null then raise exception 'La fecha de reapertura solo se pone al cerrar la casa.'; end if;
  if p_reopen_at is not null and (p_reopen_at <= today or p_reopen_at > today + 365) then
    raise exception 'La fecha de reapertura debe ser a partir de mañana y dentro de un año.';
  end if;
  perform set_config('app.allow_status', 'on', true);
  -- Abrir a mano cancela la fecha. El trigger listings_purge_page refresca la ficha.
  update public.listings set available = p_available, reopen_at = case when p_available then null else p_reopen_at end where id = p_listing;
end $$;

revoke all on function public.set_listing_available(uuid, boolean, date) from public, anon;
grant execute on function public.set_listing_available(uuid, boolean, date) to authenticated;

-- ---------- 4. Reapertura automática ----------
create extension if not exists pg_cron with schema pg_catalog;

-- Sin argumento, «hoy» en Costa Rica. Devuelve cuántas casas abrió. Cada casa activa reabierta se purga por su trigger.
create or replace function public.reopen_due_listings(p_today date default (now() at time zone 'America/Costa_Rica')::date)
returns int
language plpgsql security definer set search_path = '' as $$
declare
  n int;
begin
  perform set_config('app.allow_status', 'on', true);
  update public.listings set available = true, reopen_at = null
   where not available and reopen_at is not null and reopen_at <= p_today;
  get diagnostics n = row_count;
  return n;
end $$;

revoke all on function public.reopen_due_listings(date) from public, anon, authenticated;
grant execute on function public.reopen_due_listings(date) to service_role;

-- 06:00 UTC = 00:00 en Costa Rica (sin horario de verano). cron.schedule con un nombre existente lo sustituye.
select cron.schedule('bnbtico-reabrir-casas', '0 6 * * *', 'select public.reopen_due_listings()');

-- ---------- 5. Lectura pública ----------
create or replace function public.public_listing_days(p_public_id text)
returns table (day date, available boolean, special_price_crc int)
language sql stable security definer set search_path = '' as $$
  select d.day, d.available, d.special_price_crc
    from public.listing_days d
    join public.listings l on l.id = d.listing_id
   where l.public_id = p_public_id and l.status = 'active'
     and d.day between (now() at time zone 'America/Costa_Rica')::date and (now() at time zone 'America/Costa_Rica')::date + 365
   order by d.day
$$;

revoke all on function public.public_listing_days(text) from public;
grant execute on function public.public_listing_days(text) to anon, authenticated;
