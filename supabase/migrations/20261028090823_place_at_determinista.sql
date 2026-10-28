-- place_at determinista: un punto en el borde de dos distritos (ST_Covers da los dos) devuelve siempre el de código menor,
-- no el que salga primero del índice. Misma firma, security definer, search_path y grants que en 20261028065237.
create or replace function public.place_at(p_lat double precision, p_lng double precision)
  returns table (province text, canton text, district text, district_code text)
  language sql stable security definer set search_path = public, geo, extensions
as $$
  with pt as (select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326) g),
  inside as (
    select s.code from geo.district_shapes s, pt where ST_Covers(s.geom, pt.g) order by s.code limit 1
  ),
  near as (
    select s.code from geo.district_shapes s, pt
    where not exists (select 1 from inside)
      and s.geom && ST_Expand(pt.g, 0.01)
      and ST_DWithin(s.geom::geography, pt.g::geography, 500)
    order by ST_Distance(s.geom::geography, pt.g::geography), s.code
    limit 1
  ),
  hit as (select code from inside union all select code from near)
  select p.name, c.name, d.name, d.code
  from hit
  join geo.admin_names d on d.code = hit.code
  join geo.admin_names c on c.code = left(hit.code, 3)
  join geo.admin_names p on p.code = left(hit.code, 1);
$$;
revoke execute on function public.place_at(double precision, double precision) from public;
grant execute on function public.place_at(double precision, double precision) to anon, authenticated;
