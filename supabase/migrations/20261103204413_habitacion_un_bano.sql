-- Una Habitación es siempre 1 baño, como ya era 1 habitación (ronda de Ana del 2026-11-02, ticket 03; ajuste de Daniel del
-- 2026-11-03): el asistente y la edición ya no preguntan baños a una Habitación, solo si el baño es privado o compartido.
-- 1) El trigger listings_habitacion_una (de 20261103184011) fija también bathrooms = 1 y se dispara además en los UPDATE que
--    nombran bathrooms. Sigue sin chocar con listings_protect: solo ajusta NEW y nunca lanza errores; listings_protect no
--    mira bedrooms ni bathrooms para decidir y corre después (orden alfabético de los BEFORE).
-- 2) Arreglo de datos: toda Habitación existente queda en 1 habitación y 1 baño (podía tener null, 0 o más baños).
-- 3) update_listing_live (de 20261103055921, la vigente): para una Habitación (el tipo aprobado) no pide baños: los deja
--    en 1 antes de validar, así un patch sin baños, con null o con otra cifra se guarda igual. Lo demás no cambia, tampoco
--    su «bedrooms ≥ 1» para una Habitación (ticket 03, «No tocar»; la app manda 1 y el trigger deja 1 si llega otra cifra).
-- listing_edit_check (de 20261103184011) no pide baños: no cambia. submit_listing sigue pidiendo «bathrooms ≥ 1», que una
-- Habitación cumple siempre gracias al trigger. listing_edits no guarda baños: no hay propuesta que normalizar.

create or replace function public.listings_habitacion_una() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kind = 'habitacion' then
    new.bedrooms := 1;
    new.bathrooms := 1;
  end if;
  return new;
end $$;

drop trigger listings_habitacion_una on public.listings;
create trigger listings_habitacion_una before insert or update of kind, bedrooms, bathrooms on public.listings
for each row execute function public.listings_habitacion_una();

select set_config('app.allow_status', 'on', true);
update public.listings set bedrooms = 1, bathrooms = 1
where kind = 'habitacion' and (bedrooms is distinct from 1 or bathrooms is distinct from 1);
select set_config('app.allow_status', 'off', true);

create or replace function public.update_listing_live(p_listing uuid, p_patch jsonb) returns void
language plpgsql security definer set search_path = '' as $$
declare
  l public.listings;
  m public.listings;
  not_here constant text := 'Ese dato no se puede cambiar aquí.';
begin
  l := public.own_published_listing(p_listing);
  if p_patch is null or jsonb_typeof(p_patch) <> 'object'
     or exists (select 1 from jsonb_object_keys(p_patch) k
                where k <> all (array['capacity','bedrooms','bathrooms','features','parking_paid','nightly_price_crc','accepts_monthly','monthly_price_crc'])) then
    raise exception '%', not_here;
  end if;
  if p_patch ? 'features' and jsonb_typeof(p_patch -> 'features') <> 'array' then raise exception '%', not_here; end if;
  begin
    m := jsonb_populate_record(l, p_patch);
  exception when data_exception then
    -- Un tipo que no es (texto en un número, una característica que no existe…).
    raise exception '%', not_here;
  end;
  if m.accepts_monthly is null or array_position(m.features, null) is not null then raise exception '%', not_here; end if;
  if not m.accepts_monthly then m.monthly_price_crc := null; end if;
  -- Una Habitación no pide baños: es 1 (como el trigger listings_habitacion_una).
  if l.kind = 'habitacion' then m.bathrooms := 1; end if;

  if coalesce(m.capacity, 0) < 1 then raise exception 'Indique cuántas personas pueden alojarse (mínimo 1).'; end if;
  if m.bedrooms is null or (m.bedrooms < 1 and l.kind not in ('completo','apartamento')) then raise exception 'Indique las habitaciones; solo un alojamiento completo tipo estudio puede tener 0.'; end if;
  if coalesce(m.bathrooms, 0) < 1 then raise exception 'Indique el número de baños (mínimo 1).'; end if;
  if 'parking' = any(m.features) then
    if m.parking_paid is null then raise exception 'Indique si el parqueo es gratuito o de pago.'; end if;
  elsif m.parking_paid is not null then
    raise exception 'El tipo de parqueo solo aplica si el anuncio tiene parqueo.';
  end if;
  if coalesce(m.nightly_price_crc, 0) <= 0 then raise exception 'Indique el precio por noche en colones.'; end if;
  if m.accepts_monthly and m.monthly_price_crc is not null and m.monthly_price_crc <= 0 then raise exception 'Indique el precio al mes en colones o déjelo vacío.'; end if;

  perform set_config('app.allow_status', 'on', true);
  update public.listings set capacity = m.capacity, bedrooms = m.bedrooms, bathrooms = m.bathrooms, features = m.features,
    parking_paid = m.parking_paid, nightly_price_crc = m.nightly_price_crc, accepts_monthly = m.accepts_monthly,
    monthly_price_crc = m.monthly_price_crc
  where id = p_listing;
end $$;
