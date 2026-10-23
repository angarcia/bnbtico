import { useEffect, useState, type ReactNode } from "react";
import { formatCRC } from "../domain/money";
import type { ListingView } from "./listing";

/** Lo que depende de la sesión se monta después de hidratar, en una caja de tamaño fijo para que la página no salte. */
function AfterHydration({ children }: { children: ReactNode }) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  return <div className="after-hydration">{mounted ? children : null}</div>;
}

export function ListingPage({ listing }: { listing: ListingView }) {
  const { hero } = listing;
  return (
    <main className="listing">
      <img className="listing-hero" src={hero.src} width={hero.width} height={hero.height} alt={hero.alt} fetchPriority="high" />
      <div className="listing-body">
        <div className="row between">
          <span className="eyebrow">{listing.place}</span>
          <AfterHydration>
            <a className="btn btn-sm btn-ghost" href="/cuenta">Ingresar</a>
          </AfterHydration>
        </div>
        <h1>{listing.title}</h1>
        <p className="listing-price num">
          <b>{formatCRC(listing.nightlyPrice)}</b> <span className="muted">por noche · precio orientativo</span>
        </p>
        <p>{listing.summary}</p>
      </div>
    </main>
  );
}
