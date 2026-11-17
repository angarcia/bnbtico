-- Issue #13 (épica DBA #9): las lecturas del calendario devolvían una fila por día y PostgREST corta en max_rows = 200,
-- pero la ventana (hoy + 365) admite 366 días excepcionales: las noches posteriores a la fila 200 llegaban como libres.
-- Ahora cada lectura devuelve un único jsonb con todos los días, en orden: una sola respuesta, completa o fallida, sin
-- subir max_rows. El cuerpo HTTP tiene la misma forma que antes ([{day, available, ...}]), así que la app desplegada
-- sigue leyéndolo durante el despliegue. Permisos, ventana y filtros de visibilidad no cambian.

drop function public.owner_calendar_days(uuid);
create function public.owner_calendar_days(p_listing uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null then raise exception 'Su sesión venció. Ingrese de nuevo.'; end if;
  if not exists(select 1 from public.listings where id=p_listing and owner_id=auth.uid() and deleted_at is null) then
    return '[]'::jsonb;
  end if;
  return coalesce((select jsonb_agg(to_jsonb(d) order by d.day) from public.effective_calendar_days(p_listing) d), '[]'::jsonb);
end $$;
revoke all on function public.owner_calendar_days(uuid) from public,anon;
grant execute on function public.owner_calendar_days(uuid) to authenticated;

drop function public.admin_calendar_days(uuid);
create function public.admin_calendar_days(p_listing uuid) returns jsonb
language plpgsql stable security definer set search_path='' as $$
begin
  if not public.is_admin() then return '[]'::jsonb; end if;
  if not exists(select 1 from public.listings where id=p_listing and deleted_at is null) then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(to_jsonb(d) order by d.day) from public.effective_calendar_days(p_listing) d), '[]'::jsonb);
end $$;
revoke all on function public.admin_calendar_days(uuid) from public,anon;
grant execute on function public.admin_calendar_days(uuid) to authenticated;

drop function public.public_listing_days(text);
create function public.public_listing_days(p_public_id text) returns jsonb
language sql stable security definer set search_path='' as $$
  select coalesce(jsonb_agg(jsonb_build_object('day',d.day,'available',d.available,'special_price_crc',d.special_price_crc)
    order by d.day), '[]'::jsonb)
  from public.listings l cross join lateral public.effective_calendar_days(l.id) d
  where l.public_id=p_public_id and l.status='active' and l.admin_hold is null and l.deleted_at is null
$$;
revoke all on function public.public_listing_days(text) from public;
grant execute on function public.public_listing_days(text) to anon, authenticated;
