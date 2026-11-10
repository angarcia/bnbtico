-- #7: gestión independiente de las dos direcciones, sobre el motor y las capas de #5/#6.
alter table public.airbnb_connections add column last_error_at timestamptz;
alter table public.airbnb_import_attempts
  add column operation text not null default 'connect' check (operation in ('connect','refresh','replace','disconnect')),
  add column candidate_url text check (candidate_url is null or length(candidate_url)<=2048);
alter table public.ical_exports add column generation bigint not null default 1 check (generation>0);

-- Las columnas nuevas siguen sin grants para clientes ni administradores.
revoke all on public.airbnb_connections,public.airbnb_import_attempts,public.ical_exports from public,anon,authenticated;

create function public.airbnb_check_owner(p_listing uuid) returns void
language plpgsql security definer set search_path='' as $$
declare l public.listings;
begin
  if auth.uid() is null then raise exception 'Su sesión venció. Ingrese de nuevo.'; end if;
  select * into l from public.listings where id=p_listing and owner_id=auth.uid() and deleted_at is null for update;
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if not exists(select 1 from public.profiles where id=l.owner_id and is_active and phone_verified_at is not null) then
    raise exception 'Verifique su cuenta para conectar el calendario.';
  end if;
end $$;
revoke all on function public.airbnb_check_owner(uuid) from public,anon,authenticated,service_role;

-- Se conserva la firma consumida por #5 y por la reclamación de servicio de #8.
create or replace function public.airbnb_reserve(p_listing uuid,p_request uuid,p_url text,p_initial boolean) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l public.listings; c public.airbnb_connections; a public.airbnb_import_attempts; op text;
begin
  select * into l from public.listings where id=p_listing for update;
  if not found or l.deleted_at is not null or l.status='rejected' or l.admin_hold='blocked'
      or (l.status='draft' and l.first_published_at is null) then
    raise exception 'Esta casa no permite conectar calendarios.';
  end if;
  if not exists(select 1 from public.profiles where id=l.owner_id and is_active and phone_verified_at is not null) then
    raise exception 'Verifique su cuenta para conectar el calendario.';
  end if;
  op := case when p_initial then 'connect' when p_url is not null then 'replace' else 'refresh' end;
  if p_request is null then raise exception 'No encontramos ese intento.'; end if;
  select * into a from public.airbnb_import_attempts where request_id=p_request;
  if found then
    if a.listing_id<>p_listing or a.operation<>op then raise exception 'No encontramos ese intento.'; end if;
    return jsonb_build_object('run',false);
  end if;
  insert into public.airbnb_connections(listing_id) values(p_listing) on conflict do nothing;
  select * into c from public.airbnb_connections where listing_id=p_listing for update;
  if exists(select 1 from public.airbnb_import_attempts where listing_id=p_listing and state='running'
      and started_at>now()-interval '30 seconds') then raise exception 'Ya estamos leyendo este calendario.'; end if;
  if p_initial and c.connected then raise exception 'Esta casa ya tiene Airbnb conectado.'; end if;
  if not p_initial and not c.connected then raise exception 'Esta casa no tiene Airbnb conectado.'; end if;
  if (p_initial or p_url is not null) and (p_url is null or length(p_url)>2048
      or p_url !~ '^https://www\.airbnb\.(ca|com)/calendar/ical/[0-9]{1,30}\.ics\?t=[a-fA-F0-9]{32}$') then
    raise exception 'Revise el enlace de exportación de Airbnb.';
  end if;
  update public.airbnb_import_attempts set state='obsolete',candidate_url=null where listing_id=p_listing and state='running';
  update public.airbnb_connections set version=version+1 where listing_id=p_listing returning * into c;
  -- La candidata vive en el intento: no sustituye el enlace confirmado mientras se descarga.
  insert into public.airbnb_import_attempts(request_id,listing_id,version,operation,candidate_url)
    values(p_request,p_listing,c.version,op,coalesce(p_url,c.private_url));
  return jsonb_build_object('run',true);
end $$;
revoke all on function public.airbnb_reserve(uuid,uuid,text,boolean) from public,anon,authenticated,service_role;

create function public.begin_airbnb_update(p_listing uuid,p_request uuid,p_url text default null) returns jsonb
language plpgsql security definer set search_path='' as $$
begin
  perform public.airbnb_check_owner(p_listing);
  return public.airbnb_reserve(p_listing,p_request,p_url,false);
end $$;
revoke all on function public.begin_airbnb_update(uuid,uuid,text) from public,anon,authenticated,service_role;
grant execute on function public.begin_airbnb_update(uuid,uuid,text) to authenticated;

create or replace function public.airbnb_import_context(p_listing uuid,p_request uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.airbnb_connections; l public.listings; candidate text;
begin
  select * into l from public.listings where id=p_listing for update;
  if not found or l.deleted_at is not null or l.status='rejected' or l.admin_hold='blocked'
      or not exists(select 1 from public.profiles where id=l.owner_id and is_active and phone_verified_at is not null) then return null; end if;
  select * into c from public.airbnb_connections where listing_id=p_listing for update;
  if not found then return null; end if;
  update public.airbnb_import_attempts set claimed=true
    where request_id=p_request and listing_id=p_listing and version=c.version and state='running' and not claimed
      and operation<>'disconnect' and started_at>now()-interval '30 seconds'
    returning coalesce(candidate_url,c.private_url) into candidate;
  if not found then return null; end if;
  return jsonb_build_object('url',candidate);
end $$;

create or replace function public.finish_airbnb_import(p_listing uuid,p_request uuid,p_blocks jsonb,p_error text default null) returns void
language plpgsql security definer set search_path='' as $$
declare l public.listings; c public.airbnb_connections; a public.airbnb_import_attempts;
begin
  select * into l from public.listings where id=p_listing for update;
  if not found then return; end if;
  select * into c from public.airbnb_connections where listing_id=p_listing for update;
  select * into a from public.airbnb_import_attempts where request_id=p_request and listing_id=p_listing for update;
  if a.request_id is null or a.state<>'running' or not a.claimed or a.version<>c.version then return; end if;
  if l.deleted_at is not null or l.status='rejected' or l.admin_hold='blocked' or a.started_at<now()-interval '30 seconds'
      or not exists(select 1 from public.profiles where id=l.owner_id and is_active and phone_verified_at is not null) then
    update public.airbnb_import_attempts set state='obsolete',candidate_url=null where request_id=p_request;
    return;
  end if;
  if p_error is not null then
    if p_error not in ('url','calendar','unsupported','download','timeout','size') then raise exception 'Error de calendario no válido.'; end if;
    update public.airbnb_connections set error_code=p_error,last_error_at=clock_timestamp() where listing_id=p_listing;
    update public.airbnb_import_attempts set state='error',error_code=p_error,candidate_url=null where request_id=p_request;
    return;
  end if;
  if p_blocks is null or jsonb_typeof(p_blocks)<>'array' then raise exception 'Calendario no válido.'; end if;
  if jsonb_array_length(p_blocks)>5000 then raise exception 'Calendario demasiado grande.'; end if;
  if exists(select 1 from jsonb_to_recordset(p_blocks) as b(uid text,start text,"end" text)
      where uid is null or length(uid) not between 1 and 512 or start is null or "end" is null
        or start !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' or "end" !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'
        or start::date>="end"::date)
    or exists(select uid from jsonb_to_recordset(p_blocks) as b(uid text) group by uid having count(*)>1) then
    raise exception 'Calendario no válido.';
  end if;
  delete from public.airbnb_blocks where listing_id=p_listing;
  insert into public.airbnb_blocks(listing_id,source_uid,starts_on,ends_on)
    select p_listing,b.uid,b.start::date,b."end"::date from jsonb_to_recordset(p_blocks) as b(uid text,start text,"end" text);
  update public.airbnb_connections set connected=true,private_url=coalesce(a.candidate_url,private_url),
    last_success_at=clock_timestamp(),error_code=null,last_error_at=null where listing_id=p_listing;
  update public.airbnb_import_attempts set state='success',candidate_url=null where request_id=p_request;
  if l.status='active' then perform public.purge_listing_page(l.public_id); end if;
end $$;

create function public.disconnect_airbnb(p_listing uuid,p_request uuid) returns void
language plpgsql security definer set search_path='' as $$
declare l public.listings; a public.airbnb_import_attempts; v bigint;
begin
  perform public.airbnb_check_owner(p_listing);
  if p_request is null then raise exception 'No encontramos ese intento.'; end if;
  select * into a from public.airbnb_import_attempts where request_id=p_request;
  if found then
    if a.listing_id<>p_listing or a.operation<>'disconnect' then raise exception 'No encontramos ese intento.'; end if;
    return;
  end if;
  select * into l from public.listings where id=p_listing;
  insert into public.airbnb_connections(listing_id) values(p_listing) on conflict do nothing;
  update public.airbnb_connections set connected=false,private_url=null,version=version+1,
    last_success_at=null,error_code=null,last_error_at=null where listing_id=p_listing returning version into v;
  update public.airbnb_import_attempts set state='obsolete',candidate_url=null where listing_id=p_listing and state='running';
  delete from public.airbnb_blocks where listing_id=p_listing;
  insert into public.airbnb_import_attempts(request_id,listing_id,version,operation,state)
    values(p_request,p_listing,v,'disconnect','success');
  if l.status='active' then perform public.purge_listing_page(l.public_id); end if;
end $$;
revoke all on function public.disconnect_airbnb(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function public.disconnect_airbnb(uuid,uuid) to authenticated;

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
    'lastSuccessAt',c.last_success_at,'errorCode',c.error_code,'lastErrorAt',c.last_error_at,'nights',nights,
    'exportGenerated',exists(select 1 from public.ical_exports e where e.listing_id=p_listing and e.token is not null and e.revoked_at is null));
end $$;

create or replace function public.owner_ical_export(p_listing uuid,p_generate boolean default false) returns jsonb
language plpgsql security definer set search_path='' as $$
declare l public.listings; e public.ical_exports; suspended boolean; nights integer;
begin
  if auth.uid() is null then raise exception 'Su sesión venció. Ingrese de nuevo.'; end if;
  select * into l from public.listings where id=p_listing and owner_id=auth.uid() and deleted_at is null for update;
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if not exists(select 1 from public.profiles where id=l.owner_id and is_active and phone_verified_at is not null) then
    raise exception 'Verifique su cuenta para gestionar el calendario.';
  end if;
  suspended:=l.status='rejected' or coalesce(l.admin_hold='blocked',false);
  if p_generate and (suspended or (l.status='draft' and l.first_published_at is null)) then
    raise exception 'Esta casa no permite generar enlaces de calendario.';
  end if;
  select * into e from public.ical_exports where listing_id=p_listing for update;
  if p_generate and e.token is null then
    insert into public.ical_exports(listing_id,token) values(p_listing,pg_catalog.encode(extensions.gen_random_bytes(32),'hex'))
    on conflict(listing_id) do update set token=excluded.token,generated_at=now(),revoked_at=null,generation=public.ical_exports.generation+1
    returning * into e;
  end if;
  select count(*) into nights from public.listing_days d where d.listing_id=p_listing and not d.available
    and d.day between public.costa_rica_today() and public.costa_rica_today()+365;
  return jsonb_build_object('generated',e.token is not null,'suspended',suspended,
    'token',case when suspended then null else e.token end,'nights',nights,'generation',coalesce(e.generation,0));
end $$;

-- Mantiene el núcleo de revocación de #6, añadiendo precondición para reintentos ambiguos.
create function public.revoke_ical_export_generation(p_listing uuid,p_generation bigint) returns void
language plpgsql security definer set search_path='' as $$
declare actual bigint;
begin
  perform public.owner_ical_export(p_listing,false);
  select generation into actual from public.ical_exports where listing_id=p_listing for update;
  if actual is null and p_generation=0 then return; end if;
  if p_generation is null or actual is distinct from p_generation then
    raise exception 'El enlace cambió. Revise el estado e intente de nuevo.';
  end if;
  perform public.revoke_ical_export(p_listing);
end $$;
revoke all on function public.revoke_ical_export_generation(uuid,bigint) from public,anon,authenticated,service_role;
grant execute on function public.revoke_ical_export_generation(uuid,bigint) to authenticated;
