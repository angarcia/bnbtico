-- Intervalo de Airbnb configurable (decisión 2026-11-17): el worker lee cada AIRBNB_SYNC_MINUTES (variable de GitHub
-- del entorno; de 5 minutos a 24 horas) y la base deja de exigir «cada 3 horas en el minuto 17». Acepta cualquier ciclo
-- en minuto exacto que sea múltiplo de 5, o el minuto 17 de los intervalos de horas, y no lee una casa dos veces en menos
-- de 5 minutos aunque el worker se equivoque. Se recrean desde 20261112180000_programar_importacion_airbnb; los permisos
-- (solo service_role) se conservan con create or replace.

create or replace function public.airbnb_due_for_cycle(p_cycle timestamptz) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(q.listing_id order by q.last_auto_cycle nulls first, q.listing_id), '[]'::jsonb)
  from (
    select c.listing_id, c.last_auto_cycle
    from public.airbnb_connections c
    join public.listings l on l.id = c.listing_id
    join public.profiles p on p.id = l.owner_id
    where c.connected and c.private_url is not null
      and l.deleted_at is null and l.status <> 'rejected' and l.admin_hold is distinct from 'blocked'
      and not (l.status = 'draft' and l.first_published_at is null)
      and p.is_active and p.phone_verified_at is not null
      and (c.last_auto_cycle is null or c.last_auto_cycle <= p_cycle - interval '5 minutes')
    order by c.last_auto_cycle nulls first, c.listing_id
    limit 13 -- 12 casas y una señal de cola pendiente.
  ) q
$$;

create or replace function public.claim_airbnb_cycle(p_listing uuid, p_request uuid, p_cycle timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l public.listings; c public.airbnb_connections; utc timestamp;
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
  return public.airbnb_reserve(p_listing, p_request, null, false);
end $$;
