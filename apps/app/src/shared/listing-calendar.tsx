// Calendario de la ficha pública (trozo diferido `listing-calendar-*`): la rejilla del mes en solo lectura con los días
// que trajo el worker (ssr-data) o la consulta pública de la SPA. Cifra solo en los días ★, en la moneda de la página.
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { addMonths, calendarWindow, monthTitle } from "../domain/calendar";
import type { Currency } from "../domain/currency";
import type { PublicListing } from "../domain/listing";
import { formatMoney } from "../domain/money";
import { I } from "./icons";
import { listingDaysQuery } from "./listing-query";
import { MonthGrid, MonthLegend } from "./month-grid";

/** Hoy en Costa Rica (UTC−6, sin horario de verano), igual que `costaRicaToday` de domain/inquiry: importarla desde allí
 *  ata este trozo al de la consulta y Rolldown vuelve a partir los de la hoja de contacto (medido: +0,07 KB en la zona
 *  privada y en la hoja). */
const costaRicaToday = (nowMs: number) => new Date(nowMs - 6 * 3_600_000).toISOString().slice(0, 10);

export function ListingCalendar({ listing: l, currency }: { listing: PublicListing; currency: Currency }) {
  const today = costaRicaToday(Date.now());
  const win = calendarWindow(today);
  const [month, setMonth] = useState(win.firstMonth);
  const { data: days } = useQuery(listingDaysQuery(l.publicId));
  const base = l.acceptsNightly ? l.nightlyPriceCrc : null;
  const title = monthTitle(month);
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
          <MonthGrid month={month} today={today} days={days} base={base} prices={base === null ? "none" : "special"} currency={currency} label={title} />
          <MonthLegend special={base !== null} />
          {base !== null ? <p className="xs muted">Precio base {formatMoney(base, currency)} por noche; los días con ★ tienen otro precio.</p> : null}
        </>
      ) : null}
    </>
  );
}
