// Puertas para publicar sin cuenta (revisión UX 2026-10-29, A8, Ana): la tarjeta al final de Explorar y la fila en ocre de
// Ingresar y de Cuenta. Las dos llevan a /publicar (el asistente sin cuenta, o el de siempre con sesión) y dicen las plazas
// que quedan de la oferta; sin plazas, el precio.
import { useQuery } from "@tanstack/react-query";
import { Link } from "@tanstack/react-router";
import { formatCRC } from "../domain/money";
import { MONTHLY_FEE_CRC, launchOffer } from "../domain/offer";
import { I } from "../shared/icons";
import { offerTakenQuery } from "./offer-query";

function useOffer() {
  const taken = useQuery(offerTakenQuery);
  return taken.data === undefined ? undefined : launchOffer(taken.data);
}

const FEE = formatCRC(MONTHLY_FEE_CRC);

/** Al final de Explorar: estilo de la oferta (marrón dorado) y el botón en ocre. */
export function PublishPromoCard() {
  const offer = useOffer();
  return (
    <section className="card stack gap-8 offer-card publish-promo" data-testid="publish-promo">
      <b className="display offer-title">¿Tiene una casa en el Caribe?</b>
      <span className="small ink">
        {offer ? (
          <>
            Publíquela gratis {offer.months} meses. <b>Quedan {offer.remaining} de {offer.size} plazas.</b>
          </>
        ) : offer === null ? (
          <>Publíquela por {FEE} al mes.</>
        ) : (
          <>Publíquela gratis.</>
        )}
      </span>
      <span className="xs">
        {offer ? `Después, ${FEE} al mes por casa. ` : null}Sin comisiones; los clientes le escriben por WhatsApp.
      </span>
      <Link to="/publicar" className="btn btn-sun btn-block">
        {offer === null ? "Publicar mi casa" : "Publicar mi casa gratis"}
      </Link>
    </section>
  );
}

/** Fila en ocre de Ingresar y de Cuenta. */
export function PublishPromoRow() {
  const offer = useOffer();
  return (
    <Link to="/publicar" className="list-item list-item-sun publish-promo-row" data-testid="publish-promo-row">
      <I.house />
      <span className="body">
        {offer === null ? "¿Quiere publicar su casa?" : "¿Quiere publicar su casa gratis?"}
        <small className="num">{offer ? `Gratis ${offer.months} meses · quedan ${offer.remaining} de ${offer.size} plazas` : offer === null ? `${FEE} al mes por casa, sin comisiones` : "Sin comisiones por alquiler"}</small>
      </span>
      <span className="chev">
        <I.chevron />
      </span>
    </Link>
  );
}
