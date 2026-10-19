"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/actions/account";
import { createDraft, deleteDraft, findResumableDraft, getOwnListing, saveStep } from "@/lib/listings/repo";
import { parseStepForm, validateStep, type Step } from "@/lib/listings/schema";
import { requireOwnerSession } from "@/lib/listings/session";

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();
const stepOf = (v: string): Step | null => (/^[1-5]$/.test(v) ? (Number(v) as Step) : null);

/** Crea un borrador y abre el paso 1. Si ya hay uno sin enviar, /propietario/publicar ofrece seguirlo. */
export async function createDraftAction(): Promise<void> {
  const { db, account } = await requireOwnerSession("/propietario/publicar");
  const { id } = await createDraft(db, account.id, account.phone);
  redirect(`/propietario/publicar/${id}/1`);
}

export async function resumeDraftAction(): Promise<void> {
  const { db } = await requireOwnerSession("/propietario/publicar");
  const draft = await findResumableDraft(db);
  redirect(draft ? `/propietario/publicar/${draft.id}/1` : "/propietario/publicar");
}

/** Guarda el paso indicado y avanza. En el paso 5 envía a revisión (llega en la siguiente tarea del plan). */
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
  redirect("/propietario/casas");
}

export async function deleteDraftAction(fd: FormData): Promise<void> {
  const id = str(fd, "id");
  const { db } = await requireOwnerSession("/propietario/casas");
  await deleteDraft(db, id);
  redirect("/propietario/casas");
}
