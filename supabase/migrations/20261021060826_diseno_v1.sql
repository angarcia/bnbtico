-- bnbtico · diseño v1 «Sol y sal» (docs/diseno-v1.md) · 2026-10-20
-- Modelo del paso 1 del diseño: modalidad Vacacional y/o Mensual, tipo Alojamiento completo / Habitación (con baño privado
-- o compartido), un precio por modalidad. Copy de los mensajes en usted.

alter type listing_kind add value if not exists 'completo';

alter table listings
  add column accepts_nightly boolean not null default true,   -- Vacacional (las casas anteriores lo eran todas)
  add column bathroom_shared boolean;                          -- solo habitaciones: true compartido, false privado

create or replace function submit_listing(p_listing uuid) returns listing_status language plpgsql security definer set search_path = public as $$
declare
  l listings;
  n_photos int;
begin
  select * into l from listings where id = p_listing and owner_id = auth.uid();
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if l.status = 'review' then raise exception 'Este anuncio ya está en revisión.'; end if;
  if l.status not in ('draft','changes') then raise exception 'Este anuncio no se puede enviar en su estado actual.'; end if;
  if l.kind is null then raise exception 'Elija Alojamiento completo o Habitación.'; end if;
  if not l.accepts_nightly and not coalesce(l.accepts_monthly, false) then raise exception 'Marque Vacacional, Mensual o las dos.'; end if;
  if l.province = '' or l.canton = '' or coalesce(l.zone,'') = '' then raise exception 'Complete provincia, cantón y zona aproximada.'; end if;
  if l.lat is null or l.lng is null then raise exception 'Marque en el mapa la ubicación aproximada.'; end if;
  if l.lat not between 8.0 and 11.3 or l.lng not between -86.0 and -82.5 then raise exception 'Marque un punto dentro de Costa Rica.'; end if;
  if coalesce(l.capacity, 0) < 1 then raise exception 'Indique cuántas personas pueden alojarse (mínimo 1).'; end if;
  if l.bedrooms is null or (l.bedrooms < 1 and l.kind not in ('completo','apartamento')) then raise exception 'Indique las habitaciones; solo un alojamiento completo tipo estudio puede tener 0.'; end if;
  if coalesce(l.bathrooms, 0) < 1 then raise exception 'Indique el número de baños (mínimo 1).'; end if;
  if l.kind = 'habitacion' and l.bathroom_shared is null then raise exception 'Indique si el baño es privado o compartido.'; end if;
  if coalesce(l.title,'') = '' or coalesce(l.description,'') = '' then raise exception 'Complete el nombre de la casa y la descripción.'; end if;
  if 'parking' = any(l.features) then
    if l.parking_paid is null then raise exception 'Indique si el parqueo es gratuito o de pago.'; end if;
  elsif l.parking_paid is not null then
    raise exception 'El tipo de parqueo solo aplica si el anuncio tiene parqueo.';
  end if;
  select count(*) into n_photos from listing_photos where listing_id = p_listing;
  if n_photos < 5 then raise exception 'Agregue al menos 5 fotos.'; end if;
  if n_photos > 15 then raise exception 'Máximo 15 fotos.'; end if;
  if l.accepts_nightly and coalesce(l.nightly_price_crc, 0) <= 0 then raise exception 'Indique el precio por noche en colones.'; end if;
  if coalesce(l.accepts_monthly, false) and coalesce(l.monthly_price_crc, 0) <= 0 then raise exception 'Indique el precio por mes en colones.'; end if;
  perform set_config('app.allow_status', 'on', true);
  update listings set status = 'review', review_note = null where id = p_listing;
  return 'review';
end $$;

create or replace function review_listing(p_listing uuid, p_decision text, p_note text) returns listing_status language plpgsql security definer set search_path = public as $$
declare
  l listings;
  note text := left(btrim(coalesce(p_note, '')), 2000);
  next_status listing_status;
  n_photos int;
begin
  if not is_admin() then raise exception 'Solo bnbtico puede revisar anuncios.'; end if;
  select * into l from listings where id = p_listing;
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if l.status <> 'review' then raise exception 'Este anuncio ya tiene una decisión.'; end if;
  if p_decision not in ('approve','changes','reject') then raise exception 'Decisión no válida.'; end if;
  if p_decision <> 'approve' and note = '' then raise exception 'Escriba un motivo de hasta 2000 caracteres para pedir cambios o rechazar.'; end if;
  if p_decision = 'approve' then
    select count(*) into n_photos from listing_photos where listing_id = p_listing;
    if n_photos < 5 then raise exception 'Pida al menos 5 fotos antes de aprobar.'; end if;
  end if;
  next_status := case p_decision when 'approve' then 'active'::listing_status when 'changes' then 'changes' else 'rejected' end;
  perform set_config('app.allow_status', 'on', true);
  update listings set status = next_status, review_note = nullif(note, ''), reviewed_at = now(), reviewed_by = auth.uid() where id = p_listing;
  insert into admin_actions (admin_id, action, target_listing_id, reason) values (auth.uid(), 'listing.' || p_decision, p_listing, nullif(note, ''));
  if p_decision = 'approve' then update profiles set is_owner = true where id = l.owner_id; end if;
  return next_status;
end $$;

create or replace function set_listing_available(p_listing uuid, p_available boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from listings where id = p_listing and owner_id = auth.uid() and status = 'active') then
    raise exception 'Solo puede cambiar la disponibilidad de una casa activa.';
  end if;
  perform set_config('app.allow_status', 'on', true);
  update listings set available = p_available, reopen_at = null where id = p_listing;
end $$;

create or replace function listings_protect() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_admin() or current_setting('app.allow_status', true) = 'on' then return new; end if;
  if new.owner_id is distinct from old.owner_id or new.public_id is distinct from old.public_id
     or new.reviewed_at is distinct from old.reviewed_at or new.reviewed_by is distinct from old.reviewed_by
     or new.review_note is distinct from old.review_note then
    raise exception 'No puede cambiar ese dato.';
  end if;
  if new.status is distinct from old.status then
    if new.status = 'draft' and old.status in ('active','changes','rejected') then return new; end if;
    raise exception 'Solo bnbtico puede cambiar el estado de un anuncio.';
  end if;
  if old.status not in ('draft','changes') then
    raise exception 'Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión.';
  end if;
  return new;
end $$;

drop view listings_public;
create view listings_public as
  select l.id, l.public_id, l.kind, l.title, l.description, l.province, l.canton, l.zone,
         (approx_point(l.lat, l.lng, l.public_id))[0] as lat, (approx_point(l.lat, l.lng, l.public_id))[1] as lng,
         l.capacity, l.bedrooms, l.bathrooms, l.bathroom_shared, l.features, l.parking_paid,
         l.accepts_nightly, l.nightly_price_crc, l.min_nights, l.accepts_monthly, l.monthly_mode, l.monthly_price_crc, l.min_months,
         l.available, l.reopen_at, l.created_at, l.updated_at,
         p.full_name as owner_name, (p.phone_verified_at is not null) as owner_whatsapp_verified
  from listings l join profiles p on p.id = l.owner_id
  where l.status = 'active';
