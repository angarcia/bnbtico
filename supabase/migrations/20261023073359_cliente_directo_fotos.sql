-- bnbtico · fase R · cliente_directo, parte dos (ticket 08) · 2026-10-23
-- Las fotos se suben desde el navegador directamente a Storage con la sesión del dueño (tres variantes por foto en
-- <casa>/<uuid>/{480,800,1600}.jpg) y se registran con RPCs: la base calcula la posición y aplica los topes.
-- 1) add_listing_photo / remove_listing_photo / reorder_listing_photos (una transacción; portada = posición 0).
-- 2) Máximo 15 fotos por casa también para un insert directo (la app vieja sigue insertando filas hasta el corte).
-- 3) Storage: como mucho 45 objetos por carpeta de casa (15 fotos × 3 variantes) y nombres con forma conocida.
-- 4) Como mucho cinco borradores abiertos (nunca revisados) por dueño; se compone con listings_insert_guard (ticket 07).

-- ---------- 2. Tope de fotos por casa ----------
create or replace function listing_photos_cap() returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- Serializa por casa: dos subidas a la vez no pueden pasar las dos de 14 a 15.
  perform 1 from listings where id = new.listing_id for update;
  if (select count(*) from listing_photos where listing_id = new.listing_id) >= 15 then
    raise exception 'Máximo 15 fotos.';
  end if;
  return new;
end $$;

create trigger listing_photos_cap before insert on listing_photos for each row execute function listing_photos_cap();

-- ---------- 1. RPCs de fotos ----------
-- Comprobación común: la casa existe y es mía (si no, el mismo mensaje que da una ajena) y está en borrador o con cambios.
create or replace function listing_photos_guard(p_listing uuid) returns void language plpgsql stable security definer set search_path = public as $$
declare
  st listing_status;
begin
  select status into st from listings where id = p_listing and owner_id = auth.uid();
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if st not in ('draft','changes') then
    raise exception 'Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión.';
  end if;
end $$;

create or replace function add_listing_photo(p_listing uuid, p_path text)
returns table (id uuid, path text, "position" int) language plpgsql security definer set search_path = public as $$
declare
  next_pos int;
begin
  perform listing_photos_guard(p_listing);
  -- La carpeta de las variantes de esta casa: <casa>/<uuid>.
  if p_path !~ ('^' || p_listing::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    raise exception 'Ruta de foto no válida.';
  end if;
  perform 1 from listings l where l.id = p_listing for update;
  if (select count(*) from listing_photos ph where ph.listing_id = p_listing) >= 15 then raise exception 'Máximo 15 fotos.'; end if;
  select coalesce(max(ph.position) + 1, 0) into next_pos from listing_photos ph where ph.listing_id = p_listing;
  return query insert into listing_photos as ph (listing_id, path, position) values (p_listing, p_path, next_pos)
    returning ph.id, ph.path, ph.position;
end $$;

-- Borra la fila, recompacta las posiciones y devuelve la ruta para que el navegador borre los objetos de Storage.
create or replace function remove_listing_photo(p_photo uuid) returns text language plpgsql security definer set search_path = public as $$
declare
  ph listing_photos;
begin
  select * into ph from listing_photos where id = p_photo;
  if not found or not exists (select 1 from listings where id = ph.listing_id and owner_id = auth.uid()) then
    raise exception 'No encontramos esa foto.';
  end if;
  perform listing_photos_guard(ph.listing_id);
  perform 1 from listings where id = ph.listing_id for update;
  delete from listing_photos where id = p_photo;
  update listing_photos t set position = r.pos
    from (select x.id, (row_number() over (order by x.position, x.created_at) - 1)::int as pos from listing_photos x where x.listing_id = ph.listing_id) r
    where t.id = r.id and t.position is distinct from r.pos;
  return ph.path;
end $$;

-- El orden completo de una vez: p_ids tiene que ser exactamente el conjunto de fotos de la casa.
create or replace function reorder_listing_photos(p_listing uuid, p_ids uuid[]) returns void language plpgsql security definer set search_path = public as $$
begin
  perform listing_photos_guard(p_listing);
  perform 1 from listings where id = p_listing for update;
  if coalesce(array_length(p_ids, 1), 0) <> (select count(*) from listing_photos where listing_id = p_listing)
     or (select count(distinct x) from unnest(p_ids) x) <> coalesce(array_length(p_ids, 1), 0)
     or exists (select 1 from unnest(p_ids) x where not exists (select 1 from listing_photos where id = x and listing_id = p_listing)) then
    raise exception 'La lista de fotos cambió. Vuelva a intentarlo.';
  end if;
  update listing_photos t set position = (o.ord - 1)::int
    from unnest(p_ids) with ordinality as o(id, ord)
    where t.id = o.id and t.position is distinct from (o.ord - 1)::int;
end $$;

revoke execute on function add_listing_photo(uuid, text), remove_listing_photo(uuid), reorder_listing_photos(uuid, uuid[]), listing_photos_guard(uuid) from public, anon, authenticated;
grant execute on function add_listing_photo(uuid, text), remove_listing_photo(uuid), reorder_listing_photos(uuid, uuid[]) to authenticated;

-- ---------- 3. Storage: 45 objetos por carpeta de casa ----------
create or replace function listing_folder_objects(p_listing text) returns int language sql stable security definer set search_path = public, storage as $$
  select count(*)::int from storage.objects where bucket_id = 'listings' and (storage.foldername(name))[1] = p_listing
$$;
revoke execute on function listing_folder_objects(text) from public, anon;
grant execute on function listing_folder_objects(text) to authenticated;

drop policy listings_photos_owner_insert on storage.objects;
-- Nombres: <casa>/<uuid>/{480,800,1600}.jpg (ticket 08) o <casa>/<uuid>.jpg (app vieja, hasta el corte).
create policy listings_photos_owner_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'listings'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}(/(480|800|1600))?\.jpg$'
  and listing_editable(((storage.foldername(name))[1])::uuid)
  and listing_folder_objects((storage.foldername(name))[1]) < 45);

-- ---------- 4. Cinco borradores abiertos por dueño ----------
-- Abierto = borrador que nunca se revisó (una casa publicada que se reabre para editar no cuenta).
create or replace function open_drafts() returns int language sql stable security definer set search_path = public as $$
  select count(*)::int from listings where owner_id = auth.uid() and status = 'draft' and reviewed_at is null
$$;
revoke execute on function open_drafts() from public, anon;
grant execute on function open_drafts() to authenticated;

-- El trigger da el mensaje en español (corre antes que la política); la política es la red de seguridad.
create or replace function listings_insert_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or is_admin() then return new; end if;
  if new.status <> 'draft' or new.reviewed_at is not null or new.reviewed_by is not null or new.review_note is not null then
    raise exception 'Un anuncio nuevo empieza como borrador.';
  end if;
  if new.owner_id = auth.uid() and open_drafts() >= 5 then
    raise exception 'Ya tiene 5 borradores sin enviar. Termine o descarte uno antes de empezar otro.';
  end if;
  select phone into new.whatsapp_phone from profiles where id = new.owner_id;
  return new;
end $$;

drop policy listings_owner_insert on listings;
create policy listings_owner_insert on listings for insert with check (owner_id = auth.uid() and (open_drafts() < 5 or is_admin()));
