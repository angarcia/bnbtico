// Calendario de la ficha pública (trozo diferido `listing-calendar-*`): la rejilla del mes con los días que trajo el worker
// (ssr-data) o la consulta pública de la SPA. El formato del calendario del propietario (revisión UX 2026-10-29, N4), un mes a
// la vez con ‹ ›, con el precio de cada noche en la moneda de la página.
// Ronda de Ana 2 nov, ticket 08: se eligen llegada y salida tocando días, con el estilo de rango de «¿Cuándo?». Las fechas son
// las de la pestaña (`stay-dates.ts`): las de la búsqueda de Explorar, y las que se elijan aquí las ve la hoja de contacto y al
// revés. Se monta tras hidratar, así que puede leerlas sin tocar el HTML del servidor; la caja mide lo mismo con o sin fechas.
// Su total es también el de la barra de precio (`onStay`): una sola cuenta, y la barra no carga reglas en el JS inicial.
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { addMonths, calendarWindow, effectiveDay, monthTitle, openingMonth } from "../domain/calendar";
import type { Currency } from "../domain/currency";
import type { PublicListing } from "../domain/listing";
import { canTapDay, RANGE_BUSY_MESSAGE, tapRangeFree, type RangeState } from "../domain/range";
import { hasBusyNight, listingStay, MONTHLY_ESTIMATE_NIGHTS, stayLine } from "../domain/stay-price";
import { I } from "./icons";
import { listingDaysQuery } from "./listing-query";
import { MonthGrid, MonthLegend, WeekdayRow } from "./month-grid";
import { stayDates, useStayDates } from "./stay-dates";

/** Hoy en Costa Rica (UTC−6, sin horario de verano), igual que `costaRicaToday` de domain/inquiry: importarla desde allí
 *  ata este trozo al de la consulta y Rolldown vuelve a partir los de la hoja de contacto (medido: +0,07 KB en la zona
 *  privada y en la hoja). */
const costaRicaToday = (nowMs: number) => new Date(nowMs - 6 * 3_600_000).toISOString().slice(0, 10);

const NO_RANGE: RangeState = { arrival: null, departure: null };

/** El total de la estancia para la barra de la ficha y si, con esas noches, va también el mensual (desde las mismas con que
 *  la regla estima por meses). */
export interface BarStay {
  totalCrc: number;
  nights: number;
  monthly: boolean;
}

export function ListingCalendar({ listing: l, currency, fx, onStay }: { listing: PublicListing; currency: Currency; fx: number; onStay?: (stay: BarStay | null) => void }) {
  const today = costaRicaToday(Date.now());
  const win = calendarWindow(today);
  const shared = useStayDates();
  const monthOf = (day: string) => {
    const m = day.slice(0, 7);
    return m < win.firstMonth ? win.firstMonth : m > win.lastMonth ? win.lastMonth : m;
  };
  // Abre en el mes de la llegada; sin fechas, a fin de mes en el siguiente (revisión UX A4). «‹» vuelve al actual.
  const [month, setMonth] = useState(() => (shared ? monthOf(shared.arrival) : openingMonth(today)));
  // La llegada elegida aquí que espera su salida: las fechas de la pestaña son siempre llegada y salida.
  const [pending, setPending] = useState<string | null>(null);
  const [rejected, setRejected] = useState(false);
  const { data: days } = useQuery(listingDaysQuery(l.publicId));
  const base = l.acceptsNightly ? l.nightlyPriceCrc : null;
  const title = monthTitle(month);
  const stay = days ? listingStay(l, days, shared) : null;
  // La barra de precio, con el mismo total (o sin él: sin fechas, con noches ocupadas o sin días).
  const total = stay?.totalCrc;
  const nights = stay?.nights;
  useEffect(() => {
    onStay?.(total === undefined || nights === undefined ? null : { totalCrc: total, nights, monthly: nights >= MONTHLY_ESTIMATE_NIGHTS });
  }, [total, nights]);

  // Fechas cambiadas en la hoja de contacto: el calendario enseña el mes de la nueva llegada (las de aquí no lo mueven).
  const ownWrite = useRef(false);
  useEffect(() => {
    if (ownWrite.current) ownWrite.current = false;
    else if (shared) setMonth(monthOf(shared.arrival));
    // Solo cuando cambian las fechas de la pestaña.
  }, [shared]);

  if (!days) return <MonthHead month={month} setMonth={setMonth} title={title} win={win} />;

  // Fechas que ya traen una noche ocupada (de Explorar o de un enlace): sin banda ni total, el aviso en la línea del total.
  const blocked = hasBusyNight(days, shared);
  const value: RangeState = shared ? { arrival: shared.arrival, departure: shared.departure } : { arrival: pending, departure: null };
  const busy = (day: string) => !effectiveDay(days, base, day).available;
  const write = (dates: RangeState) => {
    ownWrite.current = true;
    stayDates.write(dates.arrival && dates.departure ? { arrival: dates.arrival, departure: dates.departure } : null);
  };
  const select = (day: string) => {
    const r = tapRangeFree(value, day, busy);
    setRejected(r.rejected);
    if (r.rejected || r.state === value) return;
    if (r.state.departure) {
      setPending(null);
      write(r.state);
    } else {
      setPending(r.state.arrival);
      if (shared) write(NO_RANGE);
    }
  };
  const clear = () => {
    setPending(null);
    setRejected(false);
    if (shared) write(NO_RANGE);
  };
  const warn = rejected || blocked;
  const note = warn ? RANGE_BUSY_MESSAGE : stay && shared ? stayLine(stay, shared, currency, fx) : pending ? "Ahora elija la salida." : "";
  return (
    <>
      <MonthHead month={month} setMonth={setMonth} title={title} win={win} />
      <WeekdayRow />
      <MonthGrid
        month={month}
        today={today}
        days={days}
        base={base}
        currency={currency}
        fx={fx}
        label={title}
        range={blocked ? NO_RANGE : value}
        canTap={(day) => canTapDay(value, day, busy)}
        onSelect={select}
      />
      {/* Leyenda con «Quitar fechas» y la línea del total (o del aviso): las dos guardan su sitio con o sin fechas. */}
      <div className="cal-legend-row">
        <MonthLegend />
        {value.arrival ? (
          <button type="button" className="btn-text" onClick={clear}>
            Quitar fechas
          </button>
        ) : null}
      </div>
      <p className={`cal-stay${warn ? " is-busy" : ""}`} data-testid="stay-total" role={warn ? "alert" : undefined} aria-live={warn ? undefined : "polite"}>
        {note}
      </p>
    </>
  );
}

function MonthHead({ month, setMonth, title, win }: { month: string; setMonth: (m: string) => void; title: string; win: { firstMonth: string; lastMonth: string } }) {
  return (
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
  );
}

