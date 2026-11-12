-- bnbtico · revisión UX C4 (punto 6) · evento «wizard_step» · 2026-10-27
-- Cada pantalla del asistente de publicar que se abre manda un evento con la casa (CT-####) y la ruta, con el id del borrador
-- ya sustituido por :id (`safePath`); el número de paso va al final de la ruta. Sin datos personales. Sirve para ver en qué
-- pantalla se abandona antes de decidir si sobra, se une o se reordena alguna (docs/telemetria.md).
alter table public.events drop constraint events_name_check;
alter table public.events add constraint events_name_check check (name in ('page_view', 'listing_view', 'whatsapp_tap', 'inquiry_created', 'wizard_step'));
