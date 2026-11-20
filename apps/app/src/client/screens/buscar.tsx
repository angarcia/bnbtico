// Búsqueda de Explorar a pantalla completa (pantallas v2 02–04): ¿Dónde? · ¿Cuándo? · ¿Quiénes?, una tarjeta abierta a la
// vez, y abajo «Borrar todo» y «Buscar». Todo queda en un borrador hasta «Buscar», que lleva a Explorar con la búsqueda
// (sustituyendo esta entrada del historial); ✕ vuelve sin aplicar. Trozo diferido (buscar-*.js): se precarga al tocar la
// píldora de Explorar.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { costaRicaToday, formatInquiryDates } from "../../domain/dates";
import { SEARCH_MAX_PEOPLE, parseFilters, searchFor } from "../../domain/filters";
import { FLAGS, SEARCH_MODE } from "../../shared/flags";
import { NightsPicker } from "../../shared/nights-picker";
import { nightsBetween, nightsLabel, peopleLabel, zonePlace, zoneSuggestions } from "../../domain/search";
import { trackSearch } from "../../shared/beacon";
import { I } from "../../shared/icons";
import { provincesQuery, zonesQuery } from "../queries";
import { RangeCalendar } from "../../shared/range-calendar";
import { Button, IconButton, TextButton } from "../../shared/button";
import { useCombobox } from "../../shared/combobox";
import { SearchInput, StickyActions } from "../../shared/field";
import { Stepper } from "../../shared/stepper";
import { Notice } from "../../shared/structure";
import { Card } from "../../shared/card";
import { ClosedField } from "../../shared/closed-field";

const route = getRouteApi("/_flow/explorar/buscar");

type Card = "donde" | "cuando" | "quienes";

interface SearchDraft {
  zone: string | null;
  arrival: string | null;
  departure: string | null;
  nights: number;
  ppl: number;
}

const EMPTY: SearchDraft = { zone: null, arrival: null, departure: null, nights: 0, ppl: 0 };

/** Una tarjeta plegable: el mismo botón de título en los dos estados (no se desmonta: el foco sigue en él al abrirla con
 *  Enter); cerrada lleva también el valor. Si se abre desde otra tarjeta (elegir una zona), el foco pasa a su título. */
/** El calendario de «¿Cuándo?» mide lo que queda libre encima de la barra «Borrar todo · Buscar», para que su pie con
 *  «Siguiente» se vea siempre sin desplazar la página; el calendario se desplaza por dentro (revisión UX 2026-10-29, N9:
 *  en un iPhone SE con Safari, «Siguiente» quedaba entero bajo la barra). Tope el de CSS, `min(52dvh, 420px)`. */
const MIN_CALENDAR_PX = 180;
function FitAboveBar({ children }: { children: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = box.current;
    if (!el) return;
    const fit = () => {
      const bar = document.querySelector(".sticky-actions");
      const foot = el.nextElementSibling;
      if (!bar || !foot) return;
      el.style.maxHeight = "";
      const rect = el.getBoundingClientRect();
      // Con la página arriba del todo: la barra es fija, el calendario y su pie están en la página.
      const top = rect.top + window.scrollY;
      const below = foot.getBoundingClientRect().bottom - rect.bottom;
      const room = bar.getBoundingClientRect().top - 8 - top - below;
      if (room < rect.height) el.style.maxHeight = `${Math.max(MIN_CALENDAR_PX, Math.floor(room))}px`;
    };
    fit();
    window.addEventListener("resize", fit);
    return () => window.removeEventListener("resize", fit);
  }, []);
  return (
    <div ref={box} className="range-scroll">
      {children}
    </div>
  );
}

function Fold({ title, value, open, onToggle, children }: { title: string; value: string; open: boolean; onToggle(): void; children: ReactNode }) {
  const id = useId();
  const card = useRef<HTMLElement>(null);
  const title_ = useRef<HTMLButtonElement>(null);
  // Solo al cambiar de tarjeta, no al montar: con el modo estricto de React el efecto corre dos veces al montar y el
  // título se quedaba con el foco y el anillo de teclado al abrir la búsqueda (revisión UX 2026-10-29, N6).
  const prev = useRef(open);
  useEffect(() => {
    if (prev.current === open) return;
    prev.current = open;
    if (open && !card.current?.contains(document.activeElement)) title_.current?.focus();
  }, [open]);
  return (
    <section ref={card} className={open ? "search-card" : "search-closed"}>
      <div className="search-card-head">
        <h2>
          <ClosedField kind="search" ref={title_} open={open} label={title} value={value} aria-expanded={open} aria-controls={open ? id : undefined} onClick={onToggle} />
        </h2>
      </div>
      {open ? (
        <div className="search-card-body" id={id}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

export function Donde({ zone, onPick, onClear, focusOnce }: { zone: string | null; onPick(id: string): void; onClear(): void; focusOnce?: { current: boolean } }) {
  const input = useRef<HTMLInputElement>(null);
  const listbox = useRef<HTMLUListElement>(null);
  // Al abrir la búsqueda en «¿Dónde?», el foco va al campo (abre el teclado), sin el anillo del título (N6).
  useEffect(() => {
    if (!focusOnce?.current) return;
    focusOnce.current = false;
    input.current?.focus({ preventScroll: true });
  }, [focusOnce]);
  const { data: zones = [], isPending, isError, refetch } = useQuery(zonesQuery);
  const name = zones.find((z) => z.id === zone)?.name ?? "";
  const [text, setText] = useState(name);
  // Con la caché fría (`?zona=` sin las zonas aún), el nombre llega después: se pone mientras no se haya escrito nada.
  const typed = useRef(false);
  useEffect(() => {
    if (!typed.current && name) setText(name);
  }, [name]);
  const list = zoneSuggestions(zones, text);
  const combo = useCombobox({ count: list.length, open: list.length > 0, initial: 0, listbox });
  return (
    <>
      <SearchInput
        variant="combobox"
        ref={input}
        {...combo.inputProps}
        aria-label="Busque una zona"
        placeholder="Busque una zona"
        autoComplete="off"
        enterKeyHint="search"
        value={text}
        onChange={(e) => {
          typed.current = true;
          setText(e.target.value);
          combo.setActive(0);
          if (listbox.current) listbox.current.scrollTop = 0;
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            combo.move(e.key === "ArrowDown" ? 1 : -1);
          } else if (e.key === "Enter" && list.length) {
            e.preventDefault();
            onPick(list[combo.active]!.id);
          }
        }}
        after={
          zone ? (
            <TextButton tone="quiet" onClick={onClear}>
              Quitar
            </TextButton>
          ) : null
        }
      />
      <ul ref={listbox} className="suggestions" role="listbox" id={combo.listId} aria-label="Zonas con casas">
        {list.map((z, i) => (
          <li key={z.id} id={combo.optionId(i)} role="option" aria-selected={z.id === zone} className={`suggestion${i === combo.active ? " is-active" : ""}${z.id === zone ? " is-chosen" : ""}`} onClick={() => onPick(z.id)}>
            <span className="suggestion-icon" aria-hidden="true">
              <I.pin size={20} />
            </span>
            <span className="suggestion-text">
              <b>{z.name}</b> <span className="small muted">{zonePlace(z)}</span>
            </span>
            <span className="suggestion-check" aria-hidden="true">{z.id === zone ? <I.check size={20} /> : null}</span>
          </li>
        ))}
      </ul>
      {isPending ? <p className="small muted" role="status">Cargando zonas…</p> : isError && !zones.length ? (
        <div className="row between gap-8"><p className="small" role="alert">No pudimos cargar las zonas.</p><TextButton tone="quiet" onClick={() => void refetch()}>Reintentar</TextButton></div>
      ) : !list.length ? <p className="small" role="status">{text ? "Todavía no hay casas en esa zona." : "Todavía no hay zonas con casas."}</p> : null}
      <p className="small muted">Le mostramos las casas de la zona y las que están a 5 km o menos.</p>
    </>
  );
}

export function BuscarScreen() {
  const search = route.useSearch();
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const queryClient = useQueryClient();
  const { abrir, ...rest } = search;
  const [today] = useState(() => costaRicaToday(Date.now()));
  const [draft, setDraft] = useState<SearchDraft>(() => {
    const f = parseFilters(rest, [], { mode: SEARCH_MODE, rooms: FLAGS.rooms });
    return { zone: f.zone, arrival: f.arrival, departure: f.departure, nights: f.nights, ppl: f.ppl };
  });
  const [open, setOpen] = useState<Card | null>(abrir ?? "donde");
  const focusZone = useRef(!abrir || abrir === "donde");
  const set = (patch: Partial<SearchDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const toggle = (card: Card) => () => setOpen((o) => (o === card ? null : card));
  const { data: zones } = useQuery(zonesQuery);
  // «…» solo mientras llegan las zonas; una que ya no está en la lista se muestra como «Añadir zona».
  const zoneName = draft.zone ? (zones ? (zones.find((z) => z.id === draft.zone)?.name ?? null) : "…") : null;
  const hasDates = !!draft.arrival && !!draft.departure;
  const datesValue = hasDates ? formatInquiryDates(draft.arrival, draft.departure) : null;

  const close = () => (canGoBack ? router.history.back() : void navigate({ to: "/explorar", search: rest, replace: true }));
  const submit = async () => {
    trackSearch({ zona: !!draft.zone, fechas: hasDates, personas: draft.ppl > 0 });
    const provinces = await queryClient.ensureQueryData(provincesQuery).catch(() => [] as string[]);
    await navigate({ to: "/explorar", search: searchFor({ ...parseFilters(rest, provinces, { mode: SEARCH_MODE, rooms: FLAGS.rooms }), ...draft }), replace: true, resetScroll: true });
    window.scrollTo(0, 0);
  };

  return (
    <div className="search-screen">
      <h1 className="sr-only">Buscar casas</h1>
      <IconButton label="Cerrar la búsqueda" placement="search-close" onClick={close}>
        <I.x size={22} />
      </IconButton>
      <Fold title="¿Dónde?" value={zoneName ?? "Añadir zona"} open={open === "donde"} onToggle={toggle("donde")}>
        {/* Con otra zona (o sin ella, tras «Quitar» o «Borrar todo») el campo vuelve a empezar con su nombre. */}
        <Donde
          key={draft.zone ?? ""}
          zone={draft.zone}
          onPick={(zone) => {
            set({ zone });
            setOpen(SEARCH_MODE === "none" ? "quienes" : "cuando");
          }}
          onClear={() => set({ zone: null })}
          focusOnce={focusZone}
        />
      </Fold>
      {/* Feature flags (#58): con fechas, «¿Cuándo?»; con número de noches, «¿Cuántas noches?» (diseño #59); sin estancia, ninguna. */}
      {SEARCH_MODE === "nights" ? (
        <Fold title="¿Cuántas noches?" value={draft.nights ? nightsLabel(draft.nights) : "Añadir noches"} open={open === "cuando"} onToggle={toggle("cuando")}>
          <NightsPicker nights={draft.nights} onChange={(nights) => set({ nights })} />
          <div className="row between">
            <span className="xs muted">Le mostramos un precio orientativo para esas noches. La disponibilidad se la confirma el anfitrión por WhatsApp.</span>
            {draft.nights ? (
              <TextButton tone="quiet" onClick={() => set({ nights: 0 })}>
                Quitar
              </TextButton>
            ) : null}
          </div>
        </Fold>
      ) : null}
      {SEARCH_MODE === "dates" ? (
      <Fold title="¿Cuándo?" value={datesValue ?? "Añadir fechas"} open={open === "cuando"} onToggle={toggle("cuando")}>
        <FitAboveBar>
          <RangeCalendar today={today} value={{ arrival: draft.arrival, departure: draft.departure }} onChange={(r) => set(r)} />
        </FitAboveBar>
        <div className="range-foot">
          <span className="range-summary" aria-live="polite">
            {hasDates ? (
              <>
                <b className="num">{datesValue}</b>
                <span className="xs muted num">{nightsLabel(nightsBetween(draft.arrival!, draft.departure!))}</span>
              </>
            ) : (
              <b>{draft.arrival ? "Elija la salida" : "Elija la llegada"}</b>
            )}
          </span>
          <Button variant="primary" onClick={() => setOpen("quienes")}>
            Siguiente
          </Button>
        </div>
        <div className="row between">
          <span className="xs muted">Le mostramos las casas libres esas noches.</span>
          {draft.arrival ? (
            <TextButton tone="quiet" onClick={() => set({ arrival: null, departure: null })}>
              Quitar fechas
            </TextButton>
          ) : null}
        </div>
      </Fold>
      ) : null}
      <Fold title="¿Quiénes?" value={peopleLabel(draft.ppl) ?? "Añadir personas"} open={open === "quienes"} onToggle={toggle("quienes")}>
        <div className="row between">
          <span className="stack gap-0">
            <b>Personas</b>
            <span className="small muted">Todas las que se van a quedar</span>
          </span>
          <Stepper unit="Una persona" value={draft.ppl} min={0} max={SEARCH_MAX_PEOPLE} empty={!draft.ppl} onChange={(ppl) => set({ ppl })} />
        </div>
        <Notice small>{SEARCH_MODE === "nights" ? "Las noches" : SEARCH_MODE === "dates" ? "Las fechas" : "Las personas"}{SEARCH_MODE === "none" ? " van" : " y las personas van"} en el mensaje de WhatsApp que le preparamos para el anfitrión.</Notice>
      </Fold>
      <StickyActions>
        <TextButton tone="quiet" onClick={() => setDraft(EMPTY)}>
          Borrar todo
        </TextButton>
        <Button variant="primary" size="lg" placement="grow" icon={<I.search size={20} />} onClick={() => void submit()}>
          Buscar
        </Button>
      </StickyActions>
    </div>
  );
}
