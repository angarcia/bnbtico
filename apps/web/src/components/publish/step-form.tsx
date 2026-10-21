"use client";
import Link from "next/link";
import { startTransition, useActionState } from "react";
import { saveStepAction } from "@/actions/listings";
import type { ActionState } from "@/actions/account";
import type { Step } from "@/lib/listings/schema";

const initial: ActionState = {};

/** Envoltorio del paso: los campos, el error del servidor y los botones fijos Atrás (contorno) / Continuar (relleno). */
export function StepForm({ listingId, step, children, initialError }: { listingId: string; step: Step; children: React.ReactNode; initialError?: string }) {
  const [state, action, pending] = useActionState(saveStepAction, initialError ? { error: initialError } : initial);
  // Con `action` a secas, React 19 vacía los campos no controlados al terminar la acción: tras un error de validación el
  // propietario perdería lo escrito. Enviando desde onSubmit se conserva; sin JavaScript sigue funcionando `action`.
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  };
  return (
    <form action={action} onSubmit={submit} className="stack" style={{ gap: 16, paddingTop: 6 }}>
      <input type="hidden" name="id" value={listingId} />
      <input type="hidden" name="step" value={step} />
      {state.error ? <div className="note" role="alert">{state.error}</div> : null}
      {children}
      <div className="sticky-spacer" aria-hidden="true" />
      <div className="sticky-actions">
        {step === 1 ? (
          <span className="btn btn-ghost" aria-disabled="true" style={{ borderColor: "var(--line)", color: "#A3ADA6" }}>Atrás</span>
        ) : (
          <Link href={`/propietario/publicar/${listingId}/${step - 1}`} className="btn btn-ghost">Atrás</Link>
        )}
        <button className="btn btn-primary grow" type="submit" disabled={pending}>
          {pending ? "Un momento…" : step < 5 ? "Continuar" : "Enviar a revisión"}
        </button>
      </div>
    </form>
  );
}
