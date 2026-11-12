-- Revierte la ronda de Ana del 2 nov (Daniel, 2026-11-02): deja el esquema como antes de 20261102215706.
-- Cada función se copia de su última versión anterior a la ronda (archivo indicado). Los datos que cambiaron las
-- migraciones de la ronda (una casa reabierta, una habitación a 1) no se pueden deducir y no se tocan aquí.

-- search_listings y su helper del total
drop function if exists public.search_listings(text, date, date, text, integer, integer, integer, text[], public.feature[], integer, integer, integer);
drop function if exists public.search_stay_total(uuid, integer, boolean, integer, date, date);

-- de 20261029091243_explorar_fechas_y_zona.sql
create or replace function public.search_listings(p_zone text default null, p_from date default null, p_to date default null)
returns setof public.listings_public
language plpgsql stable security definer set search_path = '' as $$
declare
  today date := public.costa_rica_today();
  z public.zones;
begin
  if (p_from is null) <> (p_to is null) then raise exception 'Revise las fechas.'; end if;
  if p_from is not null and (p_to <= p_from or p_from < today or p_to > today + 366) then
    raise exception 'Revise las fechas.';
  end if;
  if p_zone is not null then
    select * into z from public.zones where id = p_zone and active;
    if not found then return; end if;
  end if;
  return query
    select lp.* from public.listings_public lp
    join public.listings l on l.id = lp.id
    where l.available
      and (p_zone is null or l.zone_id = p_zone
           or extensions.ST_DWithin(extensions.ST_SetSRID(extensions.ST_MakePoint(l.lng, l.lat), 4326)::extensions.geography,
                                    z.point::extensions.geography, 5000))
      and (p_from is null or not exists (
            select 1 from public.listing_days d
            where d.listing_id = l.id and d.day >= p_from and d.day < p_to and not d.available));
end $$;
revoke all on function public.search_listings(text, date, date) from public;
grant execute on function public.search_listings(text, date, date) to anon, authenticated;

-- trigger de Habitación = 1 habitación
drop trigger if exists listings_habitacion_una on public.listings;
drop function if exists public.listings_habitacion_una();

-- de 20261030233129_admin_casas_acciones.sql
CREATE OR REPLACE FUNCTION public.create_inquiry(p_public_id text, p_arrival date, p_departure date, p_people integer, p_message text)
 RETURNS TABLE(inquiry_id uuid, whatsapp_phone text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  prof public.profiles;
  l public.listings;
  msg text := btrim(coalesce(p_message, ''));
  today date := (now() at time zone 'America/Costa_Rica')::date;
  found_id uuid;
  others int;
begin
  if uid is null then raise exception 'Ingrese con su WhatsApp para contactar al propietario.'; end if;
  select * into prof from public.profiles where id = uid;
  if not found or not prof.is_active then raise exception 'Su cuenta está desactivada. Escríbanos por WhatsApp.'; end if;
  if prof.phone_verified_at is null then raise exception 'Verifique su WhatsApp para contactar al propietario.'; end if;

  select * into l from public.listings where public_id = p_public_id and status = 'active' and admin_hold is null and deleted_at is null;
  if not found then raise exception 'Esta casa ya no está publicada.'; end if;
  if l.owner_id = uid then raise exception 'Esta es su propia casa.'; end if;
  if not l.available then raise exception 'Esta casa no está disponible para consultas.'; end if;

  -- Mismo orden y mensajes que validateInquiryDraft (src/domain/inquiry.ts).
  if (p_arrival is null) <> (p_departure is null) then raise exception 'Indique la llegada y la salida, o deje las dos vacías.'; end if;
  if p_arrival is not null then
    if p_departure <= p_arrival then raise exception 'La salida tiene que ser después de la llegada.'; end if;
    if p_arrival < today then raise exception 'La llegada no puede ser antes de hoy.'; end if;
  end if;
  if p_people is not null and (p_people < 1 or p_people > 50) then raise exception 'Indique entre 1 y 50 personas.'; end if;
  if msg = '' then raise exception 'Escriba un mensaje para el propietario.'; end if;
  if char_length(msg) > 1000 then raise exception 'El mensaje no puede pasar de 1000 caracteres.'; end if;

  -- Dos toques seguidos del mismo cliente a la misma casa no crean dos filas.
  perform pg_advisory_xact_lock(hashtextextended(uid::text || l.id::text, 0));

  select count(distinct i.listing_id) into others from public.inquiries i
   where i.client_id = uid and i.updated_at > now() - interval '24 hours' and i.listing_id <> l.id;
  if others >= 20 then raise exception 'Ha contactado muchas casas hoy. Intente mañana o escríbanos por WhatsApp.'; end if;

  select i.id into found_id from public.inquiries i
   where i.client_id = uid and i.listing_id = l.id and i.created_at > now() - interval '7 days'
   order by i.created_at desc limit 1;

  if found_id is null then
    insert into public.inquiries (listing_id, client_id, owner_id, arrival, departure, people, message, consent_share_phone, whatsapp_phone, source)
    values (l.id, uid, l.owner_id, p_arrival, p_departure, p_people, msg, true, l.whatsapp_phone, 'listing')
    returning id into found_id;
  else
    update public.inquiries
       set arrival = p_arrival, departure = p_departure, people = p_people, message = msg, consent_share_phone = true,
           whatsapp_phone = l.whatsapp_phone, updated_at = now(), owner_opened_at = null
     where id = found_id;
  end if;

  return query select found_id, l.whatsapp_phone;
end $function$;

-- de 20261030092712_revision_por_dato.sql
create or replace function public.listing_edit_check(l public.listings, e public.listing_edits) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  k public.listing_kind := coalesce(e.kind, l.kind);
  d text := btrim(coalesce(e.description, ''));
begin
  if e.lat is not null then perform public.edit_place(e.lat, e.lng, e.zone, e.zone_id, e.zone_source); end if;
  if l.bedrooms is null or (l.bedrooms < 1 and k not in ('completo','apartamento')) then
    raise exception 'Indique las habitaciones; solo un alojamiento completo tipo estudio puede tener 0.';
  end if;
  if k = 'habitacion' and coalesce(e.bathroom_shared, l.bathroom_shared) is null then
    raise exception 'Indique si el baño es privado o compartido.';
  end if;
  if e.title is not null and char_length(btrim(e.title)) not between 5 and 32 then raise exception 'El nombre de la casa debe tener entre 5 y 32 caracteres.'; end if;
  if e.description is not null and d <> '' and char_length(d) not between 80 and 2000 then
    raise exception 'La descripción debe tener entre 80 y 2000 caracteres o quedar vacía.';
  end if;
end $$;

-- de 20261029122021_editar_casa_publicada.sql
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

  if coalesce(m.capacity, 0) < 1 then raise exception 'Indique cuántas personas pueden alojarse (mínimo 1).'; end if;
  if m.bedrooms is null or (m.bedrooms < 1 and l.kind not in ('completo','apartamento')) then raise exception 'Indique las habitaciones; solo un alojamiento completo tipo estudio puede tener 0.'; end if;
  if coalesce(m.bathrooms, 0) < 1 then raise exception 'Indique el número de baños (mínimo 1).'; end if;
  if 'parking' = any(m.features) then
    if m.parking_paid is null then raise exception 'Indique si el parqueo es gratuito o de pago.'; end if;
  elsif m.parking_paid is not null then
    raise exception 'El tipo de parqueo solo aplica si el anuncio tiene parqueo.';
  end if;
  if coalesce(m.nightly_price_crc, 0) <= 0 then raise exception 'Indique el precio por noche en colones.'; end if;
  if m.accepts_monthly and m.monthly_price_crc is not null and m.monthly_price_crc <= 0 then raise exception 'Indique el precio al mes en colones o déjelo vacío.'; end if;

  perform set_config('app.allow_status', 'on', true);
  update public.listings set capacity = m.capacity, bedrooms = m.bedrooms, bathrooms = m.bathrooms, features = m.features,
    parking_paid = m.parking_paid, nightly_price_crc = m.nightly_price_crc, accepts_monthly = m.accepts_monthly,
    monthly_price_crc = m.monthly_price_crc
  where id = p_listing;
end $$;

-- de 20261030092712_revision_por_dato.sql
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

  if m.title is not null then
    m.title := btrim(m.title);
    if char_length(m.title) not between 5 and 32 then raise exception 'El nombre de la casa debe tener entre 5 y 32 caracteres.'; end if;
    if m.title = btrim(coalesce(l.title, '')) then m.title := null; end if;
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

-- de 20261030233129_admin_casas_acciones.sql
CREATE OR REPLACE FUNCTION public.submit_listing(p_listing uuid)
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
  perform public.assert_listing_open(p_listing);
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

-- CHECK de listing_edits como en 20261029122021
alter table public.listing_edits drop constraint listing_edits_title_check;
alter table public.listing_edits add constraint listing_edits_title_check check (title is null or char_length(btrim(title)) between 5 and 60);
alter table public.listing_edits drop constraint listing_edits_description_check;
alter table public.listing_edits add constraint listing_edits_description_check check (description is null or char_length(description) <= 2000);

-- Datos: CT-1054 estaba cerrada hasta el 2026-11-20 (docs/pruebas-manuales.md, 1.5) y reabrir_casas_cerradas la abrió.
select set_config('app.allow_status', 'on', true);
update public.listings set available = false, reopen_at = date '2026-11-20' where public_id = 'CT-1054' and available;
