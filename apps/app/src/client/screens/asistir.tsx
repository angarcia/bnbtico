// El admin edita las casas (ronda de Ana del 2 nov, ticket 10, versión simple): las mismas pantallas que el anfitrión (el
// asistente para lo que no se ha publicado, la ficha editable y «Editar un dato» para lo publicado, las fotos y el
// calendario) con el puerto del admin (client/editor-port.ts): lee la casa sin filtrar por dueño y guarda con las RPCs
// admin_*, al momento y sin revisión. Y la lista de borradores de todos, para asistir a quien está creando su casa.
// Trozo diferido propio (asistir-*): no entra en el JS inicial ni en el de la zona del admin.
import { queryOptions, useQuery } from "@tanstack/react-query";
import { Link, Navigate, useParams } from "@tanstack/react-router";
import type { ReactNode } from "react";
import type { AdminEditApi } from "../../domain/api";
import { isPublished } from "../../domain/can";
import { DomainError, toDomainError } from "../../domain/errors";
import { variantUrl } from "../../domain/image";
import { missingLine, missingParts, resumeStep } from "../../domain/publish-rules";
import { I } from "../../shared/icons";
import { FlowHeader, RootHeader } from "../chrome";
import { EditorContext, type EditorListings, type EditorPhotos, type EditorPort } from "../editor-port";
import { authApi, useSession } from "../session";
import { EditableFicha } from "./casa-editable";
import { Calendar } from "./calendario";
import { EditarCampoScreen } from "./editar";
import { NotFoundCard, SkeletonCard, useOwnListing } from "./propietario";
import { PasoScreen } from "./publicar";

let edit: AdminEditApi | null = null;
const adminEdit = async (): Promise<AdminEditApi> => {
  await authApi();
  return (edit ??= (await import("../supabase-data")).adminEditApi());
};
/** Lo pendiente del anfitrión no lo toca el admin desde aquí: lo decide en la revisión de siempre. */
const notHere = () => Promise.reject(new DomainError("Ese dato no se puede cambiar aquí.", "validation"));

const listingsOf = (a: AdminEditApi): EditorListings => ({
  getOwn: (id) => a.get(id),
  saveStep: (id, step, patch, known) => a.saveStep(id, step, patch, known),
  submit: (id) => a.submit(id),
  updateLive: (id, patch) => a.updateLive(id, patch),
  saveEdit: (id, patch) => a.saveEdit(id, patch),
  discardEditField: notHere,
});
let loaded: EditorListings | null = null;

/** El puerto del admin: mismas pantallas, sus RPCs y sus rutas (mismos parámetros que las del anfitrión). */
export const adminPort: EditorPort = {
  admin: true,
  listings: async () => (loaded ??= listingsOf(await adminEdit())),
  loaded: () => loaded,
  photos: async (): Promise<EditorPhotos> => {
    const a = await adminEdit();
    // Las fotos del admin van directo a la ficha, también en una casa publicada (sin revisión).
    return { add: a.addPhoto, remove: a.removePhoto, reorder: a.reorderPhotos, addEditPhoto: a.addPhoto, removeEditPhoto: notHere, reorderEditPhotos: notHere };
  },
  calendar: async () => {
    const a = await adminEdit();
    return { days: a.days, save: a.saveDays };
  },
  step: "/admin/casas/$id/publicar/$paso",
  field: "/admin/casas/$id/editar/$campo",
  ficha: "/admin/casas/$id",
  close: "/admin/borradores",
};

const AsAdmin = ({ children }: { children: ReactNode }) => <EditorContext.Provider value={adminPort}>{children}</EditorContext.Provider>;

const message = (e: unknown) => toDomainError(e).message;
const useId = () => (useParams({ strict: false }) as { id: string }).id;

// ---------- La casa: ficha editable o asistente ----------

/** «Editar casa» desde la hoja de la casa o la lista de borradores: lo publicado, en su ficha editable; lo demás, en el
 *  asistente, donde se quedó. */
export function AsistirCasaScreen() {
  return (
    <AsAdmin>
      <AdminCasa />
    </AsAdmin>
  );
}

function AdminCasa() {
  const id = useId();
  const { userId, query } = useOwnListing(id);
  const l = query.data;
  if (l && !isPublished(l)) return <Navigate to="/admin/casas/$id/publicar/$paso" params={{ id, paso: String(resumeStep(l)) }} replace />;
  return (
    <>
      <FlowHeader
        title="Editar casa"
        back="/admin/casas"
        historyBack
        action={
          l && l.status === "active" && !l.adminHold ? (
            <Link to="/casa/$publicId" params={{ publicId: l.publicId }} className="link header-action">
              Ver ficha
            </Link>
          ) : undefined
        }
      />
      {l ? (
        <>
          <p className="small muted num" data-testid="admin-house-line">
            {l.publicId} · {l.title || "Sin nombre"}
          </p>
          <EditableFicha listing={l} userId={userId} />
          <section className="list">
            <Link to="/admin/casas/$id/calendario" params={{ id }} className="list-item">
              <span className="body">
                <b>Calendario</b>
                <small>Días ocupados y precios especiales</small>
              </span>
              <span className="chev">
                <I.chevron />
              </span>
            </Link>
          </section>
        </>
      ) : null}
      {l === null ? <NotFoundCard /> : null}
      {l === undefined && query.isError ? <p className="note" role="alert">{message(query.error)}</p> : null}
      {l === undefined && !query.isError ? <SkeletonCard /> : null}
    </>
  );
}

// ---------- El asistente, un dato y el calendario, con el puerto del admin ----------

export function AsistirPasoScreen() {
  return (
    <AsAdmin>
      <PasoScreen />
    </AsAdmin>
  );
}

export function AsistirCampoScreen() {
  return (
    <AsAdmin>
      <EditarCampoScreen />
    </AsAdmin>
  );
}

export function AsistirCalendarioScreen() {
  return (
    <AsAdmin>
      <AdminCalendar />
    </AsAdmin>
  );
}

function AdminCalendar() {
  const id = useId();
  const { userId, query } = useOwnListing(id);
  const l = query.data;
  return (
    <>
      <FlowHeader title="Calendario" back={`/admin/casas/${id}`} historyBack />
      {l ? <p className="cal-house">{l.title || "Sin nombre"}</p> : null}
      {l ? <Calendar listing={l} userId={userId} month={undefined} /> : null}
      {l === null ? <NotFoundCard /> : null}
      {l === undefined && query.isError ? <p className="note" role="alert">{message(query.error)}</p> : null}
      {l === undefined && !query.isError ? <SkeletonCard /> : null}
    </>
  );
}

// ---------- Borradores ----------

/** Los borradores sin enviar de todos los anfitriones; se piden de nuevo al abrir la pantalla. */
const draftsQuery = (userId: string) =>
  queryOptions({
    queryKey: ["admin-drafts", userId] as const,
    queryFn: async () => (await adminEdit()).drafts(),
    staleTime: 0,
  });

export function BorradoresScreen() {
  const userId = useSession().session?.userId ?? "";
  const drafts = useQuery({ ...draftsQuery(userId), enabled: !!userId });
  if (drafts.error && toDomainError(drafts.error).kind === "forbidden") return <Navigate to="/admin/codigo" search={{ next: "/admin/borradores" }} replace />;
  const data = drafts.data;
  return (
    <>
      <RootHeader title="Borradores" home="/admin/casas" />
      <p className="small muted">Casas que su anfitrión empezó y aún no envió. Toque una para completarla con él.</p>
      {drafts.isError && !data ? (
        <p className="note" role="alert">
          {message(drafts.error)}
        </p>
      ) : null}
      {!data && !drafts.isError ? (
        <section className="card skeleton owner-skeleton" aria-busy="true" aria-label="Cargando los borradores">
          <span className="sk sk-line" />
        </section>
      ) : null}
      {data && data.length === 0 ? (
        <section className="card">
          <p className="muted">No hay borradores sin enviar.</p>
        </section>
      ) : null}
      {data && data.length > 0 ? (
        <section className="list" aria-label="Borradores">
          {data.map(({ listing: l, ownerName }) => {
            const cover = l.photos[0];
            const missing = missingLine(missingParts(l));
            return (
              <Link key={l.id} to="/admin/casas/$id" params={{ id: l.id }} className="list-item house-row">
                {cover ? <img src={variantUrl(cover, 480)} alt="" className="thumb house-thumb" width={56} height={56} loading="lazy" decoding="async" /> : <span className="thumb house-thumb" />}
                <span className="body stack house-body">
                  <b className="house-title">{l.title || "Sin nombre"}</b>
                  <small className="num">{[l.publicId, ownerName, `empezado el ${new Date(l.createdAt).toLocaleDateString("es-CR", { day: "numeric", month: "long" })}`].join(" · ")}</small>
                  {missing ? <small className="sun-ink">{missing}</small> : <small className="primary">Listo para enviar</small>}
                </span>
                <span className="chev">
                  <I.chevron />
                </span>
              </Link>
            );
          })}
        </section>
      ) : null}
    </>
  );
}
