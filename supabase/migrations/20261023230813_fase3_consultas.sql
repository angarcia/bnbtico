-- bnbtico · fase 3, ticket 01 · consultas por WhatsApp y favoritos en la base · 2026-10-23
--
-- 1) inquiries: la consulta solo se crea o se renueva con la RPC create_inquiry, que comprueba sesión, cuenta, casa y
--    datos, deduplica (misma casa en 7 días → se actualiza) y limita (20 casas distintas en 24 h). Es el ÚNICO camino
--    por el que alguien que no es el dueño obtiene el WhatsApp de una casa («el número de la casa solo se entrega al
--    contactar»): la vista pública no lo tiene, la tabla listings solo la leen dueño y admin, y la columna
--    inquiries.whatsapp_phone (copia del número entregado) no se puede leer por REST.
--    El propietario ve nombre y WhatsApp del cliente solo con owner_inquiries() (el perfil del cliente no es legible).
-- 2) favorites: solo se guardan casas publicadas; sin update (el listing_id no se cambia por detrás del check).
-- 3) events acepta inquiry_created.

-- ---------- 1. inquiries ----------
alter table public.inquiries
  add column whatsapp_phone text,
  add column updated_at timestamptz not null default now(),
  add column owner_opened_at timestamptz,
  add column source text not null default 'listing' check (source in ('listing', 'bnbtico'));

update public.inquiries i set whatsapp_phone = l.whatsapp_phone, updated_at = i.created_at from public.listings l where l.id = i.listing_id;
alter table public.inquiries alter column whatsapp_phone set not null;

create index inquiries_owner_updated on public.inquiries (owner_id, updated_at desc);
create index inquiries_client_updated on public.inquiries (client_id, updated_at desc);

drop policy inquiries_insert on public.inquiries;
-- inquiries_select (cliente las suyas, dueño las de sus casas, admin aal2 todas) se queda. Escribir solo con las RPCs.
revoke all on table public.inquiries from public, anon, authenticated;
grant select (id, listing_id, client_id, owner_id, arrival, departure, people, message, consent_share_phone, created_at, updated_at, owner_opened_at, source)
  on table public.inquiries to authenticated;

create or replace function public.create_inquiry(p_public_id text, p_arrival date, p_departure date, p_people int, p_message text)
returns table (inquiry_id uuid, whatsapp_phone text)
language plpgsql security definer set search_path = '' as $$
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
  if uid is null then raise exception 'Ingrese con su WhatsApp para contactar al propietario.'; end if;
  select * into prof from public.profiles where id = uid;
  if not found or not prof.is_active then raise exception 'Su cuenta está desactivada. Escríbanos por WhatsApp.'; end if;
  if prof.phone_verified_at is null then raise exception 'Verifique su WhatsApp para contactar al propietario.'; end if;

  select * into l from public.listings where public_id = p_public_id and status = 'active';
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
  if msg = '' then raise exception 'Escriba un mensaje para el propietario.'; end if;
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
end $$;

-- El propietario tocó «Abrir WhatsApp» en una consulta suya: deja de ser «Nueva». La primera vez cuenta.
create or replace function public.mark_inquiry_opened(p_id uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.inquiries set owner_opened_at = coalesce(owner_opened_at, now()) where id = p_id and owner_id = auth.uid();
  if not found then raise exception 'No encontramos esa consulta.'; end if;
end $$;

-- Mis consultas: las del propietario de la sesión (nunca las de otros, tampoco para el admin), con el nombre y el
-- WhatsApp del cliente, la más reciente primero, como mucho 200.
create or replace function public.owner_inquiries()
returns table (
  id uuid, listing_id uuid, public_id text, listing_title text, client_name text, client_phone text,
  arrival date, departure date, people int, message text,
  created_at timestamptz, updated_at timestamptz, owner_opened_at timestamptz, source text
)
language sql stable security definer set search_path = '' as $$
  select i.id, i.listing_id, l.public_id, l.title, p.full_name, p.phone,
         i.arrival, i.departure, i.people, i.message,
         i.created_at, i.updated_at, i.owner_opened_at, i.source
    from public.inquiries i
    join public.listings l on l.id = i.listing_id
    join public.profiles p on p.id = i.client_id
   where i.owner_id = auth.uid()
   order by i.updated_at desc, i.id
   limit 200
$$;

revoke all on function public.create_inquiry(text, date, date, int, text) from public, anon;
revoke all on function public.mark_inquiry_opened(uuid) from public, anon;
revoke all on function public.owner_inquiries() from public, anon;
grant execute on function public.create_inquiry(text, date, date, int, text) to authenticated;
grant execute on function public.mark_inquiry_opened(uuid) to authenticated;
grant execute on function public.owner_inquiries() to authenticated;

-- ---------- 2. favorites ----------
-- La tabla listings no es legible para quien no es dueño: el check usa un helper con los privilegios del definidor.
create or replace function public.listing_is_published(p_listing uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.listings l where l.id = p_listing and l.status = 'active')
$$;
revoke all on function public.listing_is_published(uuid) from public, anon;
grant execute on function public.listing_is_published(uuid) to authenticated;

alter table public.favorites alter column user_id set default auth.uid();

drop policy favorites_self on public.favorites;
create policy favorites_select on public.favorites for select to authenticated using (user_id = auth.uid());
create policy favorites_insert on public.favorites for insert to authenticated
  with check (user_id = auth.uid() and public.listing_is_published(listing_id));
create policy favorites_delete on public.favorites for delete to authenticated using (user_id = auth.uid());

revoke all on table public.favorites from public, anon, authenticated;
grant select, insert, delete on table public.favorites to authenticated;

-- ---------- 3. Telemetría ----------
alter table public.events drop constraint events_name_check;
alter table public.events add constraint events_name_check check (name in ('page_view', 'listing_view', 'whatsapp_tap', 'inquiry_created'));
