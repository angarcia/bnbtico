-- Ofrece solo las características del catálogo que puede aparecer en Explorar.
create view public.features_with_listings as
select distinct unnest(l.features) as feature
from public.listings_public l
where l.available;

grant select on public.features_with_listings to anon, authenticated;
