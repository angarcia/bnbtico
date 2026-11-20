-- Historia #68 (segv1-coordenadas), contrato aprobado el 2026-11-20 (.scratch/seguridad-2026-11-17/01-contrato-privacidad.md).
-- approx_point sacaba el desplazamiento de md5(public_id): con el CT público, cualquiera recuperaba el punto exacto. Ahora el
-- punto público es un dato guardado con un desplazamiento aleatorio de 150–499 m, que solo cambia cuando cambia la ubicación.
-- Las salidas públicas (listings_public y, a través de ella, search_listings) conservan los nombres lat/lng: el navegador no
-- cambia. Los puntos publicados hasta hoy se dan por quemados: todas las casas reciben uno nuevo.

alter table public.listings add column public_lat double precision, add column public_lng double precision;

-- Lo escribe solo este trigger: un valor que mande el navegador se ignora (las columnas no se pueden revocar aparte porque
-- la tabla se concede entera y la autorización va por RLS). Sin ubicación, sin punto público.
create or replace function public.listings_public_point() returns trigger language plpgsql security definer set search_path = '' as $$
declare
  dist double precision;
  ang double precision;
begin
  if tg_op = 'UPDATE' and new.lat is not distinct from old.lat and new.lng is not distinct from old.lng and old.public_lat is not null then
    new.public_lat := old.public_lat;
    new.public_lng := old.public_lng;
    return new;
  end if;
  if new.lat is null or new.lng is null then
    new.public_lat := null;
    new.public_lng := null;
    return new;
  end if;
  dist := 150 + random() * 349;
  ang := random() * 2 * pi();
  new.public_lat := new.lat + (dist * cos(ang)) / 111320.0;
  new.public_lng := new.lng + (dist * sin(ang)) / (111320.0 * cos(radians(new.lat)));
  return new;
end $$;
revoke all on function public.listings_public_point() from public, anon, authenticated;

create trigger listings_public_point before insert or update on public.listings for each row execute function public.listings_public_point();

-- Casas existentes: un punto nuevo para cada una. Sin tocar updated_at (no es un cambio de la casa) y con las protecciones
-- abiertas como en las RPCs. listings_purge_page sí salta: purga la ficha en caché de cada casa activa.
alter table public.listings disable trigger listings_updated;
set local app.allow_status = 'on';
update public.listings set public_lat = null, public_lng = null where lat is not null and lng is not null;
alter table public.listings enable trigger listings_updated;

create or replace view public.listings_public as
 SELECT l.id,
    l.public_id,
    l.kind,
    l.title,
    l.description,
    l.province,
    l.canton,
    l.zone,
    l.public_lat AS lat,
    l.public_lng AS lng,
    l.capacity,
    l.bedrooms,
    l.bathrooms,
    l.bathroom_shared,
    l.features,
    l.parking_paid,
    l.accepts_nightly,
    l.nightly_price_crc,
    l.min_nights,
    l.accepts_monthly,
    l.monthly_mode,
    l.monthly_price_crc,
    l.min_months,
    l.available,
    l.reopen_at,
    l.created_at,
    l.updated_at,
    p.full_name AS owner_name,
    p.phone_verified_at IS NOT NULL AS owner_whatsapp_verified,
    COALESCE(( SELECT jsonb_agg(ph.path ORDER BY ph."position", ph.created_at) AS jsonb_agg
           FROM public.listing_photos ph
          WHERE ph.listing_id = l.id), '[]'::jsonb) AS photos
   FROM public.listings l
     JOIN public.profiles p ON p.id = l.owner_id
  WHERE l.status = 'active'::public.listing_status AND l.admin_hold IS NULL AND l.deleted_at IS NULL;

drop function public.approx_point(double precision, double precision, text);
