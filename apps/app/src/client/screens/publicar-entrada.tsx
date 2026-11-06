// Publicar sin cuenta (publicar v2, decisiones §E; desde el 2026-11-04, hasta las fotos): /publicar responde el paso 1 en el
// teléfono, los pasos 2–6 siguen ahí (/publicar/nueva/$paso, el asistente con el puerto del teléfono), /publicar/verificar
// pide el WhatsApp al llegar a las Fotos y /publicar/continuar, ya con sesión, crea la casa con todo y sigue en las Fotos.
// Trozo propio (publicar-entrada-*), medido en «Entrada de publicar»: no descarga el asistente ni sus campos.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PUBLISH_NEXT } from "../../domain/contact-return";
import { DomainError } from "../../domain/errors";
import { emptyDraft, isFreshDraft, normalize, type Listing, type ListingDraft } from "../../domain/listing";
import { validateStep } from "../../domain/listing-rules";
import { resumeStep } from "../../domain/publish-rules";
import { EMAIL_SKIPPED_KEY, type Step1Kind } from "../../domain/publish-return";
import { track } from "../../shared/beacon";
import { I } from "../../shared/icons";
import { accountQuery } from "../account";
import { FlowHeader } from "../chrome";
import { addOwnCached, api, resumableQuery } from "../owner";
import { clearPhoneDraft, readFullPhoneDraft, readPhoneDraft, writePhoneDraft } from "../publish/phone-draft";
import { KindChoice, ReadyList, WizardHeader } from "../publish/wizard-parts";
import { authApi, useSession } from "../session";
import { SignInForm } from "../sign-in";

const message = (e: unknown) => (e instanceof DomainError ? e.message : "Algo salió mal. Intente de nuevo en un momento.");
/** Un borrador vacío de hace menos de esto es el de una visita anterior que se cortó (recarga entre crear y guardar). */
const ORPHAN_MS = 10 * 60_000;
/** Lo escrito sin cuenta (los pasos 1–6, o solo el tipo de una visita del flujo anterior). */
const storedDraft = () => readPhoneDraft();
/** Las Fotos: el primer paso que pide cuenta. */
const PHOTOS_STEP = 7;
const clearStored = clearPhoneDraft;

/** La cabecera del asistente sin borrador todavía (el paso 1, o las Fotos al pedir el código): «Cerrar» vuelve a Explorar. */
function EntryHeader({ step = 1 }: { step?: 1 | 7 }) {
  return (
    <WizardHeader step={step} close={
      <Link to="/explorar" className="btn-link header-close" aria-label="Cerrar" title="Cerrar">
        <I.x size={20} />
      </Link>
    } />
  );
}

// ---------- /publicar (sin sesión) ----------

/** El paso 1 sin cuenta: la respuesta se guarda en el teléfono (con lo que ya hubiera de una visita anterior) y se sigue en
 *  «¿Dónde está su casa?», también en el teléfono. */
export function PublicarEntradaScreen() {
  const navigate = useNavigate();
  const [initial] = useState(() => storedDraft()?.kind ?? null);
  const [error, setError] = useState<string | null>(null);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = new FormData(e.currentTarget).get("kind");
    const kind: Step1Kind | null = value === "completo" || value === "habitacion" ? value : null;
    const invalid = validateStep(1, { ...emptyDraft(), kind });
    if (invalid || !kind) return setError(invalid);
    writePhoneDraft(normalize({ ...(storedDraft() ?? emptyDraft()), kind }));
    void navigate({ to: "/publicar/$id/$paso", params: { id: "nueva", paso: "2" } });
  }
  return (
    <>
      <EntryHeader />
      <form onSubmit={submit} className="publish-form" noValidate>
        <section className="stack gap-4" aria-label="Qué tener a mano">
          <span className="small strong">Tenga a mano:</span>
          <ReadyList />
        </section>
        <KindChoice kind={initial} />
        {error ? (
          <p className="note" role="alert">
            {error}
          </p>
        ) : null}
        <div className="sticky-actions">
          <span className="btn btn-ghost btn-back is-disabled" aria-disabled="true" aria-label="Atrás">
            <I.back size={22} />
          </span>
          <button type="submit" className="btn btn-primary grow">
            Continuar <I.chevron size={20} />
          </button>
        </div>
      </form>
    </>
  );
}

// ---------- /publicar/verificar (sin sesión) ----------

/** «Para subir las fotos, verifique su WhatsApp»: el formulario de Ingresar con la vuelta a /publicar/continuar. */
export function VerificarScreen() {
  const [stored] = useState(storedDraft);
  // Cuántos llegan a verificar tras el paso 6; una vez por visita (el modo estricto de React monta dos veces).
  const sent = useRef(false);
  useEffect(() => {
    if (!stored || sent.current) return;
    sent.current = true;
    track("publish_verify");
  }, [stored]);
  if (!stored) return <Navigate to="/publicar" replace />;
  return (
    <>
      <EntryHeader step={7} />
      <SignInForm next={PUBLISH_NEXT} mode="publish" />
    </>
  );
}

// ---------- /publicar/continuar (con sesión) ----------

/**
 * Tras el código: con lo escrito en el teléfono (pasos 1–6) crea la casa, lo guarda de una vez y sigue en el primer paso que
 * falte (las Fotos, si se llegó hasta ahí). Si la cuenta ya tiene un borrador pendiente, elige como en la entrada de siempre;
 * si ese borrador está vacío y es de hace unos minutos (se recargó entre crearlo y guardar), se usa sin preguntar. Lo del
 * teléfono se borra solo cuando la casa ya lo tiene guardado.
 */
export function ContinuarScreen() {
  const userId = useSession().session?.userId ?? "";
  const client = useQueryClient();
  const navigate = useNavigate();
  const [stored] = useState(storedDraft);
  // Con los pasos 1–6 se llegó a las Fotos y se sigue ahí («Continuar» nunca espera: lo que falte lo dice «Revisar y
  // enviar»); con solo el tipo (una visita del flujo anterior), en «¿Dónde está su casa?».
  const [next] = useState(() => (readFullPhoneDraft() ? PHOTOS_STEP : 2));
  const resumable = useQuery({ ...resumableQuery(userId), enabled: !!userId && !!stored });
  // La casa creada en esta visita: un reintento tras fallar el guardado no crea otra.
  const created = useRef<string | null>(null);
  const create = useMutation({
    mutationFn: async (draft: ListingDraft) => {
      const owner = await api();
      created.current ??= (await owner.createDraft()).id;
      // Todos los datos en una sola escritura (`planStep` no limita los campos al paso); las fotos no van.
      const { photoCount: _none, ...patch } = draft;
      return owner.saveStep(created.current, 1, patch);
    },
    onSuccess: async (saved: Listing) => {
      client.setQueryData(["own-listing", userId, saved.id], saved);
      addOwnCached(client, userId, saved); // la barra crece al instante, antes de releer la lista
      void client.invalidateQueries({ queryKey: ["own-listings", userId] });
      void client.invalidateQueries({ queryKey: ["own-resumable", userId] });
      clearStored();
      await navigate({ to: "/propietario/publicar/$id/$paso", params: { id: saved.id, paso: String(next) }, replace: true });
    },
  });
  const draft = resumable.data;
  const age = draft ? Date.now() - Date.parse(draft.createdAt) : -1;
  // Una fecha del futuro (reloj del teléfono desfasado) no cuenta como recién creada.
  const orphan = draft && isFreshDraft(draft) && age >= 0 && age < ORPHAN_MS ? draft : null;
  // Un solo intento por visita (el modo estricto de React monta dos veces), y solo con una lectura de esta visita: un
  // «sin borrador» de la caché del teléfono podría estar desfasado.
  const autoStarted = useRef(false);
  const fresh = resumable.isFetchedAfterMount && !resumable.isFetching;
  useEffect(() => {
    if (!stored || !fresh || (draft !== null && !orphan) || autoStarted.current) return;
    autoStarted.current = true;
    if (orphan) created.current = orphan.id;
    create.mutate(stored);
  }, [stored, fresh, draft, orphan, create]);

  if (!stored) return <Navigate to="/propietario/publicar" replace />;
  const start = () => {
    if (create.isPending) return;
    create.mutate(stored);
  };
  const choosing = !!draft && !orphan && !create.isPending && !create.isSuccess;
  const readFailed = resumable.isError && draft === undefined;

  return (
    <>
      <FlowHeader title="Publicar casa" back="/propietario/casas" />
      {readFailed ? (
        <div className="stack gap-12">
          <p className="note" role="alert">
            {message(resumable.error)}
          </p>
          <button type="button" className="btn btn-primary btn-lg btn-block" disabled={resumable.isFetching} onClick={() => void resumable.refetch()}>
            Intentar de nuevo
          </button>
        </div>
      ) : null}
      {choosing && draft ? (
        <section className="card stack gap-12">
          <h3>Tiene un borrador sin enviar</h3>
          <p className="small muted">
            {draft.title ? `«${draft.title}»` : "Sin nombre todavía"} · empezado el {new Date(draft.createdAt).toLocaleDateString("es-CR", { day: "numeric", month: "long" })}.
          </p>
          <Link
            to="/propietario/publicar/$id/$paso"
            params={{ id: draft.id, paso: String(resumeStep(draft)) }}
            className="btn btn-primary btn-lg btn-block"
            onClick={clearStored}
          >
            Seguir con el borrador
          </Link>
          {create.isError ? null : (
            <button type="button" className="btn btn-block btn-ghost" onClick={start}>
              {stored.title.trim() ? `Seguir con «${stored.title.trim()}»` : "Empezar otra"}
            </button>
          )}
        </section>
      ) : !create.isError && !readFailed ? (
        <section className="card skeleton owner-skeleton" aria-busy="true" aria-label="Preparando su casa">
          <span className="sk thumb" />
          <span className="sk sk-line" />
        </section>
      ) : null}
      {create.isError ? (
        <div className="stack gap-12">
          <p className="note" role="alert">
            {message(create.error)}
          </p>
          <button type="button" className="btn btn-primary btn-lg btn-block" onClick={start}>
            Intentar de nuevo
          </button>
        </div>
      ) : null}
    </>
  );
}

// ---------- /propietario/casas/$id/correo (tras enviar la casa) ----------

/** «¿Quiere añadir un correo?»: una vez, tras enviar; «Ahora no» se recuerda en el teléfono. */
export function CorreoScreen() {
  const { id = "" } = useParams({ strict: false });
  const client = useQueryClient();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const done = () => navigate({ to: "/propietario/casas/$id/enviada", params: { id }, replace: true });
  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (busy) return;
    const email = String(new FormData(e.currentTarget).get("email") ?? "").trim();
    if (!email) return setError("Escriba su correo o toque «Ahora no».");
    setBusy(true);
    setError(null);
    try {
      const updated = await (await authApi()).updateProfile({ email }); // la misma validación que Mi perfil
      client.setQueryData(accountQuery(updated.id).queryKey, updated);
      await done();
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  }
  function skip() {
    localStorage.setItem(EMAIL_SKIPPED_KEY, "1");
    void done();
  }
  return (
    <>
      <header className="header-flow">
        <h1>Publicar casa</h1>
      </header>
      <form onSubmit={(e) => void save(e)} className="stack flow" noValidate>
        <h2>¿Quiere añadir un correo?</h2>
        <div className="field">
          <label htmlFor="pub-email">Correo</label>
          <input
            id="pub-email"
            name="email"
            type="email"
            autoComplete="email"
            inputMode="email"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "pub-email-error pub-email-help" : "pub-email-help"}
          />
          <span id="pub-email-help" className="small muted">
            Para recuperar su cuenta si pierde el acceso a su WhatsApp. Opcional.
          </span>
        </div>
        {error ? (
          <p id="pub-email-error" className="note" role="alert">
            {error}
          </p>
        ) : null}
        <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
          Guardar correo
        </button>
        <button type="button" className="btn btn-block btn-ghost" onClick={skip}>
          Ahora no
        </button>
      </form>
    </>
  );
}
