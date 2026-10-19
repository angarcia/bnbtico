"use client";
import Link from "next/link";
import { startTransition, useActionState } from "react";
import { saveStepAction } from "@/actions/listings";
import type { ActionState } from "@/actions/account";
import type { Step } from "@/lib/listings/schema";

const initial: ActionState = {};

/** Envoltorio del paso: el formulario, el error del servidor y los botones Atrás / Continuar. Los campos llegan como hijos. */
export function StepForm({ listingId, step, children }: { listingId: string; step: Step; children: React.ReactNode }) {
  const [state, action, pending] = useActionState(saveStepAction, initial);
  // Con `action` a secas, React 19 vacía los campos no controlados al terminar la acción: tras un error de validación el
  // propietario perdería lo escrito. Enviando desde onSubmit se conserva; sin JavaScript sigue funcionando `action`.
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  };
  return (
    <form action={action} onSubmit={submit} className="stack" style={{ gap: 14 }}>
      <input type="hidden" name="id" value={listingId} />
      <input type="hidden" name="step" value={step} />
      <section className="card stack" style={{ gap: 14 }}>
        <p className="xs muted">* Obligatorio · lo guardamos al continuar.</p>
        {state.error ? <div className="note" role="alert">{state.error}</div> : null}
        {children}
      </section>
      <div className="row between">
        {step === 1 ? (
          <span className="btn btn-ghost" aria-disabled="true" style={{ opacity: 0.5 }}>Atrás</span>
        ) : (
          <Link href={`/propietario/publicar/${listingId}/${step - 1}`} className="btn btn-ghost">Atrás</Link>
        )}
        <button className="btn btn-primary" type="submit" disabled={pending}>
          {pending ? "Un momento…" : step < 5 ? "Continuar" : "Enviar a revisión"}
        </button>
      </div>
    </form>
  );
}
