-- bnbtico · revisión por dato de los cambios de una casa publicada · 2026-10-30
-- Revisión UX 2026-10-29, A5 (Ana): sin «Enviar a revisión» general. Cada dato con revisión (nombre, tipo, descripción,
-- ubicación) y cada foto nueva va a revisión en cuanto se guarda, con su propio estado, nota y fecha de envío; se pueden
-- cambiar otros datos (o el mismo otra vez) mientras hay cambios en revisión, y cuenta el último valor enviado. El admin
-- aprueba o pide cambios en cada dato y en cada foto por separado; lo aprobado se publica al momento. Sustituye «una sola
-- edición a la vez» y la revisión de la edición entera (20261029123728, 20261029124626).
-- 1) Estado por dato: tabla listing_edit_fields (listing_id, field) y estado, nota y envío en listing_edit_photos.
--    listing_edits guarda los valores y un resumen que mantiene listing_edit_sync: status 'review' si algo espera al admin
--    (si no, 'changes') y submitted_at, el envío más antiguo de lo que espera (orden de la cola del admin).
-- 2) Relleno de las ediciones que hubiera: los datos y fotos de una edición con cambios pedidos quedan con cambios pedidos
--    y su nota; los de una enviada o sin enviar, en revisión (ya no hay «sin enviar»).
-- 3) RPCs del propietario: save_edit y add_edit_photo envían a revisión; sin bloqueo por revisión; discard_edit_field
--    descarta un dato; submit_edit desaparece.
-- 4) RPCs del admin: review_edit_field y review_edit_photo, con el envío que el admin abrió (p_submitted_at) por dato o
--    por foto; review_edit desaparece.

-- ---------- 1. Estado por dato ----------
create table public.listing_edit_fields (
  listing_id uuid not null references public.listing_edits(listing_id) on delete cascade,
  field text not null check (field in ('title','kind','description','location')),
  status text not null default 'review' check (status in ('review','changes')),
  review_note text,
  submitted_at timestamptz not null default now(),
  primary key (listing_id, field)
);
alter table public.listing_edit_fields enable row level security;
create policy listing_edit_fields_select on public.listing_edit_fields for select using (
  exists (select 1 from public.listings l where l.id = listing_edit_fields.listing_id and (l.owner_id = auth.uid() or public.is_admin())));
revoke all on public.listing_edit_fields from public, anon, authenticated;
grant select on public.listing_edit_fields to authenticated;

alter table public.listing_edit_photos
  add column status text not null default 'review' check (status in ('review','changes')),
  add column review_note text,
  add column submitted_at timestamptz not null default now();

-- El resumen de la edición: 'review' si algo espera al admin y su envío más antiguo; sin nada, la edición se borra.
create or replace function public.listing_edit_sync(p_listing uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  e public.listing_edits;
  waiting int;
  first_at timestamptz;
begin
  select * into e from public.listing_edits where listing_id = p_listing;
  if not found then return; end if;
  if public.listing_edit_empty(e) then
    delete from public.listing_edits where listing_id = p_listing;
    return;
  end if;
  select count(*), min(x.submitted_at) into waiting, first_at from (
    select f.status, f.submitted_at from public.listing_edit_fields f where f.listing_id = p_listing
    union all
    select p.status, p.submitted_at from public.listing_edit_photos p where p.listing_id = p_listing
  ) x where x.status = 'review';
  update public.listing_edits set status = case when waiting > 0 then 'review' else 'changes' end, submitted_at = first_at, review_note = null
  where listing_id = p_listing;
end $$;

-- La edición con solo un dato (los demás a null): para comprobar ese dato con listing_edit_check.
create or replace function public.listing_edit_only(e public.listing_edits, p_field text) returns public.listing_edits
language plpgsql immutable set search_path = '' as $$
declare
  o public.listing_edits := e;
begin
  if p_field <> 'title' then o.title := null; end if;
  if p_field <> 'kind' then o.kind := null; o.bathroom_shared := null; end if;
  if p_field <> 'description' then o.description := null; end if;
  if p_field <> 'location' then o.lat := null; o.lng := null; o.zone := null; o.zone_id := null; o.zone_source := null; end if;
  return o;
end $$;

-- Si la edición cambia ese dato (respecto de lo aprobado).
create or replace function public.listing_edit_has(e public.listing_edits, p_field text) returns boolean
language sql immutable set search_path = '' as $$
  select case p_field
    when 'title' then e.title is not null
    when 'kind' then e.kind is not null or e.bathroom_shared is not null
    when 'description' then e.description is not null
    when 'location' then e.lat is not null
    else false end
$$;

-- La casa resultante con las reglas de submit_listing para los datos que cambia la edición (llega con un solo dato desde
-- listing_edit_only): la descripción, como el nombre (publicar v2), solo si cambia; una casa publicada con una descripción
-- anterior fuera de la regla la conserva hasta que su dueño la cambie, sin bloquear otros datos.
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
revoke execute on function public.listing_edit_check(public.listings, public.listing_edits) from public, anon, authenticated;

-- ---------- 2. Relleno ----------
insert into public.listing_edit_fields (listing_id, field, status, review_note, submitted_at)
select e.listing_id, f.field,
  case when e.status = 'changes' then 'changes' else 'review' end,
  case when e.status = 'changes' then e.review_note end,
  coalesce(e.submitted_at, now())
from public.listing_edits e
cross join lateral (values ('title'), ('kind'), ('description'), ('location')) f(field)
where public.listing_edit_has(e, f.field);

update public.listing_edit_photos ep set
  status = case when e.status = 'changes' then 'changes' else 'review' end,
  review_note = case when e.status = 'changes' then e.review_note end,
  submitted_at = coalesce(e.submitted_at, ep.created_at)
from public.listing_edits e where e.listing_id = ep.listing_id;

do $$
declare
  id uuid;
begin
  for id in select listing_id from public.listing_edits loop
    perform public.listing_edit_sync(id);
  end loop;
end $$;

-- ---------- 3. Propietario ----------
-- La edición de la casa (la que haya, en cualquier estado) o una vacía.
create or replace function public.start_edit(p_listing uuid) returns public.listing_edits
language plpgsql security definer set search_path = '' as $$
declare
  e public.listing_edits;
begin
  perform public.own_published_listing(p_listing);
  select * into e from public.listing_edits where listing_id = p_listing for update;
  if found then return e; end if;
  insert into public.listing_edits (listing_id, status) values (p_listing, 'review') returning * into e;
  return e;
end $$;

-- p_patch: los campos revisados (snake_case) con su valor nuevo; la ubicación va entera. Lo igual a lo aprobado no cuenta
-- (el dato sale de la revisión); cada dato que cambia se comprueba con las reglas de submit_listing y va a revisión con su
-- fecha de envío. Sin ningún cambio ni foto nueva, la edición se borra y devuelve null.
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

-- Una foto nueva va a revisión al registrarla (las variantes ya están en <casa>/<uuid>); aprobadas + nuevas, como mucho 15.
create or replace function public.add_edit_photo(p_listing uuid, p_path text)
returns table (id uuid, path text, "position" int) language plpgsql security definer set search_path = '' as $$
declare
  next_pos int;
  ph public.listing_edit_photos;
begin
  perform public.start_edit(p_listing);
  if p_path !~ ('^' || p_listing::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    raise exception 'Ruta de foto no válida.';
  end if;
  if exists (select 1 from public.listing_photos x where x.path = p_path)
     or exists (select 1 from public.listing_edit_photos x where x.path = p_path) then
    raise exception 'Ruta de foto no válida.';
  end if;
  if (select count(*) from public.listing_photos x where x.listing_id = p_listing)
     + (select count(*) from public.listing_edit_photos x where x.listing_id = p_listing) >= 15 then
    raise exception 'Máximo 15 fotos.';
  end if;
  select coalesce(max(x.position) + 1, 0) into next_pos from public.listing_edit_photos x where x.listing_id = p_listing;
  insert into public.listing_edit_photos (listing_id, path, position) values (p_listing, p_path, next_pos) returning * into ph;
  perform public.listing_edit_sync(p_listing);
  return query select ph.id, ph.path, ph.position;
end $$;

-- Quita una foto nueva (también la descarta: esté en revisión o con cambios pedidos), recompacta y devuelve su ruta.
create or replace function public.remove_edit_photo(p_photo uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  ph public.listing_edit_photos;
begin
  select * into ph from public.listing_edit_photos where id = p_photo;
  if not found or not exists (select 1 from public.listings where id = ph.listing_id and owner_id = auth.uid()) then
    raise exception 'No encontramos esa foto.';
  end if;
  perform public.own_published_listing(ph.listing_id);
  select * into ph from public.listing_edit_photos where id = p_photo;
  if not found then raise exception 'No encontramos esa foto.'; end if;
  perform 1 from public.listing_edits where listing_id = ph.listing_id for update;
  delete from public.listing_edit_photos where id = p_photo;
  update public.listing_edit_photos t set position = r.pos
    from (select x.id, (row_number() over (order by x.position, x.created_at) - 1)::int as pos
          from public.listing_edit_photos x where x.listing_id = ph.listing_id) r
    where t.id = r.id and t.position is distinct from r.pos;
  perform public.listing_edit_sync(ph.listing_id);
  return ph.path;
end $$;

-- El orden completo de las fotos nuevas: p_ids tiene que ser exactamente su conjunto.
create or replace function public.reorder_edit_photos(p_listing uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.own_published_listing(p_listing);
  perform 1 from public.listing_edits where listing_id = p_listing for update;
  if not found then raise exception 'No encontramos esa edición.'; end if;
  if coalesce(array_length(p_ids, 1), 0) <> (select count(*) from public.listing_edit_photos where listing_id = p_listing)
     or (select count(distinct x) from unnest(p_ids) x) <> coalesce(array_length(p_ids, 1), 0)
     or exists (select 1 from unnest(p_ids) x where not exists (select 1 from public.listing_edit_photos where id = x and listing_id = p_listing)) then
    raise exception 'La lista de fotos cambió. Vuelva a intentarlo.';
  end if;
  update public.listing_edit_photos t set position = (o.ord - 1)::int
    from unnest(p_ids) with ordinality as o(id, ord)
    where t.id = o.id and t.position is distinct from (o.ord - 1)::int;
end $$;

-- Descarta un dato (en revisión o con cambios pedidos): la ficha sigue con lo aprobado. Sin nada más, la edición se borra.
create or replace function public.discard_edit_field(p_listing uuid, p_field text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.own_published_listing(p_listing);
  if p_field is null or p_field not in ('title','kind','description','location') then raise exception 'Ese dato no se puede cambiar aquí.'; end if;
  perform 1 from public.listing_edits where listing_id = p_listing for update;
  if not found then return; end if;
  update public.listing_edits set
    title = case when p_field = 'title' then null else title end,
    kind = case when p_field = 'kind' then null else kind end,
    bathroom_shared = case when p_field = 'kind' then null else bathroom_shared end,
    description = case when p_field = 'description' then null else description end,
    lat = case when p_field = 'location' then null else lat end,
    lng = case when p_field = 'location' then null else lng end,
    zone = case when p_field = 'location' then null else zone end,
    zone_id = case when p_field = 'location' then null else zone_id end,
    zone_source = case when p_field = 'location' then null else zone_source end
  where listing_id = p_listing;
  delete from public.listing_edit_fields where listing_id = p_listing and field = p_field;
  perform public.listing_edit_sync(p_listing);
end $$;

-- Subir fotos a una casa publicada: siempre (cada foto nueva va a revisión por su cuenta).
create or replace function public.listing_photo_uploadable(p_listing uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select public.listing_editable(p_listing) or exists (
    select 1 from public.listings l
    where l.id = p_listing and l.owner_id = auth.uid() and public.listing_status_published(l.status, l.first_published_at))
$$;

drop function public.submit_edit(uuid);

-- ---------- 4. Admin ----------
create or replace function public.edit_admin_guard() returns void language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    if coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
      raise exception 'Confirme el segundo código para revisar anuncios.';
    end if;
    raise exception 'Solo bnbtico puede revisar anuncios.';
  end if;
end $$;

-- Un dato: 'approve' lo vuelve a validar (la casa pudo cambiar al momento mientras esperaba), lo copia a listings (con la
-- ubicación, provincia, cantón y distrito del punto) y lo quita de la edición; 'changes' lo deja con la nota. Lo demás de la
-- edición no cambia. p_submitted_at es el envío de ese dato que el admin abrió.
create or replace function public.review_edit_field(p_listing uuid, p_field text, p_decision text, p_note text, p_submitted_at timestamptz) returns text
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
  e public.listing_edits;
  fd public.listing_edit_fields;
  note text := left(btrim(coalesce(p_note, '')), 2000);
  k public.listing_kind;
  pl record;
begin
  perform public.edit_admin_guard();
  select * into l from public.listings where id = p_listing for update;
  select * into e from public.listing_edits where listing_id = p_listing for update;
  select * into fd from public.listing_edit_fields where listing_id = p_listing and field = p_field for update;
  if not found then
    if p_submitted_at is not null then raise exception 'La edición cambió. Vuelva a abrirla.'; end if;
    raise exception 'No encontramos esa edición.';
  end if;
  if fd.submitted_at is distinct from p_submitted_at then raise exception 'La edición cambió. Vuelva a abrirla.'; end if;
  if fd.status <> 'review' then raise exception 'Esta edición ya tiene una decisión.'; end if;
  if p_decision is null or p_decision not in ('approve','changes') then raise exception 'Decisión no válida.'; end if;

  if p_decision = 'changes' then
    if note = '' then raise exception 'Escriba una nota para pedir cambios.'; end if;
    update public.listing_edit_fields set status = 'changes', review_note = note where listing_id = p_listing and field = p_field;
    insert into public.admin_actions (admin_id, action, target_listing_id, reason) values (auth.uid(), 'edit.changes', p_listing, p_field || ': ' || note);
    perform public.listing_edit_sync(p_listing);
    return 'changes';
  end if;

  perform public.listing_edit_check(l, public.listing_edit_only(e, p_field));
  perform set_config('app.allow_status', 'on', true);
  if p_field = 'title' then
    update public.listings set title = e.title where id = p_listing;
  elsif p_field = 'kind' then
    k := coalesce(e.kind, l.kind);
    update public.listings set kind = k,
      bathroom_shared = case when k = 'habitacion' then coalesce(e.bathroom_shared, l.bathroom_shared) end
    where id = p_listing;
  elsif p_field = 'description' then
    update public.listings set description = e.description where id = p_listing;
  else
    select * into pl from public.edit_place(e.lat, e.lng, e.zone, e.zone_id, e.zone_source);
    update public.listings set lat = e.lat, lng = e.lng, zone = pl.zone, zone_id = e.zone_id, zone_source = e.zone_source,
      province = pl.province, canton = pl.canton, district = pl.district
    where id = p_listing;
  end if;
  perform set_config('app.allow_status', 'off', true);
  update public.listing_edits set
    title = case when p_field = 'title' then null else title end,
    kind = case when p_field = 'kind' then null else kind end,
    bathroom_shared = case when p_field = 'kind' then null else bathroom_shared end,
    description = case when p_field = 'description' then null else description end,
    lat = case when p_field = 'location' then null else lat end,
    lng = case when p_field = 'location' then null else lng end,
    zone = case when p_field = 'location' then null else zone end,
    zone_id = case when p_field = 'location' then null else zone_id end,
    zone_source = case when p_field = 'location' then null else zone_source end
  where listing_id = p_listing;
  delete from public.listing_edit_fields where listing_id = p_listing and field = p_field;
  insert into public.admin_actions (admin_id, action, target_listing_id, reason) values (auth.uid(), 'edit.approve', p_listing, p_field);
  perform public.listing_edit_sync(p_listing);
  return 'approved';
end $$;

-- Una foto nueva: 'approve' la añade tras la última aprobada; 'changes' la deja con la nota.
create or replace function public.review_edit_photo(p_photo uuid, p_decision text, p_note text, p_submitted_at timestamptz) returns text
language plpgsql security definer set search_path = '' as $$
declare
  ph public.listing_edit_photos;
  note text := left(btrim(coalesce(p_note, '')), 2000);
begin
  perform public.edit_admin_guard();
  select * into ph from public.listing_edit_photos where id = p_photo;
  if not found then
    if p_submitted_at is not null then raise exception 'La edición cambió. Vuelva a abrirla.'; end if;
    raise exception 'No encontramos esa foto.';
  end if;
  perform 1 from public.listings where id = ph.listing_id for update;
  perform 1 from public.listing_edits where listing_id = ph.listing_id for update;
  select * into ph from public.listing_edit_photos where id = p_photo for update;
  if not found or ph.submitted_at is distinct from p_submitted_at then raise exception 'La edición cambió. Vuelva a abrirla.'; end if;
  if ph.status <> 'review' then raise exception 'Esta edición ya tiene una decisión.'; end if;
  if p_decision is null or p_decision not in ('approve','changes') then raise exception 'Decisión no válida.'; end if;

  if p_decision = 'changes' then
    if note = '' then raise exception 'Escriba una nota para pedir cambios.'; end if;
    update public.listing_edit_photos set status = 'changes', review_note = note where id = p_photo;
    insert into public.admin_actions (admin_id, action, target_listing_id, reason) values (auth.uid(), 'edit.changes', ph.listing_id, 'foto: ' || note);
    perform public.listing_edit_sync(ph.listing_id);
    return 'changes';
  end if;

  if (select count(*) from public.listing_photos x where x.listing_id = ph.listing_id) >= 15 then raise exception 'Máximo 15 fotos.'; end if;
  insert into public.listing_photos (listing_id, path, position)
    values (ph.listing_id, ph.path, (select coalesce(max(x.position), -1) + 1 from public.listing_photos x where x.listing_id = ph.listing_id));
  delete from public.listing_edit_photos where id = p_photo;
  update public.listing_edit_photos t set position = r.pos
    from (select x.id, (row_number() over (order by x.position, x.created_at) - 1)::int as pos
          from public.listing_edit_photos x where x.listing_id = ph.listing_id) r
    where t.id = r.id and t.position is distinct from r.pos;
  insert into public.admin_actions (admin_id, action, target_listing_id, reason) values (auth.uid(), 'edit.approve', ph.listing_id, 'foto');
  perform public.listing_edit_sync(ph.listing_id);
  return 'approved';
end $$;

drop function public.review_edit(uuid, text, text, timestamptz);

-- ---------- Permisos ----------
revoke execute on function public.listing_edit_sync(uuid), public.listing_edit_only(public.listing_edits, text),
  public.listing_edit_has(public.listing_edits, text), public.edit_admin_guard()
  from public, anon, authenticated;
revoke execute on function public.discard_edit_field(uuid, text), public.review_edit_field(uuid, text, text, text, timestamptz),
  public.review_edit_photo(uuid, text, text, timestamptz)
  from public, anon;
grant execute on function public.discard_edit_field(uuid, text), public.review_edit_field(uuid, text, text, text, timestamptz),
  public.review_edit_photo(uuid, text, text, timestamptz)
  to authenticated;
