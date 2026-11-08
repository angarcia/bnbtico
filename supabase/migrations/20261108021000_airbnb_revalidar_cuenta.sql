-- Revalidar la cuenta al reclamar y publicar: puede desactivarse mientras Airbnb responde.
-- Migración adicional para conservar intacta la primera migración ya ofrecida para aplicar en local.
create or replace function public.airbnb_import_context(p_listing uuid, p_request uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare c public.airbnb_connections; l public.listings;
begin
  select * into l from public.listings where id=p_listing for update;
  if not found or l.deleted_at is not null or l.status='rejected' or l.admin_hold='blocked'
      or not exists(select 1 from public.profiles where id=l.owner_id and is_active and phone_verified_at is not null) then return null; end if;
  select * into c from public.airbnb_connections where listing_id=p_listing for update;
  if not found then return null; end if;
  update public.airbnb_import_attempts set claimed=true
    where request_id=p_request and listing_id=p_listing and version=c.version and state='running' and not claimed
      and started_at > now()-interval '30 seconds';
  if not found then return null; end if;
  return jsonb_build_object('url', c.private_url);
end $$;

create or replace function public.finish_airbnb_import(p_listing uuid, p_request uuid, p_blocks jsonb, p_error text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare l public.listings; c public.airbnb_connections; a public.airbnb_import_attempts;
begin
  select * into l from public.listings where id=p_listing for update;
  if not found then return; end if;
  select * into c from public.airbnb_connections where listing_id=p_listing for update;
  select * into a from public.airbnb_import_attempts where request_id=p_request and listing_id=p_listing for update;
  if a.request_id is null or a.state <> 'running' or not a.claimed or a.version <> c.version then return; end if;
  if l.deleted_at is not null or l.status='rejected' or l.admin_hold='blocked' or a.started_at < now()-interval '30 seconds'
      or not exists(select 1 from public.profiles where id=l.owner_id and is_active and phone_verified_at is not null) then
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
