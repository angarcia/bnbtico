// Módulo de formulario del asistente de publicar: una sola pieza para las nueve pantallas.
// - «Continuar» valida la pantalla en el navegador (planStep, con las fotos del servidor), escribe el borrador en la caché
//   al instante (escritura optimista), navega a la pantalla siguiente y guarda por detrás (cola por casa, save-queue.ts).
// - Si el guardado falla, vuelve a esa pantalla con el mensaje de la base y lo que el propietario había escrito.
// - El guardado sale con `keepalive` (fetch propio de supabase-js, data/postgrest/keepalive-fetch.ts).
// - Teclado del iPhone: al enfocar un campo de texto la pantalla gana 320 px abajo (`--kb`) y el campo sube hasta debajo de
//   la cabecera (scroll-margin-top en CSS); al salir, vuelve. enterKeyHint «Siguiente»/«Listo» por posición del campo.
// - React 19 vacía los campos no controlados de un <form action={fn}> al terminar la acción: aquí se envía desde onSubmit
//   (sin `action`), y cada pantalla monta su propio <form> (key) para que los valores iniciales sean los de ese paso.
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState, useSyncExternalStore, type FocusEvent, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { DomainError } from "../../domain/errors";
import { LAST_STEP, normalize, planStep, validateAll, type Listing, type ListingDraft, type Step } from "../../domain/listing";
import { formInput, parseStep } from "../../domain/step-forms";
import { api, patchCached, refresh } from "../owner";
import { enqueueSave, savesSettled } from "../save-queue";
import { enterKeyHintFor, nextFieldIndex } from "./enter-next";

const GENERIC = "No pudimos guardar. Intente de nuevo.";
const messageOf = (e: unknown) => (e instanceof DomainError ? e.message : GENERIC);
const detailKey = (userId: string, id: string) => ["own-listing", userId, id] as const;

// ---------- Fallo de guardado: la pantalla que falló, su mensaje y lo escrito ----------

export interface Failure {
  listingId: string;
  step: Step;
  patch: Partial<ListingDraft>;
  message: string;
  seq: number;
}

let failure: Failure | null = null;
let failureSeq = 0;
const failureListeners = new Set<() => void>();

function setFailure(f: Omit<Failure, "seq"> | null) {
  failure = f ? { ...f, seq: ++failureSeq } : null;
  failureListeners.forEach((l) => l());
}
const clearFailure = (listingId: string) => {
  if (failure?.listingId === listingId) setFailure(null);
};
const subscribeFailure = (l: () => void) => {
  failureListeners.add(l);
  return () => void failureListeners.delete(l);
};

function useFailure(listingId: string, step: Step): Failure | null {
  const f = useSyncExternalStore(subscribeFailure, () => failure, () => null);
  return f && f.listingId === listingId && f.step === step ? f : null;
}

// ---------- Guardar una pantalla ----------

interface SaveVars {
  step: Step;
  patch: Partial<ListingDraft>;
  seq: number;
  /** El borrador tal como lo ve el navegador al tocar «Continuar»: el guardado es una sola petición (keepalive). */
  known: Listing;
}

let saveSeq = 0;
/** Último guardado pedido por casa: la respuesta de uno anterior no pisa en la caché lo que vino después. */
const latestSave = new Map<string, number>();

const toStep = (router: ReturnType<typeof useRouter>, id: string, step: Step, replace = false) =>
  router.navigate({ to: "/propietario/publicar/$id/$paso", params: { id, paso: String(step) }, replace });

export function useSaveStep(userId: string, listingId: string) {
  const client = useQueryClient();
  const router = useRouter();
  return useMutation({
    mutationFn: ({ step, patch, known }: SaveVars) => enqueueSave(listingId, async () => (await api()).saveStep(listingId, step, patch, known)),
    onMutate: async ({ patch, seq }) => {
      latestSave.set(listingId, seq);
      await client.cancelQueries({ queryKey: detailKey(userId, listingId) });
      const previous = client.getQueryData<Listing | null>(detailKey(userId, listingId));
      if (previous) patchCached(client, userId, listingId, normalize({ ...previous, ...patch, photoCount: previous.photoCount }));
    },
    onSuccess: (saved, { seq }) => {
      if (latestSave.get(listingId) === seq) patchCached(client, userId, listingId, saved);
    },
    // Callbacks de useMutation: corren aunque la pantalla ya no esté montada (el propietario siguió adelante).
    onError: (error, { step, patch }) => {
      setFailure({ listingId, step, patch, message: messageOf(error) });
      void client.invalidateQueries({ queryKey: detailKey(userId, listingId) });
      void toStep(router, listingId, step);
    },
  });
}

/** Última pantalla: espera los guardados, relee el borrador del servidor, valida todo y solo entonces envía. */
async function sendForReview(client: QueryClient, router: ReturnType<typeof useRouter>, userId: string, id: string): Promise<string | null> {
  clearFailure(id);
  await savesSettled(id);
  if (failure?.listingId === id) return null; // un guardado falló: ya volvimos a esa pantalla con su mensaje
  const fresh = await (await api()).getOwn(id);
  if (!fresh) return "No encontramos ese anuncio.";
  client.setQueryData(detailKey(userId, id), fresh);
  const invalid = validateAll(fresh);
  if (invalid) {
    if (invalid.step === LAST_STEP) return invalid.error;
    setFailure({ listingId: id, step: invalid.step, patch: {}, message: invalid.error });
    void toStep(router, id, invalid.step);
    return null;
  }
  await (await api()).submit(id);
  await router.navigate({ to: "/propietario/casas/$id/enviada", params: { id }, replace: true });
  patchCached(client, userId, id, { status: "review", reviewNote: null });
  refresh(client, userId, fresh);
  void client.invalidateQueries({ queryKey: ["own-resumable", userId] });
  return null;
}

// ---------- Teclado ----------

/** Campos que recorre «Siguiente»: entradas de texto, listas y áreas de texto, en el orden del documento. */
const FIELDS = "input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea";
/** Sitio extra bajo el formulario mientras hay un campo de texto enfocado: más que el teclado más alto del iPhone. */
export const KEYBOARD_ROOM = "320px";
const NO_KEYBOARD = new Set(["checkbox", "radio", "file", "hidden", "submit", "button", "range", "color"]);
const fieldsOf = (form: HTMLFormElement) => Array.from(form.querySelectorAll<HTMLElement>(FIELDS)).filter((el) => !el.hidden);
const isText = (el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement =>
  el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !NO_KEYBOARD.has(el.type)); // chips y tarjetas son casillas: sin teclado
function setRoom(on: boolean): void {
  if (on) document.documentElement.style.setProperty("--kb", KEYBOARD_ROOM);
  else document.documentElement.style.removeProperty("--kb");
}

/** enterKeyHint según la posición del campo; se recalcula si aparece uno (p. ej. «Tipo de parqueo»). */
function useEnterKeyHints(ref: React.RefObject<HTMLFormElement | null>) {
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
  }, [ref]);
}

// ---------- El formulario ----------

export function StepForm({ userId, listing, step, children }: { userId: string; listing: Listing; step: Step; children: (values: ListingDraft) => ReactNode }) {
  const client = useQueryClient();
  const router = useRouter();
  const save = useSaveStep(userId, listing.id);
  const failed = useFailure(listing.id, step);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const ref = useRef<HTMLFormElement>(null);
  useEnterKeyHints(ref);
  useEffect(() => () => setRoom(false), []);

  // Lo que se ve al montar: el borrador (optimista) y, si el guardado de esta pantalla falló, lo que se había escrito.
  const values: ListingDraft = failed ? { ...listing, ...failed.patch, photoCount: listing.photoCount } : listing;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (step === LAST_STEP) {
      setSending(true);
      setError(null);
      sendForReview(client, router, userId, listing.id)
        .then((message) => setError(message))
        .catch((err: unknown) => setError(messageOf(err)))
        .finally(() => setSending(false));
      return;
    }
    const patch = parseStep(step, formInput(new FormData(e.currentTarget)));
    const plan = planStep(listing, step, patch);
    if ("error" in plan) return setError(plan.error);
    setError(null);
    clearFailure(listing.id);
    save.mutate({ step, patch, seq: ++saveSeq, known: listing });
    void toStep(router, listing.id, (step + 1) as Step);
  }

  function onKeyDown(e: KeyboardEvent<HTMLFormElement>) {
    const el = e.target;
    if (e.key !== "Enter" || !(el instanceof HTMLInputElement)) return; // en la descripción, Enter es salto de línea
    e.preventDefault();
    const fields = fieldsOf(e.currentTarget);
    const next = nextFieldIndex(fields.length, fields.indexOf(el));
    if (next === null) e.currentTarget.requestSubmit();
    else fields[next]?.focus();
  }

  function onFocus(e: FocusEvent<HTMLFormElement>) {
    const el = e.target;
    if (!isText(el)) return;
    setRoom(true);
    const lift = () => el.scrollIntoView({ block: "start", behavior: "smooth" });
    requestAnimationFrame(lift);
    setTimeout(lift, 350); // tras la animación del teclado, por si el navegador movió la vista por su cuenta
  }

  function onBlur(e: FocusEvent<HTMLFormElement>) {
    if (isText(e.relatedTarget) && e.currentTarget.contains(e.relatedTarget)) return; // de un campo a otro
    setRoom(false);
  }

  const shown = error ?? failed?.message ?? null;
  return (
    <form ref={ref} key={`${step}-${failed?.seq ?? 0}`} onSubmit={onSubmit} onKeyDown={onKeyDown} onFocus={onFocus} onBlur={onBlur} className="publish-form" noValidate>
      {shown ? (
        <div className="note" role="alert">
          {shown}
        </div>
      ) : null}
      {children(values)}
      <div className="sticky-actions">
        {step === 1 ? (
          <span className="btn btn-ghost is-disabled" aria-disabled="true">
            Atrás
          </span>
        ) : (
          <Link to="/propietario/publicar/$id/$paso" params={{ id: listing.id, paso: String(step - 1) }} className="btn btn-ghost">
            Atrás
          </Link>
        )}
        <button className="btn btn-primary grow" type="submit" disabled={sending}>
          {step < LAST_STEP ? "Continuar" : sending ? "Un momento…" : "Enviar a revisión"}
        </button>
      </div>
    </form>
  );
}
