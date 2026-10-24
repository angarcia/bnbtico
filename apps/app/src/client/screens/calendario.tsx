// Calendario del propietario (pantalla 17 del diseño v1). Trozo diferido propio. Selección primero: se tocan uno o más
// días y el panel de abajo cambia disponibilidad y precio de todos a la vez. Guardar es optimista: la rejilla cambia y el
// panel se cierra en el mismo toque; si la base se niega o no hay red, vuelve atrás y avisa. Las reglas son las del
// dominio (domain/calendar.ts), las mismas que la RPC save_listing_days.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FocusEvent } from "react";
import {
  addMonths,
  applyChange,
  calendarWindow,
  changeFromSelection,
  clearSelection,
  effectiveDay,
  emptySelection,
  monthTitle,
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
import type { Listing } from "../../domain/listing";
import { formatCRC } from "../../domain/money";
import { I } from "../../shared/icons";
import { MonthGrid, MonthLegend } from "../../shared/month-grid";
import { toast } from "../../shared/toast";
import { calendarQuery, saveCalendar } from "../calendar-days";
import { RootHeader } from "../chrome";
import { ownListingsQuery, useSetAvailable } from "../owner";
import { setRole } from "../role";
import { useSession } from "../session";

const route = getRouteApi("/_tabs/_private/propietario/calendario");
const LAST_HOUSE = "bnbtico-calendario-casa";
const KB_RELEASE_MS = 400;

const titleOf = (l: Listing) => l.title || "Borrador sin título";
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
  useEffect(() => setRole("owner"), []);
  const userId = useSession().session?.userId ?? "";
  const search = route.useSearch();
  const navigate = useNavigate();
  const go = (casa: string, mes: string | undefined) => void navigate({ to: "/propietario/calendario", search: mes ? { casa, mes } : { casa }, replace: true });
  const listings = useQuery({ ...ownListingsQuery(userId), enabled: !!userId });
  const houses = listings.data?.filter((l) => l.status !== "rejected");
  const last = readLast();
  const current = houses?.find((l) => l.id === search.casa) ?? houses?.find((l) => l.id === last) ?? houses?.[0];

  useEffect(() => {
    if (current) storeLast(current.id);
  }, [current]);

  const picker = current && houses ? <HousePicker houses={houses} current={current} onPick={(id) => go(id, search.mes)} /> : undefined;
  return (
    <>
      <RootHeader title="Calendario" home="/propietario" aside={picker} />
      {listings.isError && !houses ? (
        <p className="note" role="alert">
          {toDomainError(listings.error).message}
        </p>
      ) : null}
      {!houses && !listings.isError ? <section className="card skeleton cal-skeleton" aria-busy="true" aria-label="Cargando su calendario" /> : null}
      {houses && houses.length === 0 ? (
        <section className="card stack gap-12">
          <p>Publique su casa para usar el calendario.</p>
          <Link to="/propietario/publicar" className="btn btn-primary btn-lg btn-block">
            Publicar casa
          </Link>
        </section>
      ) : null}
      {current ? (
        <Calendar
          key={current.id}
          listing={current}
          userId={userId}
          month={search.mes}
          onMonth={(mes) => go(current.id, mes)}
        />
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

function Calendar({ listing: l, userId, month, onMonth }: { listing: Listing; userId: string; month: string | undefined; onMonth: (m: string) => void }) {
  const client = useQueryClient();
  const today = costaRicaToday(Date.now());
  const win = calendarWindow(today);
  const shown = month && month >= win.firstMonth && month <= win.lastMonth ? month : win.firstMonth;
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
      <div className="cal-month">
        <div className="row gap-4">
          <button type="button" className="icon-btn cal-arrow" aria-label="Mes anterior" disabled={shown <= win.firstMonth} onClick={() => onMonth(addMonths(shown, -1))}>
            <I.back size={20} />
          </button>
          <b className="display cal-title">{monthTitle(shown)}</b>
          <button type="button" className="icon-btn cal-arrow" aria-label="Mes siguiente" disabled={shown >= win.lastMonth} onClick={() => onMonth(addMonths(shown, 1))}>
            <I.chevron size={20} />
          </button>
        </div>
        {closed ? null : <span className="small muted">Toque los días para editarlos</span>}
      </div>

      {closed ? (
        <section className="note note-arena note-col">
          <span>
            Esta casa está cerrada a consultas{l.reopenAt ? ` hasta el ${longDate(l.reopenAt)}` : ""}. Ábrala para cambiar el calendario; sus noches y precios se conservan.
          </span>
          <button type="button" className="btn btn-ghost btn-sm cal-open" disabled={reopen.isPending} onClick={() => reopen.mutate(true)}>
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

      <div className="stack gap-4">
        <MonthGrid
          month={shown}
          today={today}
          days={days}
          base={base}
          prices={base === null ? "none" : "all"}
          selected={sel.days}
          onSelect={editable ? (d) => (setSel(selectDay(sel, d, ctx)), setProblem(null)) : undefined}
          dimmed={closed}
          label={monthTitle(shown)}
        />
        <MonthLegend special={base !== null} />
      </div>

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
