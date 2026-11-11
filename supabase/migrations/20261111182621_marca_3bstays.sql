-- Marca 3bstays (decisión 2026-11-10): los mensajes de error que ve el usuario dejan de decir «bnbtico».
-- Cada función se recrea desde su definición vigente; solo cambia el texto. Los identificadores internos
-- (candado bnbtico.promo_slot, secreto bnbtico_test_clock, source = 'bnbtico') no cambian.

CREATE OR REPLACE FUNCTION public.admin_house_for_action(p_listing uuid)
 RETURNS listings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  l public.listings;
begin
  if not public.is_admin() then
    if coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
      raise exception 'Confirme el segundo código para revisar anuncios.';
    end if;
    raise exception 'Solo 3bstays puede revisar anuncios.';
  end if;
  select * into l from public.listings where id = p_listing and deleted_at is null for update;
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  return l;
end $function$;

CREATE OR REPLACE FUNCTION public.assert_listing_open(p_listing uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  l public.listings;
begin
  select * into l from public.listings where id = p_listing;
  -- Casa ajena o que no existe: la función que llama da su propio mensaje.
  if not found or l.owner_id is distinct from auth.uid() then return; end if;
  if l.deleted_at is not null then raise exception 'No encontramos ese anuncio.'; end if;
  if l.admin_hold = 'blocked' then raise exception 'Esta casa está bloqueada por 3bstays. Escríbanos por WhatsApp.'; end if;
end $function$;

CREATE OR REPLACE FUNCTION public.edit_admin_guard()
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not public.is_admin() then
    if coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
      raise exception 'Confirme el segundo código para revisar anuncios.';
    end if;
    raise exception 'Solo 3bstays puede revisar anuncios.';
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.listings_protect()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if public.is_admin() or current_setting('app.allow_status', true) = 'on' then return new; end if;
  if new.owner_id is distinct from old.owner_id or new.public_id is distinct from old.public_id
     or new.reviewed_at is distinct from old.reviewed_at or new.reviewed_by is distinct from old.reviewed_by
     or new.review_note is distinct from old.review_note or new.whatsapp_phone is distinct from old.whatsapp_phone
     or new.first_published_at is distinct from old.first_published_at then
    raise exception 'No puede cambiar ese dato.';
  end if;
  if new.admin_hold is distinct from old.admin_hold or new.admin_hold_reason is distinct from old.admin_hold_reason
     or new.admin_hold_at is distinct from old.admin_hold_at or new.deleted_at is distinct from old.deleted_at
     or new.deleted_reason is distinct from old.deleted_reason then
    raise exception 'No puede cambiar ese dato.';
  end if;
  if old.admin_hold = 'blocked' then raise exception 'Esta casa está bloqueada por 3bstays. Escríbanos por WhatsApp.'; end if;
  if new.status is distinct from old.status then
    if new.status = 'draft' and old.status in ('changes','rejected') then return new; end if;
    raise exception 'Solo 3bstays puede cambiar el estado de un anuncio.';
  end if;
  if old.status not in ('draft','changes') then
    if public.listing_status_published(old.status, old.first_published_at) then
      raise exception 'Esta casa está publicada: cambie sus datos desde Mis casas.';
    end if;
    raise exception 'Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión.';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.own_published_listing(p_listing uuid)
 RETURNS listings
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  l public.listings;
begin
  select * into l from public.listings where id = p_listing and owner_id = auth.uid() for update;
  if not found or l.deleted_at is not null then raise exception 'No encontramos ese anuncio.'; end if;
  if l.admin_hold = 'blocked' then raise exception 'Esta casa está bloqueada por 3bstays. Escríbanos por WhatsApp.'; end if;
  if not public.listing_status_published(l.status, l.first_published_at) then
    raise exception 'Solo puede cambiar así una casa publicada.';
  end if;
  return l;
end $function$;

CREATE OR REPLACE FUNCTION public.review_listing(p_listing uuid, p_decision text, p_note text)
 RETURNS listing_status
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  l public.listings;
  s public.subscriptions;
  note text := left(btrim(coalesce(p_note, '')), 2000);
  next_status public.listing_status;
  n_photos int;
  today date := public.costa_rica_today();
  slot int;
  months int;
  has_method boolean;
  promo boolean;
begin
  if not public.is_admin() then
    if coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
      raise exception 'Confirme el segundo código para revisar anuncios.';
    end if;
    raise exception 'Solo 3bstays puede revisar anuncios.';
  end if;
  select * into l from public.listings where id = p_listing;
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if l.status <> 'review' then raise exception 'Este anuncio ya tiene una decisión.'; end if;
  if p_decision not in ('approve','changes','reject') then raise exception 'Decisión no válida.'; end if;
  if p_decision <> 'approve' and note = '' then raise exception 'Escriba un motivo de hasta 2000 caracteres para pedir cambios o rechazar.'; end if;
  if p_decision = 'approve' then
    select count(*) into n_photos from public.listing_photos where listing_id = p_listing;
    if n_photos < 1 then raise exception 'Para aprobarla hace falta al menos una foto.'; end if;

    select * into s from public.subscriptions where listing_id = p_listing;
    if not found then
      perform pg_advisory_xact_lock(hashtext('bnbtico.promo_slot'));
      select coalesce(max(promo_slot), 0) + 1 into slot from public.subscriptions;
      months := case when slot <= 50 then 12 when slot <= 100 then 6 when slot <= 200 then 3 end;
      insert into public.subscriptions (listing_id, plan, promo_slot, promo_months, promo_ends_on)
      values (p_listing, (case when months is null then 'paid' else 'promo' end)::public.plan,
              case when months is null then null else slot end, months,
              case when months is null then null else (today + make_interval(months => months))::date end)
      returning * into s;
    end if;
    has_method := public.owner_has_payment_method(l.owner_id);
    promo := s.plan = 'promo' and s.promo_ends_on is not null and today <= s.promo_ends_on;
    next_status := case when promo or has_method then 'active'::public.listing_status else 'payment_due'::public.listing_status end;
    if not promo and has_method and (s.plan = 'promo' or s.paid_since is null) then
      update public.subscriptions set plan = 'paid', paid_since = today where listing_id = p_listing;
    end if;
  else
    next_status := case p_decision when 'changes' then 'changes'::public.listing_status else 'rejected'::public.listing_status end;
  end if;
  perform set_config('app.allow_status', 'on', true);
  update public.listings set status = next_status, review_note = nullif(note, ''), reviewed_at = now(), reviewed_by = auth.uid(),
    first_published_at = case when p_decision = 'approve' then coalesce(first_published_at, now()) else first_published_at end
  where id = p_listing;
  insert into public.admin_actions (admin_id, action, target_listing_id, reason) values (auth.uid(), 'listing.' || p_decision, p_listing, nullif(note, ''));
  if p_decision = 'approve' then update public.profiles set is_owner = true where id = l.owner_id; end if;
  return next_status;
end $function$;
