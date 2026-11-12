-- Ubicación por punto (spec .scratch/ubicacion-por-punto/spec.md): la casa guarda el distrito del pin y de dónde sale su
-- zona: 'list' (una de public.zones a 5 km o menos), 'district' (el nombre del distrito del pin) u 'other' (nombre
-- propuesto por el dueño, como mucho 60 caracteres). submit_listing recalcula provincia, cantón y distrito con place_at
-- y valida la zona; parte de la definición de 20261028051911_mensual_como_caracteristica.sql, el resto igual.
-- listings_public no cambia (lista de columnas explícita): zone_source y zone_id no se exponen.
-- Las casas existentes son datos de prueba: no se migran (columnas nulas).

alter table public.listings
  add column district text,
  add column zone_id text references public.zones(id) on delete set null,
  add column zone_source text check (zone_source in ('list','district','other'));

create or replace function public.submit_listing(p_listing uuid)
 RETURNS listing_status
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  l listings;
  n_photos int;
  pl record;
  zname text;
begin
  select * into l from listings where id = p_listing and owner_id = auth.uid();
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if l.status = 'review' then raise exception 'Este anuncio ya está en revisión.'; end if;
  if l.status not in ('draft','changes') then raise exception 'Este anuncio no se puede enviar en su estado actual.'; end if;
  if l.kind is null then raise exception 'Elija Alojamiento completo o Habitación.'; end if;
  -- Ubicación por punto: provincia, cantón y distrito salen del pin (place_at), no de lo que mande el cliente.
  if l.lat is null or l.lng is null then raise exception 'Marque en el mapa la ubicación aproximada.'; end if;
  select * into pl from place_at(l.lat, l.lng);
  if not found then raise exception 'Ponga el punto sobre tierra, dentro de Costa Rica.'; end if;
  if btrim(coalesce(l.zone, '')) = '' or l.zone_source is null then raise exception 'Elija la zona.'; end if;
  if l.zone_source = 'list' then
    if l.zone_id is null then raise exception 'Elija la zona.'; end if;
    if not exists (select 1 from zones_near(l.lat, l.lng, 5) z where z.id = l.zone_id) then
      raise exception 'La zona elegida queda a más de 5 km del punto. Elija otra.';
    end if;
    select z.name into zname from zones z where z.id = l.zone_id;
  elsif l.zone_source = 'district' then
    if l.zone_id is not null or btrim(l.zone) is distinct from pl.district then
      raise exception 'La zona no coincide con el distrito del punto. Elija otra.';
    end if;
  else -- 'other': nombre propuesto por el dueño, sin zona de la lista
    if l.zone_id is not null then raise exception 'Elija la zona.'; end if;
    if char_length(btrim(l.zone)) > 60 then raise exception 'La zona puede tener como mucho 60 caracteres.'; end if;
  end if;
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
  update listings set status = 'review', review_note = null,
    province = pl.province, canton = pl.canton, district = pl.district,
    zone = case when l.zone_source = 'list' then zname else btrim(l.zone) end
  where id = p_listing;
  return 'review';
end $function$;
