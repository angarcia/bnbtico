-- Publicar v2 (plan E, decisiones 2026-10-29):
-- 1) submit_listing: se envía a revisión sin fotos y sin descripción; nombre de 5 a 32 caracteres; descripción vacía o
--    de 80 a 2000. El tope de 15 fotos se queda.
-- 2) review_listing: aprobar exige al menos una foto («Para aprobarla hace falta al menos una foto.»).
-- 3) Ediciones de una casa publicada (listing_edit_check, save_edit): la misma regla de nombre (5 a 32), solo para el
--    nombre nuevo (un nombre aprobado más largo no bloquea otros cambios), y el mensaje nuevo de la descripción. save_edit solo pone el tope de 2000; el mínimo de 80 se exige al enviar (submit_edit) y al
--    aprobar (review_edit), que llaman a listing_edit_check. El check de la tabla listing_edits (5 a 60) se queda: la
--    regla la ponen las RPCs.
-- 4) Evento publish_verify (sin casa) en events_name_check.
-- Sin UPDATE de listings. create or replace conserva dueño y permisos; se repiten los revoke/grant de origen.

-- ---------- 1) submit_listing ----------
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
  if coalesce(l.capacity, 0) < 1 then raise exception 'Indique cuántas personas pueden alojarse (mínimo 1).'; end if;
  if l.bedrooms is null or (l.bedrooms < 1 and l.kind not in ('completo','apartamento')) then raise exception 'Indique las habitaciones; solo un alojamiento completo tipo estudio puede tener 0.'; end if;
  if coalesce(l.bathrooms, 0) < 1 then raise exception 'Indique el número de baños (mínimo 1).'; end if;
  if l.kind = 'habitacion' and l.bathroom_shared is null then raise exception 'Indique si el baño es privado o compartido.'; end if;
  -- Publicar v2: nombre de 5 a 32 caracteres; descripción vacía o de 80 a 2000 (sin los espacios de los extremos), como validateStep.
  if btrim(coalesce(l.title, '')) = '' then raise exception 'Póngale un nombre a la casa.'; end if;
  if char_length(btrim(l.title)) not between 5 and 32 then raise exception 'El nombre de la casa debe tener entre 5 y 32 caracteres.'; end if;
  if btrim(coalesce(l.description, '')) <> '' and char_length(btrim(l.description)) not between 80 and 2000 then
    raise exception 'La descripción debe tener entre 80 y 2000 caracteres o quedar vacía.';
  end if;
  if 'parking' = any(l.features) then
    if l.parking_paid is null then raise exception 'Indique si el parqueo es gratuito o de pago.'; end if;
  elsif l.parking_paid is not null then
    raise exception 'El tipo de parqueo solo aplica si el anuncio tiene parqueo.';
  end if;
  select count(*) into n_photos from listing_photos where listing_id = p_listing;
  -- Publicar v2: se envía sin fotos; aprobar exige al menos una (review_listing).
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

-- ---------- 2) review_listing ----------
create or replace function public.review_listing(p_listing uuid, p_decision text, p_note text)
 RETURNS public.listing_status
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  l public.listings;
  s public.subscriptions;
  note text := left(btrim(coalesce(p_note, '')), 2000);
  next_status public.listing_status;
  n_photos int;
  today date := public.costa_rica_today();
  slot int;
  months int;
  has_method boolean;
  promo boolean;
begin
  if not public.is_admin() then
    if coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
      raise exception 'Confirme el segundo código para revisar anuncios.';
    end if;
    raise exception 'Solo bnbtico puede revisar anuncios.';
  end if;
  select * into l from public.listings where id = p_listing;
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if l.status <> 'review' then raise exception 'Este anuncio ya tiene una decisión.'; end if;
  if p_decision not in ('approve','changes','reject') then raise exception 'Decisión no válida.'; end if;
  if p_decision <> 'approve' and note = '' then raise exception 'Escriba un motivo de hasta 2000 caracteres para pedir cambios o rechazar.'; end if;
  if p_decision = 'approve' then
    select count(*) into n_photos from public.listing_photos where listing_id = p_listing;
    if n_photos < 1 then raise exception 'Para aprobarla hace falta al menos una foto.'; end if;

    select * into s from public.subscriptions where listing_id = p_listing;
    if not found then
      perform pg_advisory_xact_lock(hashtext('bnbtico.promo_slot'));
      select coalesce(max(promo_slot), 0) + 1 into slot from public.subscriptions;
      months := case when slot <= 50 then 12 when slot <= 100 then 6 when slot <= 200 then 3 end;
      insert into public.subscriptions (listing_id, plan, promo_slot, promo_months, promo_ends_on)
      values (p_listing, (case when months is null then 'paid' else 'promo' end)::public.plan,
              case when months is null then null else slot end, months,
              case when months is null then null else (today + make_interval(months => months))::date end)
      returning * into s;
    end if;
    has_method := public.owner_has_payment_method(l.owner_id);
    promo := s.plan = 'promo' and s.promo_ends_on is not null and today <= s.promo_ends_on;
    next_status := case when promo or has_method then 'active'::public.listing_status else 'payment_due'::public.listing_status end;
    if not promo and has_method and (s.plan = 'promo' or s.paid_since is null) then
      update public.subscriptions set plan = 'paid', paid_since = today where listing_id = p_listing;
    end if;
  else
    next_status := case p_decision when 'changes' then 'changes'::public.listing_status else 'rejected'::public.listing_status end;
  end if;
  perform set_config('app.allow_status', 'on', true);
  update public.listings set status = next_status, review_note = nullif(note, ''), reviewed_at = now(), reviewed_by = auth.uid(),
    first_published_at = case when p_decision = 'approve' then coalesce(first_published_at, now()) else first_published_at end
  where id = p_listing;
  insert into public.admin_actions (admin_id, action, target_listing_id, reason) values (auth.uid(), 'listing.' || p_decision, p_listing, nullif(note, ''));
  if p_decision = 'approve' then update public.profiles set is_owner = true where id = l.owner_id; end if;
  return next_status;
end $function$;

-- ---------- 3) Ediciones ----------
create or replace function public.listing_edit_check(l public.listings, e public.listing_edits)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  k public.listing_kind := coalesce(e.kind, l.kind);
  d text := btrim(coalesce(e.description, l.description, ''));
begin
  if e.lat is not null then perform public.edit_place(e.lat, e.lng, e.zone, e.zone_id, e.zone_source); end if;
  if l.bedrooms is null or (l.bedrooms < 1 and k not in ('completo','apartamento')) then
    raise exception 'Indique las habitaciones; solo un alojamiento completo tipo estudio puede tener 0.';
  end if;
  if k = 'habitacion' and coalesce(e.bathroom_shared, l.bathroom_shared) is null then
    raise exception 'Indique si el baño es privado o compartido.';
  end if;
  -- Solo el nombre nuevo: una casa publicada con un nombre de más de 32 lo conserva hasta que su dueño lo cambie.
  if e.title is not null and char_length(btrim(e.title)) not between 5 and 32 then raise exception 'El nombre de la casa debe tener entre 5 y 32 caracteres.'; end if;
  if d <> '' and char_length(d) not between 80 and 2000 then raise exception 'La descripción debe tener entre 80 y 2000 caracteres o quedar vacía.'; end if;
end $function$;

create or replace function public.save_edit(p_listing uuid, p_patch jsonb)
 RETURNS public.listing_edits
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  l public.listings;
  e public.listing_edits;
  m public.listing_edits;
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

  if m.title is not null then
    m.title := btrim(m.title);
    if char_length(m.title) not between 5 and 32 then raise exception 'El nombre de la casa debe tener entre 5 y 32 caracteres.'; end if;
    if m.title = btrim(coalesce(l.title, '')) then m.title := null; end if;
  end if;
  if m.description is not null then
    m.description := btrim(m.description);
    -- Al guardar solo el tope; vacía o de 80 a 2000 se exige al enviar y al aprobar (listing_edit_check), como el asistente.
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

  if public.listing_edit_empty(m) then
    delete from public.listing_edits where listing_id = p_listing;
    return null::public.listing_edits;
  end if;
  update public.listing_edits set title = m.title, kind = m.kind, bathroom_shared = m.bathroom_shared, description = m.description,
    lat = m.lat, lng = m.lng, zone = m.zone, zone_id = m.zone_id, zone_source = m.zone_source
  where listing_id = p_listing
  returning * into e;
  return e;
end $function$;

revoke execute on function public.listing_edit_check(public.listings, public.listing_edits) from public, anon, authenticated;
revoke execute on function public.save_edit(uuid, jsonb) from public, anon;
grant execute on function public.save_edit(uuid, jsonb) to authenticated;

-- ---------- 4) Eventos ----------
alter table public.events drop constraint events_name_check;
alter table public.events add constraint events_name_check check (name in ('page_view', 'listing_view', 'whatsapp_tap', 'inquiry_created', 'wizard_step', 'search_help_tap', 'monthly_filter_tap', 'search_submit', 'explore_map_open', 'map_marker_tap', 'publish_verify'));
