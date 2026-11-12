-- «Anfitrión» en vez de «propietario» en los mensajes de create_inquiry que ve el cliente (ronda de Ana 2026-11-02,
-- ticket 02). Copia exacta de la versión vigente (20261030233129_admin_casas_acciones.sql, restaurada por
-- 20261103055921_revertir_ronda_2_nov.sql); solo cambian los tres textos. Sin cambios de lógica ni de permisos.
CREATE OR REPLACE FUNCTION public.create_inquiry(p_public_id text, p_arrival date, p_departure date, p_people integer, p_message text)
 RETURNS TABLE(inquiry_id uuid, whatsapp_phone text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
#variable_conflict use_column
declare
  uid uuid := auth.uid();
  prof public.profiles;
  l public.listings;
  msg text := btrim(coalesce(p_message, ''));
  today date := (now() at time zone 'America/Costa_Rica')::date;
  found_id uuid;
  others int;
begin
  if uid is null then raise exception 'Ingrese con su WhatsApp para contactar al anfitrión.'; end if;
  select * into prof from public.profiles where id = uid;
  if not found or not prof.is_active then raise exception 'Su cuenta está desactivada. Escríbanos por WhatsApp.'; end if;
  if prof.phone_verified_at is null then raise exception 'Verifique su WhatsApp para contactar al anfitrión.'; end if;

  select * into l from public.listings where public_id = p_public_id and status = 'active' and admin_hold is null and deleted_at is null;
  if not found then raise exception 'Esta casa ya no está publicada.'; end if;
  if l.owner_id = uid then raise exception 'Esta es su propia casa.'; end if;
  if not l.available then raise exception 'Esta casa no está disponible para consultas.'; end if;

  -- Mismo orden y mensajes que validateInquiryDraft (src/domain/inquiry.ts).
  if (p_arrival is null) <> (p_departure is null) then raise exception 'Indique la llegada y la salida, o deje las dos vacías.'; end if;
  if p_arrival is not null then
    if p_departure <= p_arrival then raise exception 'La salida tiene que ser después de la llegada.'; end if;
    if p_arrival < today then raise exception 'La llegada no puede ser antes de hoy.'; end if;
  end if;
  if p_people is not null and (p_people < 1 or p_people > 50) then raise exception 'Indique entre 1 y 50 personas.'; end if;
  if msg = '' then raise exception 'Escriba un mensaje para el anfitrión.'; end if;
  if char_length(msg) > 1000 then raise exception 'El mensaje no puede pasar de 1000 caracteres.'; end if;

  -- Dos toques seguidos del mismo cliente a la misma casa no crean dos filas.
  perform pg_advisory_xact_lock(hashtextextended(uid::text || l.id::text, 0));

  select count(distinct i.listing_id) into others from public.inquiries i
   where i.client_id = uid and i.updated_at > now() - interval '24 hours' and i.listing_id <> l.id;
  if others >= 20 then raise exception 'Ha contactado muchas casas hoy. Intente mañana o escríbanos por WhatsApp.'; end if;

  select i.id into found_id from public.inquiries i
   where i.client_id = uid and i.listing_id = l.id and i.created_at > now() - interval '7 days'
   order by i.created_at desc limit 1;

  if found_id is null then
    insert into public.inquiries (listing_id, client_id, owner_id, arrival, departure, people, message, consent_share_phone, whatsapp_phone, source)
    values (l.id, uid, l.owner_id, p_arrival, p_departure, p_people, msg, true, l.whatsapp_phone, 'listing')
    returning id into found_id;
  else
    update public.inquiries
       set arrival = p_arrival, departure = p_departure, people = p_people, message = msg, consent_share_phone = true,
           whatsapp_phone = l.whatsapp_phone, updated_at = now(), owner_opened_at = null
     where id = found_id;
  end if;

  return query select found_id, l.whatsapp_phone;
end $function$;
