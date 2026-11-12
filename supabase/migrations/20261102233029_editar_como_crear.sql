-- Editar sigue las reglas de crear (ronda de Ana del 2026-11-02, ticket 12; decisión «Editar sigue las reglas de crear»).
-- Mismos límites, mensajes y obligatorios que al crear; editar un dato valida solo ese dato, nunca la casa entera.
-- 1) update_listing_live (datos que se publican al momento): valida solo las claves del parche. Excepción: un dato que ya
--    tenía un valor válido (comparado con la fila actual) no se puede dejar vacío ni inválido; uno que no lo tenía puede
--    quedar vacío. Antes validaba la fila entera: una casa sin baños no podía cambiar el precio.
-- 2) listing_edit_check (nombre, tipo, descripción, ubicación; lo usan save_edit y review_edit_field): fuera las
--    habitaciones y el baño compartido (son datos de la capacidad, no del nombre ni de la descripción), fuera el mínimo de
--    80 de la descripción (solo el tope de 2000; de 1 a 79 se guarda y la app avisa) y nombre vacío con su mensaje.
--    Respeta 20261102225346 (una Habitación son 1 habitación, el trigger lo fija).
-- 3) save_edit: nombre vacío da «Póngale un nombre a la casa.» (el de submit_listing); un nombre igual al aprobado no se
--    valida (uno viejo de más de 32 sin tocar no estorba).
-- 4) submit_listing: tope de 2000 de la descripción (hasta ahora solo existía en el cliente al crear).
-- 5) listing_edits: CHECK del nombre de 5–60 a 5–32 y de la descripción con btrim, NOT VALID (las filas de antes no se
--    revisan; en local no hay ninguna fuera de la regla).

-- ---------- update_listing_live ----------
create or replace function public.update_listing_live(p_listing uuid, p_patch jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
  m public.listings;
  not_here constant text := 'Ese dato no se puede cambiar aquí.';
begin
  l := public.own_published_listing(p_listing);
  if p_patch is null or jsonb_typeof(p_patch) <> 'object'
     or exists (select 1 from jsonb_object_keys(p_patch) k
                where k <> all (array['capacity','bedrooms','bathrooms','features','parking_paid','nightly_price_crc','accepts_monthly','monthly_price_crc'])) then
    raise exception '%', not_here;
  end if;
  if p_patch ? 'features' and jsonb_typeof(p_patch -> 'features') <> 'array' then raise exception '%', not_here; end if;
  begin
    m := jsonb_populate_record(l, p_patch);
  exception when data_exception then
    -- Un tipo que no es (texto en un número, una característica que no existe…).
    raise exception '%', not_here;
  end;
  if m.accepts_monthly is null or array_position(m.features, null) is not null then raise exception '%', not_here; end if;
  if not m.accepts_monthly then m.monthly_price_crc := null; end if;

  -- Solo las claves del parche, con las reglas de crear (publicar avanza siempre): un dato que ya tenía un valor válido
  -- se puede cambiar pero no dejar vacío ni inválido; uno que no lo tenía puede quedar vacío (la app lo avisa en ocre) y
  -- lo inválido se guarda como null. El precio por noche es obligatorio: bloquea siempre. Nunca se valida la casa entera.
  if p_patch ? 'capacity' and coalesce(m.capacity, 0) < 1 then
    if coalesce(l.capacity, 0) >= 1 then raise exception 'Indique cuántas personas pueden alojarse (mínimo 1).'; end if;
    m.capacity := null;
  end if;
  -- Una Habitación tiene 1 (listings_habitacion_una): el asistente no lo manda, y 0 o vacío sigue rechazándose.
  if p_patch ? 'bedrooms' and (m.bedrooms is null or (m.bedrooms < 1 and l.kind not in ('completo','apartamento'))) then
    if l.bedrooms is not null and (l.bedrooms >= 1 or l.kind in ('completo','apartamento')) then
      raise exception 'Indique las habitaciones; solo un alojamiento completo tipo estudio puede tener 0.';
    end if;
    m.bedrooms := null;
  end if;
  if p_patch ? 'bathrooms' and coalesce(m.bathrooms, 0) < 1 then
    if coalesce(l.bathrooms, 0) >= 1 then raise exception 'Indique el número de baños (mínimo 1).'; end if;
    m.bathrooms := null;
  end if;
  if p_patch ?| array['features','parking_paid'] then
    if 'parking' = any(m.features) then
      if m.parking_paid is null and 'parking' = any(l.features) and l.parking_paid is not null then
        raise exception 'Indique si el parqueo es gratuito o de pago.';
      end if;
    elsif m.parking_paid is not null then
      raise exception 'El tipo de parqueo solo aplica si el anuncio tiene parqueo.';
    end if;
  end if;
  if p_patch ? 'nightly_price_crc' and coalesce(m.nightly_price_crc, 0) <= 0 then raise exception 'Indique el precio por noche en colones.'; end if;
  if p_patch ?| array['accepts_monthly','monthly_price_crc'] and m.accepts_monthly and m.monthly_price_crc is not null and m.monthly_price_crc <= 0 then
    if l.accepts_monthly and coalesce(l.monthly_price_crc, 0) > 0 then raise exception 'Indique el precio al mes en colones o déjelo vacío.'; end if;
    m.monthly_price_crc := null;
  end if;

  perform set_config('app.allow_status', 'on', true);
  update public.listings set capacity = m.capacity, bedrooms = m.bedrooms, bathrooms = m.bathrooms, features = m.features,
    parking_paid = m.parking_paid, nightly_price_crc = m.nightly_price_crc, accepts_monthly = m.accepts_monthly,
    monthly_price_crc = m.monthly_price_crc
  where id = p_listing;
end $$;

-- ---------- listing_edit_check ----------
create or replace function public.listing_edit_check(l public.listings, e public.listing_edits) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  d text := btrim(coalesce(e.description, ''));
begin
  if e.lat is not null then perform public.edit_place(e.lat, e.lng, e.zone, e.zone_id, e.zone_source); end if;
  if e.title is not null then
    if btrim(e.title) = '' then raise exception 'Póngale un nombre a la casa.'; end if;
    if char_length(btrim(e.title)) not between 5 and 32 then raise exception 'El nombre de la casa debe tener entre 5 y 32 caracteres.'; end if;
  end if;
  if e.description is not null and char_length(d) > 2000 then
    raise exception 'La descripción debe tener entre 80 y 2000 caracteres o quedar vacía.';
  end if;
end $$;
revoke execute on function public.listing_edit_check(public.listings, public.listing_edits) from public, anon, authenticated;

-- ---------- CHECK de listing_edits ----------
alter table public.listing_edits drop constraint listing_edits_title_check;
alter table public.listing_edits add constraint listing_edits_title_check
  check (title is null or char_length(btrim(title)) between 5 and 32) not valid;
alter table public.listing_edits drop constraint listing_edits_description_check;
alter table public.listing_edits add constraint listing_edits_description_check
  check (description is null or char_length(btrim(description)) <= 2000) not valid;

-- ---------- save_edit ----------
create or replace function public.save_edit(p_listing uuid, p_patch jsonb) returns public.listing_edits
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
  e public.listing_edits;
  m public.listing_edits;
  f text;
  touched text[] := '{}';
  not_here constant text := 'Ese dato no se puede cambiar aquí.';
  loc constant text[] := array['lat','lng','zone','zone_source'];
begin
  l := public.own_published_listing(p_listing);
  if p_patch is null or jsonb_typeof(p_patch) <> 'object'
     or exists (select 1 from jsonb_object_keys(p_patch) k
                where k <> all (array['title','kind','bathroom_shared','description','lat','lng','zone','zone_id','zone_source']))
     or (p_patch ?| (loc || array['zone_id']) and not p_patch ?& loc) then
    raise exception '%', not_here;
  end if;
  e := public.start_edit(p_listing);
  begin
    m := jsonb_populate_record(e, p_patch);
  exception when data_exception then
    raise exception '%', not_here;
  end;

  if p_patch ? 'title' then touched := array_append(touched, 'title'); end if;
  if p_patch ?| array['kind','bathroom_shared'] then touched := array_append(touched, 'kind'); end if;
  if p_patch ? 'description' then touched := array_append(touched, 'description'); end if;
  if p_patch ?& loc then touched := array_append(touched, 'location'); end if;

  -- Lo igual a lo aprobado no cuenta (ni se valida: un nombre viejo de más de 32 sin tocar no estorba); lo nuevo, de 5 a 32.
  if m.title is not null then
    m.title := btrim(m.title);
    if m.title = btrim(coalesce(l.title, '')) then
      m.title := null;
    elsif m.title = '' then
      raise exception 'Póngale un nombre a la casa.';
    elsif char_length(m.title) not between 5 and 32 then
      raise exception 'El nombre de la casa debe tener entre 5 y 32 caracteres.';
    end if;
  end if;
  if m.description is not null then
    m.description := btrim(m.description);
    if char_length(m.description) > 2000 then raise exception 'La descripción debe tener entre 80 y 2000 caracteres o quedar vacía.'; end if;
    if m.description = btrim(coalesce(l.description, '')) then m.description := null; end if;
  end if;
  if m.kind = l.kind then m.kind := null; end if;
  -- El baño solo cuenta si el tipo resultante es habitación.
  if coalesce(m.kind, l.kind) is distinct from 'habitacion' or m.bathroom_shared = l.bathroom_shared then m.bathroom_shared := null; end if;
  if p_patch ?& loc then
    -- La ubicación va entera: sin zone_id en el parche, la zona no es de la lista (nunca la de un guardado anterior).
    m.zone_id := p_patch ->> 'zone_id';
    if m.lat is null or m.lng is null or btrim(coalesce(m.zone, '')) = '' or m.zone_source is null
       or m.zone_source not in ('list','district','other')
       or (m.zone_id is not null and not exists (select 1 from public.zones z where z.id = m.zone_id)) then
      raise exception '%', not_here;
    end if;
    m.zone := btrim(m.zone);
    if char_length(m.zone) > 60 then raise exception 'La zona puede tener como mucho 60 caracteres.'; end if;
    if (m.lat, m.lng, m.zone, m.zone_id, m.zone_source) is not distinct from (l.lat, l.lng, btrim(l.zone), l.zone_id, l.zone_source) then
      m.lat := null; m.lng := null; m.zone := null; m.zone_id := null; m.zone_source := null;
    end if;
  end if;

  -- Lo que va a revisión, con las reglas de submit_listing (solo el dato que cambia).
  foreach f in array touched loop
    if public.listing_edit_has(m, f) then perform public.listing_edit_check(l, public.listing_edit_only(m, f)); end if;
  end loop;

  update public.listing_edits set title = m.title, kind = m.kind, bathroom_shared = m.bathroom_shared, description = m.description,
    lat = m.lat, lng = m.lng, zone = m.zone, zone_id = m.zone_id, zone_source = m.zone_source
  where listing_id = p_listing;
  foreach f in array touched loop
    if public.listing_edit_has(m, f) then
      insert into public.listing_edit_fields (listing_id, field, status, review_note, submitted_at) values (p_listing, f, 'review', null, now())
      on conflict (listing_id, field) do update set status = 'review', review_note = null, submitted_at = now();
    else
      delete from public.listing_edit_fields where listing_id = p_listing and field = f;
    end if;
  end loop;
  perform public.listing_edit_sync(p_listing);
  select * into e from public.listing_edits where listing_id = p_listing;
  if not found then return null::public.listing_edits; end if;
  return e;
end $$;

-- ---------- submit_listing ----------
create or replace function public.submit_listing(p_listing uuid)
 RETURNS public.listing_status
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
  -- Nombre de 5 a 32 caracteres (sin los espacios de los extremos), como requiredProblems.
  if btrim(coalesce(l.title, '')) = '' then raise exception 'Póngale un nombre a la casa.'; end if;
  if char_length(btrim(l.title)) not between 5 and 32 then raise exception 'El nombre de la casa debe tener entre 5 y 32 caracteres.'; end if;
  -- La descripción es opcional y solo tiene tope duro (2000): vacía o corta no bloquea, solo avisa en la app.
  if char_length(btrim(coalesce(l.description, ''))) > 2000 then raise exception 'La descripción debe tener entre 80 y 2000 caracteres o quedar vacía.'; end if;
  select count(*) into n_photos from listing_photos where listing_id = p_listing;
  if n_photos < 1 then raise exception 'Añada al menos una foto.'; end if;
  if n_photos > 15 then raise exception 'Máximo 15 fotos.'; end if;
  if coalesce(l.nightly_price_crc, 0) <= 0 then raise exception 'Indique el precio por noche en colones.'; end if;
  perform set_config('app.allow_status', 'on', true);
  update listings set status = 'review', review_note = null,
    province = pl.province, canton = pl.canton, district = pl.district,
    zone = case when l.zone_source = 'list' then zname else btrim(l.zone) end
  where id = p_listing;
  return 'review';
end $function$;
