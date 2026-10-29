-- bnbtico · editar una casa publicada sin sacarla de Explorar, parte dos · 2026-10-29
-- Spec .scratch/editar-casa/spec.md (sección RPCs). La edición revisada del propietario: una por casa (listing_edits), con
-- los campos que pasan por revisión (nombre, tipo, descripción, ubicación) y las fotos nuevas (listing_edit_photos).
-- Mientras no se apruebe (parte tres, review_edit), listings, listing_photos y listings_public no cambian.
-- 0) Renombre: el ayudante listing_is_published(status, timestamptz) de la parte uno chocaba de nombre con el de favoritos
--    listing_is_published(uuid) (otro significado). Pasa a listing_status_published, sql inmutable sin security definer ni
--    permisos; se rehacen sus llamadas (copias de 20261029122021 con solo el nombre cambiado).
-- 1) Ayudantes sin permisos: listing_edit_empty, edit_place (reglas de ubicación de submit_listing), listing_edit_check
--    (la casa resultante con las reglas y mensajes de submit_listing para los campos revisados).
-- 2) RPCs del propietario: start_edit, save_edit, add_edit_photo, remove_edit_photo, reorder_edit_photos, submit_edit,
--    discard_edit. Todas bloquean la casa (own_published_listing): una edición a la vez y en orden.

-- ---------- 0. Renombre del ayudante ----------
create or replace function public.listing_status_published(p_status public.listing_status, p_first timestamptz) returns boolean
language sql immutable set search_path = '' as $$
  select p_status in ('active','payment_due','inactive') and p_first is not null
$$;

create or replace function public.own_published_listing(p_listing uuid) returns public.listings
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
begin
  select * into l from public.listings where id = p_listing and owner_id = auth.uid() for update;
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if not public.listing_status_published(l.status, l.first_published_at) then
    raise exception 'Solo puede cambiar así una casa publicada.';
  end if;
  return l;
end $$;

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
    if public.listing_status_published(old.status, old.first_published_at) then
      raise exception 'Esta casa está publicada: cambie sus datos desde Mis casas.';
    end if;
    raise exception 'Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión.';
  end if;
  return new;
end $$;

create or replace function public.listing_photos_guard(p_listing uuid) returns void language plpgsql stable security definer set search_path = '' as $$
declare
  l public.listings;
begin
  select * into l from public.listings where id = p_listing and owner_id = auth.uid();
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if public.listing_status_published(l.status, l.first_published_at) then
    raise exception 'Las fotos nuevas pasan por revisión. Añádalas desde la ficha de su casa.';
  end if;
  if l.status not in ('draft','changes') then
    raise exception 'Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión.';
  end if;
end $$;

create or replace function public.listing_photos_owner_guard(p_listing uuid) returns boolean language plpgsql stable security definer set search_path = '' as $$
declare
  l public.listings;
begin
  select * into l from public.listings where id = p_listing and owner_id = auth.uid();
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if public.listing_status_published(l.status, l.first_published_at) then return true; end if;
  if l.status not in ('draft','changes') then
    raise exception 'Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión.';
  end if;
  return false;
end $$;

create or replace function public.listing_photo_uploadable(p_listing uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select public.listing_editable(p_listing) or exists (
    select 1 from public.listings l
    where l.id = p_listing and l.owner_id = auth.uid() and public.listing_status_published(l.status, l.first_published_at)
      and not exists (select 1 from public.listing_edits e where e.listing_id = l.id and e.status = 'review'))
$$;

drop function public.listing_is_published(public.listing_status, timestamptz);
revoke execute on function public.listing_status_published(public.listing_status, timestamptz) from public, anon, authenticated;

-- ---------- 1. Ayudantes ----------
-- Una edición sin ningún campo cambiado ni foto nueva.
create or replace function public.listing_edit_empty(e public.listing_edits) returns boolean
language sql stable security definer set search_path = '' as $$
  select e.title is null and e.kind is null and e.bathroom_shared is null and e.description is null and e.lat is null
     and not exists (select 1 from public.listing_edit_photos p where p.listing_id = e.listing_id)
$$;

-- Las reglas de ubicación de submit_listing (20261028071444), con sus mensajes: el lugar sale del pin (place_at) y la zona
-- es de la lista a 5 km o menos, el distrito del pin o un nombre propio de hasta 60 caracteres. Devuelve el lugar y el
-- nombre de zona que se guarda.
create or replace function public.edit_place(p_lat double precision, p_lng double precision, p_zone text, p_zone_id text, p_zone_source text)
returns table (province text, canton text, district text, zone text) language plpgsql stable security definer set search_path = '' as $$
declare
  pl record;
  zname text;
begin
  if p_lat is null or p_lng is null then raise exception 'Marque en el mapa la ubicación aproximada.'; end if;
  select * into pl from public.place_at(p_lat, p_lng);
  if not found then raise exception 'Ponga el punto sobre tierra, dentro de Costa Rica.'; end if;
  if btrim(coalesce(p_zone, '')) = '' or p_zone_source is null then raise exception 'Elija la zona.'; end if;
  if p_zone_source = 'list' then
    if p_zone_id is null then raise exception 'Elija la zona.'; end if;
    if not exists (select 1 from public.zones_near(p_lat, p_lng, 5) z where z.id = p_zone_id) then
      raise exception 'La zona elegida queda a más de 5 km del punto. Elija otra.';
    end if;
    select z.name into zname from public.zones z where z.id = p_zone_id;
  elsif p_zone_source = 'district' then
    if p_zone_id is not null or btrim(p_zone) is distinct from pl.district then
      raise exception 'La zona no coincide con el distrito del punto. Elija otra.';
    end if;
    zname := btrim(p_zone);
  else -- 'other': nombre propuesto por el dueño, sin zona de la lista
    if p_zone_id is not null then raise exception 'Elija la zona.'; end if;
    if char_length(btrim(p_zone)) > 60 then raise exception 'La zona puede tener como mucho 60 caracteres.'; end if;
    zname := btrim(p_zone);
  end if;
  return query select pl.province::text, pl.canton::text, pl.district::text, zname;
end $$;

-- La casa resultante (aprobada con la edición encima) con las reglas de submit_listing para los campos revisados, en su
-- orden; las habitaciones son las de ahora (pueden haber cambiado al momento) con el tipo resultante.
create or replace function public.listing_edit_check(l public.listings, e public.listing_edits) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  k public.listing_kind := coalesce(e.kind, l.kind);
  t text := btrim(coalesce(e.title, l.title, ''));
  d text := btrim(coalesce(e.description, l.description, ''));
begin
  if e.lat is not null then perform public.edit_place(e.lat, e.lng, e.zone, e.zone_id, e.zone_source); end if;
  if l.bedrooms is null or (l.bedrooms < 1 and k not in ('completo','apartamento')) then
    raise exception 'Indique las habitaciones; solo un alojamiento completo tipo estudio puede tener 0.';
  end if;
  if k = 'habitacion' and coalesce(e.bathroom_shared, l.bathroom_shared) is null then
    raise exception 'Indique si el baño es privado o compartido.';
  end if;
  -- E: 5–32
  if char_length(t) not between 5 and 60 then raise exception 'El nombre de la casa debe tener entre 5 y 60 caracteres.'; end if;
  if d <> '' and char_length(d) not between 80 and 2000 then raise exception 'La descripción debe tener entre 80 y 2000 caracteres.'; end if;
end $$;

-- ---------- 2. RPCs del propietario ----------
-- La edición de la casa: la que hay si está abierta o con cambios pedidos; si no hay, una vacía. En revisión, congelada.
create or replace function public.start_edit(p_listing uuid) returns public.listing_edits
language plpgsql security definer set search_path = '' as $$
declare
  e public.listing_edits;
begin
  perform public.own_published_listing(p_listing);
  select * into e from public.listing_edits where listing_id = p_listing for update;
  if found then
    if e.status = 'review' then raise exception 'Ya hay una edición en revisión. Espere la respuesta o descártela.'; end if;
    return e;
  end if;
  insert into public.listing_edits (listing_id) values (p_listing) returning * into e;
  return e;
end $$;

-- p_patch: los campos revisados (snake_case) con su valor nuevo; la ubicación va entera (lat, lng, zone, zone_source y,
-- si es de la lista, zone_id). Un valor igual al aprobado se guarda como null (sin cambio); solo comprobaciones ligeras
-- (la validación completa es al enviar). Si no queda ningún cambio ni foto nueva, la edición se borra y devuelve null.
create or replace function public.save_edit(p_listing uuid, p_patch jsonb) returns public.listing_edits
language plpgsql security definer set search_path = '' as $$
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
    -- E: 5–32
    if char_length(m.title) not between 5 and 60 then raise exception 'El nombre de la casa debe tener entre 5 y 60 caracteres.'; end if;
    if m.title = btrim(coalesce(l.title, '')) then m.title := null; end if;
  end if;
  if m.description is not null then
    m.description := btrim(m.description);
    if char_length(m.description) > 2000 then raise exception 'La descripción debe tener entre 80 y 2000 caracteres.'; end if;
    if m.description = btrim(coalesce(l.description, '')) then m.description := null; end if;
  end if;
  if m.kind = l.kind then m.kind := null; end if;
  if m.bathroom_shared = l.bathroom_shared then m.bathroom_shared := null; end if;
  if p_patch ?& loc then
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
end $$;

-- Una foto nueva de la edición (las variantes ya están en <casa>/<uuid>); aprobadas + nuevas, como mucho 15.
create or replace function public.add_edit_photo(p_listing uuid, p_path text)
returns table (id uuid, path text, "position" int) language plpgsql security definer set search_path = '' as $$
declare
  next_pos int;
begin
  perform public.start_edit(p_listing);
  if p_path !~ ('^' || p_listing::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    raise exception 'Ruta de foto no válida.';
  end if;
  if (select count(*) from public.listing_photos ph where ph.listing_id = p_listing)
     + (select count(*) from public.listing_edit_photos ep where ep.listing_id = p_listing) >= 15 then
    raise exception 'Máximo 15 fotos.';
  end if;
  select coalesce(max(ep.position) + 1, 0) into next_pos from public.listing_edit_photos ep where ep.listing_id = p_listing;
  return query insert into public.listing_edit_photos as ep (listing_id, path, position) values (p_listing, p_path, next_pos)
    returning ep.id, ep.path, ep.position;
end $$;

-- Quita una foto nueva, recompacta y devuelve su ruta (el navegador borra sus objetos). Sin nada más, la edición se borra.
create or replace function public.remove_edit_photo(p_photo uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  ph public.listing_edit_photos;
  e public.listing_edits;
begin
  select * into ph from public.listing_edit_photos where id = p_photo;
  if not found or not exists (select 1 from public.listings where id = ph.listing_id and owner_id = auth.uid()) then
    raise exception 'No encontramos esa foto.';
  end if;
  perform public.own_published_listing(ph.listing_id);
  select * into e from public.listing_edits where listing_id = ph.listing_id for update;
  if e.status = 'review' then raise exception 'Ya hay una edición en revisión. Espere la respuesta o descártela.'; end if;
  delete from public.listing_edit_photos where id = p_photo;
  update public.listing_edit_photos t set position = r.pos
    from (select x.id, (row_number() over (order by x.position, x.created_at) - 1)::int as pos
          from public.listing_edit_photos x where x.listing_id = ph.listing_id) r
    where t.id = r.id and t.position is distinct from r.pos;
  if public.listing_edit_empty(e) then delete from public.listing_edits where listing_id = ph.listing_id; end if;
  return ph.path;
end $$;

-- El orden completo de las fotos nuevas: p_ids tiene que ser exactamente su conjunto.
create or replace function public.reorder_edit_photos(p_listing uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.listing_edits;
begin
  perform public.own_published_listing(p_listing);
  select * into e from public.listing_edits where listing_id = p_listing for update;
  if not found then raise exception 'No encontramos esa edición.'; end if;
  if e.status = 'review' then raise exception 'Ya hay una edición en revisión. Espere la respuesta o descártela.'; end if;
  if coalesce(array_length(p_ids, 1), 0) <> (select count(*) from public.listing_edit_photos where listing_id = p_listing)
     or (select count(distinct x) from unnest(p_ids) x) <> coalesce(array_length(p_ids, 1), 0)
     or exists (select 1 from unnest(p_ids) x where not exists (select 1 from public.listing_edit_photos where id = x and listing_id = p_listing)) then
    raise exception 'La lista de fotos cambió. Vuelva a intentarlo.';
  end if;
  update public.listing_edit_photos t set position = (o.ord - 1)::int
    from unnest(p_ids) with ordinality as o(id, ord)
    where t.id = o.id and t.position is distinct from (o.ord - 1)::int;
end $$;

-- Enviar a revisión: la casa resultante tiene que pasar las reglas de submit_listing de los campos revisados.
create or replace function public.submit_edit(p_listing uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
  e public.listing_edits;
begin
  l := public.own_published_listing(p_listing);
  select * into e from public.listing_edits where listing_id = p_listing for update;
  if not found then raise exception 'No encontramos esa edición.'; end if;
  if e.status = 'review' then raise exception 'Ya hay una edición en revisión. Espere la respuesta o descártela.'; end if;
  if public.listing_edit_empty(e) then raise exception 'No hay cambios que enviar.'; end if;
  perform public.listing_edit_check(l, e);
  update public.listing_edits set status = 'review', submitted_at = now(), review_note = null where listing_id = p_listing;
  return 'review';
end $$;

-- Descartar en cualquier estado: borra la edición y sus fotos nuevas y devuelve sus rutas (el navegador borra los objetos).
create or replace function public.discard_edit(p_listing uuid) returns text[]
language plpgsql security definer set search_path = '' as $$
declare
  paths text[];
begin
  perform public.own_published_listing(p_listing);
  select coalesce(array_agg(ep.path order by ep.position), '{}') into paths
    from public.listing_edit_photos ep where ep.listing_id = p_listing;
  delete from public.listing_edits where listing_id = p_listing;
  return paths;
end $$;

-- ---------- Permisos ----------
revoke execute on function public.listing_edit_empty(public.listing_edits),
  public.edit_place(double precision, double precision, text, text, text),
  public.listing_edit_check(public.listings, public.listing_edits)
  from public, anon, authenticated;
revoke execute on function public.start_edit(uuid), public.save_edit(uuid, jsonb), public.add_edit_photo(uuid, text),
  public.remove_edit_photo(uuid), public.reorder_edit_photos(uuid, uuid[]), public.submit_edit(uuid), public.discard_edit(uuid)
  from public, anon;
grant execute on function public.start_edit(uuid), public.save_edit(uuid, jsonb), public.add_edit_photo(uuid, text),
  public.remove_edit_photo(uuid), public.reorder_edit_photos(uuid, uuid[]), public.submit_edit(uuid), public.discard_edit(uuid)
  to authenticated;
