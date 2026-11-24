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
import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useNavigate } from "@tanstack/react-router";
import { Suspense, lazy, useCallback, useMemo, useState, type ReactNode } from "react";
import { calendarMonths, changeFromSelection, clearSelection, effectiveDay, emptySelection, monthTitle, selectDay, type Selection } from "../../../domain/calendar";
import { can, isBlocked } from "../../../domain/can";
import { showChrome } from "../../comun/hiding-chrome";
import { toDomainError } from "../../../domain/errors";
import { costaRicaToday } from "../../../domain/inquiry";
import { type Listing } from "../../../domain/listing";
import { resumeStep } from "../../../domain/publish-rules";
import { formatMoney } from "../../../domain/money";
import { FLAGS } from "../../../shared/flags";
import { I } from "../../../shared/ui/icons";
import { usePreloadWhenIdle } from "../../../shared/idle";
import { useCurrency } from "../../../shared/currency";
import { CurrencySwitch } from "../../../shared/currency-switch";
import { useFx } from "../../../shared/fx";
import { MonthGrid, WeekdayRow } from "../../../shared/month-grid";
import { toast } from "../../../shared/toast";
import { ScreenHeader } from "../../comun/screen-header";
import { useDesktop } from "../../../shared/desktop";
import { useEditor } from "../editor-port";
import { useSession } from "../../comun/session";
import { HousePicker } from "../house-picker";
import { AirbnbRow, AirbnbLegend, countCalendarOrigins } from "./airbnb-calendar-row";
import { RouterButtonLink } from "../../comun/router-buttons";
import { LoadError, Skeleton } from "../../../shared/ui/structure";
import { Card } from "../../../shared/ui/card";
import * as CAL_COPY from "./copy/calendar";
import { useCalendarHouse } from "./use-calendar-house";
import { useCalendarDays } from "./use-calendar-days";
import { CalendarMonths } from "./calendar-months";
import { MarkRow, PauseRow } from "./calendar-actions";

const route = getRouteApi("/_tabs/_private/_owner/propietario/calendario");
// El panel de los días elegidos, en su trozo (panel-dias-*): se pide en reposo al abrir el Calendario o al tocar un día
// (historia 07, paso 5).
const loadPanel = () => import("./panel-dias");
const Panel = lazy(() => loadPanel().then((m) => ({ default: m.Panel })));

const titleOf = (l: Listing) => l.title || CAL_COPY.untitled;

export function CalendarioScreen() {
  const userId = useSession().session?.userId ?? "";
  const search = route.useSearch();
  const navigate = useNavigate();
  const go = (casa: string, mes: string | undefined) => void navigate({ to: "/propietario/calendario", search: mes ? { casa, mes } : { casa }, replace: true });
  const { listings, houses, current, draft } = useCalendarHouse(userId, search.casa, (id) => go(id, search.mes));

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
  usePreloadWhenIdle(loadPanel);
  const client = useQueryClient();
  const port = useEditor();
  const desktop = useDesktop();
  const today = costaRicaToday(Date.now());
  const months = useMemo(() => calendarMonths(today), [today]);
  // `?mes=` lleva a ese mes; sin él (o fuera de la ventana), arriba del todo con el mes actual entero (revisión UX A1).
  const target = month && months.includes(month) ? month : null;
  const currency = useCurrency();
  const fx = useFx(currency === "USD");
  const { query, days, base, commit, markBooked } = useCalendarDays(l, userId, today, port.calendar);
  const ctx = { days, base, today };
  const [sel, setSel] = useState<Selection>(emptySelection);
  const [problem, setProblem] = useState<string | null>(null);
  const closed = !l.available;

  const change = changeFromSelection(sel);
  function onSave() {
    if (!change) return;
    const refused = commit(change);
    if (refused) return setProblem(refused);
    setSel(clearSelection());
    setProblem(null);
    showChrome();
  }
  /** «Marcar una reserva». Una selección a medias del panel se descarta (la rejilla cambia debajo). */
  function onMark(nights: string[], label: string): string | null {
    const refused = markBooked(nights);
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
