// Publicar sin cuenta (publicar v2, decisiones §E): /publicar responde el paso 1 en el teléfono, /publicar/verificar pide
// el WhatsApp y /publicar/continuar, ya con sesión, crea la casa con esa respuesta y sigue en «¿Dónde está su casa?».
// Trozo propio (publicar-entrada-*), medido en «Entrada de publicar»: no descarga el asistente ni sus campos.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams } from "@tanstack/react-router";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { PUBLISH_NEXT } from "../../domain/contact-return";
import { DomainError } from "../../domain/errors";
import { emptyDraft, isFreshDraft, type Listing } from "../../domain/listing";
import { validateStep } from "../../domain/listing-rules";
import { resumeStep } from "../../domain/publish-rules";
import { EMAIL_SKIPPED_KEY, PUBLISH_STEP1_KEY, readStep1, storeStep1, type Step1Kind } from "../../domain/publish-return";
import { track } from "../../shared/beacon";
import { I } from "../../shared/icons";
import { accountQuery } from "../account";
import { FlowHeader } from "../chrome";
import { addOwnCached, api, resumableQuery } from "../owner";
import { KindChoice, ReadyList, StageLabel } from "../publish/wizard-parts";
import { authApi, useSession } from "../session";
import { SignInForm } from "./cuenta";

const message = (e: unknown) => (e instanceof DomainError ? e.message : "Algo salió mal. Intente de nuevo en un momento.");
/** Un borrador vacío de hace menos de esto es el de una visita anterior que se cortó (recarga entre crear y guardar). */
const ORPHAN_MS = 10 * 60_000;
const storedStep1 = () => readStep1(localStorage.getItem(PUBLISH_STEP1_KEY), Date.now());

/** La cabecera del asistente en el paso 1, sin borrador todavía: «Cerrar» vuelve a Explorar. */
function EntryHeader() {
  return (
    <header className="header-flow">
      <Link to="/explorar" className="btn-link header-close" aria-label="Cerrar">
        <I.x size={20} />
        <span>Cerrar</span>
      </Link>
      <h1>Publicar casa</h1>
      <StageLabel step={1} />
    </header>
  );
}

// ---------- /publicar (sin sesión) ----------

/** El paso 1 sin cuenta: la respuesta se guarda en el teléfono y se pide el WhatsApp. */
export function PublicarEntradaScreen() {
  const navigate = useNavigate();
  const [initial] = useState(() => storedStep1()?.kind ?? null);
  const [error, setError] = useState<string | null>(null);
  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const value = new FormData(e.currentTarget).get("kind");
    const kind: Step1Kind | null = value === "completo" || value === "habitacion" ? value : null;
    const invalid = validateStep(1, { ...emptyDraft(), kind });
    if (invalid || !kind) return setError(invalid);
    localStorage.setItem(PUBLISH_STEP1_KEY, storeStep1(kind, Date.now()));
    void navigate({ to: "/publicar/verificar" });
  }
  return (
    <>
      <EntryHeader />
      <form onSubmit={submit} className="stack flow" noValidate>
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
        <button type="submit" className="btn btn-primary btn-lg btn-block">
          Continuar
        </button>
      </form>
    </>
  );
}

// ---------- /publicar/verificar (sin sesión) ----------

/** «Para guardar su casa, verifique su WhatsApp»: el formulario de Ingresar con la vuelta a /publicar/continuar. */
export function VerificarScreen() {
  const [stored] = useState(storedStep1);
  // Cuántos llegan a verificar tras el paso 1; una vez por visita (el modo estricto de React monta dos veces).
  const sent = useRef(false);
  useEffect(() => {
    if (!stored || sent.current) return;
    sent.current = true;
    track("publish_verify");
  }, [stored]);
  if (!stored) return <Navigate to="/publicar" replace />;
  return (
    <>
      <EntryHeader />
      <SignInForm next={PUBLISH_NEXT} mode="publish" />
    </>
  );
}

// ---------- /publicar/continuar (con sesión) ----------

/**
 * Tras el código: con la respuesta del paso 1 crea la casa, guarda el tipo y sigue en el paso 2. Si la cuenta ya tiene un
 * borrador pendiente, elige como en la entrada de siempre; si ese borrador está vacío y es de hace unos minutos (se recargó
 * entre crearlo y guardar el tipo), se usa sin preguntar. La respuesta se borra solo cuando la casa ya la tiene guardada.
 */
export function ContinuarScreen() {
  const userId = useSession().session?.userId ?? "";
  const client = useQueryClient();
  const navigate = useNavigate();
  const [stored] = useState(storedStep1);
  const resumable = useQuery({ ...resumableQuery(userId), enabled: !!userId && !!stored });
  // La casa creada en esta visita: un reintento tras fallar el guardado no crea otra.
  const created = useRef<string | null>(null);
  const create = useMutation({
    mutationFn: async (kind: Step1Kind) => {
      const owner = await api();
      created.current ??= (await owner.createDraft()).id;
      return owner.saveStep(created.current, 1, { kind });
    },
    onSuccess: async (saved: Listing) => {
      client.setQueryData(["own-listing", userId, saved.id], saved);
      addOwnCached(client, userId, saved); // la barra crece al instante, antes de releer la lista
      void client.invalidateQueries({ queryKey: ["own-listings", userId] });
      void client.invalidateQueries({ queryKey: ["own-resumable", userId] });
      localStorage.removeItem(PUBLISH_STEP1_KEY);
      await navigate({ to: "/propietario/publicar/$id/$paso", params: { id: saved.id, paso: "2" }, replace: true });
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
    create.mutate(stored.kind);
  }, [stored, fresh, draft, orphan, create]);

  if (!stored) return <Navigate to="/propietario/publicar" replace />;
  const start = () => {
    if (create.isPending) return;
    create.mutate(stored.kind);
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
            onClick={() => localStorage.removeItem(PUBLISH_STEP1_KEY)}
          >
            Seguir con el borrador
          </Link>
          {create.isError ? null : (
            <button type="button" className="btn btn-block btn-ghost" onClick={start}>
              Empezar otra
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
