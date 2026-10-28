-- bnbtico · navegación simple · actividad de 30 días de las casas del propietario · 2026-10-27
-- Pantalla Actividad: una fila por casa propia (cualquier estado) con visitas (`listing_view`), toques en WhatsApp
-- (`whatsapp_tap`) y consultas de los últimos 30 días. `events` sigue sin leerse desde el navegador: solo salen totales.
-- owner_listing_stats(p_listing) sigue para el detalle de una casa.
create or replace function owner_activity()
returns table (listing_id uuid, public_id text, views int, whatsapp_taps int, inquiries int)
language sql stable security definer set search_path = public as $$
  select l.id, l.public_id,
    (select count(*)::int from events e where e.name = 'listing_view' and e.listing_public_id = l.public_id and e.created_at > now() - interval '30 days'),
    (select count(*)::int from events e where e.name = 'whatsapp_tap' and e.listing_public_id = l.public_id and e.created_at > now() - interval '30 days'),
    (select count(*)::int from inquiries i where i.listing_id = l.id and i.created_at > now() - interval '30 days')
  from listings l
  where l.owner_id = auth.uid()
  order by l.created_at desc;
$$;
revoke all on function owner_activity() from public, anon;
grant execute on function owner_activity() to authenticated;
