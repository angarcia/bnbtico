-- 3bstays · unificar estadísticas de contacto · 2026-11-20 (decisión de Ana, docs/decisiones.md)
-- Una sola cifra de contacto para el propietario: «Consultas» (filas de inquiries con created_at en 30 días, con la
-- deduplicación de 7 días de create_inquiry y también las creadas por 3bstays). Los toques en WhatsApp (`whatsapp_tap`)
-- dejan de salir en owner_activity: siguen en events solo como telemetría interna del embudo (docs/telemetria.md).
-- Cambian las columnas de salida, así que DROP + CREATE (CREATE OR REPLACE no lo admite) con los mismos permisos.
-- Los clientes anteriores leen whatsapp_taps como ausente y enseñan 0 hasta actualizarse (aceptado).
-- owner_listing_stats ya devolvía solo visitas y consultas: no cambia.
drop function public.owner_activity();

create function public.owner_activity()
 returns table(listing_id uuid, public_id text, views integer, inquiries integer)
 language sql
 stable security definer
 set search_path to 'public'
as $function$
  select l.id, l.public_id,
    (select count(*)::int from events e where e.name = 'listing_view' and e.listing_public_id = l.public_id and e.created_at > now() - interval '30 days'),
    (select count(*)::int from inquiries i where i.listing_id = l.id and i.created_at > now() - interval '30 days')
  from listings l
  where l.owner_id = auth.uid() and l.deleted_at is null
  order by l.created_at desc;
$function$;

revoke all on function public.owner_activity() from public, anon;
grant execute on function public.owner_activity() to authenticated;
