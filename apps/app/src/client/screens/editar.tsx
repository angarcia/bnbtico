// Las pantallas de cada dato de una casa publicada (`/propietario/casas/$id/editar/$campo`, spec .scratch/editar-casa §2).
// Trozo diferido. Reutilizan los campos y las reglas del asistente (fields.tsx, step-forms, location-step); «Guardar» lee
// el formulario con parseField y decide con planEdit: capacidad, características y precio cambian al momento
// (update_listing_live, optimista); nombre, tipo, ubicación y descripción van a la edición de la casa (save_edit), que se
// envía a revisión desde la ficha. Con la edición en revisión, esos cuatro se abren solo para leer. Volver sin guardar no
// guarda nada.
import { Navigate, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { isPublished } from "../../domain/can";
import { EDIT_COPY, FIELD_TITLES, REVIEWED_FIELDS, editFieldFromParam, mergeEdit, parseField, planEdit, type FormField } from "../../domain/edit";
import { toDomainError } from "../../domain/errors";
import { KIND_HINTS, KIND_LABELS, type Kind, type Listing, type ListingDraft } from "../../domain/listing";
import { formInput } from "../../domain/step-forms";
import { toast } from "../../shared/toast";
import { FlowHeader } from "../chrome";
import { useSaveEdit, useUpdateLive } from "../edit";
import { BathroomChoice, ChoiceCards, Counter, DescriptionField, FeatureChips, MonthlyQuestion, TitleField } from "../publish/fields";
import { LocationStep } from "../publish/location-step";
import { ReadyScope } from "../publish/step-form";
import { NotFoundCard, SkeletonCard, useOwnListing } from "./propietario";

const route = getRouteApi("/_flow/_privateFlow/propietario/casas/$id/editar/$campo");

export function EditarCampoScreen() {
  const { id, campo } = route.useParams();
  const field = editFieldFromParam(campo);
  const { userId, query } = useOwnListing(id);
  const l = query.data;
  const ficha = <Navigate to="/propietario/casas/$id" params={{ id }} replace />;
  if (!field || (l && !isPublished(l))) return ficha;
  const header = <FlowHeader title={FIELD_TITLES[field]} back={`/propietario/casas/${id}`} />;
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
          <p className="note" role="alert">
            {toDomainError(query.error).message}
          </p>
        ) : (
          <SkeletonCard />
        )}
      </>
    );
  // Las fotos llegan con su propia pantalla (tarea 11).
  if (field === "fotos") return header;
  return (
    <>
      {header}
      <EditFieldForm listing={l} field={field} userId={userId} />
    </>
  );
}

function EditFieldForm({ listing, field, userId }: { listing: Listing; field: FormField; userId: string }) {
  const navigate = useNavigate();
  const live = useUpdateLive(userId, listing);
  const edit = useSaveEdit(userId, listing);
  const reviewed = REVIEWED_FIELDS.includes(field);
  const readOnly = reviewed && listing.edit?.status === "review";
  // Lo que se ve: con revisión, lo pendiente de la edición encima de lo aprobado; inmediato, lo aprobado. La caché del
  // teléfono puede abrir la pantalla con datos viejos: cuando llega lo del servidor y cambia, los campos (sin controlar)
  // se vuelven a montar con ello (key); las mutaciones y su aviso siguen aquí, fuera de lo que se vuelve a montar.
  const draft = useMemo(() => mergeEdit(listing, reviewed ? listing.edit : null), [listing, reviewed]);
  const version = JSON.stringify(draft);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(true);
  const saving = live.isPending || edit.isPending;
  const toFicha = () => navigate({ to: "/propietario/casas/$id", params: { id: listing.id }, replace: true });
  const failed = (e: unknown) => setError(toDomainError(e).message);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (readOnly || saving || !ready) return;
    const plan = planEdit(listing, field, parseField(field, formInput(new FormData(e.currentTarget))));
    if ("error" in plan) return setError(plan.error);
    setError(null);
    if ("immediate" in plan) {
      if (Object.keys(plan.immediate).length === 0) return void toFicha();
      return live.mutate(plan.immediate, {
        onSuccess: () => {
          toast(EDIT_COPY.savedLive);
          void toFicha();
        },
        onError: failed,
      });
    }
    edit.mutate(plan.reviewed, {
      onSuccess: () => {
        toast(EDIT_COPY.savedEdit);
        void toFicha();
      },
      onError: failed,
    });
  }

  const inputs = (
    <ReadyScope onReady={setReady}>
      <FieldInputs field={field} draft={draft} listing={listing} userId={userId} />
    </ReadyScope>
  );
  return (
    <form key={version} onSubmit={onSubmit} className="publish-form" noValidate>
      {error ? (
        <div className="note" role="alert">
          {error}
        </div>
      ) : null}
      {readOnly ? (
        <>
          <p className="note note-arena">{EDIT_COPY.readOnly}</p>
          <fieldset disabled className="edit-fieldset">
            {inputs}
          </fieldset>
        </>
      ) : (
        <>
          {inputs}
          <div className="sticky-actions">
            <button className="btn btn-primary btn-block" type="submit" disabled={saving || !ready}>
              Guardar
            </button>
          </div>
        </>
      )}
    </form>
  );
}

/** El tipo: con «Habitación» elegida aparece el baño (que en el asistente se pide con la capacidad). */
function KindInputs({ draft }: { draft: ListingDraft }) {
  const [kind, setKind] = useState<Kind | null>(draft.kind);
  return (
    <>
      <ChoiceCards
        name="kind"
        type="radio"
        selected={kind ? [kind] : []}
        onChange={(c) => setKind(c[0] === "habitacion" ? "habitacion" : "completo")}
        options={[
          { value: "completo", label: KIND_LABELS.completo, hint: KIND_HINTS.completo },
          { value: "habitacion", label: KIND_LABELS.habitacion, hint: KIND_HINTS.habitacion },
        ]}
      />
      {kind === "habitacion" ? <BathroomChoice shared={draft.bathroomShared} /> : null}
    </>
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
      return <LocationStep listing={listing} draft={draft} />;
    case "capacidad":
      return (
        <div className="card counters">
          <Counter name="capacity" label="Personas" value={draft.capacity} min={1} />
          <Counter name="bedrooms" label="Habitaciones" value={draft.bedrooms} min={draft.kind === "habitacion" ? 1 : 0} />
          <Counter name="bathrooms" label="Baños" value={draft.bathrooms} min={1} />
        </div>
      );
    case "caracteristicas":
      return <FeatureChips selected={draft.features} parkingPaid={draft.parkingPaid} />;
    case "precio":
      return (
        <>
          <div className="field">
            <label htmlFor="pub-nightlyPriceCrc">Precio por noche</label>
            <div className="input-money">
              <span className="cur">₡</span>
              <input id="pub-nightlyPriceCrc" name="nightlyPriceCrc" inputMode="numeric" autoComplete="off" defaultValue={draft.nightlyPriceCrc ?? ""} placeholder="95 000" />
            </div>
          </div>
          <MonthlyQuestion accepts={draft.acceptsMonthly} price={draft.monthlyPriceCrc} />
          <span className="small muted">En colones; el cliente puede verlo en dólares. El precio final lo acuerda por WhatsApp.</span>
        </>
      );
  }
}
