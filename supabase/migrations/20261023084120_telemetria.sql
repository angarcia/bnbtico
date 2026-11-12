-- Telemetría de primera parte (ticket 11): Web Vitals, errores del navegador y eventos (vista de página, vista de ficha,
-- toque de WhatsApp). Solo las escribe el worker con la service role; ni anon ni authenticated pueden leerlas ni
-- escribirlas (RLS sin políticas y sin privilegios). Sin datos personales: ruta sin consulta, página, país y build.

create table public.web_vitals (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null check (name in ('LCP', 'INP', 'CLS', 'FCP', 'TTFB')),
  value double precision not null check (value >= 0),
  rating text check (rating in ('good', 'needs-improvement', 'poor')),
  metric_id text not null check (length(metric_id) <= 80),
  navigation_type text check (length(navigation_type) <= 40),
  page text not null check (length(page) <= 20),
  path text not null check (length(path) <= 200),
  country text check (country ~ '^[A-Z][A-Z0-9]$'),
  build text not null check (length(build) <= 40)
);

create table public.client_errors (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  kind text not null check (kind in ('error', 'rejection')),
  message text not null check (length(message) <= 500),
  stack text check (length(stack) <= 4000),
  source text check (length(source) <= 300),
  line integer check (line >= 0),
  col integer check (col >= 0),
  user_agent text check (length(user_agent) <= 300),
  page text not null check (length(page) <= 20),
  path text not null check (length(path) <= 200),
  country text check (country ~ '^[A-Z][A-Z0-9]$'),
  build text not null check (length(build) <= 40)
);

create table public.events (
  id bigint generated always as identity primary key,
  created_at timestamptz not null default now(),
  name text not null check (name in ('page_view', 'listing_view', 'whatsapp_tap')),
  listing_public_id text check (listing_public_id ~ '^CT-[0-9]{4,}$'),
  page text not null check (length(page) <= 20),
  path text not null check (length(path) <= 200),
  country text check (country ~ '^[A-Z][A-Z0-9]$'),
  build text not null check (length(build) <= 40)
);

create index web_vitals_created_at on public.web_vitals (created_at);
create index web_vitals_name_country_page on public.web_vitals (name, country, page, created_at);
create index client_errors_created_at on public.client_errors (created_at);
create index events_created_at on public.events (created_at);
create index events_name_created_at on public.events (name, created_at);

alter table public.web_vitals enable row level security;
alter table public.client_errors enable row level security;
alter table public.events enable row level security;

-- Supabase concede por defecto todo a anon y authenticated en las tablas nuevas de public: se retira.
revoke all on table public.web_vitals, public.client_errors, public.events from public, anon, authenticated;
revoke all on sequence public.web_vitals_id_seq, public.client_errors_id_seq, public.events_id_seq from public, anon, authenticated;
grant select, insert, delete on table public.web_vitals, public.client_errors, public.events to service_role;
