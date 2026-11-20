// Las pantallas de cada dato de una casa publicada (`/propietario/casas/$id/editar/$campo`, spec .scratch/editar-casa §2).
// Trozo diferido. Reutilizan los campos y las reglas del asistente (fields.tsx, step-forms, location-step); «Guardar» lee
// el formulario con parseField y decide con planEdit: capacidad, características y precio cambian al momento
// (update_listing_live, optimista); nombre, tipo, ubicación y descripción van a revisión con «Enviar a revisión»
// (save_edit), cada uno por su cuenta, con un aviso que nombra lo que los clientes siguen viendo (revisión UX 2026-10-29,
// A5). Se pueden volver a cambiar mientras están en revisión: cuenta el último. Volver sin guardar no guarda nada.
// Editar sigue las reglas de crear (ticket 12): solo bloquea lo obligatorio del dato; lo demás se guarda y se avisa.
// En escritorio (historia 06, Ana, 2026-11-20) la misma ruta pinta el detalle de la casa y, encima, el dato en una ventana:
// normal (520) o ancha la Ubicación (960), con «Cancelar» y la acción en el pie; las fotos, en el editor amplio
// (photo-viewer.tsx). Atrás cierra la ventana (vuelve al detalle) y, con cambios, pregunta antes (excepción a D9: la ventana
// tiene su URL). El admin y el teléfono siguen con la pantalla del dato.
import { useQueryClient } from "@tanstack/react-query";
import { Navigate, useBlocker, useCanGoBack, useNavigate, useParams, useRouter } from "@tanstack/react-router";
import { lazy, Suspense, useEffect, useId, useLayoutEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { enterToNext, useEnterKeyHints, useFormKeyboard } from "../publish/form-keyboard";
import { FieldErrorContext, useFieldError } from "../publish/field-error";
import { listingFieldError } from "../../domain/field-errors";
import { StickyActions } from "../../shared/field";
import { isBlocked, isPublished } from "../../domain/can";
import { EDIT_COPY, FIELD_TITLES, REVIEWED_FIELDS, fieldTitle, editFieldFromParam, mergeEdit, parseField, reviewNotice, type FormField, type ReviewedField } from "../../domain/edit";
import { planEdit } from "../../domain/edit-plan";
import { toDomainError } from "../../domain/errors";
import { KIND_HINTS, KIND_LABELS, MAX_PHOTOS, type Kind, type Listing, type ListingDraft } from "../../domain/listing";
import { formInput } from "../../domain/step-forms";
import { toast } from "../../shared/toast";
import { ScreenHeader } from "../chrome";
import { useSaveEdit, useUpdateLive } from "../edit";
import { useEditor } from "../editor-port";
import { refresh } from "../owner";
import { BathroomChoice, CapacityCounters, DescriptionField, FeatureChips, PriceFields, TitleField } from "../publish/fields";
import { ChoiceCards } from "../publish/wizard-parts";
import { LocationStep } from "../publish/location-step";
import { PhotoCounter, PhotoGrid, type PhotoSource } from "../publish/photo-grid";
import { useOwnListing } from "../editor-query";
import { NotFoundCard } from "../editor-status";
import { useDesktop } from "../desktop";
import { OwnerHouseDetail } from "./propietario";
import { Button } from "../../shared/button";
import { RouterButtonLink } from "../router-buttons";
import { Dialog, DiscardConfirm } from "../../shared/overlay";
import { LoadError, Notice, Skeleton } from "../../shared/structure";

/** De vuelta a la ficha sin apilarla: la ficha abrió esta pantalla, así que se vuelve atrás en el historial; si se llegó
 *  de fuera (un enlace guardado), se reemplaza esta pantalla por la ficha. Igual que la flecha (ScreenHeader con `back.historyBack`). */
function useBackToFicha(id: string) {
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  const { ficha } = useEditor();
  return () => (canGoBack ? router.history.back() : void navigate({ to: ficha, params: { id }, replace: true }));
}

/** También en las rutas del admin (/admin/casas/$id/editar/$campo), con su puerto: guarda al momento y edita también una
 *  casa bloqueada. */
export function EditarCampoScreen() {
  const { id, campo } = useParams({ strict: false }) as { id: string; campo: string };
  const port = useEditor();
  const desktop = useDesktop();
  const field = editFieldFromParam(campo);
  const { userId, query } = useOwnListing(id);
  const l = query.data;
  const ficha = <Navigate to={port.ficha} params={{ id }} replace />;
  if (!field || (l && (!isPublished(l) || (isBlocked(l) && !port.admin)))) return ficha;
  // Escritorio del anfitrión: el detalle (con su carga y sus errores) y, encima, la ventana del dato.
  if (desktop && !port.admin)
    return (
      <>
        <OwnerHouseDetail id={id} />
        {l ? field === "fotos" ? <EditPhotosDialog listing={l} userId={userId} /> : <EditFieldForm key={field} listing={l} field={field} userId={userId} dialog /> : null}
      </>
    );
  // Una Habitación solo pregunta personas: «Personas» (con el tipo aprobado, el de sus contadores).
  const header = <ScreenHeader kind="flow" title={fieldTitle(field, l?.kind)} back={{ to: port.ficha.replace("$id", id), historyBack: true }} />;
  if (l === null)
    return (
      <>
        {header}
        <NotFoundCard />
      </>
    );
  if (l === undefined)
    return (
      <>
        {header}
        {query.isError ? (
          <LoadError onRetry={() => void query.refetch()}>
            {toDomainError(query.error).message}
          </LoadError>
        ) : (
          <Skeleton shape="row" label="Cargando sus casas" />
        )}
      </>
    );
  return field === "fotos" ? <EditPhotos listing={l} userId={userId} /> : (
    <>
      {header}
      <EditFieldForm listing={l} field={field} userId={userId} />
    </>
  );
}

// El editor de fotos de escritorio, en su propio trozo (photo-viewer-*): solo lo pide el escritorio del anfitrión.
const PhotoEditorDialog = lazy(() => import("../publish/photo-viewer").then((m) => ({ default: m.PhotoEditorDialog })));

/** Al cerrar la ventana de un dato, el foco vuelve a su «Editar» (el detalle se vuelve a pintar al cambiar de ruta, así que
 *  quien la abrió ya no está). */
const editTrigger = (field: string) => () => document.querySelector<HTMLElement>(`[data-edit-field="${field}"]`);

function editFieldValue(form: HTMLFormElement, field: FormField) {
  const data = new FormData(form);
  if (field === "ubicacion") {
    // Estos datos llegan al cargar el mapa y la base los vuelve a calcular al aprobar.
    for (const name of ["province", "canton", "district"]) data.delete(name);
  }
  const patch = parseField(field, formInput(data));
  return JSON.stringify(patch, (_key, value: unknown) => typeof value === "number" && Number.isNaN(value) ? "NaN" : value);
}

function EditFieldForm({ listing, field, userId, dialog = false }: { listing: Listing; field: FormField; userId: string; dialog?: boolean }) {
  const form = useRef<HTMLFormElement>(null);
  const formId = useId();
  const keyboard = useFormKeyboard(form);
  useEnterKeyHints(form);
  const back = useBackToFicha(listing.id);
  // Salir a propósito (guardar, «Cancelar», cerrar tras «Descartar»): sin la pregunta de Atrás.
  const leaving = useRef(false);
  const finish = () => {
    leaving.current = true;
    back();
  };
  const live = useUpdateLive(userId, listing);
  const edit = useSaveEdit(userId, listing);
  // El admin guarda al momento, sin revisión: parte de lo publicado (lo pendiente del anfitrión de ese dato se descarta).
  const { admin } = useEditor();
  const reviewed = REVIEWED_FIELDS.includes(field) && !admin;
  // Lo que se ve: con revisión, lo pendiente de la edición encima de lo aprobado; inmediato, lo aprobado. La caché del
  // teléfono puede abrir la pantalla con datos viejos: mientras el propietario no toque nada, cuando llega lo del servidor
  // y cambia, los campos (sin controlar) se vuelven a montar con ello (key). Desde el primer toque o «Guardar», la key se
  // queda: ni una relectura al volver a la app ni el cambio optimista (y su vuelta atrás si falla) pisan lo escrito.
  const draft = useMemo(() => mergeEdit(listing, reviewed ? listing.edit : null), [listing, reviewed]);
  const version = JSON.stringify(draft);
  const [frozen, setFrozen] = useState<string | null>(null);
  const formVersion = frozen ?? version;
  const initialValue = useRef("");
  const interacted = useRef(false);
  const [hasChanges, setHasChanges] = useState(false);
  const touch = () => {
    interacted.current = true;
    setFrozen((f) => f ?? version);
  };
  const [error, setError] = useState<string | null>(null);
  const saving = live.isPending || edit.isPending;
  // ¿Hay cambios? Se mira el formulario en el momento (Escape justo después de escribir llega antes que `hasChanges`).
  const dirty = () => !!form.current && editFieldValue(form.current, field) !== initialValue.current;
  // Atrás del navegador (o cualquier salida de la ruta) con cambios en la ventana: «¿Descartar los cambios?».
  const blocker = useBlocker({ shouldBlockFn: () => !leaving.current && dirty(), withResolver: true, enableBeforeUnload: false, disabled: !dialog });
  const failed = (e: unknown) => setError(toDomainError(e).message);

  useLayoutEffect(() => {
    const element = form.current;
    if (!element) return;
    initialValue.current = editFieldValue(element, field);
    setHasChanges(false);
    const compare = () => {
      const value = editFieldValue(element, field);
      if (!interacted.current) initialValue.current = value;
      setHasChanges(value !== initialValue.current);
    };
    let frame = 0;
    const afterInput = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(compare);
    };
    // Los contadores y el mapa actualizan campos ocultos sin emitir input.
    const observer = new MutationObserver(compare);
    observer.observe(element, { subtree: true, attributes: true, attributeFilter: ["value"], childList: true });
    element.addEventListener("input", afterInput);
    element.addEventListener("change", afterInput);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      element.removeEventListener("input", afterInput);
      element.removeEventListener("change", afterInput);
    };
  }, [field, formVersion]);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    touch();
    // «Enviar a revisión» no espera a la pantalla (p. ej. al cantón del pin), como «Continuar» al crear: lo obligatorio
    // que falte lo dice planEdit con su mensaje.
    if (saving || !hasChanges || editFieldValue(e.currentTarget, field) === initialValue.current) return;
    const plan = planEdit(listing, field, parseField(field, formInput(new FormData(e.currentTarget)), draft));
    if ("error" in plan) return setError(plan.error);
    setError(null);
    // Lo no obligatorio se guarda y se avisa al guardar (y en ocre bajo el dato, en la ficha).
    const done = (text: string) => () => {
      toast(plan.warning ? `${text} ${plan.warning}` : text);
      finish();
    };
    const changes = "immediate" in plan ? plan.immediate : plan.reviewed;
    if (Object.keys(changes).length === 0) return finish();
    if ("immediate" in plan) return live.mutate(plan.immediate, { onSuccess: done(EDIT_COPY.savedLive), onError: failed });
    edit.mutate(plan.reviewed, { onSuccess: done(admin ? EDIT_COPY.savedLive : EDIT_COPY.sentToReview), onError: failed });
  }

  const action = reviewed ? "Enviar a revisión" : "Guardar";
  // El error de un campo va debajo de ese campo (aquí todos los datos de la pantalla están siempre a la vista); el resto,
  // en el aviso de arriba.
  const fieldProblem = listingFieldError(error);
  // El error de guardado va arriba del cuerpo de la ventana: se sube hasta él para que se vea.
  useEffect(() => {
    if (dialog && error && !fieldProblem) form.current?.querySelector('[role="alert"]')?.scrollIntoView({ block: "nearest" });
  }, [dialog, error, fieldProblem]);
  const editor = (
    <form id={formId} ref={form} key={formVersion} onSubmit={onSubmit} onKeyDown={enterToNext} onInputCapture={touch} onChangeCapture={touch} onPointerDownCapture={touch} onClickCapture={touch} {...(dialog ? {} : keyboard)} className="publish-form" noValidate>
      {/* De qué casa es el cambio, bajo el título (en la ventana, en su cabecera). */}
      {!dialog ? <p className="small muted edit-house">{listing.title}</p> : null}
      {error && !fieldProblem ? (
        <Notice as="div" tone="error">
          {error}
        </Notice>
      ) : null}
      <FieldErrorContext.Provider value={fieldProblem}>
        <FieldInputs field={field} draft={draft} listing={listing} userId={userId} />
      </FieldErrorContext.Provider>
      {reviewed ? (
        <Notice small data-testid="review-notice">
          {reviewNotice(field as ReviewedField, listing)}
        </Notice>
      ) : null}
      {!dialog && <StickyActions spacer="none">
        <Button variant="primary" size="lg" block type="submit" disabled={saving || !hasChanges}>
          {action}
        </Button>
      </StickyActions>}
    </form>
  );
  if (!dialog) return editor;
  return (
    <Dialog
      size={field === "ubicacion" ? "wide" : "normal"}
      layout="field"
      title={fieldTitle(field, listing.kind)}
      subtitle={listing.title}
      busy={saving}
      confirmDiscard={dirty}
      onClose={finish}
      returnFocus={editTrigger(field)}
      footer={
        <>
          {/* «Cancelar» cierra sin preguntar (historia 07). */}
          <Button variant="secondary" disabled={saving} onClick={finish}>Cancelar</Button>
          <Button variant="primary" type="submit" form={formId} disabled={!hasChanges} pending={saving}>{action}</Button>
        </>
      }
    >
      {editor}
      {blocker.status === "blocked" ? (
        <DiscardConfirm desktop keep={blocker.reset} discard={() => {
          leaving.current = true;
          blocker.proceed();
        }} />
      ) : null}
    </Dialog>
  );
}

/** Las fotos de una casa publicada (maqueta 08d): la rejilla del paso 7. Ordenar y quitar las aprobadas va al momento;
 * las nuevas van a revisión al subirlas, cada una por su cuenta, y salen detrás con «En revisión» (o «Cambios pedidos»);
 * quitar una nueva la descarta. El contador cuenta aprobadas y nuevas. */
function usePhotoSource(listing: Listing, userId: string): PhotoSource {
  const client = useQueryClient();
  // El admin sube directo a la ficha; las fotos nuevas del anfitrión siguen en su revisión (cuentan para el tope).
  const { admin, photos } = useEditor();
  const theirs = listing.edit?.photos ?? [];
  const pending = admin ? [] : theirs;
  const total = listing.photos.length + theirs.length;
  return {
    listingId: listing.id,
    photos: listing.photos,
    pending,
    // El mismo contador que el paso 7 del asistente.
    counter: { text: `${total} de ${MAX_PHOTOS}`, tone: "ok" },
    room: MAX_PHOTOS - total,
    canAdd: true,
    register: async (folder) => (await photos()).addEditPhoto(listing.id, folder),
    remove: async (photo, isPending) => {
      const api = await photos();
      await (isPending ? api.removeEditPhoto(photo.id) : api.remove(photo.id));
    },
    reorder: async (ids) => (await photos()).reorder(listing.id, ids),
    // Ordenar o quitar una aprobada cambia la ficha pública y Explorar: como useUpdateLive, se relee también lo público
    // (la caché del teléfono, persistida, no lo pediría hasta que venza). Se espera al detalle, como en el asistente.
    reread: async () => {
      refresh(client, userId, listing);
      await client.invalidateQueries({ queryKey: ["own-listing", userId, listing.id] }, { cancelRefetch: false });
    },
  };
}

/** Escritorio del anfitrión: el editor amplio sobre el detalle; «Listo», la ✕ y Escape vuelven al detalle. */
function EditPhotosDialog({ listing, userId }: { listing: Listing; userId: string }) {
  const source = usePhotoSource(listing, userId);
  const back = useBackToFicha(listing.id);
  return (
    <Suspense fallback={null}>
      <PhotoEditorDialog
        source={source}
        userId={userId}
        notice={`El orden y las fotos que quite se guardan al momento y ya se ven en su ficha. ${EDIT_COPY.photosNotice}`}
        onClose={back}
        returnFocus={editTrigger("fotos")}
      />
    </Suspense>
  );
}

function EditPhotos({ listing, userId }: { listing: Listing; userId: string }) {
  const toFicha = useBackToFicha(listing.id);
  const { admin, ficha } = useEditor();
  const source = usePhotoSource(listing, userId);
  const total = listing.photos.length + (listing.edit?.photos.length ?? 0);
  return (
    <>
      <ScreenHeader kind="flow" title={FIELD_TITLES.fotos} back={{ to: ficha.replace("$id", listing.id), historyBack: true }} action={<PhotoCounter counter={source.counter} />} />
      <div className="publish-form">
        {/* Como el paso 7: la ayuda de la primera foto se va con ella. */}
        {total === 0 ? <p className="small muted photos-help">Necesita al menos una foto para enviarla a revisión.</p> : null}
        <PhotoGrid source={source} userId={userId} />
        <Notice small>{admin ? "Las fotos nuevas, el orden y las que quite se guardan al momento." : `El orden y las fotos que quite se guardan al momento. ${EDIT_COPY.photosNotice}`}</Notice>
        <StickyActions spacer="none">
          <RouterButtonLink
            variant="primary"
            size="lg"
            block
            to={ficha}
            params={{ id: listing.id }}
            replace
            onClick={(e) => {
              e.preventDefault();
              toFicha();
            }}
          >
            Listo
          </RouterButtonLink>
        </StickyActions>
      </div>
    </>
  );
}

/** El tipo: con «Habitación» elegida aparece el baño (que en el asistente se pide con la capacidad). */
function KindInputs({ draft }: { draft: ListingDraft }) {
  // Un tipo de antes (casa, apartamento) cuenta como Alojamiento completo, como en el paso 1 del asistente (KindChoice).
  const [kind, setKind] = useState<Kind | null>(draft.kind === "habitacion" ? "habitacion" : draft.kind && "completo");
  const error = useFieldError("kind");
  return (
    <div className="stack publish-kind">
      <ChoiceCards
        name="kind"
        type="radio"
        error={error}
        selected={kind ? [kind] : []}
        onChange={(c) => setKind(c[0] === "habitacion" ? "habitacion" : "completo")}
        options={[
          { value: "completo", label: KIND_LABELS.completo, hint: KIND_HINTS.completo },
          { value: "habitacion", label: KIND_LABELS.habitacion, hint: KIND_HINTS.habitacion },
        ]}
      />
      {kind === "habitacion" ? <BathroomChoice shared={draft.bathroomShared} /> : null}
    </div>
  );
}

/** Los campos de un dato: los del asistente para esa pantalla. `draft` trae los valores a mostrar. */
function FieldInputs({ field, draft, listing }: { field: FormField; draft: ListingDraft; listing: Listing; userId: string }) {
  switch (field) {
    case "nombre":
      return <TitleField value={draft.title} />;
    case "descripcion":
      return <DescriptionField value={draft.description} />;
    case "tipo":
      return <KindInputs draft={draft} />;
    case "ubicacion":
      return <LocationStep listing={listing} draft={draft} fullWidth />;
    case "capacidad":
      return <CapacityCounters draft={draft} />;
    case "caracteristicas":
      return <FeatureChips selected={draft.features} parkingPaid={draft.parkingPaid} />;
    case "precio":
      return <PriceFields draft={draft} />;
  }
}
