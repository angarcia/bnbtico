-- #5: Airbnb mantiene su propia capa. listing_days sigue siendo manual/precios.
create table public.airbnb_connections (
  listing_id uuid primary key references public.listings(id) on delete cascade,
  private_url text,
  connected boolean not null default false,
  version bigint not null default 0,
  last_success_at timestamptz,
  error_code text check (error_code in ('url','calendar','unsupported','download','timeout','size')),
  check (private_url is null or length(private_url) <= 2048)
);
create table public.airbnb_import_attempts (
  request_id uuid primary key,
  listing_id uuid not null references public.airbnb_connections(listing_id) on delete cascade,
  version bigint not null,
  state text not null default 'running' check (state in ('running','success','error','obsolete')),
  claimed boolean not null default false,
  started_at timestamptz not null default now(),
  error_code text check (error_code in ('url','calendar','unsupported','download','timeout','size'))
);
create index airbnb_attempts_listing on public.airbnb_import_attempts(listing_id, started_at);
create table public.airbnb_blocks (
  listing_id uuid not null references public.airbnb_connections(listing_id) on delete cascade,
  source_uid text not null check (length(source_uid) between 1 and 512),
  starts_on date not null,
  ends_on date not null check (ends_on > starts_on),
  primary key (listing_id, source_uid)
);
-- Ninguna tabla se expone al navegador, tampoco al admin. Todas las transiciones son RPCs.
alter table public.airbnb_connections enable row level security;
alter table public.airbnb_import_attempts enable row level security;
alter table public.airbnb_blocks enable row level security;
create policy airbnb_connections_service on public.airbnb_connections to service_role using (true) with check (true);
create policy airbnb_attempts_service on public.airbnb_import_attempts to service_role using (true) with check (true);
create policy airbnb_blocks_service on public.airbnb_blocks to service_role using (true) with check (true);
revoke all on public.airbnb_connections, public.airbnb_import_attempts, public.airbnb_blocks from public, anon, authenticated;
grant select, insert, update, delete on public.airbnb_connections, public.airbnb_import_attempts, public.airbnb_blocks to service_role;

create function public.airbnb_reserve(p_listing uuid, p_request uuid, p_url text, p_initial boolean) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare l public.listings; c public.airbnb_connections; a public.airbnb_import_attempts;
begin
  select * into l from public.listings where id = p_listing for update;
  if not found or l.deleted_at is not null or l.status = 'rejected' or l.admin_hold = 'blocked'
     or (l.status = 'draft' and l.first_published_at is null) then
    raise exception 'Esta casa no permite conectar calendarios.';
  end if;
  if not exists (select 1 from public.profiles where id = l.owner_id and is_active and phone_verified_at is not null) then
    raise exception 'Verifique su cuenta para conectar el calendario.';
  end if;
  select * into a from public.airbnb_import_attempts where request_id = p_request;
  if found then
    if a.listing_id <> p_listing then raise exception 'No encontramos ese intento.'; end if;
    return jsonb_build_object('run', false);
  end if;
  insert into public.airbnb_connections(listing_id) values(p_listing) on conflict do nothing;
  select * into c from public.airbnb_connections where listing_id = p_listing for update;
  if exists (select 1 from public.airbnb_import_attempts where listing_id = p_listing and state = 'running'
       and started_at > now() - interval '30 seconds') then raise exception 'Ya estamos leyendo este calendario.'; end if;
  if p_initial and c.connected then raise exception 'Esta casa ya tiene Airbnb conectado.'; end if;
  if not p_initial and not c.connected then raise exception 'Esta casa no tiene Airbnb conectado.'; end if;
  if p_initial and (p_url is null or length(p_url) > 2048 or p_url !~ '^https://www\.airbnb\.(ca|com)/calendar/ical/[0-9]{1,30}\.ics\?t=[a-fA-F0-9]{32}$') then
    raise exception 'Revise el enlace de exportación de Airbnb.';
  end if;
  update public.airbnb_import_attempts set state = 'obsolete' where listing_id = p_listing and state = 'running';
  update public.airbnb_connections set version = version + 1,
    private_url = case when p_initial then p_url else private_url end, error_code = null
    where listing_id = p_listing returning * into c;
  insert into public.airbnb_import_attempts(request_id, listing_id, version) values(p_request, p_listing, c.version);
  return jsonb_build_object('run', true);
end $$;
revoke all on function public.airbnb_reserve(uuid,uuid,text,boolean) from public, anon, authenticated;

create function public.begin_airbnb_import(p_listing uuid, p_url text, p_request uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'Ingrese para conectar el calendario.'; end if;
  -- Comprobar propiedad incluso en reintentos: el admin no hereda este permiso.
  if not exists (select 1 from public.listings where id=p_listing and owner_id=auth.uid() and deleted_at is null) then
    raise exception 'No encontramos ese anuncio.';
  end if;
  return public.airbnb_reserve(p_listing, p_request, p_url, true);
end $$;
revoke all on function public.begin_airbnb_import(uuid,text,uuid) from public, anon;
grant execute on function public.begin_airbnb_import(uuid,text,uuid) to authenticated;

-- Reutilizable por pruebas controladas y, después, #7/#8; nunca concedida al navegador.
create function public.claim_airbnb_import(p_listing uuid, p_request uuid) returns jsonb
language sql security definer set search_path = '' as $$
  select public.airbnb_reserve(p_listing, p_request, null, false)
$$;
revoke all on function public.claim_airbnb_import(uuid,uuid) from public, anon, authenticated;
grant execute on function public.claim_airbnb_import(uuid,uuid) to service_role;

create function public.airbnb_import_context(p_listing uuid, p_request uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.airbnb_connections; l public.listings;
begin
  select * into l from public.listings where id=p_listing for update;
  if not found or l.deleted_at is not null or l.status='rejected' or l.admin_hold='blocked' then return null; end if;
  select * into c from public.airbnb_connections where listing_id=p_listing for update;
  if not found then return null; end if;
  update public.airbnb_import_attempts set claimed=true
    where request_id=p_request and listing_id=p_listing and version=c.version and state='running' and not claimed
      and started_at > now()-interval '30 seconds';
  if not found then return null; end if;
  return jsonb_build_object('url', c.private_url);
end $$;
revoke all on function public.airbnb_import_context(uuid,uuid) from public, anon, authenticated;
grant execute on function public.airbnb_import_context(uuid,uuid) to service_role;

create function public.finish_airbnb_import(p_listing uuid, p_request uuid, p_blocks jsonb, p_error text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare l public.listings; c public.airbnb_connections; a public.airbnb_import_attempts;
begin
  select * into l from public.listings where id=p_listing for update;
  if not found then return; end if;
  select * into c from public.airbnb_connections where listing_id=p_listing for update;
  select * into a from public.airbnb_import_attempts where request_id=p_request and listing_id=p_listing for update;
  if a.request_id is null or a.state <> 'running' or not a.claimed or a.version <> c.version then return; end if;
  if l.deleted_at is not null or l.status='rejected' or l.admin_hold='blocked' or a.started_at < now()-interval '30 seconds' then
    update public.airbnb_import_attempts set state='obsolete' where request_id=p_request;
    return;
  end if;
  if p_error is not null then
    if p_error not in ('url','calendar','unsupported','download','timeout','size') then raise exception 'Error de calendario no válido.'; end if;
    update public.airbnb_connections set error_code=p_error where listing_id=p_listing;
    update public.airbnb_import_attempts set state='error', error_code=p_error where request_id=p_request;
    return;
  end if;
  if p_blocks is null or jsonb_typeof(p_blocks) <> 'array' then raise exception 'Calendario no válido.'; end if;
  if jsonb_array_length(p_blocks)>5000 then raise exception 'Calendario demasiado grande.'; end if;
  -- Validar toda la carga antes de reemplazar filas. Los casts que fallen abortan la transacción completa.
  if exists (select 1 from jsonb_to_recordset(p_blocks) as b(uid text, start text, "end" text)
      where uid is null or length(uid) not between 1 and 512 or start is null or "end" is null
        or start !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or "end" !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        or start::date >= "end"::date)
    or exists (select uid from jsonb_to_recordset(p_blocks) as b(uid text) group by uid having count(*)>1) then
    raise exception 'Calendario no válido.';
  end if;
  delete from public.airbnb_blocks where listing_id=p_listing;
  insert into public.airbnb_blocks(listing_id,source_uid,starts_on,ends_on)
    select p_listing,b.uid,b.start::date,b."end"::date from jsonb_to_recordset(p_blocks) as b(uid text, start text, "end" text);
  update public.airbnb_connections set connected=true,last_success_at=clock_timestamp(),error_code=null where listing_id=p_listing;
  update public.airbnb_import_attempts set state='success' where request_id=p_request;
  if l.status='active' then perform public.purge_listing_page(l.public_id); end if;
end $$;
revoke all on function public.finish_airbnb_import(uuid,uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.finish_airbnb_import(uuid,uuid,jsonb,text) to service_role;

-- Proyección acotada: como máximo 366 fechas, aunque el proveedor incluya rangos muy largos.
create function public.effective_calendar_days(p_listing uuid)
returns table(day date,available boolean,special_price_crc integer,manual_available boolean,imported boolean)
language sql stable security definer set search_path='' as $$
  with dates as (select public.costa_rica_today()+i as d from generate_series(0,365) i), projected as (
    select dt.d, md.available, md.special_price_crc,
      exists(select 1 from public.airbnb_blocks b join public.airbnb_connections c using(listing_id)
        where b.listing_id=p_listing and c.connected and b.starts_on<=dt.d and b.ends_on>dt.d) as imported
    from dates dt left join public.listing_days md on md.listing_id=p_listing and md.day=dt.d)
  select d,coalesce(available,true) and not imported,special_price_crc,coalesce(available,true),imported
    from projected where available is not null or imported order by d
$$;
revoke all on function public.effective_calendar_days(uuid) from public, anon, authenticated;

create function public.owner_calendar_days(p_listing uuid)
returns table(day date,available boolean,special_price_crc integer,manual_available boolean,imported boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Su sesión venció. Ingrese de nuevo.'; end if;
  if not exists(select 1 from public.listings where id=p_listing and owner_id=auth.uid() and deleted_at is null) then return; end if;
  return query select * from public.effective_calendar_days(p_listing);
end $$;
revoke all on function public.owner_calendar_days(uuid) from public,anon;
grant execute on function public.owner_calendar_days(uuid) to authenticated;

create function public.airbnb_overview(p_listing uuid) returns jsonb
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
    'lastSuccessAt',c.last_success_at,'errorCode',c.error_code,'nights',nights);
end $$;
revoke all on function public.airbnb_overview(uuid) from public,anon;
grant execute on function public.airbnb_overview(uuid) to authenticated;

create or replace function public.public_listing_days(p_public_id text)
returns table(day date,available boolean,special_price_crc integer)
language sql stable security definer set search_path='' as $$
  select d.day,d.available,d.special_price_crc from public.listings l
    cross join lateral public.effective_calendar_days(l.id) d
  where l.public_id=p_public_id and l.status='active' and l.admin_hold is null and l.deleted_at is null order by d.day
$$;

-- El admin conserva lectura/edición manual con aal2; esto no permite gestionar conexiones ni leer sus URLs.
create function public.admin_calendar_days(p_listing uuid)
returns table(day date,available boolean,special_price_crc integer,manual_available boolean,imported boolean)
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_admin() then return; end if;
  if not exists(select 1 from public.listings where id=p_listing and deleted_at is null) then return; end if;
  return query select * from public.effective_calendar_days(p_listing);
end $$;
revoke all on function public.admin_calendar_days(uuid) from public,anon;
grant execute on function public.admin_calendar_days(uuid) to authenticated;

create function public.listing_has_busy_nights(p_listing uuid,p_from date,p_to date) returns boolean
language sql stable security definer set search_path='' as $$
  select exists(select 1 from public.listing_days d where d.listing_id=p_listing and not d.available and d.day>=p_from and d.day<p_to)
    or exists(select 1 from public.airbnb_blocks b join public.airbnb_connections c using(listing_id)
      where b.listing_id=p_listing and c.connected and b.starts_on<p_to and b.ends_on>p_from
        and greatest(b.starts_on,p_from,public.costa_rica_today()) < least(b.ends_on,p_to,public.costa_rica_today()+366))
$$;
revoke all on function public.listing_has_busy_nights(uuid,date,date) from public,anon,authenticated;

create function public.airbnb_listing_transition() returns trigger
language plpgsql security definer set search_path='' as $$
begin
  if new.deleted_at is not null or new.status='rejected' or new.admin_hold='blocked' then
    update public.airbnb_connections set version=version+1,
      connected=case when new.deleted_at is not null then false else connected end,
      private_url=case when new.deleted_at is not null then null else private_url end where listing_id=new.id;
    update public.airbnb_import_attempts set state='obsolete' where listing_id=new.id and state='running';
  end if;
  return new;
end $$;
revoke all on function public.airbnb_listing_transition() from public,anon,authenticated;
create trigger airbnb_listing_transition after update of deleted_at,status,admin_hold on public.listings
  for each row execute function public.airbnb_listing_transition();

-- Copias de las versiones vigentes: solo se cambia la consulta de ocupación; en contacto también se serializa
-- contra la publicación de la instantánea mediante el mismo bloqueo de fila de la casa.
create or replace function public.search_listings(
  p_zone text default null, p_from date default null, p_to date default null,
  p_province text default null, p_people integer default null, p_bedrooms integer default null,
  p_features public.feature[] default null, p_min integer default null, p_max integer default null,
  p_limit integer default null, p_kinds public.listing_kind[] default null)
returns table (
  id uuid, public_id text, kind public.listing_kind, title text, description text, province text, canton text, zone text,
  lat double precision, lng double precision, capacity integer, bedrooms integer, bathrooms integer, bathroom_shared boolean,
  features public.feature[], parking_paid boolean, accepts_nightly boolean, nightly_price_crc integer, min_nights integer,
  accepts_monthly boolean, monthly_mode text, monthly_price_crc integer, min_months integer, available boolean, reopen_at date,
  created_at timestamptz, updated_at timestamptz, owner_name text, owner_whatsapp_verified boolean, photos jsonb,
  stay_total_crc bigint, sort_rank integer
)
language plpgsql stable security definer set search_path = '' as $$
declare
  today date := public.costa_rica_today();
  z public.zones;
begin
  if (p_from is null) <> (p_to is null) then raise exception 'Revise las fechas.'; end if;
  if p_from is not null and (p_to <= p_from or p_from < today or p_to > today + 366) then
    raise exception 'Revise las fechas.';
  end if;
  if p_zone is not null then
    -- Calificado: los nombres de `returns table` (id, zone…) son variables dentro de la función.
    select * into z from public.zones zn where zn.id = p_zone and zn.active;
    if not found then return; end if;
  end if;
  return query
    with picked as materialized (
      select lp, (row_number() over (order by (lp.province = 'Limón') desc, l.created_at desc, l.id desc))::integer as rank
      from public.listings_public lp
      join public.listings l on l.id = lp.id
      where l.available
        and (p_zone is null or l.zone_id = p_zone
             or extensions.ST_DWithin(extensions.ST_SetSRID(extensions.ST_MakePoint(l.lng, l.lat), 4326)::extensions.geography,
                                      z.point::extensions.geography, 5000))
        and (p_from is null or not public.listing_has_busy_nights(l.id, p_from, p_to))
        and (p_province is null or lp.province = p_province)
        and (p_people is null or lp.capacity >= p_people)
        and (p_bedrooms is null or lp.bedrooms >= p_bedrooms)
        and (p_kinds is null or lp.kind = any (p_kinds))
        and (p_features is null or lp.features @> p_features)
        and (p_min is null or lp.nightly_price_crc >= p_min)
        and (p_max is null or lp.nightly_price_crc <= p_max)
      order by 2
      limit p_limit
    )
    select (pk.lp).*,
      case when p_from is not null then
        public.search_stay_total((pk.lp).id, (pk.lp).nightly_price_crc, (pk.lp).accepts_monthly, (pk.lp).monthly_price_crc, p_from, p_to)
      end,
      pk.rank
    from picked pk
    order by pk.rank;
end $$;
revoke all on function public.search_listings(text, date, date, text, integer, integer, public.feature[], integer, integer, integer, public.listing_kind[]) from public;
grant execute on function public.search_listings(text, date, date, text, integer, integer, public.feature[], integer, integer, integer, public.listing_kind[]) to anon, authenticated;

CREATE OR REPLACE FUNCTION public.create_inquiry(p_public_id text, p_arrival date, p_departure date, p_people integer, p_message text)
 RETURNS TABLE(inquiry_id uuid, whatsapp_phone text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  prof public.profiles;
  l public.listings;
  msg text := btrim(coalesce(p_message, ''));
  today date := (now() at time zone 'America/Costa_Rica')::date;
  found_id uuid;
  others int;
begin
  if uid is null then raise exception 'Ingrese con su WhatsApp para contactar al anfitrión.'; end if;
  select * into prof from public.profiles where id = uid;
  if not found or not prof.is_active then raise exception 'Su cuenta está desactivada. Escríbanos por WhatsApp.'; end if;
  if prof.phone_verified_at is null then raise exception 'Verifique su WhatsApp para contactar al anfitrión.'; end if;

  select * into l from public.listings where public_id = p_public_id and status = 'active' and admin_hold is null and deleted_at is null for update;
  if not found then raise exception 'Esta casa ya no está publicada.'; end if;
  if l.owner_id = uid then raise exception 'Esta es su propia casa.'; end if;
  if not l.available then raise exception 'Esta casa no está disponible para consultas.'; end if;

  -- Mismo orden y mensajes que validateInquiryDraft (src/domain/inquiry.ts).
  if (p_arrival is null) <> (p_departure is null) then raise exception 'Indique la llegada y la salida, o deje las dos vacías.'; end if;
  if p_arrival is not null then
    if p_departure <= p_arrival then raise exception 'La salida tiene que ser después de la llegada.'; end if;
    if p_arrival < today then raise exception 'La llegada no puede ser antes de hoy.'; end if;
  end if;
  if p_people is not null and (p_people < 1 or p_people > 50) then raise exception 'Indique entre 1 y 50 personas.'; end if;
  if msg = '' then raise exception 'Escriba un mensaje para el anfitrión.'; end if;
  if char_length(msg) > 1000 then raise exception 'El mensaje no puede pasar de 1000 caracteres.'; end if;
  if p_arrival is not null and public.listing_has_busy_nights(l.id, p_arrival, p_departure) then
    raise exception 'Hay noches ocupadas entre esas fechas.';
  end if;

  -- Dos toques seguidos del mismo cliente a la misma casa no crean dos filas.
  perform pg_advisory_xact_lock(hashtextextended(uid::text || l.id::text, 0));

  select count(distinct i.listing_id) into others from public.inquiries i
   where i.client_id = uid and i.updated_at > now() - interval '24 hours' and i.listing_id <> l.id;
  if others >= 20 then raise exception 'Ha contactado muchas casas hoy. Intente mañana o escríbanos por WhatsApp.'; end if;

  select i.id into found_id from public.inquiries i
   where i.client_id = uid and i.listing_id = l.id and i.created_at > now() - interval '7 days'
   order by i.created_at desc limit 1;

  if found_id is null then
    insert into public.inquiries (listing_id, client_id, owner_id, arrival, departure, people, message, consent_share_phone, whatsapp_phone, source)
    values (l.id, uid, l.owner_id, p_arrival, p_departure, p_people, msg, true, l.whatsapp_phone, 'listing')
    returning id into found_id;
  else
    update public.inquiries
       set arrival = p_arrival, departure = p_departure, people = p_people, message = msg, consent_share_phone = true,
           whatsapp_phone = l.whatsapp_phone, updated_at = now(), owner_opened_at = null
     where id = found_id;
  end if;

  return query select found_id, l.whatsapp_phone;
end $function$;
