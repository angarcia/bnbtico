-- bnbtico · fase R · cliente_directo, parte uno (ticket 02) · 2026-10-22
-- La app nueva lee PostgREST desde el navegador: el catálogo tiene que ser una sola consulta. La vista pública lleva
-- las rutas de las fotos en orden (la portada es la primera) y las provincias con casas salen de una vista.

drop view listings_public;
create view listings_public as
  select l.id, l.public_id, l.kind, l.title, l.description, l.province, l.canton, l.zone,
         (approx_point(l.lat, l.lng, l.public_id))[0] as lat, (approx_point(l.lat, l.lng, l.public_id))[1] as lng,
         l.capacity, l.bedrooms, l.bathrooms, l.bathroom_shared, l.features, l.parking_paid,
         l.accepts_nightly, l.nightly_price_crc, l.min_nights, l.accepts_monthly, l.monthly_mode, l.monthly_price_crc, l.min_months,
         l.available, l.reopen_at, l.created_at, l.updated_at,
         p.full_name as owner_name, (p.phone_verified_at is not null) as owner_whatsapp_verified,
         coalesce((select jsonb_agg(ph.path order by ph.position, ph.created_at) from listing_photos ph where ph.listing_id = l.id), '[]'::jsonb) as photos
  from listings l join profiles p on p.id = l.owner_id
  where l.status = 'active';

create view provinces_with_listings as
  select province, count(*)::int as listings
  from listings_public
  group by province;

grant select on listings_public, provinces_with_listings to anon, authenticated;
