-- CasaTica · esquema inicial (Postgres / Supabase)
-- Derivado de docs/SPEC.md §6. Dinero en enteros (colones o centavos de dólar) + currency.

create extension if not exists "pgcrypto";

-- ---------- Enums ----------
create type user_role as enum ('client','owner','admin');
create type verification_status as enum ('pending','approved','rejected');
create type rental_mode as enum ('vac','largo');            -- vacacional (por noche) / largo plazo (por mes)
create type listing_kind as enum ('casa','apto','cabina','quinta');
create type listing_status as enum ('draft','review','active','paused','rejected');
create type currency as enum ('CRC','USD');
create type amenity as enum ('pool','pets','ev_charger','ac','wifi','beachfront','bbq','parking','furnished','garage','accessible','no_deposit');
create type availability_state as enum ('free','busy');
create type lead_source as enum ('listing','request');
create type request_status as enum ('open','closed','expired');
create type match_state as enum ('new','dismissed','replied');
create type subscription_status as enum ('trial','active','paused','past_due','canceled');
create type report_status as enum ('open','reviewing','closed');

-- ---------- Usuarios ----------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  role user_role not null default 'client',
  full_name text not null,
  phone text not null unique,                 -- E.164, verificado por OTP
  phone_verified_at timestamptz,
  email text,
  locale text not null default 'es-CR',
  created_at timestamptz not null default now()
);

create table owner_profiles (
  user_id uuid primary key references profiles(id) on delete cascade,
  id_number text,                              -- cédula
  id_doc_path text,                            -- storage privado
  selfie_path text,
  verification_status verification_status not null default 'pending',
  business_whatsapp text,                      -- número que abre el botón; nunca se muestra
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

create table client_scores (
  user_id uuid primary key references profiles(id) on delete cascade,
  avg numeric(3,2) not null default 0,
  count int not null default 0,
  tags jsonb not null default '{}'::jsonb      -- {"responde_rapido":5,"cumplio_fechas":4,"cuido_casa":3}
);

-- ---------- Casas ----------
create sequence listing_public_seq start 1000;
create table listings (
  id uuid primary key default gen_random_uuid(),
  public_id text not null unique default ('CT-' || nextval('listing_public_seq')::text),
  owner_id uuid not null references profiles(id) on delete cascade,
  mode rental_mode not null,
  kind listing_kind not null default 'casa',
  title text not null,
  description text not null default '',
  province text not null,
  canton text,
  zone text,
  lat double precision,                        -- ubicación aproximada (con jitter)
  lng double precision,
  capacity int not null check (capacity > 0),
  bedrooms int not null default 1,
  bathrooms int not null default 1,
  amenities amenity[] not null default '{}',
  photos text[] not null default '{}',
  currency currency not null default 'CRC',
  base_price int not null check (base_price >= 0),  -- por noche (vac) o por mes (largo)
  min_nights int not null default 1,
  status listing_status not null default 'draft',
  views_30d int not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on listings (status, mode, province);
create index on listings using gin (amenities);

create table availability (
  listing_id uuid not null references listings(id) on delete cascade,
  day date not null,
  state availability_state not null default 'free',
  price_override int,
  label text,                                  -- p. ej. 'alta'
  primary key (listing_id, day)
);

-- ---------- Contactos (leads) ----------
create table leads (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  client_id uuid not null references profiles(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  source lead_source not null default 'listing',
  request_id uuid,                             -- fk abajo
  message text,
  check_in date,
  check_out date,
  people int,
  created_at timestamptz not null default now()
);
create index on leads (owner_id, created_at desc);

create table ratings (                         -- owner valora cliente
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references leads(id) on delete cascade,
  owner_id uuid not null references profiles(id),
  client_id uuid not null references profiles(id),
  stars int not null check (stars between 1 and 5),
  tags text[] not null default '{}',
  comment text,
  created_at timestamptz not null default now()
);

-- ---------- Solicitudes (búsqueda inversa) ----------
create table requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references profiles(id) on delete cascade,
  mode rental_mode not null,
  people int not null check (people > 0),
  date_from date,
  date_to date,
  zone text,
  must_have amenity[] not null default '{}',
  budget_total int,                            -- vac: total estadía; largo: por mes
  budget_currency currency,
  text text not null default '',
  consent_whatsapp boolean not null default false,
  max_owners int not null default 10,
  status request_status not null default 'open',
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
alter table leads add constraint leads_request_fk foreign key (request_id) references requests(id) on delete set null;

create table request_matches (
  request_id uuid not null references requests(id) on delete cascade,
  listing_id uuid not null references listings(id) on delete cascade,
  owner_id uuid not null references profiles(id) on delete cascade,
  state match_state not null default 'new',
  notified_at timestamptz,
  replied_at timestamptz,
  offered_price int,
  primary key (request_id, listing_id)
);
create index on request_matches (owner_id, state);

-- ---------- Suscripciones ----------
create table subscriptions (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references profiles(id) on delete cascade,
  listing_id uuid not null unique references listings(id) on delete cascade,
  price_per_month int not null,
  currency currency not null default 'CRC',
  status subscription_status not null default 'trial',
  provider text,                               -- tilopay | onvo | greenpay
  external_id text,
  renews_at timestamptz,
  created_at timestamptz not null default now()
);

-- ---------- Moderación ----------
create table reports (
  id uuid primary key default gen_random_uuid(),
  listing_id uuid not null references listings(id) on delete cascade,
  reporter_id uuid references profiles(id),
  reason text not null,
  status report_status not null default 'open',
  created_at timestamptz not null default now()
);

create table admin_actions (
  id uuid primary key default gen_random_uuid(),
  admin_id uuid not null references profiles(id),
  target_type text not null,                   -- owner | listing | report
  target_id uuid not null,
  action text not null,                        -- approve | reject | request_info | pause
  reason text,
  created_at timestamptz not null default now()
);

-- ---------- Matching de solicitudes ----------
create or replace function match_listings_for_request(req_id uuid)
returns setof listings language sql stable as $$
  select l.*
  from listings l, requests r
  where r.id = req_id
    and l.status = 'active'
    and l.mode = r.mode
    and l.capacity >= r.people
    and l.amenities @> r.must_have
    and (r.zone is null or l.province ilike '%' || split_part(r.zone,' /',1) || '%' or l.zone ilike '%' || split_part(r.zone,' /',1) || '%')
  order by l.created_at desc
$$;

-- ---------- RLS (esqueleto; afinar en implementación) ----------
alter table profiles enable row level security;
alter table owner_profiles enable row level security;
alter table listings enable row level security;
alter table leads enable row level security;
alter table requests enable row level security;
alter table request_matches enable row level security;

create policy "listings públicos si activos" on listings for select using (status = 'active' or owner_id = auth.uid());
create policy "owner gestiona sus listings" on listings for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "perfil propio" on profiles for select using (id = auth.uid());
create policy "leads visibles a sus partes" on leads for select using (owner_id = auth.uid() or client_id = auth.uid());
create policy "cliente crea lead" on leads for insert with check (client_id = auth.uid());
create policy "solicitud propia" on requests for all using (client_id = auth.uid()) with check (client_id = auth.uid());
create policy "owner ve matches propios" on request_matches for select using (owner_id = auth.uid());
-- Nota: el número de WhatsApp del cliente se expone al owner solo vía una vista/función que compruebe
-- request_matches + consent_whatsapp + verification_status = 'approved'.
