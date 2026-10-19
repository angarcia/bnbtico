"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/actions/account";
import { addPhoto, createDraft, deleteDraft, findResumableDraft, getOwnListing, removePhoto, reopenForEdit, saveStep, setAvailable, setCover, submit } from "@/lib/listings/repo";
import { MAX_PHOTOS, type Photo } from "@/lib/listings/schema";
import { photoPath } from "@/lib/image";
import { PHOTO_BUCKET } from "@/lib/supabase/storage";
import { parseStepForm, validateAll, validateStep, type Step } from "@/lib/listings/schema";
import { requireOwnerSession } from "@/lib/listings/session";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const stepOf = (v: string): Step | null => (/^[1-5]$/.test(v) ? (Number(v) as Step) : null);

/** Crea un borrador y abre el paso 1. Si ya hay uno sin enviar y no se fuerza, manda a /propietario/publicar a elegir. */
export async function createDraftAction(fd?: FormData): Promise<void> {
  const { db, account } = await requireOwnerSession("/propietario/publicar");
  const force = fd instanceof FormData && str(fd, "force") === "1";
  if (!force && (await findResumableDraft(db))) redirect("/propietario/publicar");
  const { id } = await createDraft(db, account.id, account.phone);
  redirect(`/propietario/publicar/${id}/1`);
}

export async function resumeDraftAction(): Promise<void> {
  const { db } = await requireOwnerSession("/propietario/publicar");
  const draft = await findResumableDraft(db);
  redirect(draft ? `/propietario/publicar/${draft.id}/1` : "/propietario/publicar");
}

/** Guarda el paso indicado y avanza. En el paso 5, además, envía a revisión. */
export async function saveStepAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const id = str(fd, "id");
  const step = stepOf(str(fd, "step"));
  if (!id || !step) return { error: "No encontramos ese anuncio." };
  const { db } = await requireOwnerSession(`/propietario/publicar/${id}/${step}`);
  const listing = await getOwnListing(db, id);
  if (!listing) return { error: "No encontramos ese anuncio." };
  if (listing.status !== "draft" && listing.status !== "changes") return { error: "Este anuncio no se puede editar en su estado actual." };
  const patch = parseStepForm(step, fd);
  const error = validateStep(step, { ...listing, ...patch });
  if (error) return { error };
  try {
    await saveStep(db, listing, patch);
  } catch {
    return { error: "No pudimos guardar. Intentá de nuevo." };
  }
  if (step < 5) redirect(`/propietario/publicar/${id}/${step + 1}`);
  // Enviar a revisión: todo el borrador válido y la RPC de la base de acuerdo.
  const fresh = await getOwnListing(db, id);
  const invalid = fresh ? validateAll(fresh) : { step: 1 as Step, error: "No encontramos ese anuncio." };
  if (invalid) {
    if (invalid.step === 5) return { error: invalid.error };
    redirect(`/propietario/publicar/${id}/${invalid.step}?error=${encodeURIComponent(invalid.error)}`);
  }
  const sent = await submit(db, id);
  if (!sent.ok) return { error: sent.error };
  redirect("/propietario/casas?enviada=1");
}

// ---------- Fotos (la subida a Storage la hace el navegador; aquí solo la fila) ----------
// Sin revalidar la ruta: el componente mantiene su propio estado, y una recarga del servidor en mitad de otra acción
// descartaba el envío del formulario.
async function ownedEditable(id: string) {
  const { db } = await requireOwnerSession(`/propietario/publicar/${id}/4`);
  const listing = await getOwnListing(db, id);
  if (!listing || (listing.status !== "draft" && listing.status !== "changes")) return null;
  return { db, listing };
}

/** URL firmada para subir una foto desde el navegador. La sesión vive en cookies httpOnly, así que el navegador no
 *  puede hablar con Storage por su cuenta; la firma se crea aquí con la sesión del dueño (Storage aplica la RLS al firmar). */
export async function signPhotoUploadAction(listingId: string): Promise<ActionState & { path?: string; token?: string }> {
  const ctx = await ownedEditable(listingId);
  if (!ctx) return { error: "No encontramos ese anuncio." };
  if (ctx.listing.photoCount >= MAX_PHOTOS) return { error: `Máximo ${MAX_PHOTOS} fotos.` };
  const path = photoPath(listingId, crypto.randomUUID());
  const { data, error } = await ctx.db.storage.from(PHOTO_BUCKET).createSignedUploadUrl(path);
  if (error || !data) return { error: "No pudimos preparar la subida. Intentá de nuevo." };
  return { ok: true, path: data.path, token: data.token };
}

export async function addPhotoAction(listingId: string, path: string): Promise<ActionState & { photo?: Photo }> {
  const ctx = await ownedEditable(listingId);
  if (!ctx) return { error: "No encontramos ese anuncio." };
  if (!path.startsWith(`${listingId}/`) || !/^[0-9a-f-]+\/[0-9a-f-]+\.jpg$/.test(path)) return { error: "Ruta de foto no válida." };
  if (ctx.listing.photoCount >= MAX_PHOTOS) return { error: `Máximo ${MAX_PHOTOS} fotos.` };
  try {
    const photo = await addPhoto(ctx.db, listingId, path);
    return { ok: true, photo };
  } catch {
    return { error: "No pudimos guardar la foto. Intentá de nuevo." };
  }
}

export async function removePhotoAction(listingId: string, photoId: string): Promise<ActionState> {
  const ctx = await ownedEditable(listingId);
  if (!ctx) return { error: "No encontramos ese anuncio." };
  const r = await removePhoto(ctx.db, listingId, photoId);
  return r.ok ? { ok: true } : { error: r.error };
}

export async function setCoverAction(listingId: string, photoId: string): Promise<ActionState> {
  const ctx = await ownedEditable(listingId);
  if (!ctx) return { error: "No encontramos ese anuncio." };
  const r = await setCover(ctx.db, listingId, photoId);
  return r.ok ? { ok: true } : { error: r.error };
}

export async function setAvailableAction(fd: FormData): Promise<void> {
  const id = str(fd, "id");
  const { db } = await requireOwnerSession(`/propietario/casas/${id}`);
  await setAvailable(db, id, str(fd, "available") === "1");
  redirect(`/propietario/casas/${id}`);
}

/** «Editar» / «Corregir y reenviar»: una casa activa pasa a borrador; luego abre el paso 1. */
export async function startEditAction(fd: FormData): Promise<void> {
  const id = str(fd, "id");
  const { db } = await requireOwnerSession(`/propietario/casas/${id}`);
  const listing = await getOwnListing(db, id);
  if (!listing) redirect("/propietario/casas");
  const r = await reopenForEdit(db, listing);
  redirect(r.ok ? `/propietario/publicar/${id}/1` : `/propietario/casas/${id}`);
}

export async function deleteDraftAction(fd: FormData): Promise<void> {
  const id = str(fd, "id");
  const { db } = await requireOwnerSession("/propietario/casas");
  await deleteDraft(db, id);
  redirect("/propietario/casas");
}
