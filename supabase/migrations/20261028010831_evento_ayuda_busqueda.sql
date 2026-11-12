-- bnbtico · fase 6, ticket 01 · evento «search_help_tap» · 2026-10-27
-- «Escribir a bnbtico por WhatsApp» en Explorar («¿No encuentra lo que busca?», sustituto de «Buscan casa»): un evento por
-- toque, sin casa, con la ruta (/explorar, sin la búsqueda), la página, el build y el país. Ni el mensaje ni los filtros.
-- Cuántos toques hay por semana dirá cuándo retomar la búsqueda asistida (docs/telemetria.md).
-- Sin esta migración, el worker responde 204 igual y solo registra «beacon_write_failed» (la fila se pierde).
alter table public.events drop constraint events_name_check;
alter table public.events add constraint events_name_check check (name in ('page_view', 'listing_view', 'whatsapp_tap', 'inquiry_created', 'wizard_step', 'search_help_tap'));
