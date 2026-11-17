-- Feature flags por entorno (historia #58, decisiones del 2026-11-17). El despliegue las escribe desde las variables de
-- GitHub FLAG_*_PRUEBAS / FLAG_*_PRODUCCION con set_feature_flags (solo service_role); sin fila, los valores iniciales.
-- Nadie las lee por REST: el navegador recibe las suyas en el build, y las RPCs que no pueden fiarse del navegador
-- (habitaciones, precios por fecha, calendarios externos) las consultan dentro con public.feature_flags().
-- Esta migración solo crea el contrato: cada regla la aplica su historia (#61 precios, #62 habitaciones, #63 iCal).

create table public.feature_flags (
  id boolean primary key default true check (id),
  explore_dates boolean not null default false,      -- fechas y disponibilidad en Explorar
  explore_nights boolean not null default true,      -- número de noches en Explorar
  date_prices boolean not null default false,        -- precios por fecha (tarifas especiales)
  external_calendars boolean not null default true,  -- calendarios externos (iCal)
  rooms boolean not null default false,              -- publicar y filtrar habitaciones
  updated_at timestamptz not null default now()
);
alter table public.feature_flags enable row level security;
revoke all on table public.feature_flags from public, anon, authenticated;
insert into public.feature_flags default values;

create function public.feature_flags() returns public.feature_flags
language sql stable security definer set search_path = '' as $$
  select coalesce((select f from public.feature_flags f where f.id),
                  row(true, false, true, false, true, false, now())::public.feature_flags)
$$;
revoke all on function public.feature_flags() from public, anon, authenticated, service_role;

create function public.set_feature_flags(p_explore_dates boolean, p_explore_nights boolean, p_date_prices boolean,
                                         p_external_calendars boolean, p_rooms boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if p_explore_dates is null or p_explore_nights is null or p_date_prices is null or p_external_calendars is null or p_rooms is null then
    raise exception 'Faltan valores de las feature flags.' using errcode = '22023';
  end if;
  insert into public.feature_flags (id, explore_dates, explore_nights, date_prices, external_calendars, rooms, updated_at)
  values (true, p_explore_dates, p_explore_nights, p_date_prices, p_external_calendars, p_rooms, now())
  on conflict (id) do update set explore_dates = excluded.explore_dates, explore_nights = excluded.explore_nights,
    date_prices = excluded.date_prices, external_calendars = excluded.external_calendars, rooms = excluded.rooms,
    updated_at = excluded.updated_at;
end $$;
revoke all on function public.set_feature_flags(boolean, boolean, boolean, boolean, boolean) from public, anon, authenticated, service_role;
grant execute on function public.set_feature_flags(boolean, boolean, boolean, boolean, boolean) to service_role;
