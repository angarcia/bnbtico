-- bnbtico · editar una casa publicada sin sacarla de Explorar, parte tres · 2026-10-29
-- Spec .scratch/editar-casa/spec.md (review_edit). El admin (con segundo factor, is_admin()) decide una edición enviada:
-- - 'approve': vuelve a validar la casa resultante (pudo cambiar al momento mientras esperaba), recalcula provincia,
--   cantón y distrito si cambió el punto, copia a listings cada campo cambiado y añade las fotos nuevas tras la última
--   aprobada, en su orden; borra la edición. Estado, suscripción y first_published_at no cambian. La ficha se purga con
--   los triggers de listings y listing_photos (listings_purge_page, listing_photos_purge_page).
-- - 'changes': la edición queda con cambios pedidos y la nota; el propietario corrige y reenvía. No hay «Rechazar».
-- p_submitted_at es el envío que el admin abrió (submitted_at de la edición): si el propietario la descartó o la reenvió
-- mientras tanto, no se decide sobre lo que el admin no vio.

create or replace function public.review_edit(p_listing uuid, p_decision text, p_note text, p_submitted_at timestamptz) returns text
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
  e public.listing_edits;
  note text := left(btrim(coalesce(p_note, '')), 2000);
  k public.listing_kind;
  prov text;
  cant text;
  dist text;
  zname text;
begin
  if not public.is_admin() then
    if coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
      raise exception 'Confirme el segundo código para revisar anuncios.';
    end if;
    raise exception 'Solo bnbtico puede revisar anuncios.';
  end if;
  -- La casa antes que la edición, en el mismo orden que las RPCs del propietario (own_published_listing).
  select * into l from public.listings where id = p_listing for update;
  select * into e from public.listing_edits where listing_id = p_listing for update;
  if not found then
    if p_submitted_at is not null then raise exception 'La edición cambió. Vuelva a abrirla.'; end if;
    raise exception 'No encontramos esa edición.';
  end if;
  if e.submitted_at is distinct from p_submitted_at then raise exception 'La edición cambió. Vuelva a abrirla.'; end if;
  if e.status <> 'review' then raise exception 'Esta edición ya tiene una decisión.'; end if;
  if p_decision is null or p_decision not in ('approve','changes') then raise exception 'Decisión no válida.'; end if;

  if p_decision = 'changes' then
    if note = '' then raise exception 'Escriba un motivo de hasta 2000 caracteres para pedir cambios o rechazar.'; end if;
    update public.listing_edits set status = 'changes', review_note = note, reviewed_at = now(), reviewed_by = auth.uid()
    where listing_id = p_listing;
    insert into public.admin_actions (admin_id, action, target_listing_id, reason) values (auth.uid(), 'edit.changes', p_listing, note);
    return 'changes';
  end if;

  perform public.listing_edit_check(l, e);
  prov := l.province; cant := l.canton; dist := l.district; zname := l.zone;
  if e.lat is not null then
    select p.province, p.canton, p.district, p.zone into prov, cant, dist, zname
      from public.edit_place(e.lat, e.lng, e.zone, e.zone_id, e.zone_source) p;
  end if;
  if (select count(*) from public.listing_photos ph where ph.listing_id = p_listing)
     + (select count(*) from public.listing_edit_photos ep where ep.listing_id = p_listing) > 15 then
    raise exception 'Máximo 15 fotos.';
  end if;
  k := coalesce(e.kind, l.kind);

  perform set_config('app.allow_status', 'on', true);
  update public.listings set
    title = coalesce(e.title, l.title),
    kind = k,
    bathroom_shared = case when k = 'habitacion' then coalesce(e.bathroom_shared, l.bathroom_shared) end,
    description = coalesce(e.description, l.description),
    lat = coalesce(e.lat, l.lat), lng = coalesce(e.lng, l.lng),
    zone = zname,
    zone_id = case when e.lat is not null then e.zone_id else l.zone_id end,
    zone_source = coalesce(e.zone_source, l.zone_source),
    province = prov, canton = cant, district = dist
  where id = p_listing;
  insert into public.listing_photos (listing_id, path, position)
    select p_listing, ep.path,
      ((select coalesce(max(ph.position), -1) from public.listing_photos ph where ph.listing_id = p_listing)
        + row_number() over (order by ep.position, ep.created_at))::int
    from public.listing_edit_photos ep where ep.listing_id = p_listing;
  delete from public.listing_edits where listing_id = p_listing;
  insert into public.admin_actions (admin_id, action, target_listing_id) values (auth.uid(), 'edit.approve', p_listing);
  return 'approved';
end $$;

revoke execute on function public.review_edit(uuid, text, text, timestamptz) from public, anon;
grant execute on function public.review_edit(uuid, text, text, timestamptz) to authenticated;
