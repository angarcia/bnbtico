-- Marca 3bstays (decisión 2026-11-11): lo último del esquema que decía bnbtico, para que producción nazca sin él.

-- 1. Candado de las plazas de la promoción. Solo existe durante cada transacción: cambiar la clave no deja nada colgado.
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
      perform pg_advisory_xact_lock(hashtext('3bstays.promo_slot'));
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

-- 2. Reloj de pruebas: el secreto de Vault pasa a 3bstays_test_clock (nunca existe en producción).
CREATE OR REPLACE FUNCTION public.test_set_offer_days_left(p_public_id text, p_days_left integer)
 RETURNS date
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  ends date;
begin
  if coalesce((select decrypted_secret from vault.decrypted_secrets where name = '3bstays_test_clock' limit 1), '') <> 'on' then
    raise exception 'El reloj de pruebas no está habilitado.';
  end if;
  update public.subscriptions s set promo_ends_on = public.costa_rica_today() + p_days_left
    from public.listings l where l.id = s.listing_id and l.public_id = p_public_id and s.plan = 'promo'
  returning s.promo_ends_on into ends;
  if ends is null then raise exception 'No encontramos ese anuncio.'; end if;
  return ends;
end $function$;

select vault.update_secret(id, new_name => '3bstays_test_clock')
from vault.secrets where name = 'bnbtico_test_clock';
