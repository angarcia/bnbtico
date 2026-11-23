// Calendario del propietario (pantalla 17 del diseño v1; revisión UX 2026-10-29, A1 y C4). Trozo diferido propio. Abre arriba
// del todo: la casa (o su selector, a todo el ancho), «Marcar una reserva» y «Pausar la casa», ₡ | $ y el mes actual entero. Los meses van uno
// debajo de otro, del actual al último de la ventana; solo se montan las rejillas cerca de la vista. La barra de pestañas se
// esconde al bajar y vuelve al subir, y no está mientras hay días seleccionados. Selección primero: se
// tocan uno o más días (también de meses distintos) y el panel de abajo cambia disponibilidad y precio de todos a la vez. Guardar es optimista: la rejilla cambia y el
// panel se cierra en el mismo toque; si la base se niega o no hay red, vuelve atrás y avisa. Las reglas son las del
// dominio (domain/calendar.ts), las mismas que la RPC save_listing_days. Arriba (ticket 04 de la ronda del 2 nov), con el
// calendario editable, «Marcar una reserva» abre una hoja con el calendario de rango de «¿Cuándo?» y guarda las noches de
// llegada a salida − 1 como ocupadas por el mismo camino que «Guardar cambios»; en una casa activa, «Pausar la casa» (antes
// «Cerrar la casa hasta…», set_listing_available) abre su hoja. Cada hoja, en su propio trozo diferido.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { Component, Suspense, lazy, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  addMonths,
  applyChange,
  calendarMonths,
  changeFromSelection,
  clearSelection,
  effectiveDay,
  emptySelection,
  monthTitle,
  selectDay,
  validateChange,
  type CalendarChange,
  type CalendarDay,
  type Selection,
} from "../../../domain/calendar";
import { can, isBlocked } from "../../../domain/can";
import { ignoreChromeScroll, showChrome } from "../../comun/hiding-chrome";
import { shortDate } from "../../../domain/dates";
import { toDomainError } from "../../../domain/errors";
import { reportError } from "../../../shared/beacon";
import { costaRicaToday } from "../../../domain/inquiry";
import { type Listing } from "../../../domain/listing";
import { resumeStep } from "../../../domain/publish-rules";
import { formatMoney } from "../../../domain/money";
import { FLAGS } from "../../../shared/flags";
import { I } from "../../../shared/ui/icons";
import { whenIdle } from "../../../shared/idle";
import { useCurrency } from "../../../shared/currency";
import { CurrencySwitch } from "../../../shared/currency-switch";
import { useFx } from "../../../shared/fx";
import { MonthGrid, WeekdayRow } from "../../../shared/month-grid";
import { toast } from "../../../shared/toast";
import { calendarQuery, saveCalendar } from "./calendar-days";
import { isChunkLoadError } from "../../comun/chunk-error";
import { ScreenHeader } from "../../comun/screen-header";
import { useDesktop } from "../../../shared/desktop";
import { useEditor } from "../editor-port";
import { ownListingsQuery, useSetAvailable } from "../owner";
import { useSession } from "../../comun/session";
import { HousePicker } from "../house-picker";

import { AirbnbRow, AirbnbLegend, countCalendarOrigins } from "./airbnb-calendar-row";
import { Button } from "../../../shared/ui/button";

import { RouterButtonLink } from "../../comun/router-buttons";
import { LoadError, Notice, Skeleton } from "../../../shared/ui/structure";
import { Card } from "../../../shared/ui/card";
import * as CAL_COPY from "./copy/calendar";

const route = getRouteApi("/_tabs/_private/_owner/propietario/calendario");
const LAST_HOUSE = "3bstays-calendario-casa";
const loadCloseSheet = () => import("./close-sheet");
const lazyCloseSheet = () => lazy(() => loadCloseSheet().then((m) => ({ default: m.CloseSheet })));
let CloseSheet = lazyCloseSheet();
const loadMarkSheet = () => import("./mark-sheet");
const lazyMarkSheet = () => lazy(() => loadMarkSheet().then((m) => ({ default: m.MarkSheet })));
// El panel de los días elegidos, en su trozo (panel-dias-*): se pide en reposo al abrir el Calendario o al tocar un día
// (historia 07, paso 5).
const loadPanel = () => import("./panel-dias");
const Panel = lazy(() => loadPanel().then((m) => ({ default: m.Panel })));
let MarkSheet = lazyMarkSheet();

const titleOf = (l: Listing) => l.title || "Borrador sin título";
/** Casas con calendario (revisión UX A5): todo lo enviado alguna vez (en revisión, con cambios pedidos, activa, pausada) y
 *  las ya publicadas que se están editando. Fuera: los borradores nunca enviados y las rechazadas. */
const hasCalendar = (l: Listing) => l.status !== "rejected" && !(l.status === "draft" && l.firstPublishedAt === null);
const baseOf = (l: Listing) => (l.acceptsNightly ? l.nightlyPriceCrc : null);
/** «95 000» en el campo (se edita con espacios; parseColones los quita). */

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
  // Los días de la casa de la URL o de la última usada salen a la vez que la lista, sin esperarla (auditoría de viajes
  // 2026-11-05). Si al final se muestra otra, solo sobra esta petición.
  const client = useQueryClient();
  const guess = search.casa ?? last;
  useEffect(() => {
    if (userId && guess) void client.prefetchQuery(calendarQuery(userId, guess));
  }, [client, userId, guess]);
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

  return (
    <>
      <ScreenHeader kind="root" title={CAL_COPY.title} />
      {listings.isError && !houses ? (
        <LoadError onRetry={() => void listings.refetch()}>
          {toDomainError(listings.error).message}
        </LoadError>
      ) : null}
      {!houses && !listings.isError ? <Skeleton shape="calendar" label={CAL_COPY.loading} /> : null}
      {houses && houses.length === 0 ? (
        <Card layout="stack" gap={12}>
          <p>{CAL_COPY.activates}</p>
          {draft ? (
            <RouterButtonLink to="/propietario/publicar/$id/$paso" params={{ id: draft.id, paso: String(resumeStep(draft)) }} variant="primary" size="lg" block>
              {CAL_COPY.continuePublishing}
            </RouterButtonLink>
          ) : (
            <RouterButtonLink to="/propietario/publicar" variant="primary" size="lg" block>
              {CAL_COPY.publish}
            </RouterButtonLink>
          )}
        </Card>
      ) : null}
      {current && houses ? (
        <Calendar
          key={current.id}
          listing={current}
          userId={userId}
          month={search.mes}
          houseControl={houses.length > 1 ? (
            <HousePicker
              houses={houses.map((h) => ({ id: h.id, name: titleOf(h) }))}
              currentId={current.id}
              onPick={(id) => { if (id) go(id, search.mes); }}
            />
          ) : <p className="cal-house">{titleOf(current)}</p>}
        />
      ) : null}
    </>
  );
}


/** El calendario de una casa. Lo reutiliza el admin con su puerto (screens/asistir.tsx): edita también una casa bloqueada
 *  y no tiene «Marcar una reserva» ni «Pausar la casa» (son del anfitrión). */
export function Calendar({ listing: l, userId, month, houseControl }: {
  listing: Listing;
  userId: string;
  month: string | undefined;
  houseControl?: ReactNode;
}) {
  useEffect(() => {
    whenIdle(() => void loadPanel().catch(() => {}));
  }, []);
  const client = useQueryClient();
  const port = useEditor();
  const desktop = useDesktop();
  const today = costaRicaToday(Date.now());
  const months = useMemo(() => calendarMonths(today), [today]);
  // `?mes=` lleva a ese mes; sin él (o fuera de la ventana), arriba del todo con el mes actual entero (revisión UX A1).
  const target = month && months.includes(month) ? month : null;
  const currency = useCurrency();
  const fx = useFx(currency === "USD");
  const options = calendarQuery(userId, l.id, port.calendar);
  const key = options.queryKey;
  const query = useQuery({ ...options, enabled: !!userId });
  const days = useMemo(() => new Map((query.data ?? []).map((d) => [d.day, d])), [query.data]);
  const base = baseOf(l);
  const ctx = { days, base, today };
  const [sel, setSel] = useState<Selection>(emptySelection);
  const [problem, setProblem] = useState<string | null>(null);
  const closed = !l.available;

  const save = useMutation({
    mutationKey: ["calendar-save", l.id],
    mutationFn: ({ change }: { change: CalendarChange; previous: CalendarDay[] | undefined }) => saveCalendar(l.id, change, port.calendar),
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
  /** Aplica el cambio a la rejilla al instante y lo guarda; devuelve el motivo si las reglas lo rechazan (y no cambia nada). */
  function commit(change: CalendarChange): string | null {
    const refused = validateChange(change, { today, listing: { status: l.status, available: l.available, nightlyPriceCrc: base } });
    if (refused) return refused;
    const previous = client.getQueryData<CalendarDay[]>(key);
    const apply = () => client.setQueryData<CalendarDay[]>(key, (d) => applyChange(d ?? [], base, change));
    apply();
    // Una lectura en vuelo traería los días de antes; al cancelarla vuelven y se aplica otra vez (es idempotente).
    if (client.isFetching({ queryKey: key })) void client.cancelQueries({ queryKey: key }).then(apply);
    save.mutate({ change, previous });
    return null;
  }
  function onSave() {
    if (!change) return;
    const refused = commit(change);
    if (refused) return setProblem(refused);
    setSel(clearSelection());
    setProblem(null);
    showChrome();
  }
  /** «Marcar una reserva»: las noches ya vienen de llegada a salida − 1; se guardan como ocupadas, sin tocar los precios.
   *  Una selección a medias del panel se descarta (la rejilla cambia debajo). */
  function onMark(nights: string[], label: string): string | null {
    const currentDays = client.getQueryData<CalendarDay[]>(key);
    if (!currentDays) return "No pudimos comprobar la disponibilidad. Intente de nuevo.";
    if (currentDays.some(d => !d.available && nights.includes(d.day))) return "Hay noches ocupadas entre esas fechas.";
    const refused = commit({ days: nights, available: false, requireFree: true });
    if (refused) return refused;
    setSel(clearSelection());
    setProblem(null);
    toast(label);
    return null;
  }

  // Una casa bloqueada por 3bstays se ve, no se edita.
  const blocked = isBlocked(l) && !port.admin;
  const editable = !closed && !blocked && query.data !== undefined;
  const hasSpecial = sel.days.some((d) => effectiveDay(days, base, d).special);
  const canMark = !closed && !blocked && !port.admin;
  const canPause = can(l, "available") && !port.admin;
  const prepareMark = useCallback(async (signal: AbortSignal) =>
    (await import("./reservation-calendar")).prepareReservationCalendar(client, userId, l.id, l.publicId, signal),
  [client, userId, l.id, l.publicId]);
  const { importedCount, manualCount } = countCalendarOrigins(days, sel.days);
  return (
    <div className="owner-calendar-layout">
      <div className="owner-calendar-options">
        {houseControl}
        {canMark || canPause || !port.admin ? (
          <section className="cal-actions" aria-label={CAL_COPY.actions}>
            {canMark || canPause ? <Card as="div" placement="cal-action-group">
              {canMark ? <MarkRow today={today} onMark={onMark} calendarDays={query.data} prepare={prepareMark} /> : null}
              {canPause ? <PauseRow listing={l} userId={userId} /> : null}
            </Card> : null}
            {!port.admin ? <AirbnbRow key={`${userId}:${l.id}`} listing={l} userId={userId} month={month} disabled={sel.days.length > 0} /> : null}
          </section>
        ) : null}
        <div className="row between gap-8 cal-hint-row">
          {closed ? <span /> : blocked ? <p className="small muted" data-testid="calendar-blocked">{CAL_COPY.blocked}</p> : <p className="small muted">{CAL_COPY.hint({ desktop })}</p>}
          <CurrencySwitch placement="calendar-local-currency" />
        </div>
        {/* Precios por fecha apagados (feature flag): el precio base en la leyenda y las casillas sin precio. */}
        <AirbnbLegend days={query.data} price={!FLAGS.datePrices && base !== null ? formatMoney(base, currency, fx.crcPerUsd) : undefined} />
        {editable && sel.days.length > 0 ? (
          <Suspense fallback={null}><Panel
            sel={sel}
            base={base}
            hasSpecial={hasSpecial}
            importedCount={importedCount}
            manualCount={manualCount}
            problem={problem}
            canSave={change !== null}
            onChange={(s) => (setSel(s), setProblem(null))}
            onCancel={() => (setSel(clearSelection()), setProblem(null), showChrome())}
            onSave={onSave}
          /></Suspense>
        ) : null}
      </div>

      <div className="owner-calendar-days">
        {query.isError && !query.data ? (
          <LoadError onRetry={() => void query.refetch()}>
            {toDomainError(query.error).message}
          </LoadError>
        ) : null}

        <WeekdayRow className="cal-weekdays" />
        <CalendarMonths
          months={months}
          target={target}
          render={(m) => (
            <MonthGrid
              month={m}
              today={today}
              days={days}
              base={base}
              prices={FLAGS.datePrices}
              currency={currency}
              showCurrencySymbol={desktop}
              fx={fx.crcPerUsd}
              selected={sel.days}
              onSelect={editable ? (d) => (setSel(selectDay(sel, d, ctx)), setProblem(null)) : undefined}
              dimmed={closed}
              importedIcon={<I.link size={16} />}
              label={monthTitle(m)}
            />
          )}
        />
      </div>
    </div>
  );
}

/** «Marcar una reserva» (ticket 04 de la ronda del 2 nov), arriba del calendario editable: abre la hoja con el calendario
 *  de rango y, al confirmar, las noches quedan ocupadas (optimista, como «Guardar cambios») y lo dice un aviso. Si las
 *  reglas rechazan el cambio, se dice junto a la fila. */
function MarkRow({ today, onMark, calendarDays, prepare }: {
  today: string; onMark: (nights: string[], label: string) => string | null; calendarDays: CalendarDay[] | undefined;
  prepare: (signal: AbortSignal) => Promise<{ warning: string | null }>;
}) {
  const [marking, setMarking] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const button = useRef<HTMLButtonElement>(null);
  // El foco vuelve al botón de la fila cuando la hoja ya se desmontó (la página dejó de estar inerte).
  const refocus = useRef(false);
  useEffect(() => {
    whenIdle(() => void loadMarkSheet().catch(() => {}));
  }, []);
  useEffect(() => {
    if (marking || !refocus.current) return;
    refocus.current = false;
    button.current?.focus();
  }, [marking]);
  const end = () => {
    refocus.current = true;
    setMarking(false);
  };
  return (
    <>
      <button ref={button} type="button" className="cal-action" aria-haspopup="dialog" onClick={() => (setProblem(null), setMarking(true))}>
        <span className="cal-action-icon">
          <I.calendar size={20} />
        </span>
        <span className="body">
          <b>{CAL_COPY.mark}</b>
        </span>
        <I.chevron />
      </button>
      {problem ? (
        <Notice tone="error">
          {problem}
        </Notice>
      ) : null}
      {marking ? (
        <SheetBoundary name="Marcar una reserva" onRetry={() => (MarkSheet = lazyMarkSheet())}>
          {() => (
            <Suspense fallback={<div className="sheet-backdrop" />}>
              <MarkSheet
                today={today}
                calendarDays={calendarDays}
                prepare={prepare}
                onClose={end}
                onConfirm={(nights, label) => {
                  setProblem(onMark(nights, label));
                  end();
                }}
              />
            </Suspense>
          )}
        </SheetBoundary>
      ) : null}
    </>
  );
}

/** «Pausar la casa» (antes «Cerrar la casa hasta…»; ticket 04 de la ronda del 2 nov), en una casa activa
 *  (can(l,"available")): sin pausar, la fila abre la hoja «Pausar la casa»; pausada, dice hasta cuándo y «Volver a
 *  publicarla» la abre en un toque. Las dos escrituras son optimistas (useSetAvailable); mientras la base no contesta,
 *  «Volver a publicarla» no hace nada (sigue enfocable, con aria-disabled). */
function PauseRow({ listing: l, userId }: { listing: Listing; userId: string }) {
  const available = useSetAvailable(userId, l);
  const [closing, setClosing] = useState(false);
  const button = useRef<HTMLButtonElement>(null);
  // El foco va al botón de la fila cuando la hoja ya se desmontó (la página dejó de estar inerte) y la fila muestra el
  // estado esperado: al cancelar, la misma; al confirmar, «Volver a publicarla»; al volver a publicarla, «Pausar la casa».
  const focusWhen = useRef<boolean | null>(null);
  useEffect(() => {
    whenIdle(() => void loadCloseSheet().catch(() => {}));
  }, []);
  useEffect(() => {
    if (closing || focusWhen.current !== l.available) return;
    focusWhen.current = null;
    button.current?.focus();
  }, [closing, l.available]);
  const endClosing = (next: boolean) => {
    focusWhen.current = next;
    setClosing(false);
  };
  const pending = available.isPending;
  return (
    <>
      {l.available ? (
        <button ref={button} type="button" className="cal-action" aria-haspopup="dialog" onClick={() => setClosing(true)}>
          <span className="cal-action-icon">
            <PauseIcon />
          </span>
          <span className="body">
            <b>{CAL_COPY.pause}</b>
          </span>
          <I.chevron />
        </button>
      ) : (
        <div className="cal-action is-paused">
          <span className="cal-action-icon">
            <PauseIcon />
          </span>
          <span className="body">
            <b>{CAL_COPY.paused({ until: l.reopenAt ? shortDate(l.reopenAt) : null })}</b>
            <span className="small muted">{CAL_COPY.pausedNote}</span>
          </span>
          <Button
            ref={button}
            variant="secondary"
            aria-disabled={pending || undefined}
            onClick={() => {
              if (pending) return;
              focusWhen.current = true;
              available.mutate({ available: true });
            }}
          >
            {CAL_COPY.republish}
          </Button>
        </div>
      )}
      {available.error ? (
        <Notice tone="error">
          {toDomainError(available.error).message}
        </Notice>
      ) : null}
      {closing ? (
        <SheetBoundary name="Pausar la casa" onRetry={() => (CloseSheet = lazyCloseSheet())}>
          {() => (
            <Suspense fallback={<div className="sheet-backdrop" />}>
              <CloseSheet
                onClose={() => endClosing(true)}
                onConfirm={(reopenAt) => {
                  endClosing(false);
                  available.mutate({ available: false, reopenAt });
                }}
              />
            </Suspense>
          )}
        </SheetBoundary>
      ) : null}
    </>
  );
}

/** Pausa: dos barras, con el trazo de los iconos de línea (shared/icons). Va en este trozo, no en el JS inicial. */
function PauseIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" aria-hidden="true">
      <path d="M9 6v12M15 6v12" />
    </svg>
  );
}

/** Si el trozo de una hoja no llega (sin red, o un despliegue nuevo cambió su nombre) o falla al pintarse, se dice junto a
 *  la fila (lo segundo, además, a /errors). «Reintentar» crea otro componente (`onRetry`), que vuelve a pedir el trozo
 *  (por eso la hoja llega como función: se pinta con el componente nuevo). */
class SheetBoundary extends Component<{ name: string; onRetry: () => void; children: () => ReactNode }, { failed: boolean }> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    if (!isChunkLoadError(error)) reportError(error);
  }
  override render() {
    if (!this.state.failed) return this.props.children();
    return (
      <div className="row gap-8 baseline cal-action-error">
        <p className="field-error" role="alert">
          {CAL_COPY.openError({ name: this.props.name })}
        </p>
        <Button
          variant="secondary"
          onClick={() => {
            this.props.onRetry();
            this.setState({ failed: false });
          }}
        >
          {CAL_COPY.retry}
        </Button>
      </div>
    );
  }
}

/** Los meses uno debajo de otro, cada uno con su título fijo arriba. Una rejilla se monta al acercarse su mes a la vista
 *  (a una pantalla) y ya no se desmonta; los dos primeros meses y el pedido (`?mes=`) van montados desde el principio, para
 *  que nada crezca encima del pedido. Con mes pedido, se lleva arriba; sin él, la pantalla abre arriba del todo. Desplazarse
 *  no cambia la URL. */
function CalendarMonths({ months, target, render }: { months: string[]; target: string | null; render: (month: string) => ReactNode }) {
  const [mounted, setMounted] = useState(() => new Set([months[0]!, months[1]!, ...(target ? [target, addMonths(target, 1)] : [])].filter((m) => months.includes(m))));
  const box = useRef<HTMLDivElement>(null);
  const router = useRouter();
  useLayoutEffect(() => {
    if (!target || target === months[0]) return;
    const toTarget = () => {
      ignoreChromeScroll(300);
      box.current?.querySelector(`[data-month="${target}"]`)?.scrollIntoView({ block: "start" });
    };
    toTarget();
    // Al llegar desde la app, la restauración del desplazamiento del router corre en su onRendered, después de este
    // efecto, y devuelve la página arriba: se lleva el mes otra vez justo después (una sola vez; luego manda el dedo).
    const stop = router.subscribe("onRendered", () => {
      stop();
      toTarget();
    });
    return stop;
    // Solo al abrir.
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
