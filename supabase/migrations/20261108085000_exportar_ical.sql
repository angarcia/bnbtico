-- #6: capacidad de lectura independiente de la importación. No contiene datos de huéspedes.
create table public.ical_exports (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  id uuid not null unique default pg_catalog.gen_random_uuid(),
  token text unique check (token ~ '^[a-f0-9]{64}$'),
  generated_at timestamptz not null default now(),
  revoked_at timestamptz,
  check ((token is null) = (revoked_at is not null))
);
alter table public.ical_exports enable row level security;
create policy ical_exports_service on public.ical_exports to service_role using (true) with check (true);
revoke all on public.ical_exports from public, anon, authenticated;
grant select, insert, update, delete on public.ical_exports to service_role;

-- Un mismo bloqueo nocturno conserva su namespace aunque se revoque/regeneren enlaces.
create function public.owner_ical_export(p_listing uuid, p_generate boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l public.listings; e public.ical_exports; suspended boolean; nights integer;
begin
  if auth.uid() is null then raise exception 'Su sesión venció. Ingrese de nuevo.'; end if;
  -- Mismo orden de locks en generación y revocación: listing, exportación.
  select * into l from public.listings where id=p_listing and owner_id=auth.uid() and deleted_at is null for update;
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if not exists (select 1 from public.profiles where id=l.owner_id and is_active and phone_verified_at is not null) then
    raise exception 'Verifique su cuenta para gestionar el calendario.';
  end if;
  suspended := l.status='rejected' or coalesce(l.admin_hold='blocked',false);
  if p_generate and (suspended or (l.status='draft' and l.first_published_at is null)) then
    raise exception 'Esta casa no permite generar enlaces de calendario.';
  end if;
  select * into e from public.ical_exports where listing_id=p_listing for update;
  if p_generate and e.token is null then
    insert into public.ical_exports(listing_id,token)
      values(p_listing,pg_catalog.encode(extensions.gen_random_bytes(32),'hex'))
    on conflict (listing_id) do update set token=excluded.token,generated_at=now(),revoked_at=null
    returning * into e;
  end if;
  -- Solo la capa manual. available=false no se deriva del calendario efectivo ni de consultas WhatsApp.
  select count(*) into nights from public.listing_days d
    where d.listing_id=p_listing and not d.available
      and d.day between public.costa_rica_today() and public.costa_rica_today()+365;
  return jsonb_build_object('generated',e.token is not null,'suspended',suspended,
    'token',case when suspended then null else e.token end,'nights',nights);
end $$;
revoke all on function public.owner_ical_export(uuid,boolean) from public,anon,authenticated,service_role;
grant execute on function public.owner_ical_export(uuid,boolean) to authenticated;

-- Núcleo preparado para #7; esta entrega no incorpora su interfaz de revocación.
create function public.revoke_ical_export(p_listing uuid) returns void
language plpgsql security definer set search_path='' as $$
begin
  perform public.owner_ical_export(p_listing,false);
  update public.ical_exports set token=null,revoked_at=now() where listing_id=p_listing;
end $$;
revoke all on function public.revoke_ical_export(uuid) from public,anon,authenticated,service_role;
grant execute on function public.revoke_ical_export(uuid) to authenticated;

-- Solo el worker puede convertir la capacidad en fechas. El navegador no ejecuta esta RPC con su JWT.
create function public.read_ical_export(p_token text) returns jsonb
language sql stable security definer set search_path='' as $$
  select jsonb_build_object('id',e.id,'nights',coalesce((
    select jsonb_agg(d.day order by d.day) from public.listing_days d
    where d.listing_id=e.listing_id and not d.available
      and d.day between public.costa_rica_today() and public.costa_rica_today()+365
  ),'[]'::jsonb))
  from public.ical_exports e
    join public.listings l on l.id=e.listing_id
    join public.profiles p on p.id=l.owner_id
  where p_token ~ '^[a-f0-9]{64}$' and e.token=p_token and e.revoked_at is null
    and l.deleted_at is null and l.status<>'rejected' and l.admin_hold is distinct from 'blocked'
    and not (l.status='draft' and l.first_published_at is null)
    and p.is_active and p.phone_verified_at is not null
$$;
revoke all on function public.read_ical_export(text) from public,anon,authenticated,service_role;
grant execute on function public.read_ical_export(text) to service_role;

-- El resumen que se persiste informa de presencia; jamás incorpora la capacidad de lectura.
create or replace function public.airbnb_overview(p_listing uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
declare c public.airbnb_connections; l public.listings; running boolean; nights integer;
begin
  if auth.uid() is null then raise exception 'Su sesión venció. Ingrese de nuevo.'; end if;
  select * into l from public.listings where id=p_listing and owner_id=auth.uid() and deleted_at is null;
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  select * into c from public.airbnb_connections where listing_id=p_listing;
  select exists(select 1 from public.airbnb_import_attempts where listing_id=p_listing and state='running'
    and started_at>now()-interval '30 seconds') into running;
  select count(*) into nights from public.effective_calendar_days(p_listing) d where d.imported;
  return jsonb_build_object('connected',coalesce(c.connected,false),
    'state',case when l.status='rejected' or l.admin_hold='blocked' then 'suspended' when running then 'running'
      when c.error_code is not null then 'error' when c.connected then 'connected' else 'none' end,
    'lastSuccessAt',c.last_success_at,'errorCode',c.error_code,'nights',nights,
    'exportGenerated',exists(select 1 from public.ical_exports e where e.listing_id=p_listing and e.token is not null and e.revoked_at is null));
end $$;

create function public.ical_export_listing_deleted() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  update public.ical_exports set token=null,revoked_at=now() where listing_id=new.id;
  return new;
end $$;
revoke all on function public.ical_export_listing_deleted() from public,anon,authenticated,service_role;
create trigger ical_export_deleted after update of deleted_at on public.listings
  for each row when (old.deleted_at is null and new.deleted_at is not null)
  execute function public.ical_export_listing_deleted();
