// La línea del alquiler mensual (ficha, vista previa y detalle del propietario): «Mensual: ₡350 000 / mes» o
// «Mensual: precio a negociar con el dueño». `format` decide la moneda (la ficha sigue la elegida; el propietario, colones).
import { isNegotiable, NEGOTIABLE_LINE, type MonthlyPrice } from "../domain/describe";
import * as LISTING_PARTS_COPY from "./copy/listing-parts";

export function MonthlyLine({ monthly, format }: { monthly: MonthlyPrice; format: (crc: number) => string }) {
  return (
    <span className="xs muted" data-testid="monthly-line">
      {isNegotiable(monthly) ? (
        NEGOTIABLE_LINE
      ) : (
        <>
          {LISTING_PARTS_COPY.monthly({ amount: <b key="amount" className="ink num">{format(monthly.amount)}</b> })}
        </>
      )}
    </span>
  );
}
