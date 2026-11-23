import { Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { formatCRC } from "../../domain/money";
import { useDesktop } from "../../shared/desktop";
import { MONTHLY_FEE_CRC } from "../../domain/offer";
import { useListingsCount } from "../comun/own-listings-query";
import { PublishPromoButton, useOffer } from "../comun/publish-promo";
import { authApi, useSession } from "../comun/session";
import "./que-es-3bstays.css";
import { Card } from "../../shared/ui/card";
import * as ABOUT_COPY from "./copy/about";

export function QueEs3bstaysScreen() {
  const { status } = useSession();
  const desktop = useDesktop();
  const { count, fetching } = useListingsCount();
  const [openedWithoutSession] = useState(status === "signed-out");
  if (status === "signed-in" && (desktop || openedWithoutSession || (count ?? 0) > 0 || (count === undefined && !fetching))) {
    return <Navigate to="/explorar" replace />;
  }
  if (status === "loading" || (status === "signed-in" && count === undefined)) return <p role="status">{ABOUT_COPY.loading}</p>;
  return <AboutContent desktop={desktop} />;
}

function AboutContent({ desktop }: { desktop: boolean }) {
  const offer = useOffer();
  const months = offer?.months;
  useEffect(() => {
    // Escucha también el ingreso desde otra pestaña mientras esta pantalla está abierta.
    void authApi().catch(() => undefined);
  }, []);

  return (
    <div className="about-3bstays">
      <div className="about-top">
        {!desktop && (
          <header role="banner" className="about-brand">
            <Link to="/explorar" replace aria-label={ABOUT_COPY.home}>
              <img src="/logo-horizontal.png" alt={ABOUT_COPY.logo} width={109} height={38} />
            </Link>
          </header>
        )}
        <section className="about-guest" aria-labelledby="about-guest-title">
          <h1 id="about-guest-title">{ABOUT_COPY.guestTitle}</h1>
          <p className="about-guest-line">
            {ABOUT_COPY.guestLine({
              link: <Link key="link" to="/explorar" replace aria-label={ABOUT_COPY.guestLinkLabel}>{ABOUT_COPY.guestLink}</Link>,
              logo: <img key="logo" src="/logo-horizontal.png" alt={ABOUT_COPY.logo} width={66} height={23} />,
            })}
          </p>
          <p className="about-slogan">{ABOUT_COPY.slogan}</p>
          <p className="about-intro">{ABOUT_COPY.intro}</p>
        </section>
      </div>
      <section className="about-owner stack" aria-labelledby="about-owner-title">
        <h2 id="about-owner-title">{ABOUT_COPY.ownerTitle}</h2>
        <p>{ABOUT_COPY.ownerText({ free: !!months })}</p>
        <PublishPromoButton label={ABOUT_COPY.publish} />
      </section>
      <Card placement="about-price" aria-labelledby="about-price-title">
        {months && <p className="about-offer-label">{ABOUT_COPY.offerLabel}</p>}
        <h2 id="about-price-title">{ABOUT_COPY.priceTitle({ months })}</h2>
        <p className="about-rate">{ABOUT_COPY.rate({ fee: <strong key="fee">{formatCRC(MONTHLY_FEE_CRC)}</strong>, after: !!months })}</p>
        <p>{ABOUT_COPY.pays}</p>
        <p className="about-terms">{ABOUT_COPY.terms}</p>
      </Card>
      <Link to="/publicar" className="about-offer-link">
        {ABOUT_COPY.offerLink({ months })}
      </Link>
    </div>
  );
}
