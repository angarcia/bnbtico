-- 2026-10-27: «Alquiler mensual» pasa a ser una característica. Toda casa se alquila por noches (el precio por noche es
-- obligatorio) y, si además acepta alquiler por meses, el precio al mes es opcional: vacío se muestra como «Precio a
-- negociar con el dueño». Por eso accepts_nightly queda siempre en true (check) y accepts_monthly deja de ser nulo
-- (por defecto false: el borrador nace en «No»). Las columnas monthly_mode, min_nights y min_months se quedan sin uso.
-- Las casas existentes son datos de prueba: bnbtico-pruebas se vacía antes del push; los dos update son solo defensivos.
select set_config('app.allow_status', 'on', true);
update public.listings set accepts_monthly = false where accepts_monthly is null;
update public.listings set accepts_nightly = true where not accepts_nightly;

alter table public.listings
  alter column accepts_monthly set default false,
  alter column accepts_monthly set not null;
alter table public.listings add constraint listings_accepts_nightly check (accepts_nightly);

create or replace function public.submit_listing(p_listing uuid)
 RETURNS listing_status
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  l listings;
  n_photos int;
begin
  select * into l from listings where id = p_listing and owner_id = auth.uid();
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if l.status = 'review' then raise exception 'Este anuncio ya está en revisión.'; end if;
  if l.status not in ('draft','changes') then raise exception 'Este anuncio no se puede enviar en su estado actual.'; end if;
  if l.kind is null then raise exception 'Elija Alojamiento completo o Habitación.'; end if;
  if l.province = '' or l.canton = '' or coalesce(l.zone,'') = '' then raise exception 'Complete provincia, cantón y zona aproximada.'; end if;
  if l.lat is null or l.lng is null then raise exception 'Marque en el mapa la ubicación aproximada.'; end if;
  if l.lat not between 8.0 and 11.3 or l.lng not between -86.0 and -82.5 then raise exception 'Marque un punto dentro de Costa Rica.'; end if;
  if coalesce(l.capacity, 0) < 1 then raise exception 'Indique cuántas personas pueden alojarse (mínimo 1).'; end if;
  if l.bedrooms is null or (l.bedrooms < 1 and l.kind not in ('completo','apartamento')) then raise exception 'Indique las habitaciones; solo un alojamiento completo tipo estudio puede tener 0.'; end if;
  if coalesce(l.bathrooms, 0) < 1 then raise exception 'Indique el número de baños (mínimo 1).'; end if;
  if l.kind = 'habitacion' and l.bathroom_shared is null then raise exception 'Indique si el baño es privado o compartido.'; end if;
  if coalesce(l.title,'') = '' or coalesce(l.description,'') = '' then raise exception 'Complete el nombre de la casa y la descripción.'; end if;
  -- Ticket 19: nombre de 5 a 60 caracteres y descripción de 80 a 2000 (sin los espacios de los extremos), como validateStep.
  if char_length(btrim(l.title)) not between 5 and 60 then raise exception 'El nombre de la casa debe tener entre 5 y 60 caracteres.'; end if;
  if char_length(btrim(l.description)) not between 80 and 2000 then raise exception 'La descripción debe tener entre 80 y 2000 caracteres.'; end if;
  if 'parking' = any(l.features) then
    if l.parking_paid is null then raise exception 'Indique si el parqueo es gratuito o de pago.'; end if;
  elsif l.parking_paid is not null then
    raise exception 'El tipo de parqueo solo aplica si el anuncio tiene parqueo.';
  end if;
  select count(*) into n_photos from listing_photos where listing_id = p_listing;
  if n_photos < 5 then raise exception 'Agregue al menos 5 fotos.'; end if;
  if n_photos > 15 then raise exception 'Máximo 15 fotos.'; end if;
  if coalesce(l.nightly_price_crc, 0) <= 0 then raise exception 'Indique el precio por noche en colones.'; end if;
  -- Precio al mes opcional: vacío es «Precio a negociar con el dueño».
  if l.accepts_monthly and l.monthly_price_crc is not null and l.monthly_price_crc <= 0 then raise exception 'Indique el precio al mes en colones o déjelo vacío.'; end if;
  perform set_config('app.allow_status', 'on', true);
  update listings set status = 'review', review_note = null where id = p_listing;
  return 'review';
end $function$;

-- Toque en el filtro «Alquiler mensual» de Explorar (sin casa).
alter table public.events drop constraint events_name_check;
alter table public.events add constraint events_name_check check (name in ('page_view', 'listing_view', 'whatsapp_tap', 'inquiry_created', 'wizard_step', 'search_help_tap', 'monthly_filter_tap'));
