// Mis consultas (pantalla 18 del diseño v1): quién le escribió al propietario por WhatsApp desde sus fichas. Trozo diferido.
// Se pinta desde la caché (`["inquiries", uid]`, persistida con la sesión) y se refresca por detrás. «Abrir WhatsApp» abre
// el chat con el cliente sin texto (la conversación ya existe) y la consulta deja de ser «Nueva».
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { describe } from "../../domain/describe";
import { initials, inquiryHouses, inquirySummary, relativeTime, type OwnerInquiry } from "../../domain/inquiry";
import type { Listing } from "../../domain/listing";
import { toDomainError } from "../../domain/errors";
import { I } from "../../shared/icons";
import { useShare } from "../../shared/share-button";
import { RootHeader } from "../chrome";
import { inquiriesQuery, openInquiry } from "../inquiries";
import { ownListingsQuery } from "../owner";
import { setRole } from "../role";
import { useSession } from "../session";

export function ConsultasScreen() {
  useEffect(() => setRole("owner"), []);
  const userId = useSession().session?.userId ?? "";
  const query = useQuery({ ...inquiriesQuery(userId), enabled: !!userId });
  const list = query.data;
  const [house, setHouse] = useState<string | null>(null);
  const houses = list ? inquiryHouses(list) : [];
  const selected = houses.some((h) => h.publicId === house) ? house : null;
  const shown = list?.filter((i) => !selected || i.publicId === selected) ?? [];

  return (
    <>
      <RootHeader title="Mis consultas" home="/propietario" />
      <p className="small muted inquiries-intro">Clientes que le escribieron por WhatsApp desde su ficha. Toque una para seguir la conversación; aquí no hay nada que aceptar ni rechazar.</p>
      {list && list.length > 0 ? (
        <div className="chiprow" role="group" aria-label="Filtrar por casa">
          <button type="button" className="chip chip-sm" aria-pressed={!selected} onClick={() => setHouse(null)}>
            Todas · <span className="num">{list.length}</span>
          </button>
          {houses.map((h) => (
            <button key={h.publicId} type="button" className="chip chip-sm" aria-pressed={selected === h.publicId} onClick={() => setHouse(h.publicId)}>
              {h.title}
            </button>
          ))}
        </div>
      ) : null}
      {query.isError && !list ? (
        <p className="note" role="alert">
          {toDomainError(query.error).message}
        </p>
      ) : null}
      {!list && !query.isError ? <SkeletonInquiry /> : null}
      {list && list.length === 0 ? <EmptyInquiries userId={userId} /> : null}
      {shown.length > 0 ? (
        <div className="stack gap-12">
          {shown.map((i) => (
            <InquiryCard key={i.id} inquiry={i} userId={userId} />
          ))}
          <p className="xs muted inquiries-foot">Es un registro de quién le escribió; la conversación completa está en su WhatsApp.</p>
        </div>
      ) : null}
    </>
  );
}

function InquiryCard({ inquiry: i, userId }: { inquiry: OwnerInquiry; userId: string }) {
  const client = useQueryClient();
  const opening = useRef(false);
  const isNew = !i.openedAt;
  const nameId = `inquiry-${i.id}`;
  function open() {
    if (opening.current) return;
    opening.current = true;
    void openInquiry(client, userId, i).finally(() => (opening.current = false));
  }
  return (
    <article className={`card stack gap-10 inquiry-card${isNew ? " is-new" : ""}`} aria-labelledby={nameId}>
      <div className="row gap-12 align-top">
        <span className={`avatar inquiry-avatar${isNew ? "" : " is-read"}`} aria-hidden="true">
          {initials(i.clientName)}
        </span>
        <div className="stack inquiry-body grow-col">
          <div className="row between baseline gap-8">
            <h2 id={nameId} className="inquiry-name">
              {i.clientName}
            </h2>
            <span className="row baseline gap-6 nowrap">
              {isNew ? <span className="badge badge-new">Nueva</span> : null}
              <span className="xs muted">{relativeTime(i.updatedAt, Date.now())}</span>
            </span>
          </div>
          <span className="small muted">{inquirySummary(i)}</span>
          {i.source === "bnbtico" ? <span className="badge badge-tight">Creada por bnbtico</span> : null}
          <p className="inquiry-message">“{i.message}”</p>
        </div>
      </div>
      <button type="button" className="btn btn-wa inquiry-wa" onClick={open}>
        <I.wa size={18} /> Abrir WhatsApp
      </button>
    </article>
  );
}

function EmptyInquiries({ userId }: { userId: string }) {
  const listings = useQuery({ ...ownListingsQuery(userId), enabled: !!userId });
  const active = listings.data?.find((l) => l.status === "active");
  return (
    <section className="card stack gap-12">
      <p>Todavía no le han escrito. Comparta su ficha para recibir consultas.</p>
      {active ? <ShareListing listing={active} /> : null}
    </section>
  );
}

function ShareListing({ listing: l }: { listing: Listing }) {
  const d = describe(l, { base: window.location.origin });
  const target = { url: d.shareUrl, title: l.title, text: d.previewText };
  const { share, copied, swap } = useShare(target);
  return (
    <button type="button" className="btn btn-primary btn-lg btn-block" onClick={share} data-share-url={target.url}>
      <span key={copied ? "copied" : "share"} className={swap}>
        {copied ? "Enlace copiado" : "Compartir ficha"}
      </span>
    </button>
  );
}

function SkeletonInquiry() {
  return (
    <section className="card skeleton owner-skeleton" aria-busy="true" aria-label="Cargando sus consultas">
      <span className="sk inquiry-avatar" />
      <span className="sk sk-line" />
    </section>
  );
}
