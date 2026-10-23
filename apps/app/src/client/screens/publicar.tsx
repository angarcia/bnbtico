// Asistente de publicar (decisión 2026-10-21): entrada (empezar o retomar el borrador pendiente) y nueve pantallas
// cortas sin scroll. Se carga bajo demanda al abrir /propietario/publicar: no entra en el JS inicial.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef } from "react";
import { DomainError } from "../../domain/errors";
import { LAST_STEP, STEPS, type Step } from "../../domain/listing";
import { FlowHeader } from "../chrome";
import { api, ownListingQuery, resumableQuery } from "../owner";
import { StepFields } from "../publish/fields";
import { StepForm } from "../publish/step-form";
import { NotFoundCard, SkeletonCard, useOwnListing, useOwnerMode, useUserId } from "./propietario";

const message = (e: unknown) => (e instanceof DomainError ? e.message : "Algo salió mal. Intente de nuevo en un momento.");

// ---------- Entrada ----------

/** Abrir esta pantalla no crea nada: el borrador nace al tocar «Empezar». Si hay uno pendiente, se ofrece seguirlo. */
export function PublicarScreen() {
  useOwnerMode();
  const userId = useUserId();
  const client = useQueryClient();
  const navigate = useNavigate();
  const resumable = useQuery({ ...resumableQuery(userId), enabled: !!userId });
  const create = useMutation({
    mutationFn: async () => (await api()).createDraft(),
    onSuccess: async ({ id }) => {
      await client.prefetchQuery(ownListingQuery(userId, id, client));
      void client.invalidateQueries({ queryKey: ["own-listings", userId] });
      void client.invalidateQueries({ queryKey: ["own-resumable", userId] });
      await navigate({ to: "/propietario/publicar/$id/$paso", params: { id, paso: "1" } });
    },
  });
  const draft = resumable.data;
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
          <Link to="/propietario/publicar/$id/$paso" params={{ id: draft.id, paso: "1" }} className="btn btn-primary btn-lg btn-block">
            Seguir con el borrador
          </Link>
          {start}
        </section>
      ) : null}
      {draft === null ? (
        <section className="card stack gap-12">
          <h3>Publique su casa en pantallas cortas</h3>
          <p className="small muted">Una pregunta por pantalla: alojamiento, ubicación, capacidad, características, nombre, fotos y precio. Guardamos el borrador en cada paso; puede seguir después, también desde otro teléfono.</p>
          {start}
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

const stepRoute = getRouteApi("/_flow/_privateFlow/propietario/publicar/$id/$paso");
const toStep = (paso: string): Step | null => (STEPS as readonly number[]).includes(Number(paso)) && /^\d$/.test(paso) ? (Number(paso) as Step) : null;

export function PasoScreen() {
  useOwnerMode();
  const { id, paso } = stepRoute.useParams();
  const step = toStep(paso);
  const { userId, query } = useOwnListing(id);
  const client = useQueryClient();
  const l = query.data;
  // Dirección del cambio de pantalla: la nueva entra desde la derecha al avanzar y desde la izquierda al volver.
  const previous = useRef<Step | null>(null);
  const enter = !step || previous.current === null || previous.current === step ? undefined : step > previous.current ? "forward" : "back";
  useEffect(() => {
    previous.current = step;
  }, [step]);

  // Fotos: siempre las del servidor al llegar a esa pantalla (la lectura espera a los guardados en curso).
  useEffect(() => {
    if (step === 7) void client.invalidateQueries({ queryKey: ["own-listing", userId, id] });
  }, [step, client, userId, id]);

  const header = <FlowHeader title="Publicar casa" back="/propietario/casas" action={step ? <span className="right">Paso {step} de {LAST_STEP}</span> : undefined} />;
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
        {STEPS.map((s) => (
          <span key={s} className={s <= step ? "on" : ""} />
        ))}
      </div>
      <StepForm key={step} userId={userId} listing={l} step={step} enter={enter}>
        {(values) => <StepFields step={step} draft={values} listing={l} userId={userId} />}
      </StepForm>
    </>
  );
}
