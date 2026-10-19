"use client";
import { startTransition, useActionState } from "react";
import type { ActionState } from "@/actions/account";
import { reviewAction } from "@/actions/admin";
import { STATUS_LABELS, type ListingStatus } from "@/lib/listings/schema";

const initial: ActionState = {};

/** Decisión del admin: motivo (obligatorio para cambios o rechazo), aprobar (deshabilitado sin 5 fotos), pedir cambios, rechazar. */
export function ReviewForm({ listingId, status, note, photoCount }: { listingId: string; status: ListingStatus; note: string | null; photoCount: number }) {
  const [state, action, pending] = useActionState(reviewAction, initial);
  if (status !== "review") {
    return (
      <div className="note" role="status">
        <b>{STATUS_LABELS[status].label}</b>
        <p style={{ whiteSpace: "pre-wrap", overflowWrap: "anywhere" }}>{note || "Sin nota adicional."}</p>
      </div>
    );
  }
  const decide = (decision: string) => (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    const form = e.currentTarget.form!;
    const data = new FormData(form);
    data.set("decision", decision);
    startTransition(() => action(data));
  };
  return (
    <form className="stack">
      <input type="hidden" name="id" value={listingId} />
      <div className="field">
        <label htmlFor="admin-review-note">Motivo o indicaciones</label>
        <textarea id="admin-review-note" name="note" rows={4} maxLength={2000} placeholder="Explicá qué debe corregir el propietario…" />
        <span className="xs muted">Obligatorio para pedir cambios o rechazar; opcional al aprobar.</span>
      </div>
      {state.error ? <p className="field-error" role="alert">{state.error}</p> : null}
      <div className="row" style={{ flexWrap: "wrap", gap: 10 }}>
        <button className="btn btn-primary" type="submit" name="decision" value="approve" disabled={pending || photoCount < 5} onClick={decide("approve")}>Aprobar anuncio</button>
        <button className="btn btn-ghost" type="submit" name="decision" value="changes" disabled={pending} onClick={decide("changes")}>Pedir cambios</button>
        <button className="btn btn-ghost" type="submit" name="decision" value="reject" disabled={pending} onClick={decide("reject")} style={{ color: "var(--bad)" }}>Rechazar anuncio</button>
      </div>
    </form>
  );
}
