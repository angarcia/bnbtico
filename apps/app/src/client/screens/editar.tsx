// Las pantallas de cada dato de una casa publicada (`/propietario/casas/$id/editar/$campo`, spec .scratch/editar-casa §2).
// Trozo diferido. Reutilizan los campos y las reglas del asistente (fields.tsx, step-forms, location-step); «Guardar» lee
// el formulario con parseField y decide con planEdit: capacidad, características y precio cambian al momento
// (update_listing_live, optimista); nombre, tipo, ubicación y descripción van a revisión con «Enviar a revisión»
// (save_edit), cada uno por su cuenta, con un aviso que nombra lo que los clientes siguen viendo (revisión UX 2026-10-29,
// A5). Se pueden volver a cambiar mientras están en revisión: cuenta el último. Volver sin guardar no guarda nada.
import { useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, getRouteApi, useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { useMemo, useState, type FormEvent } from "react";
import { isBlocked, isPublished } from "../../domain/can";
import { EDIT_COPY, FIELD_TITLES, REVIEWED_FIELDS, fieldTitle, editFieldFromParam, mergeEdit, parseField, planEdit, reviewNotice, type FormField, type ReviewedField } from "../../domain/edit";
import { toDomainError } from "../../domain/errors";
import { KIND_HINTS, KIND_LABELS, MAX_PHOTOS, type Kind, type Listing, type ListingDraft } from "../../domain/listing";
import { formInput } from "../../domain/step-forms";
import { toast } from "../../shared/toast";
import { FlowHeader } from "../chrome";
import { useSaveEdit, useUpdateLive } from "../edit";
import { photosApi, refresh } from "../owner";
import { BathroomChoice, CapacityCounters, DescriptionField, FeatureChips, PriceFields, TitleField } from "../publish/fields";
import { ChoiceCards } from "../publish/wizard-parts";
import { LocationStep } from "../publish/location-step";
import { PhotoCounter, PhotoGrid, type PhotoSource } from "../publish/photo-grid";
import { ReadyScope } from "../publish/step-form";
import { NotFoundCard, SkeletonCard, useOwnListing } from "./propietario";

const route = getRouteApi("/_flow/_privateFlow/propietario/casas/$id/editar/$campo");

/** De vuelta a la ficha sin apilarla: la ficha abrió esta pantalla, así que se vuelve atrás en el historial; si se llegó
 *  de fuera (un enlace guardado), se reemplaza esta pantalla por la ficha. Igual que la flecha (FlowHeader historyBack). */
function useBackToFicha(id: string) {
  const router = useRouter();
  const navigate = useNavigate();
  const canGoBack = useCanGoBack();
  return () => (canGoBack ? router.history.back() : void navigate({ to: "/propietario/casas/$id", params: { id }, replace: true }));
}

export function EditarCampoScreen() {
  const { id, campo } = route.useParams();
  const field = editFieldFromParam(campo);
  const { userId, query } = useOwnListing(id);
  const l = query.data;
  const ficha = <Navigate to="/propietario/casas/$id" params={{ id }} replace />;
  if (!field || (l && (!isPublished(l) || isBlocked(l)))) return ficha;
  // Una Habitación solo pregunta personas: «Personas» (con el tipo aprobado, el de sus contadores).
  const header = <FlowHeader title={fieldTitle(field, l?.kind)} back={`/propietario/casas/${id}`} historyBack />;
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
  if (field === "fotos") return <EditPhotos listing={l} userId={userId} />;
  return (
    <>
      {header}
      <EditFieldForm listing={l} field={field} userId={userId} />
    </>
  );
}

function EditFieldForm({ listing, field, userId }: { listing: Listing; field: FormField; userId: string }) {
  const toFicha = useBackToFicha(listing.id);
  const live = useUpdateLive(userId, listing);
  const edit = useSaveEdit(userId, listing);
  const reviewed = REVIEWED_FIELDS.includes(field);
  // Lo que se ve: con revisión, lo pendiente de la edición encima de lo aprobado; inmediato, lo aprobado. La caché del
  // teléfono puede abrir la pantalla con datos viejos: mientras el propietario no toque nada, cuando llega lo del servidor
  // y cambia, los campos (sin controlar) se vuelven a montar con ello (key). Desde el primer toque o «Guardar», la key se
  // queda: ni una relectura al volver a la app ni el cambio optimista (y su vuelta atrás si falla) pisan lo escrito.
  const draft = useMemo(() => mergeEdit(listing, reviewed ? listing.edit : null), [listing, reviewed]);
  const version = JSON.stringify(draft);
  const [frozen, setFrozen] = useState<string | null>(null);
  const touch = () => setFrozen((f) => f ?? version);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(true);
  const saving = live.isPending || edit.isPending;
  const failed = (e: unknown) => setError(toDomainError(e).message);

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    touch();
    if (saving || !ready) return;
    const plan = planEdit(listing, field, parseField(field, formInput(new FormData(e.currentTarget))));
    if ("error" in plan) return setError(plan.error);
    setError(null);
    if ("immediate" in plan) {
      if (Object.keys(plan.immediate).length === 0) return toFicha();
      return live.mutate(plan.immediate, {
        onSuccess: () => {
          toast(EDIT_COPY.savedLive);
          toFicha();
        },
        onError: failed,
      });
    }
    edit.mutate(plan.reviewed, {
      onSuccess: () => {
        toast(EDIT_COPY.sentToReview);
        toFicha();
      },
      onError: failed,
    });
  }

  return (
    <form key={frozen ?? version} onSubmit={onSubmit} onInputCapture={touch} onClickCapture={touch} className="publish-form" noValidate>
      {/* De qué casa es el cambio, bajo el título. */}
      <p className="small muted edit-house">{listing.title}</p>
      {error ? (
        <div className="note" role="alert">
          {error}
        </div>
      ) : null}
      <ReadyScope onReady={setReady}>
        <FieldInputs field={field} draft={draft} listing={listing} userId={userId} />
      </ReadyScope>
      {reviewed ? (
        <p className="note small" data-testid="review-notice">
          {reviewNotice(field as ReviewedField, listing)}
        </p>
      ) : null}
      <div className="sticky-actions">
        <button className="btn btn-primary btn-block" type="submit" disabled={saving || !ready}>
          {reviewed ? "Enviar a revisión" : "Guardar"}
        </button>
      </div>
    </form>
  );
}

/** Las fotos de una casa publicada (maqueta 08d): la rejilla del paso 7. Ordenar y quitar las aprobadas va al momento;
 * las nuevas van a revisión al subirlas, cada una por su cuenta, y salen detrás con «En revisión» (o «Cambios pedidos»);
 * quitar una nueva la descarta. El contador cuenta aprobadas y nuevas. */
function EditPhotos({ listing, userId }: { listing: Listing; userId: string }) {
  const client = useQueryClient();
  const toFicha = useBackToFicha(listing.id);
  const pending = listing.edit?.photos ?? [];
  const total = listing.photos.length + pending.length;
  const source: PhotoSource = {
    listingId: listing.id,
    photos: listing.photos,
    pending,
    counter: { text: `${total} de ${MAX_PHOTOS}`, tone: "muted" },
    room: MAX_PHOTOS - total,
    canAdd: true,
    register: async (folder) => (await photosApi()).addEditPhoto(listing.id, folder),
    remove: async (photo, isPending) => {
      const api = await photosApi();
      await (isPending ? api.removeEditPhoto(photo.id) : api.remove(photo.id));
    },
    reorder: async (ids) => (await photosApi()).reorder(listing.id, ids),
    // Ordenar o quitar una aprobada cambia la ficha pública y Explorar: como useUpdateLive, se relee también lo público
    // (la caché del teléfono, persistida, no lo pediría hasta que venza). Se espera al detalle, como en el asistente.
    reread: async () => {
      refresh(client, userId, listing);
      await client.invalidateQueries({ queryKey: ["own-listing", userId, listing.id] }, { cancelRefetch: false });
    },
  };
  return (
    <>
      <FlowHeader title={FIELD_TITLES.fotos} back={`/propietario/casas/${listing.id}`} historyBack action={<PhotoCounter counter={source.counter} />} />
      <div className="publish-form">
        <PhotoGrid source={source} userId={userId} />
        <p className="note small">El orden y las fotos que quite se guardan al momento. {EDIT_COPY.photosNotice}</p>
        <div className="sticky-actions">
          <Link
            className="btn btn-primary btn-block"
            to="/propietario/casas/$id"
            params={{ id: listing.id }}
            replace
            onClick={(e) => {
              e.preventDefault();
              toFicha();
            }}
          >
            Listo
          </Link>
        </div>
      </div>
    </>
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
      return <CapacityCounters draft={draft} />;
    case "caracteristicas":
      return <FeatureChips selected={draft.features} parkingPaid={draft.parkingPaid} />;
    case "precio":
      return <PriceFields draft={draft} />;
  }
}
