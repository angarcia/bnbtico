-- El texto se prepara en el teléfono para WhatsApp.
CREATE OR REPLACE FUNCTION public.create_inquiry(p_public_id text, p_arrival date, p_departure date, p_people integer)
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
  today date := (now() at time zone 'America/Costa_Rica')::date;
  found_id uuid;
  others int;
begin
  if uid is null then raise exception 'Ingrese con su WhatsApp para contactar al anfitrión.'; end if;
  select * into prof from public.profiles where id = uid;
  if not found or not prof.is_active then raise exception 'Su cuenta está desactivada. Escríbanos por WhatsApp.'; end if;
  if prof.phone_verified_at is null then raise exception 'Verifique su WhatsApp para contactar al anfitrión.'; end if;

  select * into l from public.listings where public_id = p_public_id and status = 'active' and admin_hold is null and deleted_at is null for update;
  if not found then raise exception 'Esta casa ya no está publicada.'; end if;
  if l.owner_id = uid then raise exception 'Esta es su propia casa.'; end if;
  if not l.available then raise exception 'Esta casa no está disponible para consultas.'; end if;

  -- Mismo orden y mensajes que validateInquiryDetails (src/domain/inquiry.ts).
  if (p_arrival is null) <> (p_departure is null) then raise exception 'Indique la llegada y la salida, o deje las dos vacías.'; end if;
  if p_arrival is not null then
    if p_departure <= p_arrival then raise exception 'La salida tiene que ser después de la llegada.'; end if;
    if p_arrival < today then raise exception 'La llegada no puede ser antes de hoy.'; end if;
  end if;
  if p_people is not null and (p_people < 1 or p_people > 50) then raise exception 'Indique entre 1 y 50 personas.'; end if;
  if p_arrival is not null and public.listing_has_busy_nights(l.id, p_arrival, p_departure) then
    raise exception 'Hay noches ocupadas entre esas fechas.';
  end if;

  -- Dos toques seguidos del mismo cliente a la misma casa no crean dos filas.
  perform pg_advisory_xact_lock(hashtextextended(uid::text || l.id::text, 0));

  select count(distinct i.listing_id) into others from public.inquiries i
   where i.client_id = uid and i.updated_at > now() - interval '24 hours' and i.listing_id <> l.id;
  if others >= 20 then raise exception 'Ha contactado muchas casas hoy. Intente mañana o escríbanos por WhatsApp.'; end if;

  select i.id into found_id from public.inquiries i
   where i.client_id = uid and i.listing_id = l.id and i.created_at > now() - interval '7 days'
   order by i.created_at desc limit 1;

  if found_id is null then
    insert into public.inquiries (listing_id, client_id, owner_id, arrival, departure, people, consent_share_phone, whatsapp_phone, source)
    values (l.id, uid, l.owner_id, p_arrival, p_departure, p_people, true, l.whatsapp_phone, 'listing')
    returning id into found_id;
  else
    update public.inquiries
       set arrival = p_arrival, departure = p_departure, people = p_people, consent_share_phone = true,
           whatsapp_phone = l.whatsapp_phone, updated_at = now(), owner_opened_at = null
     where id = found_id;
  end if;

  return query select found_id, l.whatsapp_phone;
end $function$;

revoke all on function public.create_inquiry(text, date, date, integer) from public, anon;
grant execute on function public.create_inquiry(text, date, date, integer) to authenticated;

-- Las pestañas abiertas durante el despliegue aún pueden usar la firma anterior.
create or replace function public.create_inquiry(p_public_id text, p_arrival date, p_departure date, p_people integer, p_message text)
returns table(inquiry_id uuid, whatsapp_phone text)
language sql
set search_path = ''
as $$
  select * from public.create_inquiry(p_public_id, p_arrival, p_departure, p_people)
$$;

CREATE OR REPLACE FUNCTION public.owner_inquiry_details()
 RETURNS TABLE(id uuid, listing_id uuid, public_id text, listing_title text, client_name text, client_phone text, arrival date, departure date, people integer, created_at timestamp with time zone, updated_at timestamp with time zone, owner_opened_at timestamp with time zone, source text)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select i.id, i.listing_id, l.public_id, l.title, p.full_name, p.phone,
         i.arrival, i.departure, i.people,
         i.created_at, i.updated_at, i.owner_opened_at, i.source
    from public.inquiries i
    join public.listings l on l.id = i.listing_id
    join public.profiles p on p.id = i.client_id
   where i.owner_id = auth.uid() and l.deleted_at is null
   order by i.updated_at desc, i.id
   limit 200
$function$;

revoke all on function public.owner_inquiry_details() from public, anon;
grant execute on function public.owner_inquiry_details() to authenticated;

-- La versión anterior de Consultas espera una cadena y llama a trim().
CREATE OR REPLACE FUNCTION public.owner_inquiries()
 RETURNS TABLE(id uuid, listing_id uuid, public_id text, listing_title text, client_name text, client_phone text, arrival date, departure date, people integer, message text, created_at timestamp with time zone, updated_at timestamp with time zone, owner_opened_at timestamp with time zone, source text)
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
  select i.id, i.listing_id, i.public_id, i.listing_title, i.client_name, i.client_phone,
         i.arrival, i.departure, i.people, ''::text,
         i.created_at, i.updated_at, i.owner_opened_at, i.source
    from public.owner_inquiry_details() i
   order by i.updated_at desc, i.id
$function$;

alter table public.inquiries drop column message;
