-- Una Habitación es siempre 1 habitación (ronda de Ana del 2026-11-02, ticket 03): el asistente ya no lo pregunta.
-- 1) Arreglo de datos: toda Habitación existente queda en 1 (antes podía ser null, 0 o más).
-- 2) Garantía hacia delante: un trigger BEFORE fija bedrooms = 1 siempre que kind = 'habitacion', sea cual sea el camino
--    (asistente, update_listing_live, aprobar un cambio de tipo en review_edit_field, admin). No choca con listings_protect:
--    éste solo rechaza el UPDATE entero según quién lo hace y qué campos protegidos toca, nunca mira bedrooms, y el trigger
--    solo ajusta NEW sin lanzar errores. Se dispara solo si el UPDATE nombra kind o bedrooms.
-- 3) listing_edit_check ya no pide habitaciones cuando el tipo resultante es Habitación (se fijan en 1 al aprobar); si no,
--    pasar un estudio (0 habitaciones) a Habitación fallaría sin que el anfitrión pudiera arreglarlo.
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

CREATE OR REPLACE FUNCTION public.listing_edit_check(l listings, e listing_edits)
 RETURNS void
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  k public.listing_kind := coalesce(e.kind, l.kind);
  d text := btrim(coalesce(e.description, ''));
begin
  if e.lat is not null then perform public.edit_place(e.lat, e.lng, e.zone, e.zone_id, e.zone_source); end if;
  if k <> 'habitacion' and (l.bedrooms is null or (l.bedrooms < 1 and k <> 'completo' and k <> 'apartamento')) then
    raise exception 'Indique las habitaciones; solo un alojamiento completo tipo estudio puede tener 0.';
  end if;
  if k = 'habitacion' and coalesce(e.bathroom_shared, l.bathroom_shared) is null then
    raise exception 'Indique si el baño es privado o compartido.';
  end if;
  if e.title is not null and char_length(btrim(e.title)) not between 5 and 32 then raise exception 'El nombre de la casa debe tener entre 5 y 32 caracteres.'; end if;
  if e.description is not null and d <> '' and char_length(d) not between 80 and 2000 then
    raise exception 'La descripción debe tener entre 80 y 2000 caracteres o quedar vacía.';
  end if;
end $function$;
