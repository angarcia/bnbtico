-- Admin · Casas: pausar, bloquear y eliminar (decidido con Daniel el 2026-10-30; .scratch/admin-casas-acciones/spec.md).
-- No toca la máquina de estados de `status`: la retención del admin son columnas aparte. Pausar saca la casa del público
-- (Explorar, ficha, sitemap, favoritos) y el propietario la sigue editando; bloquear lo mismo, pero el propietario no la edita
-- y la suscripción se para (sin avisos ni fin de oferta mientras dure); eliminar es un borrado lógico (todo se conserva oculto).

alter table public.listings
  add column admin_hold text check (admin_hold in ('paused', 'blocked')),
  add column admin_hold_reason text,
  add column admin_hold_at timestamptz,
  add column deleted_at timestamptz,
  add column deleted_reason text,
  add constraint listings_admin_hold_coherent check (
    (admin_hold is null and admin_hold_reason is null and admin_hold_at is null)
    or (admin_hold is not null and admin_hold_reason is not null and admin_hold_at is not null)),
  add constraint listings_deleted_coherent check ((deleted_at is null) = (deleted_reason is null));

-- Una casa eliminada no la lee nadie por REST (ni su dueño ni el admin); las tablas que cuelgan de ella heredan la regla
-- porque sus políticas consultan listings con la RLS de quien pregunta. Se recupera por SQL.
drop policy listings_owner_or_admin_select on public.listings;
create policy listings_owner_or_admin_select on public.listings for select to public
  using ((owner_id = auth.uid() or public.is_admin()) and deleted_at is null);
drop policy listings_owner_update on public.listings;
create policy listings_owner_update on public.listings for update to public
  using ((owner_id = auth.uid() or public.is_admin()) and deleted_at is null);

-- Comprobación común de las acciones del propietario sobre una casa suya: eliminada = no existe; bloqueada = no se toca.
create or replace function public.assert_listing_open(p_listing uuid) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  l public.listings;
begin
  select * into l from public.listings where id = p_listing;
  -- Casa ajena o que no existe: la función que llama da su propio mensaje.
  if not found or l.owner_id is distinct from auth.uid() then return; end if;
  if l.deleted_at is not null then raise exception 'No encontramos ese anuncio.'; end if;
  if l.admin_hold = 'blocked' then raise exception 'Esta casa está bloqueada por bnbtico. Escríbanos por WhatsApp.'; end if;
end $$;
revoke all on function public.assert_listing_open(uuid) from public, anon, authenticated;

-- Lo público: solo las activas sin retención y sin borrar. (Mismas columnas que antes: create or replace.)
create or replace view public.listings_public as
SELECT l.id,
    l.public_id,
    l.kind,
    l.title,
    l.description,
    l.province,
    l.canton,
    l.zone,
    (approx_point(l.lat, l.lng, l.public_id))[0] AS lat,
    (approx_point(l.lat, l.lng, l.public_id))[1] AS lng,
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
    (p.phone_verified_at IS NOT NULL) AS owner_whatsapp_verified,
    COALESCE(( SELECT jsonb_agg(ph.path ORDER BY ph."position", ph.created_at) AS jsonb_agg
           FROM listing_photos ph
          WHERE (ph.listing_id = l.id)), '[]'::jsonb) AS photos
   FROM (listings l
     JOIN profiles p ON ((p.id = l.owner_id)))
  WHERE ((l.status = 'active'::listing_status) AND (l.admin_hold IS NULL) AND (l.deleted_at IS NULL));

create or replace view public.zones_with_listings as
 SELECT z.id,
    z.name,
    z.canton_code,
    n.name AS canton,
    p.name AS province,
    z.lat,
    z.lng,
    (count(l.id))::integer AS listings
   FROM (((zones z
     JOIN geo.admin_names n ON ((n.code = z.canton_code)))
     JOIN geo.admin_names p ON ((p.code = "left"(z.canton_code, 1))))
     JOIN listings l ON (((l.status = 'active'::listing_status) AND l.admin_hold IS NULL AND l.deleted_at IS NULL AND l.available AND (l.lat IS NOT NULL) AND ((l.zone_id = z.id) OR st_dwithin((st_setsrid(st_makepoint(l.lng, l.lat), 4326))::geography, (z.point)::geography, (5000)::double precision)))))
  WHERE z.active
  GROUP BY z.id, z.name, z.canton_code, n.name, p.name, z.lat, z.lng;

create or replace function public.listing_link_state(p_public_id text) returns text
language sql stable security definer set search_path = public as $$
  select case
    when deleted_at is not null then null
    when status = 'active' and admin_hold is null then 'active'
    when status = 'draft' and reviewed_at is null then null
    else 'blocked'
  end
  from listings where public_id = p_public_id
$$;

-- Motivo del 410: una casa pausada o bloqueada no dice por qué al público («Este anuncio no está disponible…»).
create or replace function public.listing_blocked_reason(p_public_id text) returns text language sql stable security definer set search_path = '' as $$
  select case
    when public.listing_link_state(p_public_id) is distinct from 'blocked' then null
    when l.admin_hold is not null then 'other'
    when l.status = 'inactive' then 'stopped'
    when l.status = 'payment_due' then 'payment'
    else 'other'
  end
  from public.listings l where l.public_id = p_public_id
$$;

create or replace function public.listing_visible(p_listing uuid) returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from listings l where l.id = p_listing and l.deleted_at is null
                 and ((l.status = 'active' and l.admin_hold is null) or l.owner_id = auth.uid() or is_admin()))
$$;

create or replace function public.listing_is_published(p_listing uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.listings l where l.id = p_listing and l.status = 'active' and l.admin_hold is null and l.deleted_at is null)
$$;

CREATE OR REPLACE FUNCTION public.create_inquiry(p_public_id text, p_arrival date, p_departure date, p_people integer, p_message text)
 RETURNS TABLE(inquiry_id uuid, whatsapp_phone text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  prof public.profiles;
  l public.listings;
  msg text := btrim(coalesce(p_message, ''));
  today date := (now() at time zone 'America/Costa_Rica')::date;
  found_id uuid;
  others int;
begin
  if uid is null then raise exception 'Ingrese con su WhatsApp para contactar al propietario.'; end if;
  select * into prof from public.profiles where id = uid;
  if not found or not prof.is_active then raise exception 'Su cuenta está desactivada. Escríbanos por WhatsApp.'; end if;
  if prof.phone_verified_at is null then raise exception 'Verifique su WhatsApp para contactar al propietario.'; end if;

  select * into l from public.listings where public_id = p_public_id and status = 'active' and admin_hold is null and deleted_at is null;
  if not found then raise exception 'Esta casa ya no está publicada.'; end if;
  if l.owner_id = uid then raise exception 'Esta es su propia casa.'; end if;
  if not l.available then raise exception 'Esta casa no está disponible para consultas.'; end if;

  -- Mismo orden y mensajes que validateInquiryDraft (src/domain/inquiry.ts).
  if (p_arrival is null) <> (p_departure is null) then raise exception 'Indique la llegada y la salida, o deje las dos vacías.'; end if;
  if p_arrival is not null then
    if p_departure <= p_arrival then raise exception 'La salida tiene que ser después de la llegada.'; end if;
    if p_arrival < today then raise exception 'La llegada no puede ser antes de hoy.'; end if;
  end if;
  if p_people is not null and (p_people < 1 or p_people > 50) then raise exception 'Indique entre 1 y 50 personas.'; end if;
  if msg = '' then raise exception 'Escriba un mensaje para el propietario.'; end if;
  if char_length(msg) > 1000 then raise exception 'El mensaje no puede pasar de 1000 caracteres.'; end if;

  -- Dos toques seguidos del mismo cliente a la misma casa no crean dos filas.
  perform pg_advisory_xact_lock(hashtextextended(uid::text || l.id::text, 0));

  select count(distinct i.listing_id) into others from public.inquiries i
   where i.client_id = uid and i.updated_at > now() - interval '24 hours' and i.listing_id <> l.id;
  if others >= 20 then raise exception 'Ha contactado muchas casas hoy. Intente mañana o escríbanos por WhatsApp.'; end if;

  select i.id into found_id from public.inquiries i
   where i.client_id = uid and i.listing_id = l.id and i.created_at > now() - interval '7 days'
   order by i.created_at desc limit 1;

  if found_id is null then
    insert into public.inquiries (listing_id, client_id, owner_id, arrival, departure, people, message, consent_share_phone, whatsapp_phone, source)
    values (l.id, uid, l.owner_id, p_arrival, p_departure, p_people, msg, true, l.whatsapp_phone, 'listing')
    returning id into found_id;
  else
    update public.inquiries
       set arrival = p_arrival, departure = p_departure, people = p_people, message = msg, consent_share_phone = true,
           whatsapp_phone = l.whatsapp_phone, updated_at = now(), owner_opened_at = null
     where id = found_id;
  end if;

  return query select found_id, l.whatsapp_phone;
end $function$;

CREATE OR REPLACE FUNCTION public.public_listing_days(p_public_id text)
 RETURNS TABLE(day date, available boolean, special_price_crc integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select d.day, d.available, d.special_price_crc
    from public.listing_days d
    join public.listings l on l.id = d.listing_id
   where l.public_id = p_public_id and l.status = 'active' and l.admin_hold is null and l.deleted_at is null
     and d.day between (now() at time zone 'America/Costa_Rica')::date and (now() at time zone 'America/Costa_Rica')::date + 365
   order by d.day
$function$;

CREATE OR REPLACE FUNCTION public.owner_inquiries()
 RETURNS TABLE(id uuid, listing_id uuid, public_id text, listing_title text, client_name text, client_phone text, arrival date, departure date, people integer, message text, created_at timestamp with time zone, updated_at timestamp with time zone, owner_opened_at timestamp with time zone, source text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select i.id, i.listing_id, l.public_id, l.title, p.full_name, p.phone,
         i.arrival, i.departure, i.people, i.message,
         i.created_at, i.updated_at, i.owner_opened_at, i.source
    from public.inquiries i
    join public.listings l on l.id = i.listing_id
    join public.profiles p on p.id = i.client_id
   where i.owner_id = auth.uid() and l.deleted_at is null
   order by i.updated_at desc, i.id
   limit 200
$function$;

CREATE OR REPLACE FUNCTION public.owner_activity()
 RETURNS TABLE(listing_id uuid, public_id text, views integer, whatsapp_taps integer, inquiries integer)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select l.id, l.public_id,
    (select count(*)::int from events e where e.name = 'listing_view' and e.listing_public_id = l.public_id and e.created_at > now() - interval '30 days'),
    (select count(*)::int from events e where e.name = 'whatsapp_tap' and e.listing_public_id = l.public_id and e.created_at > now() - interval '30 days'),
    (select count(*)::int from inquiries i where i.listing_id = l.id and i.created_at > now() - interval '30 days')
  from listings l
  where l.owner_id = auth.uid() and l.deleted_at is null
  order by l.created_at desc;
$function$;

CREATE OR REPLACE FUNCTION public.owner_listing_stats(p_listing uuid)
 RETURNS TABLE(views integer, inquiries integer)
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  l listings;
begin
  select * into l from listings where id = p_listing;
  if not found or l.deleted_at is not null or (l.owner_id is distinct from auth.uid() and not is_admin()) then
    raise exception 'No encontramos ese anuncio.';
  end if;
  return query select
    (select count(*)::int from events e where e.name = 'listing_view' and e.listing_public_id = l.public_id and e.created_at > now() - interval '30 days'),
    (select count(*)::int from inquiries i where i.listing_id = p_listing and i.created_at > now() - interval '30 days');
end $function$;

CREATE OR REPLACE FUNCTION public.open_drafts()
 RETURNS integer
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
  select count(*)::int from listings where owner_id = auth.uid() and deleted_at is null and status = 'draft' and reviewed_at is null
$function$;

-- La suscripción del propietario: sin las eliminadas y con la retención de cada casa (una bloqueada no muestra oferta ni pago).
CREATE OR REPLACE FUNCTION public.owner_billing()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
    'houses', coalesce((
      select jsonb_agg(jsonb_build_object(
          'listing_id', l.id, 'public_id', l.public_id, 'title', l.title, 'status', l.status, 'plan', s.plan,
          'promo_slot', s.promo_slot, 'promo_months', s.promo_months, 'promo_ends_on', s.promo_ends_on,
          'paid_since', s.paid_since, 'stopped_on', (s.stopped_at at time zone 'America/Costa_Rica')::date,
          'monthly_price_crc', s.monthly_price_crc, 'admin_hold', l.admin_hold,
          'reminders', coalesce((
            select jsonb_agg(jsonb_build_object('days_before', r.days_before, 'status', r.status, 'sent_at', r.sent_at) order by r.days_before desc)
              from public.subscription_reminders r where r.listing_id = l.id), '[]'::jsonb))
        order by l.created_at desc)
        from public.listings l join public.subscriptions s on s.listing_id = l.id
       where l.owner_id = auth.uid() and l.deleted_at is null), '[]'::jsonb),
    'method', (
      select jsonb_build_object('brand', m.brand, 'last4', m.last4, 'exp_month', m.exp_month, 'exp_year', m.exp_year, 'added_at', m.added_at)
        from public.payment_methods m where m.owner_id = auth.uid()),
    'today', public.costa_rica_today())
$function$;

CREATE OR REPLACE FUNCTION public.run_subscription_day(p_today date DEFAULT NULL::date)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  today date := coalesce(p_today, public.costa_rica_today());
  n_paid int;
  n_due int;
  n_queued int;
begin
  perform set_config('app.allow_status', 'on', true);
  update public.subscriptions s set plan = 'paid', paid_since = s.promo_ends_on + 1
    from public.listings l
   where l.id = s.listing_id and l.status = 'active' and s.plan = 'promo' and s.promo_ends_on < today
     and l.admin_hold is distinct from 'blocked' and l.deleted_at is null
     and public.owner_has_payment_method(l.owner_id);
  get diagnostics n_paid = row_count;

  update public.listings l set status = 'payment_due'
    from public.subscriptions s
   where s.listing_id = l.id and l.status = 'active' and s.plan = 'promo' and s.promo_ends_on < today
     and l.admin_hold is distinct from 'blocked' and l.deleted_at is null
     and not public.owner_has_payment_method(l.owner_id);
  get diagnostics n_due = row_count;

  insert into public.subscription_reminders (listing_id, days_before, promo_ends_on, status, queued_at)
  select s.listing_id,
         case when s.promo_ends_on - today = 0 then 0 when s.promo_ends_on - today <= 7 then 7
              when s.promo_ends_on - today <= 30 then 30 else 90 end,
         s.promo_ends_on, 'queued', now()
    from public.subscriptions s join public.listings l on l.id = s.listing_id
   where l.status = 'active' and s.plan = 'promo' and s.promo_ends_on - today between 0 and 90
     and l.admin_hold is distinct from 'blocked' and l.deleted_at is null
     and not public.owner_has_payment_method(l.owner_id)
  on conflict (listing_id, days_before) do nothing;
  get diagnostics n_queued = row_count;

  return jsonb_build_object('paid', n_paid, 'payment_due', n_due, 'queued', n_queued);
end $function$;

CREATE OR REPLACE FUNCTION public.claim_reminders(p_limit integer DEFAULT 20)
 RETURNS TABLE(id uuid, listing_id uuid, public_id text, title text, owner_name text, to_phone text, days_before integer, promo_ends_on date)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
begin
  return query
  with picked as (
    select r.id from public.subscription_reminders r
     where r.status = 'queued'
     order by r.queued_at, r.id
     limit greatest(coalesce(p_limit, 0), 0)
     for update skip locked
  ), info as (
    select r.id, l.id as listing_id, l.public_id, l.title, p.full_name, p.phone, r.days_before, r.promo_ends_on,
           (l.status = 'active' and l.admin_hold is distinct from 'blocked' and l.deleted_at is null and s.plan = 'promo' and p.is_active and not public.owner_has_payment_method(l.owner_id)) as eligible
      from picked k
      join public.subscription_reminders r on r.id = k.id
      join public.listings l on l.id = r.listing_id
      join public.subscriptions s on s.listing_id = l.id
      join public.profiles p on p.id = l.owner_id
  ), skipped as (
    update public.subscription_reminders r set status = 'skipped', last_error = 'ya no corresponde'
      from info i where r.id = i.id and not i.eligible
    returning r.id
  ), claimed as (
    update public.subscription_reminders r set status = 'sending', claimed_at = now(), attempts = r.attempts + 1, to_phone = i.phone
      from info i where r.id = i.id and i.eligible
    returning r.id
  )
  select i.id, i.listing_id, i.public_id, i.title, i.full_name, i.phone, i.days_before, i.promo_ends_on
    from info i join claimed c on c.id = i.id
   order by i.id;
end $function$;

-- Un método de pago nuevo no reactiva (ni cobra) las casas bloqueadas o eliminadas: al desbloquear se decide.
CREATE OR REPLACE FUNCTION public.apply_payment_event(p_provider text, p_event_id text, p_type text, p_owner uuid DEFAULT NULL::uuid, p_customer_ref text DEFAULT NULL::text, p_method_ref text DEFAULT NULL::text, p_brand text DEFAULT NULL::text, p_last4 text DEFAULT NULL::text, p_exp_month integer DEFAULT NULL::integer, p_exp_year integer DEFAULT NULL::integer)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  inserted int;
  today date := public.costa_rica_today();
  complete boolean;
begin
  complete := p_type = 'setup_completed' and p_owner is not null and exists (select 1 from public.profiles where id = p_owner)
    and coalesce(p_customer_ref, '') <> '' and coalesce(p_method_ref, '') <> '' and coalesce(p_brand, '') <> ''
    and coalesce(p_last4, '') ~ '^[0-9]{4}$' and p_exp_month between 1 and 12 and p_exp_year between 2000 and 2100;
  insert into public.payment_events (provider, event_id, type, owner_id, result)
  values (p_provider, p_event_id, p_type, case when exists (select 1 from public.profiles where id = p_owner) then p_owner end,
          case when complete then 'applied' else 'ignored' end)
  on conflict (provider, event_id) do nothing;
  get diagnostics inserted = row_count;
  if inserted = 0 then return 'duplicate'; end if;
  if not complete then return 'ignored'; end if;

  insert into public.payment_methods (owner_id, provider, customer_ref, method_ref, brand, last4, exp_month, exp_year)
  values (p_owner, p_provider, p_customer_ref, p_method_ref, p_brand, p_last4, p_exp_month, p_exp_year)
  on conflict (owner_id) do update set provider = excluded.provider, customer_ref = excluded.customer_ref, method_ref = excluded.method_ref,
    brand = excluded.brand, last4 = excluded.last4, exp_month = excluded.exp_month, exp_year = excluded.exp_year;

  update public.subscriptions s set plan = 'paid', paid_since = coalesce(s.paid_since, today)
    from public.listings l where l.id = s.listing_id and l.owner_id = p_owner and l.status = 'payment_due'
       and l.admin_hold is distinct from 'blocked' and l.deleted_at is null;
  perform set_config('app.allow_status', 'on', true);
  update public.listings set status = 'active' where owner_id = p_owner and status = 'payment_due'
     and admin_hold is distinct from 'blocked' and deleted_at is null;
  return 'applied';
end $function$;

-- Las acciones del propietario sobre una casa bloqueada o eliminada.
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
  if l.admin_hold = 'blocked' then raise exception 'Esta casa está bloqueada por bnbtico. Escríbanos por WhatsApp.'; end if;
  if not public.listing_status_published(l.status, l.first_published_at) then
    raise exception 'Solo puede cambiar así una casa publicada.';
  end if;
  return l;
end $function$;

CREATE OR REPLACE FUNCTION public.listing_photos_guard(p_listing uuid)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  l public.listings;
begin
  perform public.assert_listing_open(p_listing);
  select * into l from public.listings where id = p_listing and owner_id = auth.uid();
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if public.listing_status_published(l.status, l.first_published_at) then
    raise exception 'Las fotos nuevas pasan por revisión. Añádalas desde la ficha de su casa.';
  end if;
  if l.status not in ('draft','changes') then
    raise exception 'Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión.';
  end if;
end $function$;

CREATE OR REPLACE FUNCTION public.listing_photos_owner_guard(p_listing uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  l public.listings;
begin
  perform public.assert_listing_open(p_listing);
  select * into l from public.listings where id = p_listing and owner_id = auth.uid();
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if public.listing_status_published(l.status, l.first_published_at) then return true; end if;
  if l.status not in ('draft','changes') then
    raise exception 'Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión.';
  end if;
  return false;
end $function$;

CREATE OR REPLACE FUNCTION public.save_listing_days(p_listing uuid, p_days date[], p_available boolean DEFAULT NULL::boolean, p_price_crc integer DEFAULT NULL::integer)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  l public.listings;
  today date := (now() at time zone 'America/Costa_Rica')::date;
  days date[];
  base int;
begin
  perform public.assert_listing_open(p_listing);
  select * into l from public.listings where id = p_listing and owner_id = auth.uid();
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
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
  select p_listing, d, coalesce(p_available, true), case when p_price_crc = base then null else p_price_crc end
    from unnest(days) d
  on conflict (listing_id, day) do update
    set available = coalesce(p_available, ld.available),
        special_price_crc = case when p_price_crc is null then ld.special_price_crc when p_price_crc = base then null else p_price_crc end;
  delete from public.listing_days where listing_id = p_listing and day = any(days) and available and special_price_crc is null;

  if l.status = 'active' then perform public.purge_listing_page(l.public_id); end if;
end $function$;

CREATE OR REPLACE FUNCTION public.set_listing_available(p_listing uuid, p_available boolean, p_reopen_at date DEFAULT NULL::date)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  today date := (now() at time zone 'America/Costa_Rica')::date;
begin
  perform public.assert_listing_open(p_listing);
  if not exists (select 1 from public.listings where id = p_listing and owner_id = auth.uid() and status = 'active') then
    raise exception 'Solo puede cambiar la disponibilidad de una casa activa.';
  end if;
  if p_available and p_reopen_at is not null then raise exception 'La fecha de reapertura solo se pone al cerrar la casa.'; end if;
  if p_reopen_at is not null and (p_reopen_at <= today or p_reopen_at > today + 365) then
    raise exception 'La fecha de reapertura debe ser a partir de mañana y dentro de un año.';
  end if;
  perform set_config('app.allow_status', 'on', true);
  -- Abrir a mano cancela la fecha. El trigger listings_purge_page refresca la ficha.
  update public.listings set available = p_available, reopen_at = case when p_available then null else p_reopen_at end where id = p_listing;
end $function$;

CREATE OR REPLACE FUNCTION public.stop_subscription(p_listing uuid)
 RETURNS listing_status
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  l public.listings;
begin
  perform public.assert_listing_open(p_listing);
  select * into l from public.listings where id = p_listing and owner_id = auth.uid();
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if not coalesce((select is_active from public.profiles where id = auth.uid()), false) then
    raise exception 'Su cuenta está desactivada. Escríbanos por WhatsApp.';
  end if;
  if l.status not in ('active','payment_due') then
    raise exception 'Solo puede parar la suscripción de una casa activa o pendiente de pago.';
  end if;
  perform set_config('app.allow_status', 'on', true);
  update public.listings set status = 'inactive' where id = p_listing;
  update public.subscriptions set stopped_at = now() where listing_id = p_listing;
  return 'inactive';
end $function$;

CREATE OR REPLACE FUNCTION public.resume_subscription(p_listing uuid)
 RETURNS listing_status
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  l public.listings;
  s public.subscriptions;
  today date := public.costa_rica_today();
  promo boolean;
  has_method boolean;
  next_status public.listing_status;
begin
  perform public.assert_listing_open(p_listing);
  select * into l from public.listings where id = p_listing and owner_id = auth.uid();
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if not coalesce((select is_active from public.profiles where id = auth.uid()), false) then
    raise exception 'Su cuenta está desactivada. Escríbanos por WhatsApp.';
  end if;
  select * into s from public.subscriptions where listing_id = p_listing;
  if l.status <> 'inactive' or not found then
    raise exception 'Solo puede reactivar una casa con la suscripción parada.';
  end if;
  has_method := public.owner_has_payment_method(l.owner_id);
  promo := s.plan = 'promo' and s.promo_ends_on is not null and today <= s.promo_ends_on;
  next_status := case when promo or has_method then 'active'::public.listing_status else 'payment_due'::public.listing_status end;
  update public.subscriptions set stopped_at = null,
    plan = case when not promo and has_method then 'paid'::public.plan else plan end,
    paid_since = case when not promo and has_method and (plan = 'promo' or paid_since is null) then today else paid_since end
  where listing_id = p_listing;
  perform set_config('app.allow_status', 'on', true);
  update public.listings set status = next_status where id = p_listing;
  return next_status;
end $function$;

CREATE OR REPLACE FUNCTION public.submit_listing(p_listing uuid)
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
  perform public.assert_listing_open(p_listing);
  select * into l from listings where id = p_listing and owner_id = auth.uid();
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
  if old.admin_hold = 'blocked' then raise exception 'Esta casa está bloqueada por bnbtico. Escríbanos por WhatsApp.'; end if;
  if new.status is distinct from old.status then
    if new.status = 'draft' and old.status in ('changes','rejected') then return new; end if;
    raise exception 'Solo bnbtico puede cambiar el estado de un anuncio.';
  end if;
  if old.status not in ('draft','changes') then
    if public.listing_status_published(old.status, old.first_published_at) then
      raise exception 'Esta casa está publicada: cambie sus datos desde Mis casas.';
    end if;
    raise exception 'Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión.';
  end if;
  return new;
end $function$;

CREATE OR REPLACE FUNCTION public.listings_insert_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
  if auth.uid() is null or is_admin() then return new; end if;
  if new.status <> 'draft' or new.reviewed_at is not null or new.reviewed_by is not null or new.review_note is not null
     or new.first_published_at is not null or new.admin_hold is not null or new.deleted_at is not null then
    raise exception 'Un anuncio nuevo empieza como borrador.';
  end if;
  if new.owner_id = auth.uid() and open_drafts() >= 5 then
    raise exception 'Ya tiene 5 borradores sin enviar. Termine o descarte uno antes de empezar otro.';
  end if;
  select phone into new.whatsapp_phone from profiles where id = new.owner_id;
  return new;
end $function$;

-- ---------- Acciones del admin ----------
-- Todas exigen is_admin() (segundo factor, aal2), piden el motivo cuando limitan la casa, lo dejan en admin_actions y
-- purgan la ficha del borde al momento (como al aprobar). Mismos mensajes que REVIEW_MESSAGES y ADMIN_HOLD_MESSAGES.

-- Devuelve la casa bloqueada para la acción (for update) o falla con el mensaje que toca.
create or replace function public.admin_house_for_action(p_listing uuid) returns public.listings
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
begin
  if not public.is_admin() then
    if coalesce((select is_admin from public.profiles where id = auth.uid()), false) then
      raise exception 'Confirme el segundo código para revisar anuncios.';
    end if;
    raise exception 'Solo bnbtico puede revisar anuncios.';
  end if;
  select * into l from public.listings where id = p_listing and deleted_at is null for update;
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  return l;
end $$;
revoke all on function public.admin_house_for_action(uuid) from public, anon, authenticated;

create or replace function public.admin_hold_reason_text(p_reason text) returns text
language plpgsql immutable set search_path = '' as $$
declare
  r text := left(btrim(coalesce(p_reason, '')), 2000);
begin
  if r = '' then raise exception 'Escriba el motivo (hasta 2000 caracteres).'; end if;
  return r;
end $$;
revoke all on function public.admin_hold_reason_text(text) from public, anon, authenticated;

-- Pausar: de Activa, Pendiente de pago o Inactiva; la suscripción no cambia. Sobre una pausada cambia el motivo.
create or replace function public.admin_pause_listing(p_listing uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings := public.admin_house_for_action(p_listing);
  reason text := public.admin_hold_reason_text(p_reason);
begin
  if not public.listing_status_published(l.status, l.first_published_at) then raise exception 'Solo se puede pausar o bloquear una casa publicada.'; end if;
  if l.admin_hold = 'blocked' then raise exception 'Esta casa está bloqueada: desbloquéela antes de pausarla.'; end if;
  if l.admin_hold = 'paused' then raise exception 'Esta casa ya está pausada.'; end if;
  perform set_config('app.allow_status', 'on', true);
  update public.listings set admin_hold = 'paused', admin_hold_reason = reason, admin_hold_at = now() where id = p_listing;
  insert into public.admin_actions (admin_id, action, target_listing_id, reason) values (auth.uid(), 'listing.pause', p_listing, reason);
  perform public.purge_listing_page(l.public_id);
end $$;

create or replace function public.admin_resume_listing(p_listing uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings := public.admin_house_for_action(p_listing);
begin
  if l.admin_hold is distinct from 'paused' then raise exception 'Esta casa no está pausada.'; end if;
  perform set_config('app.allow_status', 'on', true);
  update public.listings set admin_hold = null, admin_hold_reason = null, admin_hold_at = null where id = p_listing;
  insert into public.admin_actions (admin_id, action, target_listing_id) values (auth.uid(), 'listing.resume', p_listing);
  perform public.purge_listing_page(l.public_id);
end $$;

-- Bloquear: lo mismo para el público, el propietario no la edita y la suscripción se para: los avisos en cola se borran y
-- run_subscription_day/claim_reminders la ignoran mientras dure. Desde una pausada pasa a bloqueada.
create or replace function public.admin_block_listing(p_listing uuid, p_reason text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings := public.admin_house_for_action(p_listing);
  reason text := public.admin_hold_reason_text(p_reason);
begin
  if not public.listing_status_published(l.status, l.first_published_at) then raise exception 'Solo se puede pausar o bloquear una casa publicada.'; end if;
  if l.admin_hold = 'blocked' then raise exception 'Esta casa ya está bloqueada.'; end if;
  perform set_config('app.allow_status', 'on', true);
  update public.listings set admin_hold = 'blocked', admin_hold_reason = reason, admin_hold_at = now() where id = p_listing;
  delete from public.subscription_reminders where listing_id = p_listing and status = 'queued';
  insert into public.admin_actions (admin_id, action, target_listing_id, reason) values (auth.uid(), 'listing.block', p_listing, reason);
  perform public.purge_listing_page(l.public_id);
end $$;

-- Desbloquear: la casa vuelve al estado en que estaba (Activa, Pendiente de pago o Inactiva) y la oferta gratuita no se
-- consume mientras estuvo bloqueada: su último día gratis se corre tantos días como duró el bloqueo.
create or replace function public.admin_unblock_listing(p_listing uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings := public.admin_house_for_action(p_listing);
  blocked_days int;
begin
  if l.admin_hold is distinct from 'blocked' then raise exception 'Esta casa no está bloqueada.'; end if;
  blocked_days := greatest(public.costa_rica_today() - (l.admin_hold_at at time zone 'America/Costa_Rica')::date, 0);
  perform set_config('app.allow_status', 'on', true);
  update public.subscriptions set promo_ends_on = promo_ends_on + blocked_days
   where listing_id = p_listing and plan = 'promo' and promo_ends_on is not null;
  -- Una pendiente de pago cuyo propietario puso método mientras estaba bloqueada se activa ahora, como al añadir el método.
  if l.status = 'payment_due' and public.owner_has_payment_method(l.owner_id) then
    update public.subscriptions set plan = 'paid', paid_since = coalesce(paid_since, public.costa_rica_today()) where listing_id = p_listing;
    update public.listings set status = 'active' where id = p_listing;
  end if;
  update public.listings set admin_hold = null, admin_hold_reason = null, admin_hold_at = null where id = p_listing;
  insert into public.admin_actions (admin_id, action, target_listing_id) values (auth.uid(), 'listing.unblock', p_listing);
  perform public.purge_listing_page(l.public_id);
end $$;

-- Eliminar: borrado lógico en cualquier estado, con el código CT-#### como confirmación. Los datos, fotos y consultas se
-- conservan; se recupera por SQL (deleted_at = null).
create or replace function public.admin_delete_listing(p_listing uuid, p_reason text, p_confirm text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings := public.admin_house_for_action(p_listing);
  reason text := public.admin_hold_reason_text(p_reason);
begin
  if upper(btrim(coalesce(p_confirm, ''))) is distinct from l.public_id then raise exception 'Escriba el código de la casa (CT-####) para confirmar.'; end if;
  perform set_config('app.allow_status', 'on', true);
  update public.listings set deleted_at = now(), deleted_reason = reason where id = p_listing;
  delete from public.subscription_reminders where listing_id = p_listing and status = 'queued';
  insert into public.admin_actions (admin_id, action, target_listing_id, reason) values (auth.uid(), 'listing.delete', p_listing, reason);
  perform public.purge_listing_page(l.public_id);
end $$;

revoke all on function public.admin_pause_listing(uuid, text), public.admin_resume_listing(uuid), public.admin_block_listing(uuid, text),
  public.admin_unblock_listing(uuid), public.admin_delete_listing(uuid, text, text) from public, anon;
grant execute on function public.admin_pause_listing(uuid, text), public.admin_resume_listing(uuid), public.admin_block_listing(uuid, text),
  public.admin_unblock_listing(uuid), public.admin_delete_listing(uuid, text, text) to authenticated, service_role;

-- Subir fotos a una casa publicada: tampoco si está bloqueada o eliminada.
create or replace function public.listing_photo_uploadable(p_listing uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select public.listing_editable(p_listing) or exists (
    select 1 from public.listings l
    where l.id = p_listing and l.owner_id = auth.uid() and public.listing_status_published(l.status, l.first_published_at)
      and l.deleted_at is null and l.admin_hold is distinct from 'blocked')
$$;

-- Ni siquiera el admin lee la suscripción ni los avisos de una casa eliminada (sus filas siguen en la base).
drop policy subscriptions_owner_select on public.subscriptions;
create policy subscriptions_owner_select on public.subscriptions for select to public
  using (exists (select 1 from public.listings l where l.id = subscriptions.listing_id and (l.owner_id = auth.uid() or public.is_admin())));
drop policy reminders_owner_select on public.subscription_reminders;
create policy reminders_owner_select on public.subscription_reminders for select to public
  using (exists (select 1 from public.listings l where l.id = subscription_reminders.listing_id and (l.owner_id = auth.uid() or public.is_admin())));
