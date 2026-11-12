-- Ubicación por punto: provincia, cantón y distrito a partir de un pin (spec .scratch/ubicacion-por-punto/spec.md).
-- Los límites vienen de OpenStreetMap (ODbL) y son privados: viven en el esquema `geo`, que no está en [api] schemas de
-- config.toml, sin grants para anon ni authenticated. Solo `place_at` (security definer) los consulta y devuelve nombres
-- y código de distrito, nunca geometría. Los datos los carga la migración siguiente (supabase/datos/distritos-osm-*.sql).

create extension if not exists postgis with schema extensions;

create schema geo;
revoke all on schema geo from public, anon, authenticated;

create table geo.admin_names (
  code text primary key check (code ~ '^[1-7](\d{2}(\d{2})?)?$'),
  level text not null check (level in ('province', 'canton', 'district')),
  name text not null
);

create table geo.district_shapes (
  id bigserial primary key,
  code text not null references geo.admin_names(code),
  geom extensions.geometry(Polygon, 4326) not null
);
create index district_shapes_geom on geo.district_shapes using gist (geom);
create index district_shapes_code on geo.district_shapes (code);

alter table geo.admin_names enable row level security;
alter table geo.district_shapes enable row level security;
revoke all on geo.admin_names, geo.district_shapes from public, anon, authenticated;
revoke all on sequence geo.district_shapes_id_seq from public, anon, authenticated;

-- Carga un distrito: WKT (MULTIPOLYGON sin SRID) → válido → trozos de como mucho 256 vértices, solo polígonos.
create function geo.load_district_shape(p_code text, p_wkt text) returns void
  language sql security definer set search_path = geo, extensions
as $$
  insert into geo.district_shapes (code, geom)
  select p_code, d.geom
  from ST_Subdivide(ST_CollectionExtract(ST_MakeValid(ST_GeomFromText(p_wkt, 4326)), 3), 256) piece,
       lateral ST_Dump(piece) d
  where ST_GeometryType(d.geom) = 'ST_Polygon';
$$;
revoke execute on function geo.load_district_shape(text, text) from public, anon, authenticated;

-- Provincia, cantón y distrito de un punto. Dentro de un polígono: ese distrito. Si no (un pin en la playa, justo fuera
-- de la línea de costa de OSM): el distrito más cercano a 500 m o menos. Más lejos, fuera de Costa Rica o sin
-- coordenadas: ninguna fila.
create function public.place_at(p_lat double precision, p_lng double precision)
  returns table (province text, canton text, district text, district_code text)
  language sql stable security definer set search_path = public, geo, extensions
as $$
  with pt as (select ST_SetSRID(ST_MakePoint(p_lng, p_lat), 4326) g),
  inside as (
    select s.code from geo.district_shapes s, pt where ST_Covers(s.geom, pt.g) limit 1
  ),
  near as (
    select s.code from geo.district_shapes s, pt
    where not exists (select 1 from inside)
      and s.geom && ST_Expand(pt.g, 0.01)
      and ST_DWithin(s.geom::geography, pt.g::geography, 500)
    order by ST_Distance(s.geom::geography, pt.g::geography)
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
