-- El admin edita las casas (ronda de Ana del 2026-11-02, ticket 10, versión simplificada de Daniel del 2026-11-03).
-- La única admin es Ana: edita cualquier dato de cualquier casa salvo las eliminadas (borradores incluidos), al momento y
-- sin revisión, con las mismas reglas de datos que el anfitrión; también fotos, calendario y enviar a revisión el borrador
-- de otro. Cada guardado deja una fila en admin_actions ('listing.edit'; enviar, 'listing.submit'), sin antes/después. Si
-- edita un dato que el anfitrión tenía pendiente de revisión, manda lo suyo y el pendiente de ese dato se descarta.
-- La revisión dato a dato (save_edit, add_edit_photo, discard_edit_field, review_edit_field, review_edit_photo), la
-- retención (admin_pause/resume/block/unblock/delete_listing), listings_protect e is_admin() no cambian.
--
-- 1) Núcleos sin guarda de dueño, extraídos de las RPCs del anfitrión (que pasan a llamarlos tras su guarda; mismo
--    comportamiento y mismos mensajes). Cada uno parte de la versión vigente:
--    - listing_live_update: update_listing_live de 20261103212949_editar_como_crear.
--    - listing_days_update: save_listing_days de 20261030233129_admin_casas_acciones.
--    - listing_photo_insert / listing_photo_delete / listing_photos_order: add_listing_photo de
--      20261023073359_cliente_directo_fotos, remove_listing_photo y reorder_listing_photos de 20261029122021_editar_casa_publicada
--      (con assert_listing_open en sus guardas desde 20261030233129). El tope de 15 cuenta también las fotos nuevas de una
--      edición: un borrador no tiene edición, así que para el anfitrión no cambia nada.
--    - listing_submit: submit_listing de 20261103212949_editar_como_crear. Los núcleos reciben la fila (salvo listing_submit,
--      que recibe el id: con una fila de listings como único argumento, PostgREST la tomaría por una columna calculada).
-- 2) RPCs del admin, todas con admin_house_for_action (is_admin() con aal2, casa no eliminada, bloqueada para la
--    transacción): admin_update_listing, admin_submit_listing, admin_add_listing_photo, admin_remove_listing_photo,
--    admin_reorder_listing_photos y admin_save_listing_days. Pasan listings_protect con app.allow_status (local a la
--    transacción), como las demás RPCs. La purga de la ficha la hacen los triggers de listings y listing_photos (y
--    listing_days_update, como save_listing_days).
-- 3) Storage: políticas aparte para el admin (subir a la carpeta de una casa no eliminada y borrar objetos sin foto que los
--    enlace); las del anfitrión no cambian.

-- ---------- 1. Núcleos ----------

-- Datos al momento de una casa publicada (capacidad, características, precios), con las reglas de crear: solo las claves
-- del parche; un dato con valor válido en la fila no se deja vacío ni inválido. `l` es la fila actual, ya bloqueada.
create or replace function public.listing_live_update(l public.listings, p_patch jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  m public.listings;
  not_here constant text := 'Ese dato no se puede cambiar aquí.';
begin
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
  -- Una Habitación no pide baños: es 1 (como el trigger listings_habitacion_una).
  if l.kind = 'habitacion' then m.bathrooms := 1; end if;

  if p_patch ? 'capacity' and coalesce(m.capacity, 0) < 1 then
    if coalesce(l.capacity, 0) >= 1 then raise exception 'Indique cuántas personas pueden alojarse (mínimo 1).'; end if;
    m.capacity := null;
  end if;
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
      -- El tipo de parqueo ya dicho no se vacía; con parqueo nuevo, sin decir si se paga, se guarda (la app avisa).
      if m.parking_paid is null and 'parking' = any(l.features) and l.parking_paid is not null then
        raise exception 'Indique si el parqueo es gratuito o de pago.';
      end if;
    elsif m.parking_paid is not null then
      raise exception 'El tipo de parqueo solo aplica si el anuncio tiene parqueo.';
    end if;
  end if;
  if p_patch ? 'nightly_price_crc' and coalesce(m.nightly_price_crc, 0) <= 0 then raise exception 'Indique el precio por noche en colones.'; end if;
  -- El precio al mes vacío vale siempre («a negociar»).
  if p_patch ?| array['accepts_monthly','monthly_price_crc'] and m.accepts_monthly and m.monthly_price_crc is not null and m.monthly_price_crc <= 0 then
    if l.accepts_monthly and coalesce(l.monthly_price_crc, 0) > 0 then raise exception 'Indique el precio al mes en colones o déjelo vacío.'; end if;
    m.monthly_price_crc := null;
  end if;

  perform set_config('app.allow_status', 'on', true);
  update public.listings set capacity = m.capacity, bedrooms = m.bedrooms, bathrooms = m.bathrooms, features = m.features,
    parking_paid = m.parking_paid, nightly_price_crc = m.nightly_price_crc, accepts_monthly = m.accepts_monthly,
    monthly_price_crc = m.monthly_price_crc
  where id = l.id;
end $$;

create or replace function public.update_listing_live(p_listing uuid, p_patch jsonb) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.listing_live_update(public.own_published_listing(p_listing), p_patch);
end $$;

-- Disponibilidad y precio de unos días (las reglas de save_listing_days, en su orden y con sus mensajes). `l` es la casa.
create or replace function public.listing_days_update(l public.listings, p_days date[], p_available boolean, p_price_crc int) returns void
language plpgsql security definer set search_path = '' as $$
declare
  today date := (now() at time zone 'America/Costa_Rica')::date;
  days date[];
  base int;
begin
  if l.status = 'rejected' then raise exception 'Este anuncio fue rechazado; publique uno nuevo.'; end if;
  if not l.available then raise exception 'La casa está cerrada a consultas. Ábrala para cambiar el calendario.'; end if;

  select array_agg(distinct d) into days from unnest(p_days) d;
  if days is null or cardinality(days) > 366 or exists (select 1 from unnest(days) d where d is null or d < today or d > today + 365) then
    raise exception 'Elija días entre hoy y dentro de un año.';
  end if;
  if p_available is null and p_price_crc is null then raise exception 'No hay cambios que guardar.'; end if;

  base := case when l.accepts_nightly then l.nightly_price_crc end;
  if p_price_crc is not null then
    if p_price_crc < 1 or p_price_crc > 100000000 then
      raise exception 'Escriba un precio por noche en colones, mayor que cero y sin decimales.';
    end if;
    if base is null then raise exception 'Ponga primero el precio por noche de la casa para cambiar el de un día.'; end if;
  end if;

  -- Ocupar o liberar conserva el precio; el precio base quita la ★. Solo quedan las filas que difieren del habitual.
  insert into public.listing_days as ld (listing_id, day, available, special_price_crc)
  select l.id, d, coalesce(p_available, true), case when p_price_crc = base then null else p_price_crc end
    from unnest(days) d
  on conflict (listing_id, day) do update
    set available = coalesce(p_available, ld.available),
        special_price_crc = case when p_price_crc is null then ld.special_price_crc when p_price_crc = base then null else p_price_crc end;
  delete from public.listing_days where listing_id = l.id and day = any(days) and available and special_price_crc is null;

  if l.status = 'active' then perform public.purge_listing_page(l.public_id); end if;
end $$;

create or replace function public.save_listing_days(p_listing uuid, p_days date[], p_available boolean default null, p_price_crc int default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
begin
  perform public.assert_listing_open(p_listing);
  select * into l from public.listings where id = p_listing and owner_id = auth.uid();
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  perform public.listing_days_update(l, p_days, p_available, p_price_crc);
end $$;

-- Registra la carpeta <casa>/<uuid> como foto al final. Como mucho 15, contando las fotos nuevas de una edición.
create or replace function public.listing_photo_insert(p_listing uuid, p_path text)
returns table (id uuid, path text, "position" int) language plpgsql security definer set search_path = '' as $$
declare
  next_pos int;
begin
  if p_path is null or p_path !~ ('^' || p_listing::text || '/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') then
    raise exception 'Ruta de foto no válida.';
  end if;
  perform 1 from public.listings l where l.id = p_listing for update;
  if (select count(*) from public.listing_photos ph where ph.listing_id = p_listing)
     + (select count(*) from public.listing_edit_photos ep where ep.listing_id = p_listing) >= 15 then
    raise exception 'Máximo 15 fotos.';
  end if;
  select coalesce(max(ph.position) + 1, 0) into next_pos from public.listing_photos ph where ph.listing_id = p_listing;
  return query insert into public.listing_photos as ph (listing_id, path, position) values (p_listing, p_path, next_pos)
    returning ph.id, ph.path, ph.position;
end $$;

-- Quita una foto (una casa publicada conserva al menos una), recompacta y devuelve su ruta.
create or replace function public.listing_photo_delete(ph public.listing_photos, p_published boolean) returns text
language plpgsql security definer set search_path = '' as $$
begin
  perform 1 from public.listings where id = ph.listing_id for update;
  if p_published and (select count(*) from public.listing_photos x where x.listing_id = ph.listing_id) <= 1 then
    raise exception 'Su ficha necesita al menos una foto. Añada otra y, cuando la aprobemos, podrá quitar esta.';
  end if;
  delete from public.listing_photos where id = ph.id;
  update public.listing_photos t set position = r.pos
    from (select x.id, (row_number() over (order by x.position, x.created_at) - 1)::int as pos from public.listing_photos x where x.listing_id = ph.listing_id) r
    where t.id = r.id and t.position is distinct from r.pos;
  return ph.path;
end $$;

-- El orden completo de una vez: p_ids tiene que ser exactamente el conjunto de fotos de la casa.
create or replace function public.listing_photos_order(p_listing uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
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

create or replace function public.add_listing_photo(p_listing uuid, p_path text)
returns table (id uuid, path text, "position" int) language plpgsql security definer set search_path = '' as $$
begin
  perform public.listing_photos_guard(p_listing);
  return query select * from public.listing_photo_insert(p_listing, p_path);
end $$;

create or replace function public.remove_listing_photo(p_photo uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  ph public.listing_photos;
  published boolean;
begin
  select * into ph from public.listing_photos where id = p_photo;
  if not found or not exists (select 1 from public.listings where id = ph.listing_id and owner_id = auth.uid()) then
    raise exception 'No encontramos esa foto.';
  end if;
  published := public.listing_photos_owner_guard(ph.listing_id);
  return public.listing_photo_delete(ph, published);
end $$;

create or replace function public.reorder_listing_photos(p_listing uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.listing_photos_owner_guard(p_listing);
  perform public.listing_photos_order(p_listing, p_ids);
end $$;

-- Las comprobaciones de submit_listing sobre la casa y el paso a revisión. Recibe el id (no la fila): una función con una
-- fila de listings como único argumento sería una columna calculada de PostgREST.
CREATE OR REPLACE FUNCTION public.listing_submit(p_listing uuid)
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
  select * into l from listings where id = p_listing;
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
  -- La descripción es opcional y solo tiene tope duro (2000): vacía o corta no bloquea, la app avisa.
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

CREATE OR REPLACE FUNCTION public.submit_listing(p_listing uuid)
 RETURNS listing_status
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  l listings;
begin
  perform public.assert_listing_open(p_listing);
  select * into l from listings where id = p_listing and owner_id = auth.uid();
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  return public.listing_submit(p_listing);
end $function$;

-- ---------- 2. RPCs del admin ----------

-- Una línea por guardado en el registro del admin (sin antes/después: decisión de Daniel, 2026-11-03).
create or replace function public.admin_log_edit(p_listing uuid, p_action text default 'listing.edit') returns void
language sql security definer set search_path = '' as $$
  insert into public.admin_actions (admin_id, action, target_listing_id) values (auth.uid(), p_action, p_listing)
$$;

-- p_patch: columnas de listings (snake_case) con su valor nuevo, en cualquier estado salvo eliminada.
-- - Sin publicar (borrador, en revisión, con cambios pedidos, rechazada): las columnas que guarda el asistente. Las reglas
--   de cada pantalla las aplica la app (planStep), como cuando guarda el anfitrión, y submit_listing lo comprueba todo.
-- - Publicada: los datos al momento con las reglas de update_listing_live (listing_live_update) y los de revisión (nombre,
--   tipo y baño, descripción, ubicación entera) también al momento, cada uno con las reglas de save_edit y
--   listing_edit_check (las de crear); el pendiente del anfitrión de esos datos se descarta (manda lo del admin).
create or replace function public.admin_update_listing(p_listing uuid, p_patch jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings := public.admin_house_for_action(p_listing);
  m public.listings;
  e public.listing_edits;
  pl record;
  k public.listing_kind;
  f text;
  touched text[] := '{}';
  not_here constant text := 'Ese dato no se puede cambiar aquí.';
  live_keys constant text[] := array['capacity','bedrooms','bathrooms','features','parking_paid','nightly_price_crc','accepts_monthly','monthly_price_crc'];
  edit_keys constant text[] := array['title','kind','bathroom_shared','description','lat','lng','zone','zone_id','zone_source'];
  draft_keys constant text[] := live_keys || edit_keys || array['province','canton','district','min_nights','monthly_mode','min_months'];
  loc constant text[] := array['lat','lng','zone','zone_source'];
begin
  if p_patch is null or jsonb_typeof(p_patch) <> 'object' then raise exception '%', not_here; end if;

  if not public.listing_status_published(l.status, l.first_published_at) then
    if exists (select 1 from jsonb_object_keys(p_patch) x where x <> all (draft_keys))
       or (p_patch ? 'features' and jsonb_typeof(p_patch -> 'features') <> 'array') then
      raise exception '%', not_here;
    end if;
    begin
      m := jsonb_populate_record(l, p_patch);
    exception when data_exception then
      raise exception '%', not_here;
    end;
    perform set_config('app.allow_status', 'on', true);
    update public.listings set kind = m.kind, accepts_monthly = coalesce(m.accepts_monthly, false), province = m.province, canton = m.canton,
      district = m.district, zone = m.zone, zone_id = m.zone_id, zone_source = m.zone_source, lat = m.lat, lng = m.lng,
      capacity = m.capacity, bedrooms = m.bedrooms, bathrooms = m.bathrooms, bathroom_shared = m.bathroom_shared,
      title = m.title, description = m.description, features = m.features, parking_paid = m.parking_paid,
      nightly_price_crc = m.nightly_price_crc, min_nights = m.min_nights, monthly_mode = m.monthly_mode,
      monthly_price_crc = m.monthly_price_crc, min_months = m.min_months
    where id = p_listing;
    perform public.admin_log_edit(p_listing);
    return;
  end if;

  if exists (select 1 from jsonb_object_keys(p_patch) x where x <> all (live_keys || edit_keys))
     or (p_patch ?| (loc || array['zone_id']) and not p_patch ?& loc) then
    raise exception '%', not_here;
  end if;
  if p_patch ?| live_keys then
    perform public.listing_live_update(l, (select jsonb_object_agg(x.key, x.value) from jsonb_each(p_patch) x where x.key = any (live_keys)));
  end if;

  if p_patch ? 'title' then touched := array_append(touched, 'title'); end if;
  if p_patch ?| array['kind','bathroom_shared'] then touched := array_append(touched, 'kind'); end if;
  if p_patch ? 'description' then touched := array_append(touched, 'description'); end if;
  if p_patch ?& loc then touched := array_append(touched, 'location'); end if;
  if cardinality(touched) > 0 then
    begin
      e := jsonb_populate_record(null::public.listing_edits, p_patch - live_keys);
    exception when data_exception then
      raise exception '%', not_here;
    end;
    -- Como save_edit: el nombre y la descripción sin los espacios de los extremos (vacío no es «sin cambio»).
    if 'title' = any (touched) then e.title := btrim(coalesce(e.title, '')); end if;
    if 'description' = any (touched) then e.description := btrim(coalesce(e.description, '')); end if;
    if 'kind' = any (touched) then e.kind := coalesce(e.kind, l.kind); end if;
    if 'location' = any (touched) then
      -- La ubicación va entera: sin zone_id en el parche, la zona no es de la lista.
      e.zone_id := p_patch ->> 'zone_id';
      if e.lat is null or e.lng is null or btrim(coalesce(e.zone, '')) = '' or e.zone_source is null
         or e.zone_source not in ('list','district','other')
         or (e.zone_id is not null and not exists (select 1 from public.zones z where z.id = e.zone_id)) then
        raise exception '%', not_here;
      end if;
      e.zone := btrim(e.zone);
      if char_length(e.zone) > 60 then raise exception 'La zona puede tener como mucho 60 caracteres.'; end if;
    end if;
    -- Las reglas de crear, dato a dato (las mismas que save_edit y review_edit_field).
    foreach f in array touched loop
      perform public.listing_edit_check(l, public.listing_edit_only(e, f));
    end loop;

    perform set_config('app.allow_status', 'on', true);
    foreach f in array touched loop
      if f = 'title' then
        update public.listings set title = e.title where id = p_listing;
      elsif f = 'kind' then
        k := e.kind;
        update public.listings set kind = k,
          bathroom_shared = case when k = 'habitacion' then coalesce(e.bathroom_shared, l.bathroom_shared) end
        where id = p_listing;
      elsif f = 'description' then
        update public.listings set description = e.description where id = p_listing;
      else
        select * into pl from public.edit_place(e.lat, e.lng, e.zone, e.zone_id, e.zone_source);
        update public.listings set lat = e.lat, lng = e.lng, zone = pl.zone, zone_id = e.zone_id, zone_source = e.zone_source,
          province = pl.province, canton = pl.canton, district = pl.district
        where id = p_listing;
      end if;
    end loop;

    -- El pendiente del anfitrión de esos datos se descarta, sin aviso; sus otros datos y fotos nuevas siguen en revisión.
    perform 1 from public.listing_edits where listing_id = p_listing for update;
    if found then
      update public.listing_edits set
        title = case when 'title' = any (touched) then null else title end,
        kind = case when 'kind' = any (touched) then null else kind end,
        bathroom_shared = case when 'kind' = any (touched) then null else bathroom_shared end,
        description = case when 'description' = any (touched) then null else description end,
        lat = case when 'location' = any (touched) then null else lat end,
        lng = case when 'location' = any (touched) then null else lng end,
        zone = case when 'location' = any (touched) then null else zone end,
        zone_id = case when 'location' = any (touched) then null else zone_id end,
        zone_source = case when 'location' = any (touched) then null else zone_source end
      where listing_id = p_listing;
      delete from public.listing_edit_fields where listing_id = p_listing and field = any (touched);
      perform public.listing_edit_sync(p_listing);
    end if;
  end if;
  perform public.admin_log_edit(p_listing);
end $$;

-- Enviar a revisión el borrador de otro (decisión D1 de la versión simple): las mismas comprobaciones que submit_listing.
create or replace function public.admin_submit_listing(p_listing uuid) returns public.listing_status
language plpgsql security definer set search_path = '' as $$
declare
  st public.listing_status;
begin
  perform public.admin_house_for_action(p_listing);
  st := public.listing_submit(p_listing);
  perform public.admin_log_edit(p_listing, 'listing.submit');
  return st;
end $$;

-- Fotos: van directo a la ficha (sin revisión), en cualquier estado salvo eliminada.
create or replace function public.admin_add_listing_photo(p_listing uuid, p_path text)
returns table (id uuid, path text, "position" int) language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_house_for_action(p_listing);
  return query select * from public.listing_photo_insert(p_listing, p_path);
  perform public.admin_log_edit(p_listing);
end $$;

create or replace function public.admin_remove_listing_photo(p_photo uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  ph public.listing_photos;
  l public.listings;
  path text;
begin
  perform public.edit_admin_guard();
  select * into ph from public.listing_photos where id = p_photo;
  if not found then raise exception 'No encontramos esa foto.'; end if;
  l := public.admin_house_for_action(ph.listing_id);
  path := public.listing_photo_delete(ph, public.listing_status_published(l.status, l.first_published_at));
  perform public.admin_log_edit(l.id);
  return path;
end $$;

create or replace function public.admin_reorder_listing_photos(p_listing uuid, p_ids uuid[]) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.admin_house_for_action(p_listing);
  perform public.listing_photos_order(p_listing, p_ids);
  perform public.admin_log_edit(p_listing);
end $$;

-- Calendario de una casa ajena: las reglas de save_listing_days.
create or replace function public.admin_save_listing_days(p_listing uuid, p_days date[], p_available boolean default null, p_price_crc int default null)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform public.listing_days_update(public.admin_house_for_action(p_listing), p_days, p_available, p_price_crc);
  perform public.admin_log_edit(p_listing);
end $$;

-- ---------- 3. Storage del admin ----------
create policy listings_photos_admin_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'listings'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/(480|800|1600)\.jpg$'
  and public.is_admin()
  and exists (select 1 from public.listings l where l.id::text = (storage.foldername(name))[1] and l.deleted_at is null)
  and public.listing_folder_objects((storage.foldername(name))[1]) < 45);

create policy listings_photos_admin_delete on storage.objects for delete to authenticated using (
  bucket_id = 'listings'
  and public.is_admin()
  and public.photo_unreferenced(name));

-- ---------- Permisos ----------
revoke all on function public.listing_live_update(public.listings, jsonb), public.listing_days_update(public.listings, date[], boolean, int),
  public.listing_photo_insert(uuid, text), public.listing_photo_delete(public.listing_photos, boolean), public.listing_photos_order(uuid, uuid[]),
  public.listing_submit(uuid), public.admin_log_edit(uuid, text)
  from public, anon, authenticated;
revoke all on function public.admin_update_listing(uuid, jsonb), public.admin_submit_listing(uuid), public.admin_add_listing_photo(uuid, text),
  public.admin_remove_listing_photo(uuid), public.admin_reorder_listing_photos(uuid, uuid[]),
  public.admin_save_listing_days(uuid, date[], boolean, int)
  from public, anon;
grant execute on function public.admin_update_listing(uuid, jsonb), public.admin_submit_listing(uuid), public.admin_add_listing_photo(uuid, text),
  public.admin_remove_listing_photo(uuid), public.admin_reorder_listing_photos(uuid, uuid[]),
  public.admin_save_listing_days(uuid, date[], boolean, int)
  to authenticated, service_role;
