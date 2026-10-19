-- bnbtico · fase 2: publicar una casa, aprobarla y verla · 2026-10-19
-- Especificación: docs/superpowers/specs/2026-10-19-fase-2-publicar-aprobar-ver-design.md
-- Columnas que pide el formulario del prototipo, Storage para fotos, protección del estado frente al dueño,
-- RPCs de envío y revisión, estado del enlace público y seed de admin para local/pruebas.

-- ---------- Columnas nuevas ----------
alter table listings
  add column canton text not null default '',
  add column min_nights int not null default 1 check (min_nights >= 1),
  add column min_months int check (min_months is null or min_months >= 1),
  add column parking_paid boolean,                       -- null sin parqueo; true de pago; false gratuito
  add column monthly_mode text check (monthly_mode in ('amount','contact'));  -- null hasta que el dueño elige

-- ---------- El dueño borra solo borradores ----------
create policy listings_owner_delete on listings for delete using (owner_id = auth.uid() and status = 'draft');

-- ---------- is_admin() sin recursión ----------
-- En 0001 la función leía profiles con RLS, y la política de profiles vuelve a llamar a is_admin(): al leer filas ajenas
-- (otro usuario mirando listings, un admin mirando admin_actions) Postgres fallaba con «stack depth limit exceeded».
-- Como security definer salta la RLS de profiles y corta el bucle.
create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false)
$$;

-- ---------- Protección del estado y de los campos de revisión ----------
-- La política de update de 0001 dejaba al dueño cambiar cualquier columna, incluido status. Las RPCs de abajo
-- marcan app.allow_status = 'on' en su transacción; fuera de ellas, solo admin puede mover el estado.
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
  return new;
end $$;
create trigger listings_protect before update on listings for each row execute function listings_protect();

-- ---------- Enviar a revisión ----------
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
  if coalesce(l.title,'') = '' or coalesce(l.description,'') = '' then raise exception 'Completá el título y la descripción.'; end if;
  if l.province = '' or l.canton = '' or coalesce(l.zone,'') = '' then raise exception 'Completá provincia, cantón y zona aproximada.'; end if;
  if l.lat is null or l.lng is null then raise exception 'Marcá en el mapa la ubicación aproximada.'; end if;
  if l.capacity < 1 then raise exception 'Indicá cuántas personas pueden alojarse (mínimo 1).'; end if;
  if l.bathrooms < 1 then raise exception 'Indicá el número de baños disponibles (mínimo 1).'; end if;
  if l.bedrooms < 1 and l.kind <> 'apartamento' then raise exception 'Indicá las habitaciones ofrecidas; solo un apartamento tipo estudio puede tener 0.'; end if;
  if l.nightly_price_crc <= 0 then raise exception 'Indicá un precio por noche en colones, mayor que cero y sin decimales.'; end if;
  if l.min_nights < 1 then raise exception 'Indicá la estancia mínima en noches.'; end if;
  if l.accepts_monthly then
    if l.monthly_mode is null then raise exception 'Elegí indicar un precio mensual o Consultar con el propietario.'; end if;
    if l.monthly_mode = 'amount' and coalesce(l.monthly_price_crc, 0) <= 0 then raise exception 'Indicá un precio mensual válido.'; end if;
  elsif l.monthly_mode is not null or l.monthly_price_crc is not null or l.min_months is not null then
    raise exception 'Este anuncio no acepta alquiler mensual: quitá los datos mensuales.';
  end if;
  if 'parking' = any(l.features) then
    if l.parking_paid is null then raise exception 'Indicá si el parqueo es gratuito o de pago.'; end if;
  elsif l.parking_paid is not null then
    raise exception 'El tipo de parqueo solo aplica si el anuncio tiene parqueo.';
  end if;
  select count(*) into n_photos from listing_photos where listing_id = p_listing;
  if n_photos < 5 then raise exception 'Agregá al menos 5 fotos.'; end if;
  if n_photos > 15 then raise exception 'Máximo 15 fotos.'; end if;
  perform set_config('app.allow_status', 'on', true);
  update listings set status = 'review', review_note = null where id = p_listing;
  return 'review';
end $$;

-- ---------- Revisión del admin ----------
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
  if p_decision <> 'approve' and note = '' then raise exception 'Escribí un motivo de hasta 2000 caracteres para pedir cambios o rechazar.'; end if;
  if p_decision = 'approve' then
    select count(*) into n_photos from listing_photos where listing_id = p_listing;
    if n_photos < 5 then raise exception 'Pedí al menos 5 fotos antes de aprobar.'; end if;
  end if;
  next_status := case p_decision when 'approve' then 'active'::listing_status when 'changes' then 'changes' else 'rejected' end;
  perform set_config('app.allow_status', 'on', true);
  update listings set status = next_status, review_note = nullif(note, ''), reviewed_at = now(), reviewed_by = auth.uid() where id = p_listing;
  insert into admin_actions (admin_id, action, target_listing_id, reason)
  values (auth.uid(), 'listing.' || p_decision, p_listing, nullif(note, ''));
  if p_decision = 'approve' then update profiles set is_owner = true where id = l.owner_id; end if;
  return next_status;
end $$;

-- ---------- Disponible / no disponible (solo casas activas) ----------
create or replace function set_listing_available(p_listing uuid, p_available boolean) returns void language plpgsql security definer set search_path = public as $$
begin
  if not exists (select 1 from listings where id = p_listing and owner_id = auth.uid() and status = 'active') then
    raise exception 'Solo podés cambiar la disponibilidad de una casa activa.';
  end if;
  update listings set available = p_available, reopen_at = null where id = p_listing;
end $$;

-- ---------- Estado del enlace público ----------
-- 'active' se muestra; 'blocked' → «Este enlace ya no está activo»; null → 404. Un borrador que nunca pasó por revisión
-- no existe para el público; uno que fue activo y el dueño está editando sí queda como bloqueado (el enlace ya circuló).
create or replace function listing_link_state(p_public_id text) returns text language sql stable security definer set search_path = public as $$
  select case
    when status = 'active' then 'active'
    when status = 'draft' and reviewed_at is null then null
    else 'blocked'
  end
  from listings where public_id = p_public_id
$$;
grant execute on function listing_link_state(text) to anon, authenticated;

-- ---------- Admin en local y pruebas ----------
-- Solo con la clave de servicio (Playwright, o Daniel desde el panel SQL). La app nunca la llama.
create or replace function seed_admin(p_phone text) returns void language sql security definer set search_path = public as $$
  update profiles set is_admin = true where phone = p_phone
$$;
revoke execute on function seed_admin(text) from public, anon, authenticated;

-- ---------- Storage: fotos de las casas ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listings', 'listings', true, 10485760, '{image/jpeg,image/webp}')
on conflict (id) do nothing;

create policy listings_photos_public_read on storage.objects for select to public using (bucket_id = 'listings');
create policy listings_photos_owner_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'listings' and exists (select 1 from listings l where l.id::text = (storage.foldername(name))[1] and l.owner_id = auth.uid()));
create policy listings_photos_owner_update on storage.objects for update to authenticated using (
  bucket_id = 'listings' and exists (select 1 from listings l where l.id::text = (storage.foldername(name))[1] and l.owner_id = auth.uid()));
create policy listings_photos_owner_delete on storage.objects for delete to authenticated using (
  bucket_id = 'listings' and exists (select 1 from listings l where l.id::text = (storage.foldername(name))[1] and l.owner_id = auth.uid()));

-- ---------- Vista pública con las columnas nuevas ----------
drop view listings_public;
create view listings_public as
  select l.id, l.public_id, l.kind, l.title, l.description, l.province, l.canton, l.zone, l.lat, l.lng,
         l.capacity, l.bedrooms, l.bathrooms, l.features, l.parking_paid,
         l.nightly_price_crc, l.min_nights, l.accepts_monthly, l.monthly_mode, l.monthly_price_crc, l.min_months,
         l.available, l.reopen_at, l.created_at, l.updated_at,
         p.full_name as owner_name, (p.phone_verified_at is not null) as owner_whatsapp_verified
  from listings l join profiles p on p.id = l.owner_id
  where l.status = 'active';
