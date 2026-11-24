// Asistente de publicar (decisión 2026-10-21): entrada (empezar o retomar el borrador pendiente) y ocho pantallas
// cortas sin scroll (ids de URL 1, 2 y 4–9; el 3 viejo lleva al 2). Se carga bajo demanda al abrir /propietario/publicar:
// no entra en el JS inicial.
import { Navigate, useNavigate, useParams, useSearch } from "@tanstack/react-router";
import { useState, type ReactNode } from "react";
import { LAST_STEP, stepFromParam, type Step } from "../../../domain/listing";
import { isPublished } from "../../../domain/can";
import { EditorContext, useEditor } from "../editor-port";
import { localPort } from "./local-port";
import type { Volver } from "./step-form";
import { requiredProblems, resumeStep } from "../../../domain/publish-rules";
import { ScreenHeader, type HeaderClose } from "../../comun/screen-header";
import { useDesktop } from "../../../shared/desktop";
import { savesSettled } from "../save-queue";
import { StepFields } from "./fields";
import { ReadyList, WizardHeader } from "./wizard-parts";
import { StepForm } from "./step-form";
import { useOwnListing, useUserId } from "../editor-query";
import { NotFoundCard } from "../editor-status";
import { Button } from "../../../shared/ui/button";
import { RouterButtonLink } from "../../comun/router-buttons";
import { LoadError, Notice, Skeleton } from "../../../shared/ui/structure";
import { Card } from "../../../shared/ui/card";
import * as PUBLICAR_COPY from "./copy/publicar";
import { errorMessage as message, usePublishEntry } from "./use-publish-entry";
import { useFreshPhotosOnStep, useStepEnter, useTrackWizardStep } from "./use-wizard-step";

const DESKTOP_STEPS: readonly Step[] = [1, 7, 6, LAST_STEP];

// ---------- Entrada ----------

/** Sin borrador pendiente, abrir esta pantalla crea uno y entra al paso 1. Si Mis casas ya lo sabía, al instante y el
 *  borrador se crea por detrás (2026-11-06); si no, viendo lo mismo que el paso 1 mientras la base responde (su cabecera y
 *  el esqueleto). Solo si falla, qué tener a mano y «Empezar». Si hay uno pendiente, no crea nada: ofrece seguirlo o
 *  empezar otro (ronda de Ana 2026-11-02: sin tarjetas de paso al tocar «+»). */
export function PublicarScreen() {
  const userId = useUserId();
  const { instant, resumable, draft, create, failure } = usePublishEntry(userId);
  const start = (
    <Button variant={draft ? "secondary" : "primary"} size={draft ? "md" : "lg"} block disabled={create.isPending} onClick={() => create.mutate()}>
      {PUBLICAR_COPY.start({ pending: create.isPending, draft: !!draft })}
    </Button>
  );
  const failed =
    failure !== null ? (
      <Notice tone="error">
        {failure}
      </Notice>
    ) : null;

  // Leyendo, creando o ya creado (camino del paso 1): lo mismo que verá el paso 1 mientras carga, para que no cambie nada
  // hasta el formulario; al releer, el borrador recién creado no sale como «pendiente».
  // Con `instant`, solo la cabecera del paso 1 hasta que la navegación (sin red) pinta su formulario.
  if (instant) return <StepHeader step={1} />;
  if (create.isSuccess || (!draft && !resumable.isError && failure === null))
    return (
      <>
        <StepHeader step={1} />
        <Skeleton shape="row" label={PUBLICAR_COPY.loading} />
      </>
    );
  return (
    <>
      <ScreenHeader kind="flow" title={PUBLICAR_COPY.title} back={{ to: "/cuenta", historyBack: true }} />
      {resumable.isError ? (
        <LoadError onRetry={() => void resumable.refetch()}>
          {message(resumable.error)}
        </LoadError>
      ) : null}
      {draft ? (
        <Card layout="stack" gap={12}>
          <h3>{PUBLICAR_COPY.draftTitle}</h3>
          <p className="small muted">
            {PUBLICAR_COPY.draftLine({ title: draft.title, date: new Date(draft.createdAt).toLocaleDateString("es-CR", { day: "numeric", month: "long" }) })}
          </p>
          <RouterButtonLink to="/propietario/publicar/$id/$paso" params={{ id: draft.id, paso: String(resumeStep(draft)) }} variant="primary" size="lg" block>
            {PUBLICAR_COPY.continueDraft}
          </RouterButtonLink>
          {start}
        </Card>
      ) : draft === null ? (
        <Card layout="stack" gap={12}>
          <h3>{PUBLICAR_COPY.intro}</h3>
          {/* Solo si no se pudo crear el borrador: lo que pide el asistente y «Empezar» para reintentar. */}
          <ReadyList />
          <p className="small muted">{PUBLICAR_COPY.introNote}</p>
          {start}
        </Card>
      ) : null}
      {failed}
    </>
  );
}

// ---------- Una pantalla del asistente ----------

/** «Cerrar» (B11f): espera a que salgan los guardados de esta casa y vuelve a Mis casas; el borrador se retoma después. */
function useCloseWizard(id?: string): HeaderClose {
  const navigate = useNavigate();
  const { close: to } = useEditor();
  const [saving, setSaving] = useState(false);
  async function close() {
    setSaving(true);
    if (id) await savesSettled(id);
    await navigate({ to });
  }
  return { label: saving ? PUBLICAR_COPY.savingDraft : PUBLICAR_COPY.closeLater, onClick: () => void close(), disabled: saving, busy: saving, title: PUBLICAR_COPY.closeLater };
}

function StepHeader({ id, step, lastInGroup, missingSteps, actions }: { id?: string; step: Step | null; lastInGroup?: Step; missingSteps?: readonly Step[]; actions?: ReactNode }) {
  const { admin } = useEditor();
  const close = useCloseWizard(id);
  return (
    <WizardHeader title={PUBLICAR_COPY.wizardTitle({ admin: !!admin })} step={step} lastInGroup={lastInGroup} close={close} missingSteps={missingSteps} actions={actions} />
  );
}

/** También en las rutas del admin (/admin/casas/$id/publicar/$paso, mismos parámetros y búsqueda), con su puerto. */
export function PasoScreen() {
  const { id, paso } = useParams({ strict: false }) as { id: string; paso: string };
  const port = useEditor();
  const desktop = useDesktop();
  const parsed = stepFromParam(paso);
  const routeStep = parsed && "step" in parsed ? parsed.step : null;
  // Abierta desde «Revisar y enviar»: «Continuar» y «Atrás» vuelven a él (en el propio resumen no significa nada).
  const search = useSearch({ strict: false }) as { volver?: Volver };
  const volver = routeStep === LAST_STEP ? undefined : search.volver;
  const groupSteps = desktop && !port.admin;
  const step = groupSteps && routeStep !== null && (routeStep === 2 || routeStep === 4 || routeStep === 5 || port.local) ? 1
    : groupSteps && routeStep === 8 ? 7 : routeStep;
  const lastInGroup = groupSteps ? (step === 1 ? 5 : step === 7 ? 8 : undefined) : undefined;
  const { userId, query } = useOwnListing(id);
  const l = query.data;
  const enter = useStepEnter(step, !!volver, groupSteps ? DESKTOP_STEPS : undefined);
  useTrackWizardStep(step, port.local ? "telefono" : l?.publicId);
  useFreshPhotosOnStep(step, userId, id);

  // Un id de pantalla retirado (el 3, el mapa de antes) lleva a la que lo sustituye: los enlaces viejos siguen sirviendo.
  if (port.local && routeStep === 1 && !desktop) return <Navigate to="/publicar" replace />;
  if (parsed && "redirect" in parsed) return <Navigate to={port.step} params={{ id, paso: String(parsed.redirect) }} replace />;
  const renderHeader = (actions?: ReactNode) => <StepHeader id={id} step={step} lastInGroup={lastInGroup} missingSteps={step === LAST_STEP && l ? requiredProblems(l).map((p) => p.step) : undefined} actions={actions} />;
  if (!step || l === null) {
    return (
      <>
        {renderHeader()}
        <NotFoundCard />
      </>
    );
  }
  if (l === undefined) {
    return (
      <>
        {renderHeader()}
        {query.isError ? (
          <LoadError onRetry={() => void query.refetch()}>
            {message(query.error)}
          </LoadError>
        ) : (
          <Skeleton shape="row" label={PUBLICAR_COPY.loading} />
        )}
      </>
    );
  }
  // Solo un borrador o una casa con cambios pedidos se editan; lo demás se ve en su detalle. El admin edita así cualquier
  // casa sin publicar (también en revisión o rechazada); una publicada, en su ficha editable.
  if (port.admin ? isPublished(l) : l.status !== "draft" && l.status !== "changes") return <Navigate to={port.ficha} params={{ id }} replace />;
  const desktopStepIndex = DESKTOP_STEPS.indexOf(step);

  return (
    <>
      <StepForm
        key={`${step}-${lastInGroup ?? ""}`}
        userId={userId}
        listing={l}
        step={step}
        lastInGroup={lastInGroup}
        next={groupSteps ? DESKTOP_STEPS[desktopStepIndex + 1] : undefined}
        back={groupSteps ? DESKTOP_STEPS[desktopStepIndex - 1] : undefined}
        verifyBeforePhotos={groupSteps && port.local}
        enter={enter}
        volver={volver}
        renderHeader={renderHeader}
      >
        {(values) => lastInGroup ? (
          <div className={`publish-step-columns${step === 7 ? " publish-price-photos" : ""}`}>
            {step === 1 ? (
              <>
                <div className="stack">
                  <StepFields step={1} draft={values} listing={l} userId={userId} withCapacity />
                  <StepFields step={5} draft={values} listing={l} userId={userId} />
                </div>
                <div className="stack"><StepFields step={2} draft={values} listing={l} userId={userId} /></div>
              </>
            ) : (
              <>
                <div className="stack"><StepFields step={8} draft={values} listing={l} userId={userId} /></div>
                <div className="stack"><StepFields step={7} draft={values} listing={l} userId={userId} /></div>
              </>
            )}
          </div>
        ) : <StepFields step={step} draft={values} listing={l} userId={userId} />}
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
