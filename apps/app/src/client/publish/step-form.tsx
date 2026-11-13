// Módulo de formulario del asistente de publicar: una sola pieza para las ocho pantallas.
// - Una pantalla puede tener «Continuar» deshabilitado mientras le falta algo que llega solo (p. ej. el cantón del pin):
//   `useStepReady(false)`.
// - «Continuar» valida la pantalla en el navegador (planStep, con las fotos del servidor), escribe el borrador en la caché
//   al instante (escritura optimista), navega a la pantalla siguiente y guarda por detrás (cola por casa, save-queue.ts).
// - Si el guardado falla, vuelve a esa pantalla con el mensaje de la base y lo que el propietario había escrito.
// - Abierta desde «Revisar y enviar» (`?volver=revisar`), «Continuar» guarda y vuelve directo a ese resumen, y «Atrás»
//   también (decisión del 2026-11-03, ticket 03 de la ronda de Ana del 2 nov).
// - El guardado sale con `keepalive` (fetch propio de supabase-js, data/postgrest/keepalive-fetch.ts) y en el mismo tick
//   del envío: se lanza desde onSubmit (no desde la mutación, que arranca tras varias esperas) con el adaptador ya cargado
//   y el token guardado, así que recargar o cerrar la app justo después de «Continuar» no pierde el paso.
// - Teclado del iPhone: al enfocar un campo de texto la pantalla gana 320 px abajo (`--kb`) y el campo sube hasta debajo de
//   la cabecera (scroll-margin-top en CSS); al salir, vuelve. Un campo enfocado desde el código (p. ej. «Otra…») no abre el
//   teclado hasta que se toca: tocarlo ya enfocado, o que el teclado encoja la vista, lo vuelve a subir (revisión de Ana).
//   enterKeyHint «Siguiente»/«Listo» por posición del campo.
// - React 19 vacía los campos no controlados de un <form action={fn}> al terminar la acción: aquí se envía desde onSubmit
//   (sin `action`), y cada pantalla monta su propio <form> (key) para que los valores iniciales sean los de ese paso.
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { Link, useRouter } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useId, useRef, useState, useSyncExternalStore, type FormEvent, type KeyboardEvent, type ReactNode } from "react";
import { PUBLISH_NEXT } from "../../domain/contact-return";
import { track } from "../../shared/beacon";
import { DomainError } from "../../domain/errors";
import { I } from "../../shared/icons";
import { LAST_STEP, STEPS, nextStep, normalize, previousStep, stepPosition, type Listing, type ListingDraft, type Step } from "../../domain/listing";
import { useFormKeyboard } from "./form-keyboard";
import { planStep, validateAll } from "../../domain/publish-rules";
import { EMAIL_SKIPPED_KEY, shouldAskEmail } from "../../domain/publish-return";
import { formInput, parseStep } from "../../domain/step-forms";
import { accountQuery } from "../account";
import { authApi } from "../session";
import { useEditor, type EditorPort } from "../editor-port";
import { useDesktop } from "../desktop";
import { patchCached, refresh } from "../owner";
import { enqueueSave, savesSettled } from "../save-queue";
import { isLostDraft } from "./lost-drafts";
import { enterKeyHintFor, nextFieldIndex } from "./enter-next";
import { StepReadyContext } from "./step-ready";

const GENERIC = "No pudimos guardar. Intente de nuevo.";
const WhatsAppDialog = lazy(() => import("../whatsapp-dialog").then((m) => ({ default: m.WhatsAppDialog })));
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
  /** La pantalla se abrió desde «Revisar y enviar»: si el guardado falla, se vuelve a ella con el mismo `volver`. */
  volver?: Volver;
  /** El guardado ya lanzado (cola por casa) en el mismo tick de «Continuar». */
  request: Promise<Listing>;
}

/** Encola el guardado y, si la cola está libre, lanza ya la petición (sin esperar a cargar nada si el adaptador está). */
function startSave(port: EditorPort, listingId: string, step: Step, patch: Partial<ListingDraft>, known: Listing): Promise<Listing> {
  return enqueueSave(listingId, () => {
    const ready = port.loaded();
    return ready ? ready.saveStep(listingId, step, patch, known) : port.listings().then((a) => a.saveStep(listingId, step, patch, known));
  });
}

let saveSeq = 0;
/** Último guardado pedido por casa: la respuesta de uno anterior no pisa en la caché lo que vino después. */
const latestSave = new Map<string, number>();

/** `revisar`: la pantalla se abrió desde «Revisar y enviar» y «Continuar» y «Atrás» vuelven a ese resumen. */
export type Volver = "revisar";
const toStep = (router: ReturnType<typeof useRouter>, to: EditorPort["step"], id: string, step: Step, volver?: Volver) =>
  router.navigate({ to, params: { id, paso: String(step) }, search: volver ? { volver } : {} });

export function useSaveStep(userId: string, listingId: string) {
  const client = useQueryClient();
  const router = useRouter();
  const port = useEditor();
  return useMutation({
    mutationFn: ({ request }: SaveVars) => request,
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
    onError: (error, { step, patch, volver }) => {
      if (isLostDraft(listingId)) return; // la base no creó el borrador: la entrada ya enseña por qué (new-draft.ts)
      setFailure({ listingId, step, patch, message: messageOf(error) });
      void client.invalidateQueries({ queryKey: detailKey(userId, listingId) });
      void toStep(router, port.step, listingId, step, volver);
    },
  });
}

/** Lo más que se espera a la cuenta tras enviar antes de seguir a «Enviada». */
const ACCOUNT_WAIT_MS = 2500;

/** Última pantalla: espera los guardados, relee el borrador del servidor, valida todo y solo entonces envía. */
async function sendForReview(client: QueryClient, router: ReturnType<typeof useRouter>, port: EditorPort, userId: string, id: string): Promise<string | null> {
  clearFailure(id);
  await savesSettled(id);
  if (failure?.listingId === id) return null; // un guardado falló: ya volvimos a esa pantalla con su mensaje
  const fresh = await (await port.listings()).getOwn(id);
  if (!fresh) return "No encontramos ese anuncio.";
  client.setQueryData(detailKey(userId, id), fresh);
  // Solo lo obligatorio manda a otra pantalla (2026-10-30); los avisos no bloquean.
  const invalid = validateAll(fresh);
  if (invalid) {
    setFailure({ listingId: id, step: invalid.step, patch: {}, message: invalid.error });
    void toStep(router, port.step, id, invalid.step, "revisar"); // arreglado, «Continuar» vuelve al resumen
    return null;
  }
  await (await port.listings()).submit(id);
  // El admin envió el borrador de otro (ticket 10, D1): a la revisión de esa casa, donde puede aprobarla.
  if (port.admin) {
    patchCached(client, userId, id, { status: "review", reviewNote: null });
    refresh(client, userId, fresh);
    await router.navigate({ to: "/admin/anuncios/$id", params: { id }, replace: true });
    return null;
  }
  // Cuenta sin correo que aún no dijo «Ahora no»: antes de «Enviada», la pregunta del correo de recuperación. Una sola
  // lectura, sin los reintentos de la consulta de la pantalla y con un tope de espera: si falla o tarda, la casa ya está
  // enviada y se pasa a «Enviada» sin la pregunta.
  const account =
    client.getQueryData(accountQuery(userId).queryKey) ??
    (await Promise.race([(await authApi()).profile().catch(() => undefined), new Promise<undefined>((r) => setTimeout(r, ACCOUNT_WAIT_MS))])) ??
    undefined;
  const ask = shouldAskEmail(account, localStorage.getItem(EMAIL_SKIPPED_KEY));
  await router.navigate({ to: ask ? "/propietario/casas/$id/correo" : "/propietario/casas/$id/enviada", params: { id }, replace: true });
  patchCached(client, userId, id, { status: "review", reviewNote: null });
  refresh(client, userId, fresh);
  void client.invalidateQueries({ queryKey: ["own-resumable", userId] });
  return null;
}

// ---------- Teclado ----------

/** Campos que recorre «Siguiente»: entradas de texto, listas y áreas de texto, en el orden del documento. */
const FIELDS = "input:not([type=hidden]):not([type=checkbox]):not([type=radio]):not([type=file]), select, textarea";
/** Sitio extra bajo el formulario mientras hay un campo de texto enfocado: más que el teclado más alto del iPhone. */
const fieldsOf = (form: HTMLFormElement) => Array.from(form.querySelectorAll<HTMLElement>(FIELDS)).filter((el) => !el.hidden);

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

// ---------- «Continuar» listo o no ----------

const noReady = () => undefined;

// ---------- El formulario ----------

export function StepForm({
  userId,
  listing,
  step,
  lastInGroup,
  next,
  back,
  verifyBeforePhotos = false,
  enter,
  volver,
  renderHeader,
  children,
}: {
  userId: string;
  listing: Listing;
  step: Step;
  lastInGroup?: Step;
  next?: Step;
  back?: Step;
  verifyBeforePhotos?: boolean;
  enter?: "forward" | "back";
  /** Abierta desde «Revisar y enviar»: «Continuar» y «Atrás» vuelven a él. */
  volver?: Volver;
  renderHeader?: (actions?: ReactNode) => ReactNode;
  children: (values: ListingDraft) => ReactNode;
}) {
  // La dirección de entrada se fija al montar esta pantalla: los repintados posteriores no cortan la animación.
  const [entering] = useState(enter);
  const client = useQueryClient();
  const router = useRouter();
  const save = useSaveStep(userId, listing.id);
  const port = useEditor();
  const failed = useFailure(listing.id, step);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [ready, setReady] = useState(true);
  const ref = useRef<HTMLFormElement>(null);
  useEnterKeyHints(ref);
  const keyboard = useFormKeyboard(ref);
  const desktop = useDesktop() && !port.admin && !!renderHeader;
  const formId = useId();

  // Lo que se ve al montar: el borrador (optimista) y, si el guardado de esta pantalla falló, lo que se había escrito.
  const values: ListingDraft = failed ? { ...listing, ...failed.patch, photoCount: listing.photoCount } : listing;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ready || sending) return;
    if (step === LAST_STEP) {
      setSending(true);
      setError(null);
      sendForReview(client, router, port, userId, listing.id)
        .then((message) => setError(message))
        .catch((err: unknown) => setError(messageOf(err)))
        .finally(() => setSending(false));
      return;
    }
    const input = formInput(new FormData(e.currentTarget));
    const patch = lastInGroup
      ? Object.assign({}, ...STEPS.slice(stepPosition(step) - 1, stepPosition(lastInGroup)).map((part) => parseStep(part, input)))
      : parseStep(step, input);
    const plan = planStep(listing, step, patch);
    if ("error" in plan) return setError(plan.error);
    setError(null);
    clearFailure(listing.id);
    const request = startSave(port, listing.id, step, patch, listing);
    request.catch(() => undefined); // el error lo recoge la mutación
    save.mutate({ step, patch, seq: ++saveSeq, volver, request });
    if (verifyBeforePhotos) {
      setSending(true);
      void request.then(() => {
        setSending(false);
        setVerifying(true);
        track("publish_verify");
      }, () => setSending(false));
    } else {
      void toStep(router, port.step, listing.id, volver ? LAST_STEP : (next ?? nextStep(lastInGroup ?? step) ?? LAST_STEP));
    }
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

  const shown = error ?? failed?.message ?? null;
  const actions = (
      <div className={desktop ? "publish-top-actions" : "sticky-actions"}>
        {/* «Atrás» como botón cuadrado con la flecha y «Continuar ›»; en el último paso, la acción sin flecha (A9). */}
        {step === 1 && !volver ? (
          <span className="btn btn-ghost btn-back is-disabled" aria-disabled="true" aria-label="Atrás">
            <I.back size={22} />
          </span>
        ) : (
          <Link to={port.step} params={{ id: listing.id, paso: String(volver ? LAST_STEP : (back ?? previousStep(step) ?? 1)) }} className="btn btn-ghost btn-back" aria-label="Atrás">
            <I.back size={22} />
          </Link>
        )}
        <button className="btn btn-primary grow" type="submit" form={desktop ? formId : undefined} disabled={sending || !ready}>
          {step < LAST_STEP ? (
            <>
              Continuar <I.chevron size={20} />
            </>
          ) : sending ? (
            "Un momento…"
          ) : (
            "Enviar a revisión"
          )}
        </button>
      </div>
  );
  return (
    <>
    {renderHeader?.(desktop ? actions : undefined)}
    <form id={formId} ref={ref} key={`${step}-${failed?.seq ?? 0}`} onSubmit={onSubmit} onKeyDown={onKeyDown} {...keyboard} className={`publish-form${step === LAST_STEP ? " publish-review" : ""}`} data-enter={entering} noValidate>
      {shown ? <div className="note" role="alert">{shown}</div> : null}
      <StepReadyContext.Provider value={step === LAST_STEP ? setReady : noReady}>{children(values)}</StepReadyContext.Provider>
      {desktop ? null : actions}
    </form>
    {verifying ? <Suspense fallback={null}><WhatsAppDialog mode="publish" next={PUBLISH_NEXT} onClose={() => setVerifying(false)} /></Suspense> : null}
    </>
  );
}
