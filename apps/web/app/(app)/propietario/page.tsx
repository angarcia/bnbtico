import Link from "next/link";
import { ScreenTitle } from "@/components/shell";
import { auth } from "@/lib/auth";
import { listOwnListings } from "@/lib/listings/repo";
import { STATUS_LABELS } from "@/lib/listings/schema";
import { supabaseServer } from "@/lib/supabase/server";

export const metadata = { title: "Tu panel" };

export default async function Panel({ searchParams }: { searchParams: Promise<{ "sin-supabase"?: string }> }) {
  const params = await searchParams;
  const [db, account] = await Promise.all([supabaseServer(), (await auth()).current()]);
  const listings = db && account ? await listOwnListings(db) : [];
  return (
    <>
      <ScreenTitle title="Tu panel" />
      {account ? <p className="eyebrow">Hola, {account.name}</p> : null}
      {!db || params["sin-supabase"] ? (
        <div className="note">Esta pantalla necesita Supabase. En local: <code>pnpm db:start</code>.</div>
      ) : (
        <Link href="/propietario/publicar" className="btn btn-primary">Publicar casa</Link>
      )}
      <section className="stack" style={{ gap: 10 }}>
        <div className="row between">
          <b>Mis casas</b>
          <Link href="/propietario/casas" className="btn-link">Ver todas</Link>
        </div>
        {listings.length === 0 ? (
          <p className="small muted">Todavía no publicaste ninguna casa.</p>
        ) : (
          listings.map((l) => (
            <article key={l.id} className="card row between">
              <b>{l.title || "Borrador sin título"}</b>
              <span className={`badge ${STATUS_LABELS[l.status].badge}`}>{STATUS_LABELS[l.status].label}</span>
            </article>
          ))
        )}
      </section>
    </>
  );
}
