// Asistente de publicar (decisión 2026-10-21): entrada (empezar o retomar el borrador pendiente) y ocho pantallas
// cortas sin scroll (ids de URL 1, 2 y 4–9; el 3 viejo lleva al 2). Se carga bajo demanda al abrir /propietario/publicar:
// no entra en el JS inicial.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, useNavigate, useParams, useRouter, useSearch } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { DomainError } from "../../domain/errors";
import { track } from "../../shared/beacon";
import { LAST_STEP, stepFromParam, type Step } from "../../domain/listing";
import { isPublished } from "../../domain/can";
import { EditorContext, useEditor } from "../editor-port";
import { localPort } from "../publish/local-port";
import type { Volver } from "../publish/step-form";
import { requiredProblems, resumeStep } from "../../domain/publish-rules";
import { FlowHeader } from "../chrome";
import { I } from "../../shared/icons";
import { savesSettled } from "../save-queue";
import { stepEnter } from "../motion";
import { ownListingKey } from "../listing-keys";
import { addOwnCached, api, resumableQuery } from "../owner";
import { StepFields } from "../publish/fields";
import { ReadyList, WizardHeader } from "../publish/wizard-parts";
import { StepForm } from "../publish/step-form";
import { useOwnListing, useUserId } from "../editor-query";
import { NotFoundCard, SkeletonCard } from "../editor-status";
import { knownNoDraft } from "../own-listings-query";
import { clearCreateFailure, createFailure, startDraft } from "../publish/new-draft";

const message = (e: unknown) => (e instanceof DomainError ? e.message : "Algo salió mal. Intente de nuevo en un momento.");

// ---------- Entrada ----------

/** Sin borrador pendiente, abrir esta pantalla crea uno y entra al paso 1. Si Mis casas ya lo sabía, al instante y el
 *  borrador se crea por detrás (2026-11-06); si no, viendo lo mismo que el paso 1 mientras la base responde (su cabecera y
 *  el esqueleto). Solo si falla, qué tener a mano y «Empezar». Si hay uno pendiente, no crea nada: ofrece seguirlo o
 *  empezar otro (ronda de Ana 2026-11-02: sin tarjetas de paso al tocar «+»). */
const RESUMABLE_FRESH_MS = 3000;

export function PublicarScreen() {
  const userId = useUserId();
  const client = useQueryClient();
  const navigate = useNavigate();
  const router = useRouter();
  // El borrador que el teléfono empezó sin esperar a la base y que la base no creó: aquí, su mensaje y «Empezar».
  const [lost] = useState(createFailure);
  useEffect(() => clearCreateFailure(), []);
  // Mis casas ya sabe que no hay borrador pendiente: el paso 1 sale ya y el borrador se crea por detrás (new-draft.ts).
  const [instant] = useState(() => !lost && knownNoDraft(client, userId));
  // La lectura que empezó al apoyar el dedo en «+» (Mis casas) vale si es de hace menos de RESUMABLE_FRESH_MS: no se repite.
  const resumable = useQuery({ ...resumableQuery(userId), enabled: !!userId && !instant, staleTime: RESUMABLE_FRESH_MS });
  const begun = useRef(false);
  useEffect(() => {
    if (!instant || begun.current) return;
    begun.current = true;
    const id = startDraft(client, userId, (lostId) => {
      // Solo si sigue en ese borrador: quien ya cerró el asistente no se ve llevado de vuelta.
      if (router.state.location.pathname.includes(lostId)) void router.navigate({ to: "/propietario/publicar", replace: true });
    });
    // En lugar de la entrada: «Atrás» desde el paso 1 vuelve a donde se tocó «+».
    void navigate({ to: "/propietario/publicar/$id/$paso", params: { id, paso: "1" }, replace: true });
  }, [instant, client, userId, router, navigate]);
  // Si se cierra mientras se crea, el borrador queda en Mis casas y no se salta al paso 1.
  const mounted = useRef(false);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const create = useMutation({
    mutationFn: async () => (await api()).createDraft(),
    onSuccess: async ({ id, listing }) => {
      // createDraft trae el borrador entero: a la caché sin otro viaje a la base (antes se volvía a pedir aquí).
      client.setQueryData(ownListingKey(userId, id), listing);
      addOwnCached(client, userId, listing); // la barra crece al instante, antes de releer la lista
      void client.invalidateQueries({ queryKey: ["own-listings", userId] });
      void client.invalidateQueries({ queryKey: ["own-resumable", userId] });
      // En lugar de la entrada: «Atrás» desde el paso 1 vuelve a donde se tocó «+».
      if (mounted.current) await navigate({ to: "/propietario/publicar/$id/$paso", params: { id, paso: "1" }, replace: true });
    },
  });
  // Solo con una lectura de esta visita (de después de montar o de los últimos segundos, la del toque en «+»): la caché del
  // teléfono puede traer un borrador ya enviado o descartado, o un «sin borrador» desfasado que crearía otro; la restaurada
  // conserva su hora antigua y no cuenta. Hasta entonces, el esqueleto.
  const fresh = resumable.isFetchedAfterMount || (resumable.isSuccess && !resumable.isFetching && Date.now() - resumable.dataUpdatedAt < RESUMABLE_FRESH_MS);
  const draft = fresh && !resumable.isError ? resumable.data : undefined;
  // Sin borrador pendiente no hay nada que elegir: se crea y se entra directo al paso 1 (revisión UX C4). Un solo intento
  // por visita (el modo estricto de React monta dos veces); si falla, el botón «Empezar» queda para reintentar.
  const autoStarted = useRef(instant || lost !== null);
  useEffect(() => {
    if (draft !== null || resumable.isFetching || autoStarted.current) return;
    autoStarted.current = true;
    create.mutate();
  }, [draft, resumable.isFetching, create]);
  const failure = create.isError ? message(create.error) : create.isIdle ? lost : null;
  const start = (
    <button type="button" className={`btn btn-block ${draft ? "btn-ghost" : "btn-primary btn-lg"}`} disabled={create.isPending} onClick={() => create.mutate()}>
      {create.isPending ? "Un momento…" : draft ? "Empezar otro" : "Empezar"}
    </button>
  );
  const failed =
    failure !== null ? (
      <p className="note" role="alert">
        {failure}
      </p>
    ) : null;

  // Leyendo, creando o ya creado (camino del paso 1): lo mismo que verá el paso 1 mientras carga, para que no cambie nada
  // hasta el formulario; al releer, el borrador recién creado no sale como «pendiente».
  // Con `instant`, solo la cabecera del paso 1 hasta que la navegación (sin red) pinta su formulario.
  if (instant) return <StepHeader step={1} />;
  if (create.isSuccess || (!draft && !resumable.isError && failure === null))
    return (
      <>
        <StepHeader step={1} />
        <SkeletonCard />
      </>
    );
  return (
    <>
      <FlowHeader title="Publicar casa" back="/cuenta" historyBack />
      {resumable.isError ? (
        <p className="note" role="alert">
          {message(resumable.error)}
        </p>
      ) : null}
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
      ) : draft === null ? (
        <section className="card stack gap-12">
          <h3>Publique su casa en pocos pasos</h3>
          {/* Solo si no se pudo crear el borrador: lo que pide el asistente y «Empezar» para reintentar. */}
          <ReadyList />
          <p className="small muted">La revisamos a mano y queda visible con su enlace para compartir por WhatsApp.</p>
          {start}
        </section>
      ) : null}
      {failed}
    </>
  );
}

// ---------- Una pantalla del asistente ----------

/** «Cerrar» (B11f): espera a que salgan los guardados de esta casa y vuelve a Mis casas; el borrador se retoma después. */
function CloseWizard({ id }: { id?: string }) {
  const navigate = useNavigate();
  const { close: to } = useEditor();
  const [saving, setSaving] = useState(false);
  async function close() {
    setSaving(true);
    if (id) await savesSettled(id);
    await navigate({ to });
  }
  return (
    <button type="button" className="btn-link header-close" onClick={close} disabled={saving} aria-busy={saving || undefined} aria-label={saving ? "Guardando el borrador…" : "Cerrar y seguir después"} title="Cerrar y seguir después">
      <I.x size={20} />
    </button>
  );
}

function StepHeader({ id, step, missingSteps }: { id?: string; step: Step | null; missingSteps?: readonly Step[] }) {
  const { admin } = useEditor();
  return (
    <WizardHeader title={admin ? "Asistir casa" : "Publicar casa"} step={step} close={<CloseWizard id={id} />} missingSteps={missingSteps} />
  );
}

/** También en las rutas del admin (/admin/casas/$id/publicar/$paso, mismos parámetros y búsqueda), con su puerto. */
export function PasoScreen() {
  const { id, paso } = useParams({ strict: false }) as { id: string; paso: string };
  const port = useEditor();
  const parsed = stepFromParam(paso);
  const step = parsed && "step" in parsed ? parsed.step : null;
  // Abierta desde «Revisar y enviar»: «Continuar» y «Atrás» vuelven a él (en el propio resumen no significa nada).
  const search = useSearch({ strict: false }) as { volver?: Volver };
  const volver = step === LAST_STEP ? undefined : search.volver;
  const { userId, query } = useOwnListing(id);
  const client = useQueryClient();
  const l = query.data;
  // Dirección del cambio de pantalla: la nueva entra desde la derecha al avanzar y desde la izquierda al volver. Al corregir
  // desde «Revisar y enviar», el resumen queda detrás: abrir el paso avanza y volver a él retrocede.
  const previous = useRef<{ step: Step | null; volver: boolean }>({ step: null, volver: false });
  const enter = stepEnter(previous.current.step, step, !!volver || previous.current.volver);
  useEffect(() => {
    previous.current = { step, volver: !!volver };
  }, [step, volver]);

  // Qué pantalla se abre (revisión UX C4): para ver dónde se abandona. La ruta lleva el paso y el id sale como :id.
  // Sin cuenta (pasos 2–6 en el teléfono) no hay casa: el evento va sin ella, con la ruta /publicar/nueva/:id/:paso.
  // Una vez por paso: con la casa, cuando llega su publicId; en el teléfono, al abrirlo (no espera a nada).
  const publicId = port.local ? "telefono" : l?.publicId;
  useEffect(() => {
    if (step && publicId) track("wizard_step", publicId === "telefono" ? undefined : publicId);
  }, [step, publicId]);

  // Fotos: siempre las del servidor al llegar a esa pantalla (la lectura espera a los guardados en curso).
  useEffect(() => {
    if (step === 7) void client.invalidateQueries({ queryKey: ["own-listing", userId, id] });
  }, [step, client, userId, id]);

  // Un id de pantalla retirado (el 3, el mapa de antes) lleva a la que lo sustituye: los enlaces viejos siguen sirviendo.
  if (parsed && "redirect" in parsed) return <Navigate to={port.step} params={{ id, paso: String(parsed.redirect) }} replace />;
  const header = <StepHeader id={id} step={step} missingSteps={step === LAST_STEP && l ? requiredProblems(l).map((p) => p.step) : undefined} />;
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
  // Solo un borrador o una casa con cambios pedidos se editan; lo demás se ve en su detalle. El admin edita así cualquier
  // casa sin publicar (también en revisión o rechazada); una publicada, en su ficha editable.
  if (port.admin ? isPublished(l) : l.status !== "draft" && l.status !== "changes") return <Navigate to={port.ficha} params={{ id }} replace />;

  return (
    <>
      {header}
      <StepForm key={step} userId={userId} listing={l} step={step} enter={enter} volver={volver}>
        {(values) => <StepFields step={step} draft={values} listing={l} userId={userId} />}
      </StepForm>
    </>
  );
}

/** Sin cuenta (Ana, 2026-11-04): los pasos 2–6 con el puerto del teléfono, en /publicar/nueva/$paso. La ruta manda el paso 1 a
 *  /publicar (la entrada), las Fotos y lo que sigue a /publicar/verificar y, con sesión, todo a /publicar/continuar. */
export function PasoLocalScreen() {
  return (
    <EditorContext.Provider value={localPort}>
      <PasoScreen />
    </EditorContext.Provider>
  );
}
