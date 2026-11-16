-- «Eliminar casa» del anfitrión (historia 28, propuesta aprobada por Ana el 2026-11-16). Borrado lógico de una casa propia
-- con el mismo mecanismo que admin_delete_listing (deleted_at): la RLS la oculta a todos, Explorar, favoritos y consultas
-- dejan de verla, run_subscription_day la ignora, la importación de Airbnb no la vuelve a leer y el trigger
-- ical_export_deleted invalida su exportación. No se reembolsa nada ni se devuelve la plaza de la oferta; se recupera por SQL.
-- Estados: sí con cambios pedidos, borrador ya revisado, pendiente de pago, activa (también pausada) e inactiva; no en
-- revisión, ni bloqueada (no se borra la evidencia), ni un borrador nunca revisado (se descarta), ni rechazada (no la ve).

-- Quién la eliminó: el anfitrión aquí; el admin sigue en admin_actions. Sin quién no hay cuándo, así que nadie lo escribe
-- por REST (listings_protect y listings_insert_guard ya impiden tocar deleted_at).
alter table public.listings
  add column deleted_by uuid references public.profiles(id),
  add constraint listings_deleted_by_coherent check (deleted_by is null or deleted_at is not null);

create or replace function public.delete_own_listing(p_listing uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
begin
  -- Ajena, inexistente, ya eliminada o rechazada: lo mismo para no revelar nada. El for update ordena dos peticiones a la
  -- vez: la segunda espera y ya la encuentra eliminada.
  select * into l from public.listings
   where id = p_listing and owner_id = auth.uid() and deleted_at is null and status <> 'rejected' for update;
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if l.admin_hold = 'blocked' then raise exception 'Esta casa está bloqueada por 3bstays. Escríbanos por WhatsApp.'; end if;
  if l.status = 'review' then
    raise exception 'Esta casa está en revisión. Espere nuestra respuesta o escríbanos por WhatsApp si quiere retirarla.';
  end if;
  if l.status = 'draft' and l.reviewed_at is null then
    raise exception 'Este borrador no se elimina: descártelo con «Descartar borrador».';
  end if;
  perform set_config('app.allow_status', 'on', true);
  update public.listings set deleted_at = now(), deleted_reason = 'Eliminada por el anfitrión.', deleted_by = auth.uid()
   where id = p_listing;
  delete from public.subscription_reminders where listing_id = p_listing and status = 'queued';
  perform public.purge_listing_page(l.public_id);
end $$;

revoke all on function public.delete_own_listing(uuid) from public, anon;
grant execute on function public.delete_own_listing(uuid) to authenticated;
