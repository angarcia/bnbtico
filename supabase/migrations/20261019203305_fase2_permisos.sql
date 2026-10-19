-- bnbtico · fase 2 · permisos que la revisión encontró abiertos en 0001 · 2026-10-19
-- 1) Nadie se marca admin/dueño/verificado por REST. 2) La tabla listings deja de ser legible para el público:
-- el catálogo y la ficha leen solo la vista listings_public (sin WhatsApp, con coordenadas desplazadas en SQL).
-- 3) Una casa fuera de draft/changes no se edita (fila, fotos ni Storage) sin volver a borrador y a revisión.
-- 4) El borrador nace sin valores inventados (kind, accepts_monthly y números nulos hasta que el dueño los escribe).

-- ---------- 1. profiles: privilegios por columna ----------
-- Las políticas de fila no bastan: la política de update de 0001 dejaba cambiar cualquier columna de la propia fila.
revoke update on profiles from anon, authenticated;
grant update (full_name, email, description) on profiles to authenticated;

-- ---------- 2. listings: solo dueño y admin leen la tabla; el público lee la vista ----------
drop policy listings_public_select on listings;
create policy listings_owner_or_admin_select on listings for select using (owner_id = auth.uid() or is_admin());

-- Las políticas de fotos/tarifas/días consultaban listings con la RLS del usuario; con la tabla cerrada al público
-- usarían una subconsulta vacía. Helper security definer: visible si está activa, es mía o soy admin.
create or replace function listing_visible(p_listing uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from listings l where l.id = p_listing and (l.status = 'active' or l.owner_id = auth.uid() or is_admin()))
$$;
-- Editable por el dueño: suya y en borrador o con cambios pedidos.
create or replace function listing_editable(p_listing uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from listings l where l.id = p_listing and l.owner_id = auth.uid() and l.status in ('draft','changes'))
$$;

drop policy photos_select on listing_photos;
create policy photos_select on listing_photos for select using (listing_visible(listing_id));
drop policy photos_owner_write on listing_photos;
create policy photos_owner_write on listing_photos for all using (listing_editable(listing_id)) with check (listing_editable(listing_id));
drop policy rates_select on listing_rates;
create policy rates_select on listing_rates for select using (listing_visible(listing_id));
drop policy days_select on listing_days;
create policy days_select on listing_days for select using (listing_visible(listing_id));

drop policy listings_photos_owner_insert on storage.objects;
drop policy listings_photos_owner_update on storage.objects;
drop policy listings_photos_owner_delete on storage.objects;
create policy listings_photos_owner_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'listings' and listing_editable(((storage.foldername(name))[1])::uuid));
create policy listings_photos_owner_update on storage.objects for update to authenticated using (
  bucket_id = 'listings' and listing_editable(((storage.foldername(name))[1])::uuid));
create policy listings_photos_owner_delete on storage.objects for delete to authenticated using (
  bucket_id = 'listings' and listing_editable(((storage.foldername(name))[1])::uuid));

-- El borrador que fue una casa publicada conserva su CT-####: no se borra.
drop policy listings_owner_delete on listings;
create policy listings_owner_delete on listings for delete using (owner_id = auth.uid() and status = 'draft' and reviewed_at is null);

-- ---------- 3. Contenido congelado fuera de draft/changes ----------
create or replace function listings_protect() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_admin() or current_setting('app.allow_status', true) = 'on' then return new; end if;
  if new.owner_id is distinct from old.owner_id or new.public_id is distinct from old.public_id
     or new.reviewed_at is distinct from old.reviewed_at or new.reviewed_by is distinct from old.reviewed_by
     or new.review_note is distinct from old.review_note then
    raise exception 'No podés cambiar ese dato.';
  end if;
  if new.status is distinct from old.status then
    if new.status = 'draft' and old.status in ('active','changes','rejected') then return new; end if;
    raise exception 'Solo bnbtico puede cambiar el estado de un anuncio.';
  end if;
  if old.status not in ('draft','changes') then
    raise exception 'Este anuncio no se puede editar en su estado actual. Abrilo para editar y volverá a revisión.';
  end if;
  return new;
end $$;

create or replace function set_listing_available(p_listing uuid, p_available boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from listings where id = p_listing and owner_id = auth.uid() and status = 'active') then
    raise exception 'Solo podés cambiar la disponibilidad de una casa activa.';
  end if;
  perform set_config('app.allow_status', 'on', true);
  update listings set available = p_available, reopen_at = null where id = p_listing;
end $$;

-- ---------- 4. Borrador sin valores inventados ----------
alter table listings
  alter column accepts_monthly drop default, alter column accepts_monthly drop not null,
  alter column capacity drop not null,
  alter column bedrooms drop not null,
  alter column bathrooms drop not null,
  alter column nightly_price_crc drop not null,
  alter column min_nights drop default, alter column min_nights drop not null;

create or replace function submit_listing(p_listing uuid) returns listing_status language plpgsql security definer set search_path = public as $$
declare
  l listings;
  n_photos int;
begin
  select * into l from listings where id = p_listing and owner_id = auth.uid();
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if l.status = 'review' then raise exception 'Este anuncio ya está en revisión.'; end if;
  if l.status not in ('draft','changes') then raise exception 'Este anuncio no se puede enviar en su estado actual.'; end if;
  if l.kind is null then raise exception 'Elegí Casa, Apartamento o Habitación.'; end if;
  if l.accepts_monthly is null then raise exception 'Respondé si aceptás alquiler mensual.'; end if;
  if l.province = '' or l.canton = '' or coalesce(l.zone,'') = '' then raise exception 'Completá provincia, cantón y zona aproximada.'; end if;
  if l.lat is null or l.lng is null then raise exception 'Marcá en el mapa la ubicación aproximada.'; end if;
  if l.lat not between 8.0 and 11.3 or l.lng not between -86.0 and -82.5 then raise exception 'Marcá un punto dentro de Costa Rica.'; end if;
  if coalesce(l.capacity, 0) < 1 then raise exception 'Indicá cuántas personas pueden alojarse (mínimo 1).'; end if;
  if l.bedrooms is null or (l.bedrooms < 1 and l.kind <> 'apartamento') then raise exception 'Indicá las habitaciones ofrecidas; solo un apartamento tipo estudio puede tener 0.'; end if;
  if coalesce(l.bathrooms, 0) < 1 then raise exception 'Indicá el número de baños disponibles (mínimo 1).'; end if;
  if coalesce(l.title,'') = '' or coalesce(l.description,'') = '' then raise exception 'Completá el título y la descripción.'; end if;
  if 'parking' = any(l.features) then
    if l.parking_paid is null then raise exception 'Indicá si el parqueo es gratuito o de pago.'; end if;
  elsif l.parking_paid is not null then
    raise exception 'El tipo de parqueo solo aplica si el anuncio tiene parqueo.';
  end if;
  select count(*) into n_photos from listing_photos where listing_id = p_listing;
  if n_photos < 5 then raise exception 'Agregá al menos 5 fotos.'; end if;
  if n_photos > 15 then raise exception 'Máximo 15 fotos.'; end if;
  if coalesce(l.nightly_price_crc, 0) <= 0 then raise exception 'Indicá un precio por noche en colones, mayor que cero y sin decimales.'; end if;
  if coalesce(l.min_nights, 0) < 1 then raise exception 'Indicá la estancia mínima en noches.'; end if;
  if l.accepts_monthly then
    if l.monthly_mode is null then raise exception 'Elegí indicar un precio mensual o Consultar con el propietario.'; end if;
    if l.monthly_mode = 'amount' and coalesce(l.monthly_price_crc, 0) <= 0 then raise exception 'Indicá un precio mensual válido.'; end if;
  elsif l.monthly_mode is not null or l.monthly_price_crc is not null or l.min_months is not null then
    raise exception 'Este anuncio no acepta alquiler mensual: quitá los datos mensuales.';
  end if;
  perform set_config('app.allow_status', 'on', true);
  update listings set status = 'review', review_note = null where id = p_listing;
  return 'review';
end $$;

-- ---------- 5. Vista pública con coordenadas desplazadas en SQL ----------
-- Determinista por public_id (misma casa → mismo círculo), entre 150 y 499 m del punto real. El punto exacto no sale de la tabla.
create or replace function approx_point(p_lat double precision, p_lng double precision, p_seed text) returns point language plpgsql immutable as $$
declare
  h1 int := abs(('x' || substr(md5(p_seed), 1, 8))::bit(32)::int);
  h2 int := abs(('x' || substr(md5(p_seed), 9, 8))::bit(32)::int);
  dist double precision := 150 + (h1 % 350);          -- 150–499 m
  ang double precision := radians(h2 % 360);
begin
  if p_lat is null or p_lng is null then return null; end if;
  return point(p_lat + (dist * cos(ang)) / 111320.0, p_lng + (dist * sin(ang)) / (111320.0 * cos(radians(p_lat))));
end $$;

drop view listings_public;
create view listings_public as
  select l.id, l.public_id, l.kind, l.title, l.description, l.province, l.canton, l.zone,
         (approx_point(l.lat, l.lng, l.public_id))[0] as lat, (approx_point(l.lat, l.lng, l.public_id))[1] as lng,
         l.capacity, l.bedrooms, l.bathrooms, l.features, l.parking_paid,
         l.nightly_price_crc, l.min_nights, l.accepts_monthly, l.monthly_mode, l.monthly_price_crc, l.min_months,
         l.available, l.reopen_at, l.created_at, l.updated_at,
         p.full_name as owner_name, (p.phone_verified_at is not null) as owner_whatsapp_verified
  from listings l join profiles p on p.id = l.owner_id
  where l.status = 'active';
