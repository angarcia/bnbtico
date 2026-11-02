// Búsqueda de Explorar a pantalla completa (pantallas v2 02–04): ¿Dónde? · ¿Cuándo? · ¿Quiénes?, una tarjeta abierta a la
// vez, y abajo «Borrar todo» y «Buscar». Todo queda en un borrador hasta «Buscar», que lleva a Explorar con la búsqueda
// (sustituyendo esta entrada del historial); ✕ vuelve sin aplicar. Trozo diferido (buscar-*.js): se precarga al tocar la
// píldora de Explorar.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { costaRicaToday, formatInquiryDates, shortDate } from "../../domain/dates";
import { SEARCH_MAX_PEOPLE, parseFilters, searchFor } from "../../domain/filters";
import { MONTHLY_FILTER_LABEL } from "../../domain/listing";
import { monthlyWindowLabel, nightsBetween, nightsLabel, peopleLabel, zonePlace, zoneSuggestions } from "../../domain/search";
import { trackSearch } from "../../shared/beacon";
import { I } from "../../shared/icons";
import { provincesQuery, zonesQuery } from "../queries";
import { RangeCalendar } from "../../shared/range-calendar";

const route = getRouteApi("/_flow/explorar/buscar");

type Card = "donde" | "cuando" | "quienes";

interface SearchDraft {
  zone: string | null;
  arrival: string | null;
  departure: string | null;
  monthlyFrom: string | null;
  ppl: number;
}

const EMPTY: SearchDraft = { zone: null, arrival: null, departure: null, monthlyFrom: null, ppl: 0 };

const Minus = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
    <path d="M5 12h14" />
  </svg>
);

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

function Fold({ title, value, open, onToggle, aside, children }: { title: string; value: string; open: boolean; onToggle(): void; aside?: ReactNode; children: ReactNode }) {
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
          <button ref={title_} type="button" className={open ? "search-card-title" : "search-fold"} aria-expanded={open} aria-controls={open ? id : undefined} onClick={onToggle}>
            <span>{title}</span>
            {open ? null : <b className="num">{value}</b>}
          </button>
        </h2>
        {open ? aside : null}
      </div>
      {open ? (
        <div className="search-card-body" id={id}>
          {children}
        </div>
      ) : null}
    </section>
  );
}

function Donde({ zone, onPick, onClear, focusOnce }: { zone: string | null; onPick(id: string): void; onClear(): void; focusOnce?: { current: boolean } }) {
  const input = useRef<HTMLInputElement>(null);
  // Al abrir la búsqueda en «¿Dónde?», el foco va al campo (abre el teclado), sin el anillo del título (N6).
  useEffect(() => {
    if (!focusOnce?.current) return;
    focusOnce.current = false;
    input.current?.focus({ preventScroll: true });
  }, [focusOnce]);
  const { data: zones = [] } = useQuery(zonesQuery);
  const name = zones.find((z) => z.id === zone)?.name ?? "";
  const [text, setText] = useState(name);
  // Con la caché fría (`?zona=` sin las zonas aún), el nombre llega después: se pone mientras no se haya escrito nada.
  const typed = useRef(false);
  useEffect(() => {
    if (!typed.current && name) setText(name);
  }, [name]);
  const [active, setActive] = useState(0);
  const list = zoneSuggestions(zones, text);
  const listId = useId();
  const optionId = (i: number) => `${listId}-${i}`;
  return (
    <>
      <div className="zone-input">
        <I.search size={20} />
        <input
          ref={input}
          role="combobox"
          aria-label="Busque una zona"
          placeholder="Busque una zona"
          aria-expanded={list.length > 0}
          aria-controls={listId}
          aria-autocomplete="list"
          aria-activedescendant={list.length ? optionId(Math.min(active, list.length - 1)) : undefined}
          autoComplete="off"
          enterKeyHint="search"
          value={text}
          onChange={(e) => {
            typed.current = true;
            setText(e.target.value);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (e.key === "ArrowDown" || e.key === "ArrowUp") {
              e.preventDefault();
              setActive((i) => (list.length ? (i + (e.key === "ArrowDown" ? 1 : list.length - 1)) % list.length : 0));
            } else if (e.key === "Enter" && list.length) {
              e.preventDefault();
              onPick(list[Math.min(active, list.length - 1)]!.id);
            }
          }}
        />
        {zone ? (
          <button type="button" className="btn-text" onClick={onClear}>
            Quitar
          </button>
        ) : null}
      </div>
      <ul className="zone-list" role="listbox" id={listId} aria-label="Zonas con casas">
        {list.map((z, i) => (
          <li key={z.id} id={optionId(i)} role="option" aria-selected={z.id === zone} className={`zone-option${i === active ? " is-active" : ""}`} onClick={() => onPick(z.id)}>
            <span className="zone-icon" aria-hidden="true">
              <I.pin size={20} />
            </span>
            <span className="zone-text">
              <b>{z.name}</b> <span className="small muted">{zonePlace(z)}</span>
            </span>
          </li>
        ))}
      </ul>
      {text && !list.length ? <p className="small">Todavía no hay casas en esa zona.</p> : null}
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
  const monthly = search.mensual === "1";
  const [today] = useState(() => costaRicaToday(Date.now()));
  const [draft, setDraft] = useState<SearchDraft>(() => {
    const f = parseFilters(rest, []);
    return { zone: f.zone, arrival: f.arrival, departure: f.departure, monthlyFrom: f.monthlyFrom, ppl: f.ppl };
  });
  const [open, setOpen] = useState<Card | null>(abrir ?? "donde");
  const focusZone = useRef(!abrir || abrir === "donde");
  const set = (patch: Partial<SearchDraft>) => setDraft((d) => ({ ...d, ...patch }));
  const toggle = (card: Card) => () => setOpen((o) => (o === card ? null : card));
  const { data: zones } = useQuery(zonesQuery);
  // «…» solo mientras llegan las zonas; una que ya no está en la lista se muestra como «Añadir zona».
  const zoneName = draft.zone ? (zones ? (zones.find((z) => z.id === draft.zone)?.name ?? null) : "…") : null;
  const nightly = !!draft.arrival && !!draft.departure;
  const hasDates = monthly ? !!draft.monthlyFrom : nightly;
  const datesValue = monthly ? (draft.monthlyFrom ? `Desde el ${shortDate(draft.monthlyFrom)}` : null) : nightly ? formatInquiryDates(draft.arrival, draft.departure) : null;

  const close = () => (canGoBack ? router.history.back() : void navigate({ to: "/explorar", search: rest, replace: true }));
  const submit = async () => {
    trackSearch({ zona: !!draft.zone, fechas: hasDates, personas: draft.ppl > 0 });
    const provinces = await queryClient.ensureQueryData(provincesQuery).catch(() => [] as string[]);
    await navigate({ to: "/explorar", search: searchFor({ ...parseFilters(rest, provinces), ...draft }, provinces), replace: true, resetScroll: true });
    window.scrollTo(0, 0);
  };

  return (
    <div className="search-screen">
      <h1 className="sr-only">Buscar casas</h1>
      <button type="button" className="icon-btn search-close" aria-label="Cerrar la búsqueda" onClick={close}>
        <I.x size={22} />
      </button>
      <Fold title="¿Dónde?" value={zoneName ?? "Añadir zona"} open={open === "donde"} onToggle={toggle("donde")}>
        {/* Con otra zona (o sin ella, tras «Quitar» o «Borrar todo») el campo vuelve a empezar con su nombre. */}
        <Donde
          key={draft.zone ?? ""}
          zone={draft.zone}
          onPick={(zone) => {
            set({ zone });
            setOpen("cuando");
          }}
          onClear={() => set({ zone: null })}
          focusOnce={focusZone}
        />
      </Fold>
      <Fold
        title="¿Cuándo?"
        value={datesValue ?? "Añadir fechas"}
        open={open === "cuando"}
        onToggle={toggle("cuando")}
        aside={monthly ? <span className="badge badge-sel">{MONTHLY_FILTER_LABEL}</span> : null}
      >
        <FitAboveBar>
          {monthly ? (
            <RangeCalendar today={today} mode="from" value={draft.monthlyFrom} onChange={(monthlyFrom) => set({ monthlyFrom })} />
          ) : (
            <RangeCalendar today={today} mode="range" value={{ arrival: draft.arrival, departure: draft.departure }} onChange={(r) => set(r)} />
          )}
        </FitAboveBar>
        <div className="range-foot">
          <span className="range-summary" aria-live="polite">
            {monthly ? (
              draft.monthlyFrom ? (
                <>
                  <b className="num">{datesValue}</b>
                  <span className="xs muted num">{monthlyWindowLabel(draft.monthlyFrom)}</span>
                </>
              ) : (
                <b>Elija desde cuándo</b>
              )
            ) : nightly ? (
              <>
                <b className="num">{datesValue}</b>
                <span className="xs muted num">{nightsLabel(nightsBetween(draft.arrival!, draft.departure!))}</span>
              </>
            ) : (
              <b>{draft.arrival ? "Elija la salida" : "Elija la llegada"}</b>
            )}
          </span>
          <button type="button" className="btn btn-outline" onClick={() => setOpen("quienes")}>
            Siguiente
          </button>
        </div>
        <div className="row between">
          {monthly ? <span /> : <span className="xs muted">Le mostramos las casas libres esas noches.</span>}
          {(monthly ? draft.monthlyFrom : draft.arrival) ? (
            <button type="button" className="btn-text" onClick={() => set(monthly ? { monthlyFrom: null } : { arrival: null, departure: null })}>
              Quitar fechas
            </button>
          ) : null}
        </div>
      </Fold>
      <Fold title="¿Quiénes?" value={peopleLabel(draft.ppl) ?? "Añadir personas"} open={open === "quienes"} onToggle={toggle("quienes")}>
        <div className="row between">
          <span className="stack gap-0">
            <b>Personas</b>
            <span className="small muted">Todas las que se van a quedar</span>
          </span>
          <span className="people-stepper">
            <button type="button" aria-label="Una persona menos" disabled={draft.ppl <= 0} onClick={() => set({ ppl: draft.ppl - 1 })}>
              <Minus />
            </button>
            <b className={draft.ppl ? "num" : "num is-empty"} aria-live="polite">
              {draft.ppl || "–"}
            </b>
            <button type="button" aria-label="Una persona más" disabled={draft.ppl >= SEARCH_MAX_PEOPLE} onClick={() => set({ ppl: draft.ppl + 1 })}>
              <I.plus size={20} />
            </button>
          </span>
        </div>
        <p className="note small">Las fechas y las personas van en el mensaje de WhatsApp que le preparamos para el anfitrión.</p>
      </Fold>
      <div className="sticky-spacer" aria-hidden="true" />
      <div className="sticky-actions">
        <button type="button" className="btn-text" onClick={() => setDraft(EMPTY)}>
          Borrar todo
        </button>
        <button type="button" className="btn btn-primary grow" onClick={() => void submit()}>
          <I.search size={20} />
          Buscar
        </button>
      </div>
    </div>
  );
}
