-- Tipo de cambio diario USD→CRC (ticket 21). Lo escribe el cron del worker con la service role (fuente principal
-- fawazahmed0/exchange-api, respaldo ExchangeRate-API); la app y la ficha leen el del día más reciente. Es solo para
-- mostrar precios en dólares como referencia: los precios se fijan y se cobran en colones.

create table public.fx_rates (
  day date primary key,
  crc_per_usd numeric(10, 4) not null check (crc_per_usd between 300 and 900),
  source text not null check (source in ('fawazahmed0', 'exchangerate-api', 'constante')),
  fetched_at timestamptz not null default now()
);

alter table public.fx_rates enable row level security;
create policy fx_rates_public_read on public.fx_rates for select to anon, authenticated using (true);

-- Supabase concede por defecto todo a anon y authenticated en las tablas nuevas de public: solo lectura.
revoke all on table public.fx_rates from public, anon, authenticated;
grant select on table public.fx_rates to anon, authenticated;
grant select, insert, update, delete on table public.fx_rates to service_role;

-- Valor inicial (la constante que usaba la app) para que todo funcione antes del primer cron.
insert into public.fx_rates (day, crc_per_usd, source) values ('2026-10-26', 510, 'constante');
