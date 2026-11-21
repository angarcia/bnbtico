-- Historia #69 (segv1-fotos), contrato aprobado el 2026-11-20 (.scratch/seguridad-2026-11-17/01-contrato-privacidad.md) con
-- los dos ajustes de Ana del mismo día: cada foto vive en UN bucket (`listings`, público, si está aprobada y su casa se ve;
-- `listings-privadas` si no) y la mueve el worker (POST /api/fotos/sincronizar y el cron). En un bucket público Storage sirve
-- la URL sin mirar políticas: por eso lo no aprobado no puede estar en él.

-- ---------- Bucket privado, mismas condiciones que el público ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  select 'listings-privadas', 'listings-privadas', false, file_size_limit, allowed_mime_types from storage.buckets where id = 'listings'
  on conflict (id) do nothing;

-- ---------- Dónde está cada foto ----------
-- Nuevas: en el privado. Las de hoy están todas en el público; la primera sincronización saca de ahí lo que no toca.
alter table public.listing_photos add column bucket text not null default 'private' check (bucket in ('public', 'private'));
alter table public.listing_edit_photos add column bucket text not null default 'private' check (bucket in ('public', 'private'));
update public.listing_photos set bucket = 'public';
update public.listing_edit_photos set bucket = 'public';

-- ---------- Políticas de storage.objects ----------
-- En el público ya no sube nadie con su sesión: solo el worker (service role). Leer y borrar siguen para dueño y admin aal2
-- (quitar una foto aprobada borra su objeto; Storage exige poder leerlo para borrarlo).
drop policy listings_photos_owner_insert on storage.objects;
drop policy listings_photos_admin_insert on storage.objects;
drop policy listings_photos_owner_update on storage.objects;

create policy listings_private_owner_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'listings-privadas'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/(480|800|1600)\.jpg$'
  and public.listing_photo_uploadable(((storage.foldername(name))[1])::uuid)
  and public.listing_folder_objects((storage.foldername(name))[1]) < 45);

create policy listings_private_admin_insert on storage.objects for insert to authenticated with check (
  bucket_id = 'listings-privadas'
  and name ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}/(480|800|1600)\.jpg$'
  and public.is_admin()
  and exists (select 1 from public.listings l where l.id::text = (storage.foldername(name))[1] and l.deleted_at is null)
  and public.listing_folder_objects((storage.foldername(name))[1]) < 45);

create policy listings_private_owner_read on storage.objects for select to authenticated using (
  bucket_id = 'listings-privadas'
  and exists (select 1 from public.listings l where l.id::text = (storage.foldername(name))[1] and l.owner_id = auth.uid()));

create policy listings_private_admin_read on storage.objects for select to authenticated using (
  bucket_id = 'listings-privadas' and public.is_admin());

create policy listings_private_owner_delete on storage.objects for delete to authenticated using (
  bucket_id = 'listings-privadas'
  and exists (select 1 from public.listings l where l.id::text = (storage.foldername(name))[1] and l.owner_id = auth.uid())
  and public.photo_unreferenced(name));

create policy listings_private_admin_delete on storage.objects for delete to authenticated using (
  bucket_id = 'listings-privadas' and public.is_admin() and public.photo_unreferenced(name));

-- El tope de 45 objetos por casa cuenta los dos buckets.
CREATE OR REPLACE FUNCTION public.listing_folder_objects(p_listing text)
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'storage'
AS $function$
  select count(*)::int from storage.objects where bucket_id in ('listings', 'listings-privadas') and (storage.foldername(name))[1] = p_listing
$function$;

-- ---------- La ficha pública solo enseña lo que ya está en el público ----------
create or replace view public.listings_public as
 SELECT l.id,
    l.public_id,
    l.kind,
    l.title,
    l.description,
    l.province,
    l.canton,
    l.zone,
    l.public_lat AS lat,
    l.public_lng AS lng,
    l.capacity,
    l.bedrooms,
    l.bathrooms,
    l.bathroom_shared,
    l.features,
    l.parking_paid,
    l.accepts_nightly,
    l.nightly_price_crc,
    l.min_nights,
    l.accepts_monthly,
    l.monthly_mode,
    l.monthly_price_crc,
    l.min_months,
    l.available,
    l.reopen_at,
    l.created_at,
    l.updated_at,
    p.full_name AS owner_name,
    p.phone_verified_at IS NOT NULL AS owner_whatsapp_verified,
    COALESCE(( SELECT jsonb_agg(ph.path ORDER BY ph."position", ph.created_at) AS jsonb_agg
           FROM public.listing_photos ph
          WHERE ph.listing_id = l.id AND ph.bucket = 'public'), '[]'::jsonb) AS photos
   FROM public.listings l
     JOIN public.profiles p ON p.id = l.owner_id
  WHERE l.status = 'active'::public.listing_status AND l.admin_hold IS NULL AND l.deleted_at IS NULL;

-- ---------- Aprobar una foto de edición conserva su bucket ----------
CREATE OR REPLACE FUNCTION public.review_edit_photo(p_photo uuid, p_decision text, p_note text, p_submitted_at timestamp with time zone)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
  -- La foto aprobada sigue en el bucket donde está (el privado): la sincronización del worker la pasa al público.
  insert into public.listing_photos (listing_id, path, position, bucket)
    values (ph.listing_id, ph.path, (select coalesce(max(x.position), -1) + 1 from public.listing_photos x where x.listing_id = ph.listing_id), ph.bucket);
  delete from public.listing_edit_photos where id = p_photo;
  update public.listing_edit_photos t set position = r.pos
    from (select x.id, (row_number() over (order by x.position, x.created_at) - 1)::int as pos
          from public.listing_edit_photos x where x.listing_id = ph.listing_id) r
    where t.id = r.id and t.position is distinct from r.pos;
  insert into public.admin_actions (admin_id, action, target_listing_id, reason) values (auth.uid(), 'edit.approve', ph.listing_id, 'foto');
  perform public.listing_edit_sync(ph.listing_id);
  return 'approved';
end $function$;

-- ---------- Para el worker (solo service role) ----------
-- Las fotos que están en otro bucket del que les toca: público si la foto está aprobada (listing_photos) y su casa se ve
-- (las mismas condiciones que listings_public); privado en cualquier otro caso. Por lotes de 500.
create function public.photo_sync_pending()
returns table(kind text, id uuid, listing_id uuid, path text, from_bucket text, to_bucket text)
language sql stable security definer set search_path = '' as $$
  select * from (
    select 'listing'::text, ph.id, ph.listing_id, ph.path, ph.bucket,
           case when l.status = 'active' and l.admin_hold is null and l.deleted_at is null then 'public' else 'private' end as target
      from public.listing_photos ph join public.listings l on l.id = ph.listing_id
    union all
    select 'edit'::text, ep.id, ep.listing_id, ep.path, ep.bucket, 'private' from public.listing_edit_photos ep
  ) t(kind, id, listing_id, path, from_bucket, to_bucket)
  where from_bucket <> to_bucket
  order by kind, id
  limit 500
$$;

-- El worker la llama después de copiar los objetos al bucket nuevo y antes de borrarlos del viejo.
create function public.set_photo_bucket(p_kind text, p_id uuid, p_bucket text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_bucket is null or p_bucket not in ('public', 'private') then raise exception 'Bucket no válido.'; end if;
  if p_kind = 'listing' then update public.listing_photos set bucket = p_bucket where id = p_id;
  elsif p_kind = 'edit' then update public.listing_edit_photos set bucket = p_bucket where id = p_id;
  else raise exception 'Tipo no válido.';
  end if;
end $$;

revoke all on function public.photo_sync_pending(), public.set_photo_bucket(text, uuid, text) from public, anon, authenticated;
grant execute on function public.photo_sync_pending(), public.set_photo_bucket(text, uuid, text) to service_role;
