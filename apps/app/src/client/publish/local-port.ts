// Publicar sin cuenta hasta las fotos (Ana, 2026-11-04): el puerto del asistente que guarda en el teléfono. Mismas pantallas
// y mismas reglas (`planStep`) que el del anfitrión; los pasos 1–6 viven en localStorage (`PUBLISH_DRAFT_KEY`, 7 días) y, al
// pasar a Fotos, la ruta pide el WhatsApp (/publicar/verificar). Con el código, /publicar/continuar crea la casa con todo
// esto de una vez y sigue en Fotos. Rutas /publicar/nueva/$paso, un solo borrador por teléfono.
import { DomainError } from "../../domain/errors";
import { emptyDraft, type Listing, type ListingDraft } from "../../domain/listing";
import { planStep } from "../../domain/publish-rules";
import { PUBLISH_DRAFT_KEY, PUBLISH_STEP1_KEY, readPublishDraft, storeLocalDraft } from "../../domain/publish-return";
import type { EditorListings, EditorPort } from "../editor-port";
export { LOCAL_USER } from "../editor-port";

/** El id de la ruta del borrador del teléfono (no es un UUID: nunca llega a la base). */
export const LOCAL_ID = "nueva";

export const readPhoneDraft = (now = Date.now()): ListingDraft | null =>
  readPublishDraft(localStorage.getItem(PUBLISH_DRAFT_KEY), localStorage.getItem(PUBLISH_STEP1_KEY), now);

export function writePhoneDraft(draft: ListingDraft, now = Date.now()): void {
  localStorage.setItem(PUBLISH_DRAFT_KEY, storeLocalDraft(draft, now));
  localStorage.removeItem(PUBLISH_STEP1_KEY); // el borrador entero ya lleva el tipo
}

export function clearPhoneDraft(): void {
  localStorage.removeItem(PUBLISH_DRAFT_KEY);
  localStorage.removeItem(PUBLISH_STEP1_KEY);
}

const EPOCH = new Date(0).toISOString();
/** El borrador del teléfono con la forma de una casa: siempre un borrador, sin fotos, sin dueño ni número todavía. */
export const phoneListing = (d: ListingDraft): Listing => ({
  ...d,
  photoCount: 0,
  id: LOCAL_ID,
  publicId: "",
  ownerId: "",
  status: "draft",
  available: false,
  reopenAt: null,
  reviewNote: null,
  reviewedAt: null,
  firstPublishedAt: null,
  whatsappPhone: "",
  createdAt: EPOCH,
  updatedAt: EPOCH,
  photos: [],
  edit: null,
  adminHold: null,
});

const NOT_FOUND = "No encontramos ese anuncio.";
const notHere = () => Promise.reject(new DomainError("Para esto hace falta verificar su WhatsApp.", "validation"));

const listings: EditorListings = {
  async getOwn(id) {
    return id === LOCAL_ID ? phoneListing(readPhoneDraft() ?? emptyDraft()) : null;
  },
  async saveStep(id, step, patch, known) {
    if (id !== LOCAL_ID) throw new DomainError(NOT_FOUND, "not_found");
    const current = known ?? phoneListing(readPhoneDraft() ?? emptyDraft());
    const plan = planStep(current, step, patch);
    if ("error" in plan) throw new DomainError(plan.error, "validation");
    writePhoneDraft(plan.next);
    return phoneListing(plan.next);
  },
  submit: notHere,
  updateLive: notHere,
  saveEdit: notHere,
  discardEditField: notHere,
};

export const localPort: EditorPort = {
  admin: false,
  local: true,
  listings: async () => listings,
  loaded: () => listings,
  photos: notHere,
  calendar: notHere,
  step: "/publicar/$id/$paso",
  field: "/propietario/casas/$id/editar/$campo",
  ficha: "/propietario/casas/$id",
  close: "/explorar",
};
