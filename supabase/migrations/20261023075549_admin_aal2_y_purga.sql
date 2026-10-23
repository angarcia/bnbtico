-- bnbtico · fase R, ticket 09: admin con segundo factor exigido en SQL y purga de la ficha desde Postgres · 2026-10-23
--
-- 1) Admin = profiles.is_admin Y sesión aal2 (segundo código por teléfono). Todas las políticas RLS de admin (listings,
--    profiles, listing_photos/rates/days vía listing_visible, inquiries, request_matches, admin_actions, alta de casas),
--    las excepciones de admin de los triggers y review_listing pasan por is_admin(); exigir aal2 dentro de la función lo
--    aplica a todas a la vez, también a las que se añadan después. Un admin en aal1 se comporta como un usuario normal.
--    Consecuencia: la app vieja (apps/web) revisa con una sesión aal1 y deja de poder revisar en cuanto esto se aplique.
-- 2) Purga de la ficha /casa/CT-#### en Cloudflare: el navegador no puede llamar a /_purge (el secreto no puede estar en
--    él). Un trigger encola con pg_net un POST a <worker_purge_url>/_purge/CT-#### con el secreto, ambos en Vault. Sin
--    los dos secretos no hace nada; un fallo al encolar nunca rompe la transacción.

-- ---------- 1. Admin exige aal2 ----------
create or replace function is_admin() returns boolean language sql stable security definer set search_path = public as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
     and coalesce((select is_admin from profiles where id = auth.uid()), false)
$$;

create or replace function review_listing(p_listing uuid, p_decision text, p_note text) returns listing_status language plpgsql security definer set search_path = public as $$
declare
  l listings;
  note text := left(btrim(coalesce(p_note, '')), 2000);
  next_status listing_status;
  n_photos int;
begin
  if not is_admin() then
    if coalesce((select is_admin from profiles where id = auth.uid()), false) then
      raise exception 'Confirme el segundo código para revisar anuncios.';
    end if;
    raise exception 'Solo bnbtico puede revisar anuncios.';
  end if;
  select * into l from listings where id = p_listing;
  if not found then raise exception 'No encontramos ese anuncio.'; end if;
  if l.status <> 'review' then raise exception 'Este anuncio ya tiene una decisión.'; end if;
  if p_decision not in ('approve','changes','reject') then raise exception 'Decisión no válida.'; end if;
  if p_decision <> 'approve' and note = '' then raise exception 'Escriba un motivo de hasta 2000 caracteres para pedir cambios o rechazar.'; end if;
  if p_decision = 'approve' then
    select count(*) into n_photos from listing_photos where listing_id = p_listing;
    if n_photos < 5 then raise exception 'Pida al menos 5 fotos antes de aprobar.'; end if;
  end if;
  next_status := case p_decision when 'approve' then 'active'::listing_status when 'changes' then 'changes' else 'rejected' end;
  perform set_config('app.allow_status', 'on', true);
  update listings set status = next_status, review_note = nullif(note, ''), reviewed_at = now(), reviewed_by = auth.uid() where id = p_listing;
  insert into admin_actions (admin_id, action, target_listing_id, reason) values (auth.uid(), 'listing.' || p_decision, p_listing, nullif(note, ''));
  if p_decision = 'approve' then update profiles set is_owner = true where id = l.owner_id; end if;
  return next_status;
end $$;

-- ---------- 2. Purga de la ficha pública ----------
create extension if not exists pg_net;

-- Encola la purga de una ficha. URL base (p. ej. https://nueva.bnbtico.com) y secreto (PURGE_SECRET del worker) en Vault:
--   select vault.create_secret('<url>', 'worker_purge_url');  select vault.create_secret('<secreto>', 'worker_purge_secret');
create or replace function purge_listing_page(p_public_id text) returns void language plpgsql security definer set search_path = public as $$
declare
  base text;
  secret text;
begin
  select decrypted_secret into base from vault.decrypted_secrets where name = 'worker_purge_url' limit 1;
  select decrypted_secret into secret from vault.decrypted_secrets where name = 'worker_purge_secret' limit 1;
  if coalesce(base, '') = '' or coalesce(secret, '') = '' or p_public_id is null then return; end if;
  perform net.http_post(
    url := rtrim(base, '/') || '/_purge/' || p_public_id,
    body := '{}'::jsonb,
    headers := jsonb_build_object('Authorization', 'Bearer ' || secret, 'Content-Type', 'application/json'),
    timeout_milliseconds := 5000
  );
exception when others then
  raise warning 'No se pudo encolar la purga de %: %', p_public_id, sqlerrm;
end $$;
revoke execute on function purge_listing_page(text) from public, anon, authenticated;

-- Una casa que es o fue activa en este cambio: estado (aprobar, reabrir, rechazar…), disponibilidad o contenido.
create or replace function listings_purge_page() returns trigger language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'DELETE' then
    if old.status = 'active' then perform purge_listing_page(old.public_id); end if;
    return null;
  end if;
  if (old.status = 'active' or new.status = 'active')
     and (to_jsonb(old) - 'updated_at') is distinct from (to_jsonb(new) - 'updated_at') then
    perform purge_listing_page(new.public_id);
  end if;
  return null;
end $$;
create trigger listings_purge_page after update or delete on listings for each row execute function listings_purge_page();

create or replace function listing_photos_purge_page() returns trigger language plpgsql security definer set search_path = public as $$
declare
  pid text;
begin
  select public_id into pid from listings where id = coalesce(new.listing_id, old.listing_id) and status = 'active';
  if pid is not null then perform purge_listing_page(pid); end if;
  return null;
end $$;
create trigger listing_photos_purge_page after insert or update or delete on listing_photos for each row execute function listing_photos_purge_page();
