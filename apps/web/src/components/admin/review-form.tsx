"use client";
import { startTransition, useActionState } from "react";
import type { ActionState } from "@/actions/account";
import { reviewAction } from "@/actions/admin";
import { STATUS_LABELS, type ListingStatus } from "@/lib/listings/schema";

const initial: ActionState = {};

/** Pantalla 22: lista de comprobación, mensaje para el propietario y los tres botones fijos. */
export function ReviewForm({ listingId, status, note, photoCount }: { listingId: string; status: ListingStatus; note: string | null; photoCount: number }) {
  const [state, action, pending] = useActionState(reviewAction, initial);
  if (status !== "review") {
    return (
      <div className="note" role="status" style={{ flexDirection: "column", gap: 4 }}>
        <b>{STATUS_LABELS[status].label}</b>
        <span style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{note || "Sin nota adicional."}</span>
      </div>
    );
  }
  const decide = (decision: string) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget.form!);
    data.set("decision", decision);
    startTransition(() => action(data));
  };
  return (
    <form className="stack" style={{ gap: 14 }}>
      <input type="hidden" name="id" value={listingId} />
      <section className="card-soft stack" style={{ gap: 8 }}>
        <b className="small">Antes de decidir</b>
        <label className="check"><input type="checkbox" name="check-photos" /> Las fotos son de la casa y sin teléfonos ni logos</label>
        <label className="check"><input type="checkbox" name="check-text" /> La descripción no tiene enlaces ni publicidad</label>
        <label className="check"><input type="checkbox" name="check-price" /> Zona y precio coherentes</label>
      </section>
      <div className="field">
        <label htmlFor="admin-review-note">Mensaje para el propietario <span style={{ fontWeight: 400 }}>(obligatorio si pide cambios o rechaza)</span></label>
        <textarea id="admin-review-note" name="note" rows={3} maxLength={2000} placeholder="Ej.: la foto 4 muestra un número de teléfono; súbala sin él." />
      </div>
      {state.error ? <p className="field-error" role="alert">{state.error}</p> : null}
      {photoCount < 5 ? <p className="note note-sun small">Faltan fotos: se requieren al menos 5 para aprobar.</p> : null}
      <div className="sticky-spacer" aria-hidden="true" style={{ height: 112 }} />
      <div className="sticky-actions" style={{ flexDirection: "column", gap: 8 }}>
        <button className="btn btn-primary btn-block" type="submit" name="decision" value="approve" disabled={pending || photoCount < 5} onClick={decide("approve")}>Aprobar y publicar</button>
        <div className="row" style={{ gap: 8 }}>
          <button className="btn btn-ghost" style={{ flex: 1, minHeight: 44, fontSize: 14, fontFamily: "var(--body)" }} type="submit" name="decision" value="changes" disabled={pending} onClick={decide("changes")}>Pedir cambios</button>
          <button className="btn btn-outline-bad" style={{ flex: 1, minHeight: 44, fontSize: 14, fontFamily: "var(--body)" }} type="submit" name="decision" value="reject" disabled={pending} onClick={decide("reject")}>Rechazar</button>
        </div>
      </div>
    </form>
  );
}
