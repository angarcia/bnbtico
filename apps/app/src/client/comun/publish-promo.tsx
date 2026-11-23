// Puertas para publicar sin cuenta (revisión UX 2026-10-29, A8, Ana): la tarjeta al final de Explorar y la fila en ocre de
// Ingresar y de Cuenta. Las dos llevan a /publicar (el asistente sin cuenta, o el de siempre con sesión) y dicen las plazas
// que quedan de la oferta; sin plazas, el precio.
import { useQuery } from "@tanstack/react-query";

import { formatCRC } from "../../domain/money";
import { MONTHLY_FEE_CRC, launchOffer } from "../../domain/offer";
import { I } from "../../shared/ui/icons";
import { offerTakenQuery } from "./offer-query";
import { RouterButtonLink } from "./router-buttons";
import { RouterListRow } from "./router-rows";
import { Card } from "../../shared/ui/card";
import * as PROMO_COPY from "./copy/publish-promo";

export function useOffer() {
  const taken = useQuery(offerTakenQuery);
  return taken.data === undefined ? undefined : launchOffer(taken.data);
}

const FEE = formatCRC(MONTHLY_FEE_CRC);

export function PublishPromoButton({ label }: { label: string }) {
  return <RouterButtonLink to="/publicar" variant="pay" block>{label}</RouterButtonLink>;
}

/** Al final de Explorar: estilo de la oferta (marrón dorado) y el botón en ocre. */
export function PublishPromoCard() {
  const offer = useOffer();
  return (
    <Card layout="stack" gap={8} placement="publish-promo" data-testid="publish-promo">
      <b className="display offer-title">{PROMO_COPY.title}</b>
      <span className="small ink">
        {offer ? (
          <>{PROMO_COPY.offer({ months: offer.months, places: <b key="places">{PROMO_COPY.places({ remaining: offer.remaining, size: offer.size })}</b> })}</>
        ) : offer === null ? (
          <>{PROMO_COPY.paid({ fee: FEE })}</>
        ) : (
          <>{PROMO_COPY.free}</>
        )}
      </span>
      <span className="xs">
        {PROMO_COPY.note({ fee: offer ? FEE : null })}
      </span>
      <PublishPromoButton label={PROMO_COPY.button({ free: offer !== null })} />
    </Card>
  );
}

/** Fila en ocre de Ingresar y de Cuenta. */
export function PublishPromoRow() {
  const offer = useOffer();
  return (
    <RouterListRow tone="sun" placement="publish-promo-row" to="/publicar" data-testid="publish-promo-row">
      <I.house />
      <span className="body">
        {PROMO_COPY.rowTitle({ free: offer !== null })}
        <small className="num">{offer ? PROMO_COPY.rowOffer({ months: offer.months, remaining: offer.remaining, size: offer.size }) : offer === null ? PROMO_COPY.rowPaid({ fee: FEE }) : PROMO_COPY.rowFree}</small>
      </span>
      <span className="chev">
        <I.chevron />
      </span>
    </RouterListRow>
  );
}
