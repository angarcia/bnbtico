// Calendario de la ficha pública (trozo diferido `listing-calendar-*`): la rejilla del mes con los días que trajo el worker
// (ssr-data) o la consulta pública de la SPA. El formato del calendario del propietario (revisión UX 2026-10-29, N4), un mes a
// la vez con ‹ › y el precio de cada noche en la moneda de la página. Desde el ticket 08 de la ronda del 2 nov se eligen
// llegada y salida tocando días, con el estilo de rango de «¿Cuándo?»; las fechas son las de la pestaña (`stay-dates.ts`):
// las que trae Explorar, y las que cambie aquí las ve también la hoja de contacto y al revés. Como se monta tras hidratar,
// puede leerlas sin tocar el HTML del servidor.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useRef, useState } from "react";
import { addMonths, calendarWindow, effectiveDay, monthTitle, openingMonth } from "../domain/calendar";
import type { Currency } from "../domain/currency";
import type { PublicListing } from "../domain/listing";
import { canTapDay, RANGE_BUSY_MESSAGE, tapRangeFree, type RangeState } from "../domain/range";
import { hasBusyNight, listingStay, stayLine } from "../domain/stay-price";
import { I } from "./icons";
import { listingDaysQuery } from "./listing-query";
import { MonthGrid, MonthLegend, WeekdayRow } from "./month-grid";
import { stayDates, useStayDates } from "./stay-dates";

/** Hoy en Costa Rica (UTC−6, sin horario de verano), igual que `costaRicaToday` de domain/inquiry: importarla desde allí
 *  ata este trozo al de la consulta y Rolldown vuelve a partir los de la hoja de contacto (medido: +0,07 KB en la zona
 *  privada y en la hoja). */
const costaRicaToday = (nowMs: number) => new Date(nowMs - 6 * 3_600_000).toISOString().slice(0, 10);

export function ListingCalendar({ listing: l, currency, fx }: { listing: PublicListing; currency: Currency; fx: number }) {
  const today = costaRicaToday(Date.now());
  const win = calendarWindow(today);
  const shared = useStayDates();
  const monthOf = (day: string) => (day.slice(0, 7) < win.firstMonth ? win.firstMonth : day.slice(0, 7) > win.lastMonth ? win.lastMonth : day.slice(0, 7));
  // Abre en el mes de la llegada compartida; sin fechas, a fin de mes en el siguiente (revisión UX A4). «‹» vuelve al actual.
  const [month, setMonth] = useState(() => (shared ? monthOf(shared.arrival) : openingMonth(today)));
  // La llegada elegida aquí que aún espera su salida (las fechas compartidas son siempre un rango completo).
  const [pending, setPending] = useState<string | null>(null);
  const [rejected, setRejected] = useState(false);
  const { data: days } = useQuery(listingDaysQuery(l.publicId));
  const base = l.acceptsNightly ? l.nightlyPriceCrc : null;
  const title = monthTitle(month);
  const value: RangeState = shared ? { arrival: shared.arrival, departure: shared.departure } : { arrival: pending, departure: null };
  const busy = useMemo(() => (day: string) => !!days && !effectiveDay(days, base, day).available, [days, base]);

  // Un cambio de fechas que no vino de aquí (la hoja de contacto): el calendario enseña el mes de la nueva llegada.
  const mine = useRef(false);
  useEffect(() => {
    if (mine.current) mine.current = false;
    else if (shared) setMonth(monthOf(shared.arrival));
    // Solo cuando cambian las fechas compartidas.
  }, [shared?.arrival, shared?.departure]);

  const select = (day: string) => {
    const r = tapRangeFree(value, day, busy);
    setRejected(r.rejected);
    if (r.rejected || r.state === value) return;
    mine.current = true;
    if (r.state.arrival && r.state.departure) {
      setPending(null);
      stayDates.write({ arrival: r.state.arrival, departure: r.state.departure });
    } else {
      setPending(r.state.arrival);
      if (shared) stayDates.write(null);
      else mine.current = false;
    }
  };
  const clear = () => {
    mine.current = !!shared;
    setPending(null);
    setRejected(false);
    stayDates.write(null);
  };

  // Fechas de Explorar (o de un enlace viejo) con una noche ocupada: sin banda ni total, el aviso en la línea del total.
  const blocked = !!days && hasBusyNight(l, days, shared);
  const stay = days && shared ? listingStay(l, days, shared) : null;
  // La línea del total ocupa su sitio con o sin fechas: la caja no cambia de alto.
  const warn = rejected || blocked;
  const note = warn ? RANGE_BUSY_MESSAGE : stay && shared ? stayLine(stay, shared, currency, fx) : pending ? "Ahora elija la salida." : "";
  return (
    <>
      <div className="cal-month">
        <div className="row gap-4">
          <button type="button" className="icon-btn cal-arrow" aria-label="Mes anterior" disabled={month <= win.firstMonth} onClick={() => setMonth(addMonths(month, -1))}>
            <I.back size={20} />
          </button>
          <b className="display cal-title">{title}</b>
          <button type="button" className="icon-btn cal-arrow" aria-label="Mes siguiente" disabled={month >= win.lastMonth} onClick={() => setMonth(addMonths(month, 1))}>
            <I.chevron size={20} />
          </button>
        </div>
      </div>
      {days ? (
        <>
          <WeekdayRow />
          <MonthGrid month={month} today={today} days={days} base={base} currency={currency} fx={fx} label={title} range={blocked ? { arrival: null, departure: null } : value} canTap={(d) => canTapDay(value, d, busy)} onSelect={select} />
          <div className="cal-legend-row">
            <MonthLegend />
            {value.arrival ? (
              <button type="button" className="btn-text" onClick={clear}>
                Quitar fechas
              </button>
            ) : null}
          </div>
          <p className={`cal-stay${warn ? " is-rejected" : ""}`} data-testid="stay-total" role={warn ? "alert" : undefined} aria-live={warn ? undefined : "polite"}>
            {note}
          </p>
        </>
      ) : null}
    </>
  );
}
