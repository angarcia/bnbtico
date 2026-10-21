import { createDraftAction } from "@/actions/listings";
import { OwnerCard } from "@/components/listing/owner-card";
import { RootHeader } from "@/components/shell";
import { listOwnListings } from "@/lib/listings/repo";
import { requireOwnerSession } from "@/lib/listings/session";
import { requestShareBase } from "@/lib/listings/share-server";

export const metadata = { title: "Mis casas" };

/** Mis casas (pantalla 10): resumen por estado y una tarjeta por casa con la acción que toca. */
export default async function Casas() {
  const { db } = await requireOwnerSession("/propietario/casas");
  const [listings, base] = await Promise.all([listOwnListings(db), requestShareBase()]);
  const count = (s: string) => listings.filter((l) => l.status === s).length;
  return (
    <>
      <RootHeader
        title="Mis casas"
        home="/propietario"
        action={
          <form action={createDraftAction}>
            <button className="btn btn-primary" type="submit">Nueva</button>
          </form>
        }
      />
      {listings.length > 0 ? (
        <div className="grid-3">
          <div className="tile tile-soft"><b className="num">{count("active")}</b><span>{count("active") === 1 ? "activa" : "activas"}</span></div>
          <div className="tile tile-sun"><b className="num">{count("payment_due")}</b><span>por pagar</span></div>
          <div className="tile tile-review"><b className="num">{count("review")}</b><span>en revisión</span></div>
        </div>
      ) : null}
      {listings.length === 0 ? (
        <section className="card stack">
          <h3>Todavía no publicó ninguna casa</h3>
          <p className="small muted">Fotos, ubicación aproximada, características y precio. La revisamos a mano y queda visible con su enlace.</p>
          <form action={createDraftAction}>
            <button className="btn btn-primary btn-lg btn-block" type="submit">Publicar casa</button>
          </form>
        </section>
      ) : (
        <div className="stack" style={{ gap: 14 }}>
          {listings.map((l) => (
            <OwnerCard key={l.id} listing={l} shareBase={base} />
          ))}
        </div>
      )}
    </>
  );
}
