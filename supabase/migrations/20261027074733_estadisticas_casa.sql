-- bnbtico · revisión UX A2 · visitas y consultas de una casa para su propietario · 2026-10-27
-- «N visitas · N consultas · últimos 30 días» en Inicio y en el detalle de la casa: lo que hace que el propietario vea que
-- la ficha funciona (y renueve). `events` sigue sin leerse desde el navegador: solo salen estos dos totales, y solo para
-- el dueño de la casa o el admin. Las visitas son las balizas `listing_view` (la ficha no la manda cuando la abre su dueño).
create or replace function owner_listing_stats(p_listing uuid) returns table (views int, inquiries int)
language plpgsql stable security definer set search_path = public as $$
declare
  l listings;
begin
  select * into l from listings where id = p_listing;
  if not found or (l.owner_id is distinct from auth.uid() and not is_admin()) then
    raise exception 'No encontramos ese anuncio.';
  end if;
  return query select
    (select count(*)::int from events e where e.name = 'listing_view' and e.listing_public_id = l.public_id and e.created_at > now() - interval '30 days'),
    (select count(*)::int from inquiries i where i.listing_id = p_listing and i.created_at > now() - interval '30 days');
end $$;

revoke all on function owner_listing_stats(uuid) from public, anon;
grant execute on function owner_listing_stats(uuid) to authenticated;
