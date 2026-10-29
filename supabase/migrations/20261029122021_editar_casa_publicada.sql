-- bnbtico · editar una casa publicada sin sacarla de Explorar, parte uno · 2026-10-29
-- Spec .scratch/editar-casa/spec.md (sección Data). Una casa publicada (activa, pendiente de pago o inactiva, con
-- first_published_at) no vuelve nunca a borrador: unos datos cambian al momento (update_listing_live) y otros pasan por
-- una edición revisada (listing_edits, una por casa; sus RPCs llegan en la parte dos). Mientras tanto listings,
-- listing_photos y listings_public no cambian: los clientes ven la versión aprobada.
-- 1) Tablas listing_edits y listing_edit_photos: solo lectura para dueño y admin; se escriben con RPCs.
-- 2) Ayudantes: listing_is_published, own_published_listing.
-- 3) update_listing_live: capacidad, características y precio, validados con los mensajes de submit_listing.
-- 4) listings_protect: una casa activa ya no pasa a borrador; la casa publicada congelada da su propio mensaje.
-- 5) Fotos: ordenar y quitar también en una casa publicada (nunca la última); añadir, no (va por la edición).
-- 6) Storage: subir a la carpeta de una casa publicada sin edición en revisión; borrar solo objetos sin foto que los enlace.
-- Copia de listings_protect de 20261027060732_primera_publicacion.sql y de las RPCs de fotos de
-- 20261023073359_cliente_directo_fotos.sql, con solo los cambios dichos y search_path vacío.

-- ---------- 1. Tablas ----------
create table public.listing_edits (
  listing_id uuid primary key references public.listings(id) on delete cascade,  -- una edición por casa
  status text not null default 'open' check (status in ('open','review','changes')),
  -- Campos con revisión; null = sin cambio.
  title text check (title is null or char_length(btrim(title)) between 5 and 60),  -- E baja el máximo a 32 en las RPCs
  kind public.listing_kind,
  bathroom_shared boolean,          -- va con el tipo: solo cuenta si el tipo resultante es habitación
  description text check (description is null or char_length(description) <= 2000),  -- '' = borrar la descripción
  lat double precision, lng double precision,
  zone text, zone_id text references public.zones(id) on delete set null, zone_source text check (zone_source in ('list','district','other')),
  review_note text,
  submitted_at timestamptz, reviewed_at timestamptz, reviewed_by uuid references public.profiles(id),
  created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
  check ((lat is null) = (lng is null)),
  check ((lat is null) = (zone_source is null))   -- ubicación completa o nada
);
create trigger listing_edits_updated before update on public.listing_edits for each row execute function public.set_updated_at();

create table public.listing_edit_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references public.listing_edits(listing_id) on delete cascade,
  path text not null,                 -- <casa>/<uuid>: la misma carpeta que las fotos aprobadas
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index on public.listing_edit_photos (listing_id, position);

alter table public.listing_edits enable row level security;
alter table public.listing_edit_photos enable row level security;
create policy listing_edits_select on public.listing_edits for select using (
  exists (select 1 from public.listings l where l.id = listing_edits.listing_id and (l.owner_id = auth.uid() or public.is_admin())));
create policy listing_edit_photos_select on public.listing_edit_photos for select using (
  exists (select 1 from public.listings l where l.id = listing_edit_photos.listing_id and (l.owner_id = auth.uid() or public.is_admin())));
revoke all on public.listing_edits, public.listing_edit_photos from public, anon, authenticated;
grant select on public.listing_edits, public.listing_edit_photos to authenticated;

-- ---------- 2. Ayudantes ----------
-- Publicada = se aprobó alguna vez y no está en el circuito de la primera revisión.
create or replace function public.listing_is_published(p_status public.listing_status, p_first timestamptz) returns boolean
language sql immutable security definer set search_path = '' as $$
  select p_status in ('active','payment_due','inactive') and p_first is not null
$$;

-- La casa, bloqueada para esta transacción, si es mía y está publicada; si no, el mensaje que toca.
create or replace function public.own_published_listing(p_listing uuid) returns public.listings
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
begin
  select * into l from public.listings where id = p_listing and owner_id = auth.uid() for update;
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if not public.listing_is_published(l.status, l.first_published_at) then
    raise exception 'Solo puede cambiar así una casa publicada.';
  end if;
  return l;
end $$;

-- ---------- 3. Datos al momento ----------
-- p_patch: columnas de listings (snake_case) con su valor nuevo; las demás claves se rechazan. Se valida la fila
-- resultante con las reglas y los mensajes de submit_listing, en su orden; el tipo es el aprobado (un cambio de tipo
-- pendiente se vuelve a comprobar al aprobar la edición). listings_purge_page purga la ficha.
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

-- ---------- 4. listings_protect ----------
-- Igual que en 20261027060732 salvo: el dueño ya no pasa una casa activa a borrador (solo 'changes' y 'rejected', que
-- nunca se publicaron), y una casa publicada congelada da el mensaje que lleva a Mis casas.
create or replace function public.listings_protect() returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if public.is_admin() or current_setting('app.allow_status', true) = 'on' then return new; end if;
  if new.owner_id is distinct from old.owner_id or new.public_id is distinct from old.public_id
     or new.reviewed_at is distinct from old.reviewed_at or new.reviewed_by is distinct from old.reviewed_by
     or new.review_note is distinct from old.review_note or new.whatsapp_phone is distinct from old.whatsapp_phone
     or new.first_published_at is distinct from old.first_published_at then
    raise exception 'No puede cambiar ese dato.';
  end if;
  if new.status is distinct from old.status then
    if new.status = 'draft' and old.status in ('changes','rejected') then return new; end if;
    raise exception 'Solo bnbtico puede cambiar el estado de un anuncio.';
  end if;
  if old.status not in ('draft','changes') then
    if public.listing_is_published(old.status, old.first_published_at) then
      raise exception 'Esta casa está publicada: cambie sus datos desde Mis casas.';
    end if;
    raise exception 'Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión.';
  end if;
  return new;
end $$;

-- ---------- 5. Fotos ----------
-- add_listing_photo: casa mía en borrador o con cambios. Una casa publicada añade fotos por la edición.
create or replace function public.listing_photos_guard(p_listing uuid) returns void language plpgsql stable security definer set search_path = '' as $$
declare
  l public.listings;
begin
  select * into l from public.listings where id = p_listing and owner_id = auth.uid();
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if public.listing_is_published(l.status, l.first_published_at) then
    raise exception 'Las fotos nuevas pasan por revisión. Añádalas desde la ficha de su casa.';
  end if;
  if l.status not in ('draft','changes') then
    raise exception 'Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión.';
  end if;
end $$;

-- Quitar y ordenar: casa mía en borrador, con cambios o publicada. Devuelve si está publicada.
create or replace function public.listing_photos_owner_guard(p_listing uuid) returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  l public.listings;
begin
  select * into l from public.listings where id = p_listing and owner_id = auth.uid();
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if public.listing_is_published(l.status, l.first_published_at) then return true; end if;
  if l.status not in ('draft','changes') then
    raise exception 'Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión.';
  end if;
  return false;
end $$;

-- Borra la fila, recompacta las posiciones y devuelve la ruta para que el navegador borre los objetos de Storage.
-- Una casa publicada conserva al menos una foto aprobada.
create or replace function public.remove_listing_photo(p_photo uuid) returns text language plpgsql security definer set search_path = '' as $$
declare
  ph public.listing_photos;
  published boolean;
begin
  select * into ph from public.listing_photos where id = p_photo;
  if not found or not exists (select 1 from public.listings where id = ph.listing_id and owner_id = auth.uid()) then
    raise exception 'No encontramos esa foto.';
  end if;
  published := public.listing_photos_owner_guard(ph.listing_id);
  perform 1 from public.listings where id = ph.listing_id for update;
  if published and (select count(*) from public.listing_photos x where x.listing_id = ph.listing_id) <= 1 then
    raise exception 'Su ficha necesita al menos una foto. Añada otra y, cuando la aprobemos, podrá quitar esta.';
  end if;
  delete from public.listing_photos where id = p_photo;
  update public.listing_photos t set position = r.pos
    from (select x.id, (row_number() over (order by x.position, x.created_at) - 1)::int as pos from public.listing_photos x where x.listing_id = ph.listing_id) r
    where t.id = r.id and t.position is distinct from r.pos;
  return ph.path;
end $$;

-- El orden completo de una vez: p_ids tiene que ser exactamente el conjunto de fotos de la casa.
create or replace function public.reorder_listing_photos(p_listing uuid, p_ids uuid[]) returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.listing_photos_owner_guard(p_listing);
  perform 1 from public.listings where id = p_listing for update;
  if coalesce(array_length(p_ids, 1), 0) <> (select count(*) from public.listing_photos where listing_id = p_listing)
     or (select count(distinct x) from unnest(p_ids) x) <> coalesce(array_length(p_ids, 1), 0)
     or exists (select 1 from unnest(p_ids) x where not exists (select 1 from public.listing_photos where id = x and listing_id = p_listing)) then
    raise exception 'La lista de fotos cambió. Vuelva a intentarlo.';
  end if;
  update public.listing_photos t set position = (o.ord - 1)::int
    from unnest(p_ids) with ordinality as o(id, ord)
    where t.id = o.id and t.position is distinct from (o.ord - 1)::int;
end $$;

-- ---------- 6. Storage ----------
-- Subir: casa mía en borrador o con cambios, o publicada sin una edición en revisión (la primera foto nueva se sube antes
-- de que add_edit_photo abra la edición; con la edición en revisión, la edición está congelada).
create or replace function public.listing_photo_uploadable(p_listing uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select public.listing_editable(p_listing) or exists (
    select 1 from public.listings l
    where l.id = p_listing and l.owner_id = auth.uid() and public.listing_is_published(l.status, l.first_published_at)
      and not exists (select 1 from public.listing_edits e where e.listing_id = l.id and e.status = 'review'))
$$;

-- Ningún registro de foto (aprobada o nueva) enlaza ese objeto: su carpeta <casa>/<uuid> o el nombre entero (app vieja).
create or replace function public.photo_unreferenced(p_name text) returns boolean language sql stable security definer set search_path = '' as $$
  select not exists (select 1 from public.listing_photos ph where ph.path = p_name or starts_with(p_name, ph.path || '/'))
     and not exists (select 1 from public.listing_edit_photos ep where ep.path = p_name or starts_with(p_name, ep.path || '/'))
$$;

drop policy listings_photos_owner_insert on storage.objects;
-- Nombres: <casa>/<uuid>/{480,800,1600}.jpg (ticket 08) o <casa>/<uuid>.jpg (app vieja, hasta el corte).
create policy listings_photos_owner_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'listings'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}(/(480|800|1600))?\.jpg$'
  and public.listing_photo_uploadable(((storage.foldername(name))[1])::uuid)
  and public.listing_folder_objects((storage.foldername(name))[1]) < 45);

-- Borrar: la carpeta es de una casa mía y ninguna foto enlaza el objeto (el navegador borra después de que la RPC quitó
-- la fila: fotos quitadas, nuevas descartadas; nunca una en uso).
drop policy listings_photos_owner_delete on storage.objects;
create policy listings_photos_owner_delete on storage.objects for delete to authenticated using (
  bucket_id = 'listings'
  and exists (select 1 from public.listings l where l.id::text = (storage.foldername(name))[1] and l.owner_id = auth.uid())
  and public.photo_unreferenced(name));

-- ---------- Permisos ----------
revoke execute on function public.listing_is_published(public.listing_status, timestamptz), public.update_listing_live(uuid, jsonb),
  public.listing_photo_uploadable(uuid), public.photo_unreferenced(text) from public, anon;
grant execute on function public.listing_is_published(public.listing_status, timestamptz), public.update_listing_live(uuid, jsonb),
  public.listing_photo_uploadable(uuid), public.photo_unreferenced(text) to authenticated;
revoke execute on function public.own_published_listing(uuid), public.listing_photos_owner_guard(uuid), public.listing_photos_guard(uuid)
  from public, anon, authenticated;
