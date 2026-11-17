-- Habitaciones detrás de la feature flag `rooms` (historia #62, decisiones de Ana del 2026-11-17). Se lanza sin
-- habitaciones y se añadirán si resultan útiles.
-- 1) Regla en la base: con `rooms` apagada (public.feature_flags(), que escribe el despliegue) ninguna casa pasa a ser
--    Habitación (alta, cambio de tipo, aprobar un cambio de tipo, update_listing_live, SQL a mano) ni una Habitación se
--    envía a revisión; tampoco se guarda una propuesta de edición que la convierta en Habitación (save_edit). El navegador
--    no puede saltársela: no manda ningún booleano. Un trigger y no un cambio en cada RPC: cubre todos los caminos.
-- 2) Datos: todas las casas de tipo Habitación, en cualquier estado, quedan eliminadas con el borrado lógico de «Eliminar
--    casa» y del admin (deleted_at): desaparecen de la app y se recuperan por SQL si hiciera falta. Sus avisos de
--    suscripción en cola se quitan y su ficha se purga de la caché. Las propuestas de cambiar una casa a Habitación se
--    descartan. Ninguna flag borra datos por sí sola: esto es una decisión de una vez.

create or replace function public.listings_rooms_flag() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'habitacion' and not (public.feature_flags()).rooms
     and (tg_op = 'INSERT' or old.kind is distinct from new.kind or (new.status = 'review' and old.status is distinct from 'review')) then
    raise exception 'Por ahora 3bstays publica solo alojamientos completos.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.listings_rooms_flag() from public, anon, authenticated, service_role;

create trigger listings_rooms_flag before insert or update of kind, status on public.listings
for each row execute function public.listings_rooms_flag();

create or replace function public.listing_edits_rooms_flag() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.kind = 'habitacion' and not (public.feature_flags()).rooms then
    raise exception 'Por ahora 3bstays publica solo alojamientos completos.' using errcode = 'P0001';
  end if;
  return new;
end $$;
revoke all on function public.listing_edits_rooms_flag() from public, anon, authenticated, service_role;

create trigger listing_edits_rooms_flag before insert or update of kind on public.listing_edits
for each row execute function public.listing_edits_rooms_flag();

-- Datos (una vez). Propuestas pendientes de pasar a Habitación: fuera la propuesta de tipo.
with dropped as (
  update public.listing_edits set kind = null, bathroom_shared = null where kind = 'habitacion' returning listing_id
)
delete from public.listing_edit_fields f using dropped d where f.listing_id = d.listing_id and f.field = 'kind';

do $$
declare r record;
begin
  perform set_config('app.allow_status', 'on', true);
  for r in select id, public_id from public.listings where kind = 'habitacion' and deleted_at is null loop
    update public.listings set deleted_at = now(), deleted_reason = 'Habitaciones fuera del lanzamiento (decisión del 2026-11-17).'
     where id = r.id;
    delete from public.subscription_reminders where listing_id = r.id and status = 'queued';
    perform public.purge_listing_page(r.public_id);
  end loop;
  perform set_config('app.allow_status', 'off', true);
end $$;
