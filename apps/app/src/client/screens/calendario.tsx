// Calendario del propietario (pantalla 17 del diseño v1). Trozo diferido propio. Los meses van uno debajo de otro, del
// actual al último de la ventana, con casillas altas; solo se montan las rejillas cerca de la vista. Selección primero: se
// tocan uno o más días (también de meses distintos) y el panel de abajo cambia disponibilidad y precio de todos a la vez. Guardar es optimista: la rejilla cambia y el
// panel se cierra en el mismo toque; si la base se niega o no hay red, vuelve atrás y avisa. Las reglas son las del
// dominio (domain/calendar.ts), las mismas que la RPC save_listing_days.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type FocusEvent, type ReactNode } from "react";
import {
  addMonths,
  applyChange,
  calendarMonths,
  changeFromSelection,
  clearSelection,
  effectiveDay,
  emptySelection,
  monthTitle,
  openingMonth,
  selectDay,
  selectionLabel,
  setAvailability,
  setPrice,
  validateChange,
  type CalendarChange,
  type CalendarDay,
  type Selection,
} from "../../domain/calendar";
import { longDate } from "../../domain/dates";
import { toDomainError } from "../../domain/errors";
import { costaRicaToday } from "../../domain/inquiry";
import { resumeStep, type Listing } from "../../domain/listing";
import { formatCRC } from "../../domain/money";
import { I } from "../../shared/icons";
import { MonthGrid, MonthLegend, WeekdayRow } from "../../shared/month-grid";
import { toast } from "../../shared/toast";
import { calendarQuery, saveCalendar } from "../calendar-days";
import { RootHeader } from "../chrome";
import { ownListingsQuery, useSetAvailable } from "../owner";
import { useSession } from "../session";

const route = getRouteApi("/_tabs/_private/_owner/propietario/calendario");
const LAST_HOUSE = "bnbtico-calendario-casa";
const KB_RELEASE_MS = 400;

const titleOf = (l: Listing) => l.title || "Borrador sin título";
/** Casas con calendario (revisión UX A5): todo lo enviado alguna vez (en revisión, con cambios pedidos, activa, pausada) y
 *  las ya publicadas que se están editando. Fuera: los borradores nunca enviados y las rechazadas. */
const hasCalendar = (l: Listing) => l.status !== "rejected" && !(l.status === "draft" && l.firstPublishedAt === null);
const baseOf = (l: Listing) => (l.acceptsNightly ? l.nightlyPriceCrc : null);
/** «95 000» en el campo (se edita con espacios; parseColones los quita). */
const grouped = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

function readLast(): string | null {
  try {
    return localStorage.getItem(LAST_HOUSE);
  } catch {
    return null;
  }
}
function storeLast(id: string) {
  try {
    localStorage.setItem(LAST_HOUSE, id);
  } catch {
    /* sin almacenamiento: vale para esta visita */
  }
}

export function CalendarioScreen() {
  const userId = useSession().session?.userId ?? "";
  const search = route.useSearch();
  const navigate = useNavigate();
  const go = (casa: string, mes: string | undefined) => void navigate({ to: "/propietario/calendario", search: mes ? { casa, mes } : { casa }, replace: true });
  const listings = useQuery({ ...ownListingsQuery(userId), enabled: !!userId });
  const houses = listings.data?.filter(hasCalendar);
  const last = readLast();
  // Por defecto, la elegida en la URL, la última usada o la primera activa; nunca un borrador (revisión UX A5).
  const current =
    houses?.find((l) => l.id === search.casa) ?? houses?.find((l) => l.id === last) ?? houses?.find((l) => l.status === "active") ?? houses?.[0];
  // Para el estado vacío: el borrador sin enviar más reciente (la lista llega de la más nueva a la más vieja).
  const draft = listings.data?.find((l) => l.status === "draft" && l.firstPublishedAt === null);

  useEffect(() => {
    if (current) storeLast(current.id);
  }, [current]);
  // `?casa=` de una casa sin calendario (un borrador) o que ya no existe: la URL pasa a la que se muestra.
  const corrected = search.casa && current && search.casa !== current.id ? current.id : null;
  useEffect(() => {
    if (corrected) go(corrected, search.mes);
    // `go` cambia en cada render: basta con depender de la casa corregida.
  }, [corrected]);

  // Con una sola casa no hay nada que elegir: su nombre como subtítulo.
  const picker =
    current && houses && houses.length > 1 ? <HousePicker houses={houses} current={current} onPick={(id) => go(id, search.mes)} /> : undefined;
  return (
    <>
      <RootHeader title="Calendario" aside={picker} />
      {listings.isError && !houses ? (
        <p className="note" role="alert">
          {toDomainError(listings.error).message}
        </p>
      ) : null}
      {!houses && !listings.isError ? <section className="card skeleton cal-skeleton" aria-busy="true" aria-label="Cargando su calendario" /> : null}
      {current && houses && houses.length === 1 ? <p className="muted cal-house">{titleOf(current)}</p> : null}
      {houses && houses.length === 0 ? (
        <section className="card stack gap-12">
          <p>Su calendario se activa cuando envíe su casa a revisión.</p>
          {draft ? (
            <Link to="/propietario/publicar/$id/$paso" params={{ id: draft.id, paso: String(resumeStep(draft)) }} className="btn btn-primary btn-lg btn-block">
              Seguir publicando
            </Link>
          ) : (
            <Link to="/propietario/publicar" className="btn btn-primary btn-lg btn-block">
              Publicar casa
            </Link>
          )}
        </section>
      ) : null}
      {current ? (
<Calendar key={current.id} listing={current} userId={userId} month={search.mes} />
      ) : null}
    </>
  );
}

function HousePicker({ houses, current, onPick }: { houses: Listing[]; current: Listing; onPick: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: PointerEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("pointerdown", away);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("pointerdown", away);
      document.removeEventListener("keydown", esc);
    };
  }, [open]);
  const pick = (id: string) => {
    setOpen(false);
    if (id !== current.id) onPick(id);
  };
  return (
    <div className="house-picker" ref={box}>
      <button type="button" className="picker-pill" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen(!open)}>
        <span className="ellipsis">{titleOf(current)}</span>
        <I.chevron size={14} />
      </button>
      {open ? (
        <ul className="picker-list" role="listbox" aria-label="Elegir casa">
          {houses.map((h) => (
            <li
              key={h.id}
              role="option"
              tabIndex={0}
              aria-selected={h.id === current.id}
              onClick={() => pick(h.id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && (e.preventDefault(), pick(h.id))}
            >
              {titleOf(h)}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

function Calendar({ listing: l, userId, month }: { listing: Listing; userId: string; month: string | undefined }) {
  const client = useQueryClient();
  const today = costaRicaToday(Date.now());
  const months = useMemo(() => calendarMonths(today), [today]);
  // `?mes=` lleva a ese mes; sin él (o fuera de la ventana), al de apertura: a fin de mes, el siguiente (revisión UX A4).
  const target = month && months.includes(month) ? month : openingMonth(today);
  const options = calendarQuery(userId, l.id);
  const key = options.queryKey;
  const query = useQuery({ ...options, enabled: !!userId });
  const days = useMemo(() => new Map((query.data ?? []).map((d) => [d.day, d])), [query.data]);
  const base = baseOf(l);
  const ctx = { days, base, today };
  const [sel, setSel] = useState<Selection>(emptySelection);
  const [problem, setProblem] = useState<string | null>(null);
  const closed = !l.available;
  const reopen = useSetAvailable(userId, l);

  const save = useMutation({
    mutationKey: ["calendar-save", l.id],
    mutationFn: ({ change }: { change: CalendarChange; previous: CalendarDay[] | undefined }) => saveCalendar(l.id, change),
    onError: (error, { previous }) => {
      client.setQueryData(key, previous);
      toast(toDomainError(error).message);
    },
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["listing", l.publicId] });
      void client.invalidateQueries({ queryKey: ["listing-days", l.publicId] });
    },
    // Con otro guardado en vuelo, releer ahora pisaría su cambio optimista: lee el último.
    onSettled: () => {
      if (client.isMutating({ mutationKey: ["calendar-save", l.id] }) <= 1) void client.invalidateQueries({ queryKey: key });
    },
  });

  const change = changeFromSelection(sel);
  function onSave() {
    if (!change) return;
    const refused = validateChange(change, { today, listing: { status: l.status, available: l.available, nightlyPriceCrc: base } });
    if (refused) return setProblem(refused);
    const previous = client.getQueryData<CalendarDay[]>(key);
    const apply = () => client.setQueryData<CalendarDay[]>(key, (d) => applyChange(d ?? [], base, change));
    apply();
    // Una lectura en vuelo traería los días de antes; al cancelarla vuelven y se aplica otra vez (es idempotente).
    if (client.isFetching({ queryKey: key })) void client.cancelQueries({ queryKey: key }).then(apply);
    setSel(clearSelection());
    setProblem(null);
    save.mutate({ change, previous });
  }

  const editable = !closed && query.data !== undefined;
  const hasSpecial = sel.days.some((d) => effectiveDay(days, base, d).special);
  return (
    <>
      {closed ? null : <p className="small muted cal-hint">Toque los días para editarlos</p>}

      {closed ? (
        <section className="note note-arena note-col">
          <span>
            Esta casa está cerrada a consultas{l.reopenAt ? ` hasta el ${longDate(l.reopenAt)}` : ""}. Ábrala para cambiar el calendario; sus noches y precios se conservan.
          </span>
          <button type="button" className="btn btn-ghost btn-sm cal-open" disabled={reopen.isPending} onClick={() => reopen.mutate({ available: true })}>
            Abrir a consultas
          </button>
        </section>
      ) : null}
      {reopen.error ? (
        <p className="note" role="alert">
          {toDomainError(reopen.error).message}
        </p>
      ) : null}
      {query.isError && !query.data ? (
        <p className="note" role="alert">
          {toDomainError(query.error).message}
        </p>
      ) : null}

      <MonthLegend special={base !== null} />
      <WeekdayRow className="cal-weekdays" />
      <CalendarMonths
        months={months}
        target={target}
        render={(m) => (
          <MonthGrid
            size="tall"
            month={m}
            today={today}
            days={days}
            base={base}
            prices={base === null ? "none" : "all"}
            selected={sel.days}
            onSelect={editable ? (d) => (setSel(selectDay(sel, d, ctx)), setProblem(null)) : undefined}
            dimmed={closed}
            label={monthTitle(m)}
          />
        )}
      />

      {editable && sel.days.length > 0 ? (
        <Panel
          sel={sel}
          base={base}
          hasSpecial={hasSpecial}
          problem={problem}
          canSave={change !== null}
          onChange={(s) => (setSel(s), setProblem(null))}
          onCancel={() => (setSel(clearSelection()), setProblem(null))}
          onSave={onSave}
        />
      ) : null}
    </>
  );
}

/** Los meses uno debajo de otro, cada uno con su título fijo arriba. Una rejilla se monta al acercarse su mes a la vista
 *  (a una pantalla) y ya no se desmonta; al abrir, el mes pedido se lleva arriba. Desplazarse no cambia la URL. */
function CalendarMonths({ months, target, render }: { months: string[]; target: string; render: (month: string) => ReactNode }) {
  const [mounted, setMounted] = useState(() => new Set([target, addMonths(target, 1)].filter((m) => months.includes(m))));
  const box = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    if (target !== months[0]) box.current?.querySelector(`[data-month="${target}"]`)?.scrollIntoView({ block: "start" });
    // Solo al abrir: después manda el dedo.
  }, []);
  useEffect(() => {
    const blocks = box.current?.querySelectorAll<HTMLElement>(".cal-month-block");
    if (!blocks) return;
    const observer = new IntersectionObserver(
      (entries) => {
        const seen = entries.filter((e) => e.isIntersecting).map((e) => (observer.unobserve(e.target), (e.target as HTMLElement).dataset.month!));
        if (seen.length) setMounted((prev) => (seen.every((m) => prev.has(m)) ? prev : new Set([...prev, ...seen])));
      },
      { rootMargin: "100% 0px" },
    );
    blocks.forEach((b) => observer.observe(b));
    return () => observer.disconnect();
  }, []);
  return (
    <div className="cal-months" ref={box}>
      {months.map((m) => (
        <section key={m} className="cal-month-block" data-month={m} aria-label={monthTitle(m)}>
          <h2 className="cal-month-title">{monthTitle(m)}</h2>
          {mounted.has(m) ? render(m) : <div className="cal-month-placeholder" aria-hidden="true" />}
        </section>
      ))}
    </div>
  );
}

interface PanelProps {
  sel: Selection;
  base: number | null;
  hasSpecial: boolean;
  problem: string | null;
  canSave: boolean;
  onChange: (s: Selection) => void;
  onCancel: () => void;
  onSave: () => void;
}

function Panel({ sel, base, hasSpecial, problem, canSave, onChange, onCancel, onSave }: PanelProps) {
  // Teclado del iPhone (no encoge la vista): mientras el precio tiene el foco el panel gana sitio abajo y el campo sube por
  // encima. Se quita un poco después de salir del campo para que «Guardar cambios» no se mueva bajo el dedo.
  const [kb, setKb] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const isPrice = (el: EventTarget | null) => el instanceof HTMLInputElement;
  function onFocus(e: FocusEvent<HTMLElement>) {
    if (!isPrice(e.target)) return;
    clearTimeout(timer.current);
    setKb(true);
  }
  function onBlur(e: FocusEvent<HTMLElement>) {
    if (!isPrice(e.target)) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setKb(false), KB_RELEASE_MS);
  }
  const price = sel.priceEdited ? sel.price : grouped(sel.price);
  return (
    <section className={`cal-panel${kb ? " kb" : ""}`} aria-label="Días seleccionados" onFocus={onFocus} onBlur={onBlur}>
      <div className="row between baseline">
        <b className="display">{selectionLabel(sel.days)}</b>
        <button type="button" className="cal-cancel" onClick={onCancel}>
          Cancelar
        </button>
      </div>
      <div className="row gap-8">
        <div className="seg" role="group" aria-label="Disponibilidad">
          <button type="button" aria-pressed={sel.available === true} onClick={() => onChange(setAvailability(sel, true))}>
            Disponible
          </button>
          <button type="button" aria-pressed={sel.available === false} onClick={() => onChange(setAvailability(sel, false))}>
            Ocupado
          </button>
        </div>
        {base !== null ? (
          <label className="cal-price">
            <span aria-hidden="true">₡</span>
            <input
              aria-label="Precio por noche"
              inputMode="numeric"
              enterKeyHint="done"
              autoComplete="off"
              placeholder={sel.mixedPrice ? "Varios precios" : undefined}
              value={price}
              onChange={(e) => onChange(setPrice(sel, e.target.value))}
              onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
            />
          </label>
        ) : null}
      </div>
      {base !== null && hasSpecial ? (
        <button type="button" className="btn-link cal-base" onClick={() => onChange(setPrice(sel, grouped(String(base))))}>
          Usar el precio base ({formatCRC(base)})
        </button>
      ) : null}
      {problem ? (
        <p className="field-error" role="alert">
          {problem}
        </p>
      ) : null}
      <button type="button" className="btn btn-primary btn-lg btn-block" disabled={!canSave} onClick={onSave}>
        Guardar cambios
      </button>
    </section>
  );
}
