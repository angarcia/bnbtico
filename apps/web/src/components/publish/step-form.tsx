"use client";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useRef } from "react";
import { saveStepAction } from "@/actions/listings";
import type { ActionState } from "@/actions/account";
import { enterKeyHintFor, nextFieldIndex } from "@/lib/forms/enter-next";
import { keyboardInset, scrollTopToCenter } from "@/lib/forms/keyboard-inset";
import { LAST_STEP, type Step } from "@/lib/listings/schema";

const initial: ActionState = {};
/** Campos que recorre «Siguiente»: entradas de texto, listas y áreas de texto, en el orden del documento. */
const FIELDS = 'input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea';
const fieldsOf = (form: HTMLFormElement) => Array.from(form.querySelectorAll<HTMLElement>(FIELDS)).filter((el) => !el.hidden);

/** Envoltorio del paso: los campos, el error del servidor y los botones fijos Atrás (contorno) / Continuar (relleno).
 *  Cada pantalla cabe sin scroll; el teclado muestra «Siguiente» entre campos y «Listo» en el último, que envía el paso. */
export function StepForm({ listingId, step, children, initialError }: { listingId: string; step: Step; children: React.ReactNode; initialError?: string }) {
  const [state, action, pending] = useActionState(saveStepAction, initialError ? { error: initialError } : initial);
  const ref = useRef<HTMLFormElement>(null);
  // Con `action` a secas, React 19 vacía los campos no controlados al terminar la acción: tras un error de validación el
  // propietario perdería lo escrito. Enviando desde onSubmit se conserva; sin JavaScript sigue funcionando `action`.
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  };

  // enterKeyHint según la posición del campo en el paso; se recalcula si aparece un campo (p. ej. «Tipo de parqueo»).
  useEffect(() => {
    const form = ref.current;
    if (!form) return;
    const apply = () => {
      const fields = fieldsOf(form);
      fields.forEach((el, i) => {
        if (el instanceof HTMLInputElement) el.enterKeyHint = enterKeyHintFor(fields.length, i);
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    observer.observe(form, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [step]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    const el = e.target;
    if (e.key !== "Enter" || !(el instanceof HTMLInputElement)) return; // en el área de texto, Enter es salto de línea
    e.preventDefault();
    const fields = fieldsOf(e.currentTarget);
    const next = nextFieldIndex(fields.length, fields.indexOf(el));
    if (next === null) e.currentTarget.requestSubmit();
    else fields[next]?.focus();
  };

  // iOS no encoge la página con el teclado: cuando la ventana visible se hace más baja, `--kb` (en la raíz) alarga la
  // pantalla de publicar justo lo que tapa el teclado, para que la página pueda desplazarse, y el campo enfocado se trae a la vista.
  useEffect(() => {
    const form = ref.current;
    const vv = window.visualViewport;
    if (!form || !vv) return;
    const root = document.documentElement;
    const update = () => {
      const inset = keyboardInset({ innerHeight: window.innerHeight, viewportHeight: vv.height });
      root.style.setProperty("--kb", `${inset}px`);
      const el = document.activeElement;
      if (inset > 0 && (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) && form.contains(el)) {
        const rect = el.getBoundingClientRect();
        window.scrollTo({ top: scrollTopToCenter({ scrollY: window.scrollY, elementTop: rect.top, elementHeight: rect.height, viewportHeight: vv.height, viewportOffsetTop: vv.offsetTop }), behavior: "smooth" });
      }
    };
    // Solo al cambiar de tamaño (abrir/cerrar el teclado); escuchar el scroll de la vista visible realimentaba la altura.
    vv.addEventListener("resize", update);
    return () => {
      vv.removeEventListener("resize", update);
      root.style.removeProperty("--kb");
    };
  }, [step]);

  // Al enfocar, el campo se centra en lo que queda de pantalla (Android encoge la página; en iOS lo remata el efecto de arriba).
  const onFocus = (e: React.FocusEvent<HTMLFormElement>) => {
    const el = e.target;
    if (el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement) {
      setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
    }
  };

  return (
    <form ref={ref} action={action} onSubmit={submit} onKeyDown={onKeyDown} onFocus={onFocus} className="publish-form">
      <input type="hidden" name="id" value={listingId} />
      <input type="hidden" name="step" value={step} />
      {state.error ? <div className="note" role="alert">{state.error}</div> : null}
      {children}
      <div className="sticky-actions">
        {step === 1 ? (
          <span className="btn btn-ghost" aria-disabled="true" style={{ borderColor: "var(--line)", color: "#A3ADA6" }}>Atrás</span>
        ) : (
          <Link href={`/propietario/publicar/${listingId}/${step - 1}`} className="btn btn-ghost">Atrás</Link>
        )}
        <button className="btn btn-primary grow" type="submit" disabled={pending}>
          {pending ? "Un momento…" : step < LAST_STEP ? "Continuar" : "Enviar a revisión"}
        </button>
      </div>
    </form>
  );
}
