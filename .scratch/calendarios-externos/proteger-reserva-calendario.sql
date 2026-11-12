-- Ana crea una migración nueva con Supabase CLI y copia aquí el contenido mediante comprobar-reserva-07-backend.sh.
-- La ocupación se comprueba bajo el mismo bloqueo de casa que usa finish_airbnb_import.
create function public.mark_listing_reservation(p_listing uuid, p_days date[])
returns void language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
begin
  if auth.uid() is null then raise exception 'Su sesión venció. Ingrese de nuevo.'; end if;
  select * into l from public.listings where id = p_listing and owner_id = auth.uid() and deleted_at is null for update;
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if not exists(select 1 from public.profiles where id = auth.uid() and is_active and phone_verified_at is not null) then
    raise exception 'Verifique su cuenta para cambiar el calendario.' using errcode = '42501';
  end if;
  perform public.assert_listing_open(p_listing);
  if exists(select 1 from public.effective_calendar_days(p_listing) d where not d.available and d.day = any(p_days)) then
    raise exception 'Hay noches ocupadas entre esas fechas.';
  end if;
  perform public.listing_days_update(l, p_days, false, null);
end $$;
revoke all on function public.mark_listing_reservation(uuid,date[]) from public, anon;
grant execute on function public.mark_listing_reservation(uuid,date[]) to authenticated;

-- El editor manual comparte la exclusión por casa; conserva permisos, entradas y comportamiento.
create or replace function public.save_listing_days(p_listing uuid, p_days date[], p_available boolean default null, p_price_crc int default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
begin
  select * into l from public.listings where id = p_listing and owner_id = auth.uid() for update;
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  perform public.assert_listing_open(p_listing);
  perform public.listing_days_update(l, p_days, p_available, p_price_crc);
end $$;
