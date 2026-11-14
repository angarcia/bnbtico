import { Link, Navigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { formatCRC } from "../../domain/money";
import { useDesktop } from "../desktop";
import { MONTHLY_FEE_CRC } from "../../domain/offer";
import { useListingsCount } from "../own-listings-query";
import { PublishPromoButton, useOffer } from "../publish-promo";
import { authApi, useSession } from "../session";
import "./que-es-3bstays.css";

export function QueEs3bstaysScreen() {
  const { status } = useSession();
  const desktop = useDesktop();
  const { count, fetching } = useListingsCount();
  const [openedWithoutSession] = useState(status === "signed-out");
  if (status === "signed-in" && (desktop || openedWithoutSession || (count ?? 0) > 0 || (count === undefined && !fetching))) {
    return <Navigate to="/explorar" replace />;
  }
  if (status === "loading" || (status === "signed-in" && count === undefined)) return <p role="status">Cargando…</p>;
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
            <Link to="/explorar" replace aria-label="3bstays, inicio">
              <img src="/logo-horizontal.png" alt="3bstays" width={109} height={38} />
            </Link>
          </header>
        )}
        <section className="about-guest" aria-labelledby="about-guest-title">
          <h1 id="about-guest-title">¿Busca alojamiento en Costa Rica?</h1>
          <p className="about-guest-line">
            Encuentre <Link to="/explorar" replace aria-label="Aquí, explorar alojamientos">aquí</Link> su alojamiento{" "}
            <img src="/logo-horizontal.png" alt="3bstays" width={66} height={23} />
          </p>
          <p className="about-slogan">Bueno, bonito y bien tico.</p>
          <p className="about-intro">Escriba directo al anfitrión por WhatsApp, sin comisiones de plataforma.</p>
        </section>
      </div>
      <section className="about-owner stack" aria-labelledby="about-owner-title">
        <h2 id="about-owner-title">¿Tiene una casa en Costa Rica?</h2>
        <p>Publique su casa{months ? " gratis" : ""} y reciba consultas por WhatsApp, sin comisiones ni cargos por reserva.</p>
        <PublishPromoButton label="Publicar mi casa" />
      </section>
      <section className="card about-price" aria-labelledby="about-price-title">
        {months && <p className="about-offer-label">Oferta de lanzamiento para nuevos anfitriones</p>}
        <h2 id="about-price-title">{months ? `Anuncie su casa gratis durante ${months} meses` : "Suscripción por casa activa"}</h2>
        <p className="about-rate">{months ? "Después, " : ""}<strong>{formatCRC(MONTHLY_FEE_CRC)}</strong> al mes por casa activa</p>
        <p>Una reserva de fin de semana lo paga.</p>
        <p className="about-terms">Sin comisiones ni permanencia.</p>
      </section>
      <Link to="/publicar" className="about-offer-link">
        {months ? `Publique ahora y obtenga ${months} meses gratis` : "Publique su casa ahora"}
      </Link>
    </div>
  );
}
