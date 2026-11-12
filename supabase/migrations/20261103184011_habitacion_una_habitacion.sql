-- Una Habitación es siempre 1 habitación (ronda de Ana del 2026-11-02, ticket 03, rehecho tras la reversión 20261103055921):
-- el asistente y la edición ya no lo preguntan.
-- 1) Garantía en la base: un trigger BEFORE fija bedrooms = 1 siempre que kind = 'habitacion', sea cual sea el camino
--    (asistente, update_listing_live, aprobar un cambio de tipo en review_edit_field, el admin o SQL a mano). Se dispara
--    al insertar y en los UPDATE que nombran kind o bedrooms. Se eligió un trigger y no un CHECK: un CHECK haría fallar
--    esos caminos (aprobar el cambio de tipo de un completo de 3 habitaciones, por ejemplo) en vez de dejar el dato bien.
--    No choca con listings_protect: los triggers BEFORE corren por orden alfabético (listings_habitacion_una,
--    listings_insert_guard, listings_protect, listings_updated); éste solo ajusta NEW, nunca lanza errores, y
--    listings_protect no mira bedrooms (rechaza o deja pasar el UPDATE entero por quién lo hace, el estado y los datos
--    protegidos), así que decide lo mismo con o sin el ajuste.
-- 2) Arreglo de datos: toda Habitación existente queda en 1 (podía ser null, 0 o más). En bnbtico-pruebas ya lo dejó así
--    20261102225346 (la reversión quitó el trigger, no los datos); aquí se repite por si alguna se escribió después.
-- 3) listing_edit_check (de 20261103055921, que restauró la de 20261030092712) no pide habitaciones cuando el tipo
--    resultante es Habitación: si no, pasar un estudio (0 habitaciones) a Habitación fallaría al enviar y al aprobar sin que
--    el anfitrión pudiera arreglarlo (la edición ya no muestra ese contador). Al aprobar, el trigger deja 1.
-- update_listing_live no cambia: su «bedrooms ≥ 1» para una Habitación se cumple con el 1 que manda la app.
-- listing_edits no guarda bedrooms: no hay propuesta que normalizar.

create or replace function public.listings_habitacion_una() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.kind = 'habitacion' then new.bedrooms := 1; end if;
  return new;
end $$;

create trigger listings_habitacion_una before insert or update of kind, bedrooms on public.listings
for each row execute function public.listings_habitacion_una();

select set_config('app.allow_status', 'on', true);
update public.listings set bedrooms = 1 where kind = 'habitacion' and bedrooms is distinct from 1;
select set_config('app.allow_status', 'off', true);

create or replace function public.listing_edit_check(l public.listings, e public.listing_edits) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  k public.listing_kind := coalesce(e.kind, l.kind);
  d text := btrim(coalesce(e.description, ''));
begin
  if e.lat is not null then perform public.edit_place(e.lat, e.lng, e.zone, e.zone_id, e.zone_source); end if;
  -- Una Habitación no pide habitaciones: son 1 (trigger listings_habitacion_una al aprobar).
  if k is distinct from 'habitacion' and (l.bedrooms is null or (l.bedrooms < 1 and k not in ('completo','apartamento'))) then
    raise exception 'Indique las habitaciones; solo un alojamiento completo tipo estudio puede tener 0.';
  end if;
  if k = 'habitacion' and coalesce(e.bathroom_shared, l.bathroom_shared) is null then
    raise exception 'Indique si el baño es privado o compartido.';
  end if;
  if e.title is not null and char_length(btrim(e.title)) not between 5 and 32 then raise exception 'El nombre de la casa debe tener entre 5 y 32 caracteres.'; end if;
  if e.description is not null and d <> '' and char_length(d) not between 80 and 2000 then
    raise exception 'La descripción debe tener entre 80 y 2000 caracteres o quedar vacía.';
  end if;
end $$;
