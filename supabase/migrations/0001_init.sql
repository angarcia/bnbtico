-- bnbtico · esquema inicial v1 (Postgres / Supabase) · 2026-10-15
-- Derivado del prototipo (design/prototype, vista Móvil) y de docs/plan-implementacion.md.
-- Dinero: enteros en colones (CRC). Los dólares son solo visualización en el cliente.
-- Sin Veriff en v1 (v1.1); sin cobro real (la tarjeta se tokeniza en la pasarela, no se carga aquí).

create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type listing_kind as enum ('casa','apartamento','habitacion');
-- Estados de una casa (prototipo: estados-casa.js). 'review' = Pendiente de revisión; 'changes' = cambios pedidos;
-- 'payment_due' = Pendiente de pago; 'active' = Activa; 'inactive' = Inactiva (el propietario paró la suscripción).
create type listing_status as enum ('draft','review','changes','rejected','payment_due','active','inactive');
-- Características: una sola lista, igual al publicar y al filtrar (prototipo: caracteristicas.js).
create type feature as enum ('pool','pets','wifi','ac','parking','ev','kids_free','beachfront','bbq');
create type tariff as enum ('base','high','low','special');
create type plan as enum ('promo','paid');
create type request_status as enum ('open','closed','expired');

-- ---------- Usuarios ----------
-- Una cuenta = un WhatsApp verificado. La misma persona puede ser cliente y propietario.
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text not null unique,                        -- E.164, el WhatsApp verificado por código
  phone_verified_at timestamptz,
  is_owner boolean not null default false,            -- se activa al publicar la primera casa
  is_admin boolean not null default false,
  is_active boolean not null default true,            -- desactivación por admin, con motivo en admin_actions
  email text,                                         -- correo de recuperación, opcional
  description text,                                   -- «contanos un poco sobre vos», opcional
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------- Casas ----------
create sequence listing_public_seq start 1000;
create table listings (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default ('CT-' || nextval('listing_public_seq')::text),
  owner_id uuid not null references profiles(id) on delete cascade,
  status listing_status not null default 'draft',
  kind listing_kind not null default 'casa',
  title text not null,
  description text not null default '',
  province text not null,                             -- 'Limón' por defecto en Explorar; solo provincias con casas en filtros
  zone text,                                          -- p. ej. 'Manzanillo'
  address_private text,                               -- la dirección exacta la comparte el propietario; nunca pública
  lat double precision,                               -- ubicación aproximada (jitter ~500 m)
  lng double precision,
  capacity int not null check (capacity > 0),
  bedrooms int not null check (bedrooms >= 0),
  bathrooms int not null check (bathrooms >= 0),
  features feature[] not null default '{}',
  nightly_price_crc int not null check (nightly_price_crc > 0),
  accepts_monthly boolean not null default false,
  monthly_price_crc int check (monthly_price_crc is null or monthly_price_crc > 0),  -- null con accepts_monthly = «consultar»
  whatsapp_phone text not null,                       -- número verificado de esta casa (se copia del perfil al crear)
  direct_contact boolean not null default true,
  available boolean not null default true,            -- «No disponible» cierra consultas nuevas sin ocultar la ficha
  reopen_at date,                                     -- reapertura automática a medianoche CR; null = manual
  review_note text,                                   -- motivo de cambios/rechazo para el propietario
  reviewed_at timestamptz,
  reviewed_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on listings (status, province);
create index on listings using gin (features);
create index on listings (owner_id);

create table listing_photos (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  path text not null,                                 -- Storage: listings/<listing_id>/<uuid>.jpg
  position int not null default 0,
  created_at timestamptz not null default now()
);
create index on listing_photos (listing_id, position);

-- Tarifas compartidas por casa (prototipo: calendar.js). Fin de semana = viernes y sábado; null usa el precio por noche.
create table listing_rates (
  listing_id uuid primary key references listings(id) on delete cascade,
  base_weekend_crc int,
  high_price_crc int, high_weekend_crc int, high_from date, high_to date,
  low_price_crc int,  low_weekend_crc int,  low_from date,  low_to date,
  check ((high_price_crc is null) or (high_from is not null and high_to is not null)),
  check ((low_price_crc is null) or (low_from is not null and low_to is not null))
);

-- Estado por día: solo se guardan los días que difieren del valor por defecto (disponible, tarifa por fechas).
create table listing_days (
  listing_id uuid not null references listings(id) on delete cascade,
  day date not null,
  available boolean not null default true,
  special_price_crc int check (special_price_crc is null or special_price_crc > 0),  -- ★ precio especial del día
  primary key (listing_id, day)
);

create table favorites (
  user_id uuid not null references profiles(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, listing_id)
);

-- ---------- Consultas (cliente → propietario por WhatsApp) ----------
-- Se registra la apertura de WhatsApp; la conversación ocurre fuera de bnbtico.
create table inquiries (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  client_id uuid not null references profiles(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  arrival date,
  departure date,
  people int check (people is null or people > 0),
  message text not null default '',                   -- el texto tal cual se abrió en WhatsApp
  consent_share_phone boolean not null default true,
  created_at timestamptz not null default now(),
  check (arrival is null or departure is null or departure > arrival)
);
create index on inquiries (owner_id, created_at desc);
create index on inquiries (client_id, listing_id, created_at desc);

-- ---------- Suscripción por casa ----------
-- Oferta de lanzamiento: 50 primeras casas 12 meses, siguientes 50 → 6, siguientes 100 → 3; después ₡9.900/mes.
create table subscriptions (
  listing_id uuid primary key references listings(id) on delete cascade,
  plan plan not null default 'promo',
  promo_months int,
  promo_ends_at timestamptz,
  monthly_price_crc int not null default 9900,
  payment_method_token text,                          -- token de la pasarela; nunca datos de tarjeta
  payment_method_added_at timestamptz,
  stopped_at timestamptz,                             -- el propietario paró la suscripción → casa inactiva
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Avisos de fin de oferta (90/30/7/0 días), en la app y por WhatsApp.
create table subscription_reminders (
  listing_id uuid not null references listings(id) on delete cascade,
  days_before int not null check (days_before in (90,30,7,0)),
  sent_at timestamptz not null default now(),
  channel text not null default 'whatsapp',
  primary key (listing_id, days_before)
);

-- ---------- «Buscan casa» (búsqueda asistida) ----------
create table requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  province text,
  zone text,
  people int not null check (people > 0),
  arrival date,
  departure date,
  must_have feature[] not null default '{}',
  budget_total_crc int,
  notes text not null default '',
  consent_whatsapp boolean not null default false,    -- hasta 10 propietarios compatibles pueden escribirle
  max_owners int not null default 10,
  status request_status not null default 'open',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create table request_matches (
  request_id uuid not null references requests(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  seen_at timestamptz,
  contacted_at timestamptz,
  primary key (request_id, listing_id)
);
create index on request_matches (owner_id, contacted_at);

-- ---------- Admin ----------
create table admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references profiles(id),
  action text not null,                               -- 'listing.approve' | 'listing.changes' | 'listing.reject' | 'user.deactivate' | 'user.reactivate'
  target_listing_id uuid references listings(id) on delete set null,
  target_user_id uuid references profiles(id) on delete set null,
  reason text,
  created_at timestamptz not null default now()
);

-- ---------- Perfil automático ----------
-- El perfil nace con el usuario de auth (la app manda el nombre como metadato al pedir el código) y se marca
-- «WhatsApp verificado» cuando Supabase confirma el teléfono. Así nunca hay sesión sin perfil.
create or replace function handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.phone is null then return new; end if;
  insert into public.profiles (id, full_name, phone, phone_verified_at)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''), '+' || new.phone, new.phone_confirmed_at)
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();

create or replace function handle_phone_confirmed() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.phone is not null and new.phone_confirmed_at is not null and old.phone_confirmed_at is null then
    update public.profiles set phone_verified_at = coalesce(phone_verified_at, new.phone_confirmed_at), phone = '+' || new.phone where id = new.id;
  end if;
  return new;
end $$;
create trigger on_auth_user_phone_confirmed after update of phone_confirmed_at on auth.users for each row execute function handle_phone_confirmed();

-- ---------- updated_at ----------
create or replace function set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger profiles_updated before update on profiles for each row execute function set_updated_at();
create trigger listings_updated before update on listings for each row execute function set_updated_at();
create trigger subscriptions_updated before update on subscriptions for each row execute function set_updated_at();

-- ---------- Reglas de negocio ----------
-- Una ficha es pública solo si está activa y el propietario no la ha parado.
create or replace function listing_is_public(l listings) returns boolean language sql stable as $$
  select l.status = 'active'
$$;

-- Estado derivado de la suscripción (prototipo: houseState). Se evalúa en un job diario y al leer.
create or replace function subscription_state(s subscriptions) returns text language sql stable as $$
  select case
    when s.stopped_at is not null then 'inactive'
    when s.plan = 'promo' and s.promo_ends_at > now() then 'active'
    when s.payment_method_token is not null then 'active'
    else 'payment_due'
  end
$$;

-- ---------- RLS ----------
alter table profiles enable row level security;
alter table listings enable row level security;
alter table listing_photos enable row level security;
alter table listing_rates enable row level security;
alter table listing_days enable row level security;
alter table favorites enable row level security;
alter table inquiries enable row level security;
alter table subscriptions enable row level security;
alter table subscription_reminders enable row level security;
alter table requests enable row level security;
alter table request_matches enable row level security;
alter table admin_actions enable row level security;

create or replace function is_admin() returns boolean language sql stable as $$
  select coalesce((select is_admin from profiles where id = auth.uid()), false)
$$;

-- Perfil: cada quien el suyo; admin todos.
create policy profiles_self_select on profiles for select using (id = auth.uid() or is_admin());
create policy profiles_self_insert on profiles for insert with check (id = auth.uid());
create policy profiles_self_update on profiles for update using (id = auth.uid()) with check (id = auth.uid());

-- Casas: las activas son públicas (sin número: ver vista listings_public); el dueño ve y edita las suyas; admin todo.
create policy listings_public_select on listings for select using (status = 'active' or owner_id = auth.uid() or is_admin());
create policy listings_owner_insert on listings for insert with check (owner_id = auth.uid());
create policy listings_owner_update on listings for update using (owner_id = auth.uid() or is_admin());

create policy photos_select on listing_photos for select using (
  exists (select 1 from listings l where l.id = listing_id and (l.status = 'active' or l.owner_id = auth.uid() or is_admin())));
create policy photos_owner_write on listing_photos for all using (
  exists (select 1 from listings l where l.id = listing_id and l.owner_id = auth.uid()));

create policy rates_select on listing_rates for select using (
  exists (select 1 from listings l where l.id = listing_id and (l.status = 'active' or l.owner_id = auth.uid() or is_admin())));
create policy rates_owner_write on listing_rates for all using (
  exists (select 1 from listings l where l.id = listing_id and l.owner_id = auth.uid()));
create policy days_select on listing_days for select using (
  exists (select 1 from listings l where l.id = listing_id and (l.status = 'active' or l.owner_id = auth.uid() or is_admin())));
create policy days_owner_write on listing_days for all using (
  exists (select 1 from listings l where l.id = listing_id and l.owner_id = auth.uid()));

create policy favorites_self on favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Consultas: las crea el cliente (con sesión); las ven cliente y propietario.
create policy inquiries_insert on inquiries for insert with check (client_id = auth.uid());
create policy inquiries_select on inquiries for select using (client_id = auth.uid() or owner_id = auth.uid() or is_admin());

create policy subscriptions_owner_select on subscriptions for select using (
  exists (select 1 from listings l where l.id = listing_id and l.owner_id = auth.uid()) or is_admin());
create policy reminders_owner_select on subscription_reminders for select using (
  exists (select 1 from listings l where l.id = listing_id and l.owner_id = auth.uid()) or is_admin());

create policy requests_client on requests for all using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy matches_owner_select on request_matches for select using (owner_id = auth.uid() or is_admin());
create policy matches_client_select on request_matches for select using (
  exists (select 1 from requests r where r.id = request_id and r.client_id = auth.uid()));

create policy admin_actions_admin on admin_actions for all using (is_admin()) with check (is_admin());

-- Vista pública de fichas: sin número de WhatsApp ni dirección (el número se entrega al contactar, con sesión).
create view listings_public as
  select l.id, l.public_id, l.kind, l.title, l.description, l.province, l.zone, l.lat, l.lng,
         l.capacity, l.bedrooms, l.bathrooms, l.features, l.nightly_price_crc, l.accepts_monthly, l.monthly_price_crc,
         l.available, l.reopen_at, l.created_at,
         p.full_name as owner_name, (p.phone_verified_at is not null) as owner_whatsapp_verified
  from listings l join profiles p on p.id = l.owner_id
  where l.status = 'active';
