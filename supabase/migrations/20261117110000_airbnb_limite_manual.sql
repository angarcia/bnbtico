-- Límite de las lecturas manuales de Airbnb (decisión 2026-11-17), para que Airbnb no nos bloquee: «Actualizar ahora»
-- espera 15 minutos desde la última lectura de la casa (manual o automática) y cada casa tiene 10 lecturas manuales al
-- día de Costa Rica. Conectar o cambiar el enlace no espera, pero cuenta. Repetir la misma petición (mismo request_id) no
-- choca con el límite. Lo aplica la base, bajo el bloqueo de la casa, para que no se salte llamando a la API. Mismos
-- mensajes que AIRBNB_LIMIT_MESSAGES (src/domain/airbnb.ts). El admin no lee calendarios ajenos (begin_airbnb_import).

-- 1. Origen de cada lectura: las del ciclo automático no cuentan en el tope manual. Las anteriores quedan como manuales.
alter table public.airbnb_import_attempts
  add column origin text not null default 'manual' check (origin in ('manual', 'auto'));
create index if not exists airbnb_import_attempts_listing_started on public.airbnb_import_attempts (listing_id, started_at desc);

create function public.airbnb_manual_reads_today(p_listing uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::integer from public.airbnb_import_attempts
   where listing_id = p_listing and origin = 'manual' and operation <> 'disconnect'
     and (started_at at time zone 'America/Costa_Rica')::date = public.costa_rica_today()
$$;
revoke all on function public.airbnb_manual_reads_today(uuid) from public, anon, authenticated, service_role;

-- 2. La guarda: se llama con la casa ya comprobada y antes de reservar. Bloquea la fila para que dos peticiones a la vez
-- no pasen las dos.
create function public.airbnb_manual_gate(p_listing uuid, p_request uuid, p_wait boolean) returns void
language plpgsql security definer set search_path = '' as $$
declare last_read timestamptz;
begin
  perform 1 from public.listings where id = p_listing for update;
  if exists (select 1 from public.airbnb_import_attempts where request_id = p_request) then return; end if;
  if p_wait then
    select max(started_at) into last_read from public.airbnb_import_attempts
     where listing_id = p_listing and operation <> 'disconnect';
    if last_read > now() - interval '15 minutes' then
      raise exception 'Podrá actualizar de nuevo a las %.',
        to_char((last_read + interval '15 minutes') at time zone 'America/Costa_Rica', 'HH24:MI');
    end if;
  end if;
  if public.airbnb_manual_reads_today(p_listing) >= 10 then
    raise exception 'Hoy ya actualizó 10 veces. Podrá actualizar de nuevo mañana.';
  end if;
end $$;
revoke all on function public.airbnb_manual_gate(uuid, uuid, boolean) from public, anon, authenticated, service_role;

-- 3. Las lecturas manuales pasan por la guarda (definiciones vigentes de 20261108020000 y 20261108220000).
create or replace function public.begin_airbnb_import(p_listing uuid, p_url text, p_request uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Ingrese para conectar el calendario.'; end if;
  -- Comprobar propiedad incluso en reintentos: el admin no hereda este permiso.
  if not exists (select 1 from public.listings where id=p_listing and owner_id=auth.uid() and deleted_at is null) then
    raise exception 'No encontramos ese anuncio.';
  end if;
  perform public.airbnb_manual_gate(p_listing, p_request, false);
  return public.airbnb_reserve(p_listing, p_request, p_url, true);
end $$;

create or replace function public.begin_airbnb_update(p_listing uuid,p_request uuid,p_url text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform public.airbnb_check_owner(p_listing);
  -- «Actualizar ahora» espera; cambiar el enlace no (pero cuenta en el día).
  perform public.airbnb_manual_gate(p_listing,p_request,p_url is null);
  return public.airbnb_reserve(p_listing,p_request,p_url,false);
end $$;

-- 4. El ciclo automático marca su lectura (definición de 20261117100000_airbnb_intervalo).
create or replace function public.claim_airbnb_cycle(p_listing uuid, p_request uuid, p_cycle timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l public.listings; c public.airbnb_connections; utc timestamp; r jsonb;
begin
  utc := p_cycle at time zone 'UTC';
  if p_cycle is null or p_request is null or not isfinite(p_cycle)
      or extract(second from utc) <> 0
      or (extract(minute from utc)::int % 5 <> 0 and extract(minute from utc)::int <> 17) then
    raise exception 'Ciclo de calendario no válido.';
  end if;
  select * into l from public.listings where id = p_listing for update;
  if not found or l.deleted_at is not null or l.status = 'rejected' or l.admin_hold = 'blocked'
      or (l.status = 'draft' and l.first_published_at is null)
      or not exists (select 1 from public.profiles where id = l.owner_id and is_active and phone_verified_at is not null) then
    return jsonb_build_object('run', false);
  end if;
  select * into c from public.airbnb_connections where listing_id = p_listing for update;
  if not found or not c.connected or c.private_url is null or c.last_auto_cycle > p_cycle - interval '5 minutes' then
    return jsonb_build_object('run', false);
  end if;
  update public.airbnb_connections set last_auto_cycle = p_cycle where listing_id = p_listing;
  if exists (select 1 from public.airbnb_import_attempts where listing_id = p_listing and state = 'running'
      and started_at > now() - interval '30 seconds') then
    return jsonb_build_object('run', false);
  end if;
  r := public.airbnb_reserve(p_listing, p_request, null, false);
  -- La lectura automática no cuenta en el tope manual del día (pero sí hace esperar a «Actualizar ahora»).
  update public.airbnb_import_attempts set origin = 'auto' where request_id = p_request;
  return r;
end $$;

-- 5. El resumen dice desde cuándo se puede actualizar y cuántas quedan hoy (definición de 20261108220000).
create or replace function public.airbnb_overview(p_listing uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.airbnb_connections; l public.listings; running boolean; nights integer; last_read timestamptz; used integer;
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
    'manualAvailableAt',case when last_read>now()-interval '15 minutes' then last_read+interval '15 minutes' end,
    'manualLeftToday',greatest(0,10-used));
end $$;
