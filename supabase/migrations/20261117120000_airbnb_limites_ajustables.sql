-- Límites manuales de Airbnb ajustables (decisión 2026-11-17): la espera y el tope del día dejan de ser 15 y 10 fijos.
-- Los escribe el despliegue desde las variables de GitHub AIRBNB_MANUAL_WAIT_MINUTES_* y AIRBNB_MANUAL_PER_DAY_* con
-- set_airbnb_manual_limits (solo service_role). Sin fila, 15 minutos y 10 al día. Rangos: espera de 1 a 60 minutos y de 1 a
-- 50 lecturas al día. La tabla no la lee nadie por REST: el resumen de la casa ya dice lo que hace falta.

create table public.airbnb_settings (
  id boolean primary key default true check (id),
  manual_wait_minutes integer not null default 15 check (manual_wait_minutes between 1 and 60),
  manual_per_day integer not null default 10 check (manual_per_day between 1 and 50),
  updated_at timestamptz not null default now()
);
alter table public.airbnb_settings enable row level security;
revoke all on table public.airbnb_settings from public, anon, authenticated;
insert into public.airbnb_settings default values;

create function public.airbnb_manual_limits() returns public.airbnb_settings
language sql stable security definer set search_path = '' as $$
  select coalesce((select s from public.airbnb_settings s where s.id), row(true, 15, 10, now())::public.airbnb_settings)
$$;
revoke all on function public.airbnb_manual_limits() from public, anon, authenticated, service_role;

create function public.set_airbnb_manual_limits(p_wait_minutes integer, p_per_day integer) returns void
language sql security definer set search_path = '' as $$
  insert into public.airbnb_settings (id, manual_wait_minutes, manual_per_day, updated_at)
  values (true, p_wait_minutes, p_per_day, now())
  on conflict (id) do update set manual_wait_minutes = excluded.manual_wait_minutes,
    manual_per_day = excluded.manual_per_day, updated_at = excluded.updated_at
$$;
revoke all on function public.set_airbnb_manual_limits(integer, integer) from public, anon, authenticated, service_role;
grant execute on function public.set_airbnb_manual_limits(integer, integer) to service_role;

-- La guarda y el resumen, con los límites de la tabla (definiciones de 20261117110000_airbnb_limite_manual).
create or replace function public.airbnb_manual_gate(p_listing uuid, p_request uuid, p_wait boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare last_read timestamptz; lim public.airbnb_settings := public.airbnb_manual_limits();
begin
  perform 1 from public.listings where id = p_listing for update;
  if exists (select 1 from public.airbnb_import_attempts where request_id = p_request) then return; end if;
  if p_wait then
    select max(started_at) into last_read from public.airbnb_import_attempts
     where listing_id = p_listing and operation <> 'disconnect';
    if last_read > now() - make_interval(mins => lim.manual_wait_minutes) then
      raise exception 'Podrá actualizar de nuevo a las %.',
        to_char((last_read + make_interval(mins => lim.manual_wait_minutes)) at time zone 'America/Costa_Rica', 'HH24:MI');
    end if;
  end if;
  if public.airbnb_manual_reads_today(p_listing) >= lim.manual_per_day then
    raise exception 'Hoy ya actualizó % %. Podrá actualizar de nuevo mañana.',
      lim.manual_per_day, case when lim.manual_per_day = 1 then 'vez' else 'veces' end;
  end if;
end $$;

create or replace function public.airbnb_overview(p_listing uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.airbnb_connections; l public.listings; running boolean; nights integer; last_read timestamptz; used integer; lim public.airbnb_settings := public.airbnb_manual_limits();
begin
  if auth.uid() is null then raise exception 'Su sesión venció. Ingrese de nuevo.'; end if;
  select * into l from public.listings where id=p_listing and owner_id=auth.uid() and deleted_at is null;
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  select * into c from public.airbnb_connections where listing_id=p_listing;
  select exists(select 1 from public.airbnb_import_attempts where listing_id=p_listing and state='running'
    and started_at>now()-interval '30 seconds') into running;
  select count(*) into nights from public.effective_calendar_days(p_listing) d where d.imported;
  select max(started_at) into last_read from public.airbnb_import_attempts where listing_id=p_listing and operation<>'disconnect';
  used := public.airbnb_manual_reads_today(p_listing);
  return jsonb_build_object('connected',coalesce(c.connected,false),
    'state',case when l.status='rejected' or l.admin_hold='blocked' then 'suspended' when running then 'running'
      when c.error_code is not null then 'error' when c.connected then 'connected' else 'none' end,
    'lastSuccessAt',c.last_success_at,'errorCode',c.error_code,'lastErrorAt',c.last_error_at,'nights',nights,
    'exportGenerated',exists(select 1 from public.ical_exports e where e.listing_id=p_listing and e.token is not null and e.revoked_at is null),
    'manualAvailableAt',case when last_read>now()-make_interval(mins=>lim.manual_wait_minutes) then last_read+make_interval(mins=>lim.manual_wait_minutes) end,
    'manualLeftToday',greatest(0,lim.manual_per_day-used),'manualPerDay',lim.manual_per_day);
end $$;
