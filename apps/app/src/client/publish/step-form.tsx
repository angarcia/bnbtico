// Módulo de formulario del asistente de publicar: una sola pieza para las ocho pantallas.
// - Una pantalla puede tener «Continuar» deshabilitado mientras le falta algo que llega solo (p. ej. el cantón del pin):
//   `useStepReady(false)`.
// - «Continuar» valida la pantalla en el navegador (planStep, con las fotos del servidor), escribe el borrador en la caché
//   al instante (escritura optimista), navega a la pantalla siguiente y guarda por detrás (cola por casa, save-queue.ts).
// - Si el guardado falla, vuelve a esa pantalla con el mensaje de la base y lo que el propietario había escrito.
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
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type FocusEvent, type FormEvent, type KeyboardEvent, type MouseEvent, type PointerEvent, type ReactNode } from "react";
import { DomainError } from "../../domain/errors";
import { LAST_STEP, nextStep, normalize, planStep, previousStep, validateAll, type Listing, type ListingDraft, type Step } from "../../domain/listing";
import { formInput, parseStep } from "../../domain/step-forms";
import { api, loadedApi, patchCached, refresh } from "../owner";
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
  /** El guardado ya lanzado (cola por casa) en el mismo tick de «Continuar». */
  request: Promise<Listing>;
}

/** Encola el guardado y, si la cola está libre, lanza ya la petición (sin esperar a cargar nada si el adaptador está). */
function startSave(listingId: string, step: Step, patch: Partial<ListingDraft>, known: Listing): Promise<Listing> {
  return enqueueSave(listingId, () => {
    const ready = loadedApi();
    return ready ? ready.saveStep(listingId, step, patch, known) : api().then((a) => a.saveStep(listingId, step, patch, known));
  });
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
/** Lo que tiene que encoger la vista para contar como teclado (un pellizco de zoom la encoge poco a poco). */
const KEYBOARD_MIN_PX = 100;
const NO_KEYBOARD = new Set(["checkbox", "radio", "file", "hidden", "submit", "button", "range", "color"]);
const fieldsOf = (form: HTMLFormElement) => Array.from(form.querySelectorAll<HTMLElement>(FIELDS)).filter((el) => !el.hidden);
const isText = (el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement =>
  el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !NO_KEYBOARD.has(el.type)); // chips y tarjetas son casillas: sin teclado
function setRoom(on: boolean): void {
  if (on) document.documentElement.style.setProperty("--kb", KEYBOARD_ROOM);
  else document.documentElement.style.removeProperty("--kb");
}
/** Sube el campo hasta debajo de la cabecera, ya y tras la animación del teclado (por si el navegador movió la vista). */
function lift(el: HTMLElement): void {
  const go = () => el.scrollIntoView({ block: "start", behavior: "smooth" });
  requestAnimationFrame(go);
  setTimeout(go, 350);
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

// ---------- «Continuar» listo o no ----------

const ReadyContext = createContext<(ready: boolean) => void>(() => undefined);

/** «Continuar» deshabilitado mientras `ready` sea false (dentro de un StepForm). Antes de pintar: si no, se vería un
 *  fotograma con «Continuar» habilitado al abrir la pantalla. */
export function useStepReady(ready: boolean): void {
  const set = useContext(ReadyContext);
  useLayoutEffect(() => {
    set(ready);
    return () => set(true);
  }, [set, ready]);
}

// ---------- El formulario ----------

export function StepForm({ userId, listing, step, enter, children }: { userId: string; listing: Listing; step: Step; enter?: "forward" | "back"; children: (values: ListingDraft) => ReactNode }) {
  // La dirección de entrada se fija al montar esta pantalla: los repintados posteriores no cortan la animación.
  const [entering] = useState(enter);
  const client = useQueryClient();
  const router = useRouter();
  const save = useSaveStep(userId, listing.id);
  const failed = useFailure(listing.id, step);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [ready, setReady] = useState(true);
  const ref = useRef<HTMLFormElement>(null);
  useEnterKeyHints(ref);
  useEffect(() => () => setRoom(false), []);
  // El teclado que sale tarde (campo enfocado desde el código y tocado después) encoge la vista: el campo vuelve a subir.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let height = vv.height;
    const onResize = () => {
      const shrank = height - vv.height >= KEYBOARD_MIN_PX;
      height = vv.height;
      const el = document.activeElement;
      if (shrank && isText(el) && ref.current?.contains(el)) lift(el);
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  // Lo que se ve al montar: el borrador (optimista) y, si el guardado de esta pantalla falló, lo que se había escrito.
  const values: ListingDraft = failed ? { ...listing, ...failed.patch, photoCount: listing.photoCount } : listing;

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!ready) return; // p. ej. Enter en un campo mientras «Continuar» espera
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
    const request = startSave(listing.id, step, patch, listing);
    request.catch(() => undefined); // el error lo recoge la mutación
    save.mutate({ step, patch, seq: ++saveSeq, request });
    void toStep(router, listing.id, nextStep(step) ?? LAST_STEP);
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
    lift(el);
  }

  // Tocar un campo que ya tenía el foco (en el iPhone, es cuando sale el teclado si se enfocó desde el código).
  const focusedBefore = useRef<Element | null>(null);
  function onPointerDown(e: PointerEvent<HTMLFormElement>) {
    focusedBefore.current = e.target === document.activeElement ? document.activeElement : null;
  }
  function onClick(e: MouseEvent<HTMLFormElement>) {
    const el = e.target;
    if (!isText(el) || focusedBefore.current !== el) return;
    setRoom(true);
    lift(el);
  }

  function onBlur(e: FocusEvent<HTMLFormElement>) {
    if (isText(e.relatedTarget) && e.currentTarget.contains(e.relatedTarget)) return; // de un campo a otro
    const left = e.target;
    // Después del toque: quitar el sitio ya movería la página entre el mousedown y el clic, y el toque sobre un chip
    // (p. ej. «¿Acepta alquiler por meses?» con el teclado abierto) se perdería. Si entretanto se enfocó otro campo de
    // texto (también el de la pantalla siguiente), el sitio se queda.
    setTimeout(() => {
      if (isText(document.activeElement)) return;
      setRoom(false);
      // Al cerrar el teclado la página encoge: el campo que se deja no se queda bajo la barra (scroll-margin-bottom en CSS).
      if (isText(left) && left.isConnected) requestAnimationFrame(() => left.scrollIntoView({ block: "nearest" }));
    }, 0);
  }

  const shown = error ?? failed?.message ?? null;
  return (
    <form ref={ref} key={`${step}-${failed?.seq ?? 0}`} onSubmit={onSubmit} onKeyDown={onKeyDown} onFocus={onFocus} onBlur={onBlur} onPointerDown={onPointerDown} onClick={onClick} className="publish-form" data-enter={entering} noValidate>
      {shown ? (
        <div className="note" role="alert">
          {shown}
        </div>
      ) : null}
      <ReadyContext.Provider value={setReady}>{children(values)}</ReadyContext.Provider>
      <div className="sticky-actions">
        {step === 1 ? (
          <span className="btn btn-ghost is-disabled" aria-disabled="true">
            Atrás
          </span>
        ) : (
          <Link to="/propietario/publicar/$id/$paso" params={{ id: listing.id, paso: String(previousStep(step) ?? 1) }} className="btn btn-ghost">
            Atrás
          </Link>
        )}
        <button className="btn btn-primary grow" type="submit" disabled={sending || !ready}>
          {step < LAST_STEP ? "Continuar" : sending ? "Un momento…" : "Enviar a revisión"}
        </button>
      </div>
    </form>
  );
}
