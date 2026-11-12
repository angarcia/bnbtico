-- bnbtico · fase 5, ticket 02: suscripción por casa, avisos (outbox) y método de pago · 2026-10-27
--
-- 1) subscriptions y subscription_reminders (vacías en todos los entornos) se rehacen: plaza de la oferta de lanzamiento
--    (promo_slot, la toma la primera aprobación y se conserva para siempre), último día gratis (promo_ends_on, día de
--    Costa Rica) y comienzo del plan de pago (paid_since). La tarifa pasa a ₡2 900 (decisión 2026-10-27). Los avisos son
--    un outbox: pg_cron los encola, el worker los reclama, los envía y los marca.
-- 2) payment_methods (uno por propietario, solo ids opacos de la pasarela y marca/últimos 4/vencimiento),
--    payment_customers y payment_events (idempotencia de los webhooks). Nada de esto se escribe desde el navegador.
-- 3) Relleno: las casas que ya se publicaron alguna vez toman plaza en orden de first_published_at.
-- 4) RPCs: toda transición de estado pasa por una función (review_listing, stop/resume_subscription, run_subscription_day,
--    apply_payment_event). Mensajes idénticos a SUBSCRIPTION_MESSAGES (apps/app/src/domain/subscription.ts).
--    El texto del WhatsApp no se compone aquí: claim_reminders devuelve los datos y el worker lo compone con
--    reminderWhatsApp del dominio; finish_reminders guarda el número y el texto enviados.
-- 5) La purga de la ficha también salta en los cambios entre pendiente de pago e inactiva (cambia el motivo del 410).
-- «Hoy» es siempre el día de Costa Rica.

-- ---------- 1. Suscripción ----------
alter table public.subscriptions
  add column promo_slot int unique check (promo_slot between 1 and 200),
  add column promo_ends_on date,
  add column paid_since date,
  drop column promo_ends_at,
  drop column payment_method_token,
  drop column payment_method_added_at,
  alter column monthly_price_crc set default 2900;
alter table public.subscriptions add constraint subscriptions_promo_complete
  check (promo_slot is null or (promo_months is not null and promo_ends_on is not null));

drop function if exists public.subscription_state(public.subscriptions);

alter table public.subscription_reminders
  add column id uuid not null default gen_random_uuid() unique,
  add column promo_ends_on date,
  add column queued_at timestamptz not null default now(),
  add column status text not null default 'queued' check (status in ('queued','sending','sent','failed','unknown','skipped')),
  add column attempts int not null default 0,
  add column claimed_at timestamptz,
  add column to_phone text,
  add column body text,
  add column provider_ref text,
  add column last_error text;
alter table public.subscription_reminders alter column sent_at drop not null, alter column sent_at drop default;
create index subscription_reminders_queue on public.subscription_reminders (status, queued_at);

-- ---------- 2. Método de pago ----------
create table public.payment_methods (
  owner_id uuid primary key references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('stripe','fake')),
  customer_ref text not null,
  method_ref text not null,
  brand text not null,
  last4 char(4) not null check (last4 ~ '^[0-9]{4}$'),
  exp_month int not null check (exp_month between 1 and 12),
  exp_year int not null check (exp_year between 2000 and 2100),
  added_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger payment_methods_updated before update on public.payment_methods for each row execute function public.set_updated_at();

create table public.payment_customers (
  owner_id uuid not null references public.profiles(id) on delete cascade,
  provider text not null check (provider in ('stripe','fake')),
  customer_ref text not null,
  created_at timestamptz not null default now(),
  primary key (owner_id, provider)
);

create table public.payment_events (
  provider text not null check (provider in ('stripe','fake')),
  event_id text not null,
  type text not null,
  owner_id uuid references public.profiles(id) on delete set null,
  received_at timestamptz not null default now(),
  result text not null default 'applied',
  unique (provider, event_id)
);

alter table public.payment_methods enable row level security;
alter table public.payment_customers enable row level security;
alter table public.payment_events enable row level security;

create policy payment_methods_owner_select on public.payment_methods for select using (owner_id = auth.uid() or public.is_admin());

-- ---------- Permisos: nada se escribe por REST; los ids de la pasarela no se leen desde el navegador ----------
revoke all on table public.subscriptions, public.subscription_reminders, public.payment_methods, public.payment_customers, public.payment_events
  from public, anon, authenticated;
grant select on table public.subscriptions to authenticated;
grant select (listing_id, days_before, promo_ends_on, queued_at, status, sent_at) on table public.subscription_reminders to authenticated;
grant select (owner_id, provider, brand, last4, exp_month, exp_year, added_at) on table public.payment_methods to authenticated;

-- ---------- 3. Relleno ----------
-- Solo inserta en subscriptions (no toca listings: no hace falta app.allow_status). Las casas que ya se publicaron
-- alguna vez (first_published_at, también si ahora se están editando) toman plaza en ese orden; su oferta empieza el día
-- (Costa Rica) de la primera publicación.
with ordered as (
  select l.id,
         coalesce((select max(promo_slot) from public.subscriptions), 0)
           + row_number() over (order by l.first_published_at, l.created_at, l.id) as slot,
         (l.first_published_at at time zone 'America/Costa_Rica')::date as day
    from public.listings l
   where l.first_published_at is not null
     and not exists (select 1 from public.subscriptions s where s.listing_id = l.id)
), tiered as (
  select o.*, case when o.slot <= 50 then 12 when o.slot <= 100 then 6 when o.slot <= 200 then 3 end as months from ordered o
)
insert into public.subscriptions (listing_id, plan, promo_slot, promo_months, promo_ends_on)
select t.id,
       (case when t.months is null then 'paid' else 'promo' end)::public.plan,
       case when t.months is null then null else t.slot end,
       t.months,
       case when t.months is null then null else (t.day + make_interval(months => t.months))::date end
  from tiered t;

-- ---------- 4. Funciones ----------
create or replace function public.costa_rica_today() returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Costa_Rica')::date
$$;

create or replace function public.owner_has_payment_method(p_owner uuid) returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.payment_methods m where m.owner_id = p_owner)
$$;
revoke all on function public.owner_has_payment_method(uuid) from public, anon, authenticated;

-- Aprobación: la primera vez toma la siguiente plaza (bajo un candado: dos aprobaciones a la vez nunca comparten plaza).
-- Estado por la regla de aprobar: activa si la oferta sigue o el propietario tiene método; si no, pendiente de pago.
-- Volver a aprobar tras editar reutiliza la suscripción. Copia de 20261027060732_primera_publicacion con eso añadido.
create or replace function public.review_listing(p_listing uuid, p_decision text, p_note text) returns public.listing_status
language plpgsql security definer set search_path = '' as $$
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
    raise exception 'Solo bnbtico puede revisar anuncios.';
  end if;
  select * into l from public.listings where id = p_listing;
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if l.status <> 'review' then raise exception 'Este anuncio ya tiene una decisión.'; end if;
  if p_decision not in ('approve','changes','reject') then raise exception 'Decisión no válida.'; end if;
  if p_decision <> 'approve' and note = '' then raise exception 'Escriba un motivo de hasta 2000 caracteres para pedir cambios o rechazar.'; end if;
  if p_decision = 'approve' then
    select count(*) into n_photos from public.listing_photos where listing_id = p_listing;
    if n_photos < 5 then raise exception 'Pida al menos 5 fotos antes de aprobar.'; end if;

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
end $$;

-- Facturación del propietario de la sesión: sus casas con suscripción, su método de pago (sin ids de la pasarela) y hoy.
create or replace function public.owner_billing() returns jsonb language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'houses', coalesce((
      select jsonb_agg(jsonb_build_object(
          'listing_id', l.id, 'public_id', l.public_id, 'title', l.title, 'status', l.status, 'plan', s.plan,
          'promo_slot', s.promo_slot, 'promo_months', s.promo_months, 'promo_ends_on', s.promo_ends_on,
          'paid_since', s.paid_since, 'stopped_on', (s.stopped_at at time zone 'America/Costa_Rica')::date,
          'monthly_price_crc', s.monthly_price_crc,
          'reminders', coalesce((
            select jsonb_agg(jsonb_build_object('days_before', r.days_before, 'status', r.status, 'sent_at', r.sent_at) order by r.days_before desc)
              from public.subscription_reminders r where r.listing_id = l.id), '[]'::jsonb))
        order by l.created_at desc)
        from public.listings l join public.subscriptions s on s.listing_id = l.id
       where l.owner_id = auth.uid()), '[]'::jsonb),
    'method', (
      select jsonb_build_object('brand', m.brand, 'last4', m.last4, 'exp_month', m.exp_month, 'exp_year', m.exp_year, 'added_at', m.added_at)
        from public.payment_methods m where m.owner_id = auth.uid()),
    'today', public.costa_rica_today())
$$;

create or replace function public.stop_subscription(p_listing uuid) returns public.listing_status
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
begin
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
end $$;

create or replace function public.resume_subscription(p_listing uuid) returns public.listing_status
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
  s public.subscriptions;
  today date := public.costa_rica_today();
  promo boolean;
  has_method boolean;
  next_status public.listing_status;
begin
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
end $$;

-- Plazas asignadas de la oferta (el contador «Quedan N de 50»): la más alta, porque una plaza no se reutiliza.
create or replace function public.launch_offer_taken() returns int language sql stable security definer set search_path = '' as $$
  select coalesce(max(promo_slot), 0)::int from public.subscriptions
$$;

-- Motivo del 410 de una ficha bloqueada; null si el enlace no está bloqueado (activa o inexistente).
-- Aparte de listing_link_state, cuyos valores no cambian (la app vieja la usa).
create or replace function public.listing_blocked_reason(p_public_id text) returns text language sql stable security definer set search_path = '' as $$
  select case
    when public.listing_link_state(p_public_id) is distinct from 'blocked' then null
    when l.status = 'inactive' then 'stopped'
    when l.status = 'payment_due' then 'payment'
    else 'other'
  end
  from public.listings l where l.public_id = p_public_id
$$;

-- Trabajo diario (pg_cron, 00:05 en Costa Rica): (1) fin de la oferta de las casas activas: con método pasan al plan de
-- pago y siguen activas; sin método, pendientes de pago. (2) Avisos: las activas con oferta y sin método dentro de los
-- 90 días encolan el umbral en el que están (el más pequeño ≥ días restantes); la clave (casa, umbral) impide encolarlo
-- dos veces. Si un día no corrió, los umbrales ya pasados no se mandan.
create or replace function public.run_subscription_day(p_today date default null) returns jsonb
language plpgsql security definer set search_path = '' as $$
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
     and public.owner_has_payment_method(l.owner_id);
  get diagnostics n_paid = row_count;

  update public.listings l set status = 'payment_due'
    from public.subscriptions s
   where s.listing_id = l.id and l.status = 'active' and s.plan = 'promo' and s.promo_ends_on < today
     and not public.owner_has_payment_method(l.owner_id);
  get diagnostics n_due = row_count;

  insert into public.subscription_reminders (listing_id, days_before, promo_ends_on, status, queued_at)
  select s.listing_id,
         case when s.promo_ends_on - today = 0 then 0 when s.promo_ends_on - today <= 7 then 7
              when s.promo_ends_on - today <= 30 then 30 else 90 end,
         s.promo_ends_on, 'queued', now()
    from public.subscriptions s join public.listings l on l.id = s.listing_id
   where l.status = 'active' and s.plan = 'promo' and s.promo_ends_on - today between 0 and 90
     and not public.owner_has_payment_method(l.owner_id)
  on conflict (listing_id, days_before) do nothing;
  get diagnostics n_queued = row_count;

  return jsonb_build_object('paid', n_paid, 'payment_due', n_due, 'queued', n_queued);
end $$;

-- Reclama hasta p_limit avisos en cola (los más antiguos; las filas que otra sesión tiene tomadas se saltan). Los de
-- casas que ya no son activas con oferta y sin método (el propietario añadió tarjeta o la paró), o de cuentas
-- desactivadas, se marcan como omitidos y no vuelven. Una fila «sending» nunca se vuelve a reclamar.
create or replace function public.claim_reminders(p_limit int default 20)
returns table (id uuid, listing_id uuid, public_id text, title text, owner_name text, to_phone text, days_before int, promo_ends_on date)
language plpgsql security definer set search_path = '' as $$
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
           (l.status = 'active' and s.plan = 'promo' and p.is_active and not public.owner_has_payment_method(l.owner_id)) as eligible
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
end $$;

-- Resultado del envío, por aviso: sent (con provider_ref, número y texto enviados), retry (la pasarela lo rechazó antes
-- de aceptarlo: vuelve a la cola hasta 5 intentos, luego failed), unknown (sin respuesta: nunca se reintenta solo) o
-- skipped (p. ej. fuera de la lista de números permitidos en pruebas). Solo cambia filas «sending». Devuelve cuántas.
create or replace function public.finish_reminders(p_results jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  item jsonb;
  outcome text;
  k int;
  n int := 0;
begin
  for item in select * from jsonb_array_elements(coalesce(p_results, '[]'::jsonb)) loop
    outcome := item->>'outcome';
    if outcome not in ('sent','retry','unknown','skipped') then raise exception 'Resultado de envío no válido.'; end if;
    update public.subscription_reminders r set
      status = case outcome when 'sent' then 'sent' when 'unknown' then 'unknown' when 'skipped' then 'skipped'
                            else case when r.attempts < 5 then 'queued' else 'failed' end end,
      sent_at = case when outcome = 'sent' then now() else r.sent_at end,
      provider_ref = case when outcome = 'sent' then item->>'provider_ref' else r.provider_ref end,
      to_phone = coalesce(item->>'to_phone', r.to_phone),
      body = coalesce(item->>'body', r.body),
      last_error = case when outcome = 'sent' then null else left(item->>'error', 500) end
    where r.id = (item->>'id')::uuid and r.status = 'sending';
    get diagnostics k = row_count;
    n := n + k;
  end loop;
  return n;
end $$;

-- Lo que el worker necesita para abrir la sesión de la pasarela, con el JWT del usuario (PostgREST valida la sesión).
create or replace function public.payment_setup_context(p_provider text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  p public.profiles;
begin
  if p_provider not in ('stripe','fake') then raise exception 'Pasarela de pago no válida.'; end if;
  select * into p from public.profiles where id = auth.uid();
  if not found then raise exception 'Su sesión venció. Ingrese de nuevo.'; end if;
  if not p.is_active then raise exception 'Su cuenta está desactivada. Escríbanos por WhatsApp.'; end if;
  return jsonb_build_object('owner_id', p.id, 'full_name', p.full_name, 'phone', p.phone,
    'customer_ref', (select c.customer_ref from public.payment_customers c where c.owner_id = p.id and c.provider = p_provider));
end $$;

create or replace function public.save_payment_customer(p_owner uuid, p_provider text, p_ref text) returns void
language sql security definer set search_path = '' as $$
  insert into public.payment_customers (owner_id, provider, customer_ref) values (p_owner, p_provider, p_ref)
  on conflict (owner_id, provider) do update set customer_ref = excluded.customer_ref
$$;

-- Evento del webhook ya verificado. Cada (pasarela, evento) se aplica una sola vez ('duplicate' si ya llegó). Un tipo
-- desconocido o incompleto se registra y no hace nada ('ignored'). 'setup_completed' guarda el método del propietario y
-- pasa a activas, con el plan de pago desde hoy, todas sus casas pendientes de pago (las que tienen oferta siguen igual).
create or replace function public.apply_payment_event(
  p_provider text, p_event_id text, p_type text, p_owner uuid default null, p_customer_ref text default null,
  p_method_ref text default null, p_brand text default null, p_last4 text default null, p_exp_month int default null, p_exp_year int default null
) returns text
language plpgsql security definer set search_path = '' as $$
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
    from public.listings l where l.id = s.listing_id and l.owner_id = p_owner and l.status = 'payment_due';
  perform set_config('app.allow_status', 'on', true);
  update public.listings set status = 'active' where owner_id = p_owner and status = 'payment_due';
  return 'applied';
end $$;

-- Reloj de pruebas: deja a una casa con N días de oferta (negativo: ya terminó; la expira el siguiente
-- run_subscription_day). No cambia el estado. Solo con el secreto bnbtico_test_clock = 'on' en Vault, que existe en
-- pruebas y local y nunca en producción. Devuelve el nuevo último día gratis.
create or replace function public.test_set_offer_days_left(p_public_id text, p_days_left int) returns date
language plpgsql security definer set search_path = '' as $$
declare
  ends date;
begin
  if coalesce((select decrypted_secret from vault.decrypted_secrets where name = 'bnbtico_test_clock' limit 1), '') <> 'on' then
    raise exception 'El reloj de pruebas no está habilitado.';
  end if;
  update public.subscriptions s set promo_ends_on = public.costa_rica_today() + p_days_left
    from public.listings l where l.id = s.listing_id and l.public_id = p_public_id and s.plan = 'promo'
  returning s.promo_ends_on into ends;
  if ends is null then raise exception 'No encontramos ese anuncio.'; end if;
  return ends;
end $$;

-- Permisos de las funciones (Supabase concede ejecución a anon y authenticated por defecto).
revoke all on function public.costa_rica_today() from public, anon, authenticated;
revoke all on function public.owner_billing() from public, anon, authenticated;
revoke all on function public.stop_subscription(uuid) from public, anon, authenticated;
revoke all on function public.resume_subscription(uuid) from public, anon, authenticated;
revoke all on function public.launch_offer_taken() from public, anon, authenticated;
revoke all on function public.listing_blocked_reason(text) from public, anon, authenticated;
revoke all on function public.run_subscription_day(date) from public, anon, authenticated;
revoke all on function public.claim_reminders(int) from public, anon, authenticated;
revoke all on function public.finish_reminders(jsonb) from public, anon, authenticated;
revoke all on function public.payment_setup_context(text) from public, anon, authenticated;
revoke all on function public.save_payment_customer(uuid, text, text) from public, anon, authenticated;
revoke all on function public.apply_payment_event(text, text, text, uuid, text, text, text, text, int, int) from public, anon, authenticated;
revoke all on function public.test_set_offer_days_left(text, int) from public, anon, authenticated;

grant execute on function public.owner_billing() to authenticated;
grant execute on function public.stop_subscription(uuid) to authenticated;
grant execute on function public.resume_subscription(uuid) to authenticated;
grant execute on function public.payment_setup_context(text) to authenticated;
grant execute on function public.launch_offer_taken() to anon, authenticated;
grant execute on function public.listing_blocked_reason(text) to anon, authenticated;
grant execute on function public.costa_rica_today(), public.owner_has_payment_method(uuid), public.run_subscription_day(date),
  public.claim_reminders(int), public.finish_reminders(jsonb), public.save_payment_customer(uuid, text, text),
  public.apply_payment_event(text, text, text, uuid, text, text, text, text, int, int), public.test_set_offer_days_left(text, int)
  to service_role;

-- 06:05 UTC = 00:05 en Costa Rica, después de bnbtico-reabrir-casas. cron.schedule con un nombre existente lo sustituye.
select cron.schedule('bnbtico-suscripciones', '5 6 * * *', 'select public.run_subscription_day()');

-- ---------- 5. Purga también entre pendiente de pago e inactiva ----------
create or replace function public.listings_purge_page() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'active' then perform purge_listing_page(old.public_id); end if;
    return null;
  end if;
  if ((old.status = 'active' or new.status = 'active')
      and (to_jsonb(old) - 'updated_at') is distinct from (to_jsonb(new) - 'updated_at'))
     or (old.status is distinct from new.status
      and (old.status in ('payment_due','inactive') or new.status in ('payment_due','inactive'))) then
    perform purge_listing_page(new.public_id);
  end if;
  return null;
end $$;
