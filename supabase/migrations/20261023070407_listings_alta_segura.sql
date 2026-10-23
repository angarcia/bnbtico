-- bnbtico · fase R, ticket 07 · alta segura de anuncios · 2026-10-23
-- El asistente crea el borrador desde el navegador (PostgREST con el JWT del dueño). La política de insert solo exigía
-- owner_id = auth.uid() y el trigger listings_protect solo vigilaba updates: un propietario podía insertar una casa
-- directamente «active» (sin revisión) y con cualquier WhatsApp. Ahora un anuncio nuevo nace como borrador sin revisión
-- y con el WhatsApp del perfil, y ese número no se cambia por REST. El servicio (auth.uid() nulo) y el admin no cambian.

create or replace function listings_insert_guard() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or is_admin() then return new; end if;
  if new.status <> 'draft' or new.reviewed_at is not null or new.reviewed_by is not null or new.review_note is not null then
    raise exception 'Un anuncio nuevo empieza como borrador.';
  end if;
  select phone into new.whatsapp_phone from profiles where id = new.owner_id;
  return new;
end $$;

create trigger listings_insert_guard before insert on listings for each row execute function listings_insert_guard();

create or replace function listings_protect() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if is_admin() or current_setting('app.allow_status', true) = 'on' then return new; end if;
  if new.owner_id is distinct from old.owner_id or new.public_id is distinct from old.public_id
     or new.reviewed_at is distinct from old.reviewed_at or new.reviewed_by is distinct from old.reviewed_by
     or new.review_note is distinct from old.review_note or new.whatsapp_phone is distinct from old.whatsapp_phone then
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
