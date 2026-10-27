-- bnbtico · revisión UX A5 · primera publicación de una casa · 2026-10-27
-- El calendario del propietario lista las casas que han estado publicadas alguna vez (también si ahora se están editando
-- y vuelven a revisión: sus reservas siguen existiendo). `reviewed_at` no sirve para saberlo: se rellena en cualquier
-- revisión, también al pedir cambios o rechazar una casa que nunca se publicó. `first_published_at` lo pone review_listing
-- la primera vez que aprueba y no se toca después; el cliente no lo puede escribir (listings_protect).

alter table listings add column first_published_at timestamptz;

-- Relleno: las casas activas hoy. Las que se están editando tras haber estado publicadas no se distinguen con certeza de
-- las que vuelven de «cambios» o «rechazada» (todas son borrador con reviewed_at); antes del lanzamiento solo hay datos
-- de prueba, así que no se adivinan.
update listings set first_published_at = coalesce(reviewed_at, updated_at) where status = 'active';

create or replace function listings_protect() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_admin() or current_setting('app.allow_status', true) = 'on' then return new; end if;
  if new.owner_id is distinct from old.owner_id or new.public_id is distinct from old.public_id
     or new.reviewed_at is distinct from old.reviewed_at or new.reviewed_by is distinct from old.reviewed_by
     or new.review_note is distinct from old.review_note or new.whatsapp_phone is distinct from old.whatsapp_phone
     or new.first_published_at is distinct from old.first_published_at then
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

-- Copia de la versión de 20261023073359_cliente_directo_fotos (con el tope de 5 borradores) más first_published_at.
create or replace function listings_insert_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or is_admin() then return new; end if;
  if new.status <> 'draft' or new.reviewed_at is not null or new.reviewed_by is not null or new.review_note is not null
     or new.first_published_at is not null then
    raise exception 'Un anuncio nuevo empieza como borrador.';
  end if;
  if new.owner_id = auth.uid() and open_drafts() >= 5 then
    raise exception 'Ya tiene 5 borradores sin enviar. Termine o descarte uno antes de empezar otro.';
  end if;
  select phone into new.whatsapp_phone from profiles where id = new.owner_id;
  return new;
end $$;

create or replace function review_listing(p_listing uuid, p_decision text, p_note text) returns listing_status language plpgsql security definer set search_path = public as $$
declare
  l listings;
  note text := left(btrim(coalesce(p_note, '')), 2000);
  next_status listing_status;
  n_photos int;
begin
  if not is_admin() then
    if coalesce((select is_admin from profiles where id = auth.uid()), false) then
      raise exception 'Confirme el segundo código para revisar anuncios.';
    end if;
    raise exception 'Solo bnbtico puede revisar anuncios.';
  end if;
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
  update listings set status = next_status, review_note = nullif(note, ''), reviewed_at = now(), reviewed_by = auth.uid(),
    first_published_at = case when p_decision = 'approve' then coalesce(first_published_at, now()) else first_published_at end
  where id = p_listing;
  insert into admin_actions (admin_id, action, target_listing_id, reason) values (auth.uid(), 'listing.' || p_decision, p_listing, nullif(note, ''));
  if p_decision = 'approve' then update profiles set is_owner = true where id = l.owner_id; end if;
  return next_status;
end $$;
