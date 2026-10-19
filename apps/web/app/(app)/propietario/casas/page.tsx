import { headers } from "next/headers";
import Link from "next/link";
import { OwnerCard } from "@/components/listing/owner-card";
import { ScreenTitle } from "@/components/shell";
import { listOwnListings } from "@/lib/listings/repo";
import { requireOwnerSession } from "@/lib/listings/session";
import { shareBase } from "@/lib/listings/share";

export const metadata = { title: "Mis casas" };

export default async function Casas({ searchParams }: { searchParams: Promise<{ enviada?: string }> }) {
  const [{ db }, params] = await Promise.all([requireOwnerSession("/propietario/casas"), searchParams]);
  const listings = await listOwnListings(db);
  const h = await headers();
  const base = shareBase({ NODE_ENV: process.env.NODE_ENV, NEXT_PUBLIC_STAGE: process.env.NEXT_PUBLIC_STAGE }, h.get("host") ? `${h.get("x-forwarded-proto") ?? "http"}://${h.get("host")}` : null);
  return (
    <>
      <ScreenTitle title="Mis casas" right={<Link href="/propietario/publicar" className="btn btn-primary" style={{ minHeight: 36, padding: "8px 12px" }}>Nueva</Link>} />
      {params.enviada === "1" ? (
        <div className="note" role="status">Anuncio enviado a revisión. Te avisamos cuando esté listo.</div>
      ) : null}
      {listings.length === 0 ? (
        <section className="card stack">
          <p>Todavía no publicaste ninguna casa.</p>
          <Link href="/propietario/publicar" className="btn btn-primary">Publicar casa</Link>
        </section>
      ) : (
        <div className="stack" style={{ gap: 12 }}>
          {listings.map((l) => (
            <OwnerCard key={l.id} listing={l} shareBase={base} />
          ))}
        </div>
      )}
    </>
  );
}
