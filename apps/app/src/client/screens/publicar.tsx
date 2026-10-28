// Asistente de publicar (decisión 2026-10-21): entrada (empezar o retomar el borrador pendiente) y nueve pantallas
// cortas sin scroll. Se carga bajo demanda al abrir /propietario/publicar: no entra en el JS inicial.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { DomainError } from "../../domain/errors";
import { track } from "../../shared/beacon";
import { LAST_STEP, STEPS, resumeStep, wizardStage, type Listing, type Step } from "../../domain/listing";
import { FlowHeader } from "../chrome";
import { I } from "../../shared/icons";
import { savesSettled } from "../save-queue";
import { stepEnter } from "../motion";
import { addOwnCached, api, ownListingQuery, resumableQuery } from "../owner";
import { StepFields } from "../publish/fields";
import { StepForm } from "../publish/step-form";
import { NotFoundCard, SkeletonCard, useOwnListing, useUserId } from "./propietario";

const message = (e: unknown) => (e instanceof DomainError ? e.message : "Algo salió mal. Intente de nuevo en un momento.");

// ---------- Entrada ----------

/** Abrir esta pantalla no crea nada: el borrador nace al tocar «Empezar». Si hay uno pendiente, se ofrece seguirlo. */
export function PublicarScreen() {
  const userId = useUserId();
  const client = useQueryClient();
  const navigate = useNavigate();
  const resumable = useQuery({ ...resumableQuery(userId), enabled: !!userId });
  const create = useMutation({
    mutationFn: async () => (await api()).createDraft(),
    onSuccess: async ({ id }) => {
      await client.prefetchQuery(ownListingQuery(userId, id, client));
      const created = client.getQueryData<Listing | null>(["own-listing", userId, id]);
      if (created) addOwnCached(client, userId, created); // la barra crece al instante, antes de releer la lista
      void client.invalidateQueries({ queryKey: ["own-listings", userId] });
      void client.invalidateQueries({ queryKey: ["own-resumable", userId] });
      await navigate({ to: "/propietario/publicar/$id/$paso", params: { id, paso: "1" } });
    },
  });
  const draft = resumable.data;
  // Sin borrador pendiente no hay nada que elegir: se crea y se entra directo al paso 1 (revisión UX C4). Un solo intento
  // por visita (el modo estricto de React monta dos veces); si falla, el botón «Empezar» queda para reintentar.
  const autoStarted = useRef(false);
  // Solo con una lectura de esta visita: un «sin borrador» de la caché del teléfono podría estar desfasado y crear otro.
  const fresh = resumable.isFetchedAfterMount && !resumable.isFetching;
  useEffect(() => {
    if (!fresh || draft !== null || autoStarted.current) return;
    autoStarted.current = true;
    create.mutate();
  }, [fresh, draft, create]);
  const start = (
    <button type="button" className={`btn btn-block ${draft ? "btn-ghost" : "btn-primary btn-lg"}`} disabled={create.isPending} onClick={() => create.mutate()}>
      {create.isPending ? "Un momento…" : draft ? "Empezar otro" : "Empezar"}
    </button>
  );

  return (
    <>
      <FlowHeader title="Publicar casa" back="/propietario/casas" />
      {resumable.isError && draft === undefined ? (
        <p className="note" role="alert">
          {message(resumable.error)}
        </p>
      ) : null}
      {draft === undefined && !resumable.isError ? <SkeletonCard /> : null}
      {draft ? (
        <section className="card stack gap-12">
          <h3>Tiene un borrador sin enviar</h3>
          <p className="small muted">
            {draft.title ? `«${draft.title}»` : "Sin nombre todavía"} · empezado el {new Date(draft.createdAt).toLocaleDateString("es-CR", { day: "numeric", month: "long" })}.
          </p>
          <Link to="/propietario/publicar/$id/$paso" params={{ id: draft.id, paso: String(resumeStep(draft)) }} className="btn btn-primary btn-lg btn-block">
            Seguir con el borrador
          </Link>
          {start}
        </section>
      ) : null}
      {draft === null ? (
        <section className="card stack gap-12">
          <h3>Publique su casa en pocos pasos</h3>
          {/* Lo que pide el asistente, mientras se crea el borrador (revisión UX C4): las fotos son lo que más frena. */}
          <ul className="ready-list small">
            <li>5 fotos horizontales o más</li>
            <li>El precio por noche o por mes</li>
            <li>Unos 10 minutos</li>
          </ul>
          <p className="small muted">La revisamos a mano y queda visible con su enlace para compartir por WhatsApp.</p>
          {create.isError ? start : null}
        </section>
      ) : null}
      {create.isError ? (
        <p className="note" role="alert">
          {message(create.error)}
        </p>
      ) : null}
    </>
  );
}

// ---------- Una pantalla del asistente ----------

/** «Cerrar» (B11f): espera a que salgan los guardados de esta casa y vuelve a Mis casas; el borrador se retoma después. */
function CloseWizard({ id }: { id: string }) {
  const navigate = useNavigate();
  const [saving, setSaving] = useState(false);
  async function close() {
    setSaving(true);
    await savesSettled(id);
    await navigate({ to: "/propietario/casas" });
  }
  return (
    <button type="button" className="btn-link header-close" onClick={close} disabled={saving} aria-label={saving ? "Guardando el borrador…" : "Cerrar y seguir después"}>
      <I.x size={20} />
      <span>{saving ? "Guardando…" : "Cerrar"}</span>
    </button>
  );
}

function StageLabel({ step }: { step: Step }) {
  const stage = wizardStage(step);
  return (
    <span className="right stage-label" aria-label={`${stage.name}, ${stage.position} de ${stage.size}. Paso ${step} de ${LAST_STEP}.`}>
      <b>{stage.name}</b>
      <span>
        {stage.position} de {stage.size}
      </span>
    </span>
  );
}

function StepHeader({ id, step }: { id: string; step: Step | null }) {
  return (
    <header className="header-flow">
      <CloseWizard id={id} />
      <h1>Publicar casa</h1>
      {/* La etapa en vez de «Paso n de 9» (revisión UX C4): tres tramos que se leen más cortos que nueve pasos. */}
      {step ? <StageLabel step={step} /> : null}
    </header>
  );
}

const stepRoute = getRouteApi("/_flow/_privateFlow/propietario/publicar/$id/$paso");
const toStep = (paso: string): Step | null => (STEPS as readonly number[]).includes(Number(paso)) && /^\d$/.test(paso) ? (Number(paso) as Step) : null;

export function PasoScreen() {
  const { id, paso } = stepRoute.useParams();
  const step = toStep(paso);
  const { userId, query } = useOwnListing(id);
  const client = useQueryClient();
  const l = query.data;
  // Dirección del cambio de pantalla: la nueva entra desde la derecha al avanzar y desde la izquierda al volver.
  const previous = useRef<Step | null>(null);
  const enter = stepEnter(previous.current, step);
  useEffect(() => {
    previous.current = step;
  }, [step]);

  // Qué pantalla se abre (revisión UX C4): para ver dónde se abandona. La ruta lleva el paso y el id sale como :id.
  const publicId = l?.publicId;
  useEffect(() => {
    if (step && publicId) track("wizard_step", publicId);
  }, [step, publicId]);

  // Fotos: siempre las del servidor al llegar a esa pantalla (la lectura espera a los guardados en curso).
  useEffect(() => {
    if (step === 7) void client.invalidateQueries({ queryKey: ["own-listing", userId, id] });
  }, [step, client, userId, id]);

  const header = <StepHeader id={id} step={step} />;
  if (!step || l === null) {
    return (
      <>
        {header}
        <NotFoundCard />
      </>
    );
  }
  if (l === undefined) {
    return (
      <>
        {header}
        {query.isError ? (
          <p className="note" role="alert">
            {message(query.error)}
          </p>
        ) : (
          <SkeletonCard />
        )}
      </>
    );
  }
  // Solo un borrador o una casa con cambios pedidos se editan; lo demás se ve en su detalle.
  if (l.status !== "draft" && l.status !== "changes") return <Navigate to="/propietario/casas/$id" params={{ id }} replace />;

  return (
    <>
      {header}
      <div className="progress" aria-hidden="true">
        {/* Los 9 tramos agrupados por etapa: un hueco mayor donde empieza la siguiente. */}
        {STEPS.map((s) => (
          <span key={s} className={`${s <= step ? "on" : ""}${s > 1 && wizardStage(s).first === s ? " stage-start" : ""}`.trim() || undefined} />
        ))}
      </div>
      <StepForm key={step} userId={userId} listing={l} step={step} enter={enter}>
        {(values) => <StepFields step={step} draft={values} listing={l} userId={userId} />}
      </StepForm>
    </>
  );
}
