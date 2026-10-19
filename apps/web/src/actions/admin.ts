"use server";

import { revalidatePath } from "next/cache";
import type { ActionState } from "@/actions/account";
import { review } from "@/lib/listings/repo";
import { requireAdmin } from "@/lib/listings/session";

const DECISIONS = ["approve", "changes", "reject"] as const;
type Decision = (typeof DECISIONS)[number];

/** Decisión del admin sobre un anuncio en revisión. La RPC vuelve a comprobar permisos, estado, fotos y motivo. */
export async function reviewAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const { db } = await requireAdmin();
  const id = String(fd.get("id") ?? "");
  const decision = String(fd.get("decision") ?? "");
  const note = String(fd.get("note") ?? "").trim().slice(0, 2000);
  if (!id || !(DECISIONS as readonly string[]).includes(decision)) return { error: "Decisión no válida." };
  const result = await review(db, id, decision as Decision, note);
  if (!result.ok) return { error: result.error };
  revalidatePath("/admin");
  revalidatePath(`/admin/casas/${id}`);
  return { ok: true };
}
