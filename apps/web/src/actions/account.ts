"use server";

import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { normalizePhone } from "@/lib/phone";
import { safeNext } from "@/lib/safe-next";
import { clearRole, setRole } from "@/lib/role";

export type ActionState = { error?: string; ok?: boolean };

const str = (fd: FormData, key: string) => String(fd.get(key) ?? "").trim();

export async function startAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const mode = str(fd, "mode") === "login" ? "login" : "register";
  const phone = normalizePhone(str(fd, "phone"));
  if (!phone) return { error: "Escriba un WhatsApp válido, con código de país si no es de Costa Rica." };
  const name = str(fd, "name");
  if (mode === "register" && name.length < 2) return { error: "Escriba su nombre." };
  const result = await (await auth()).start(mode === "register" ? { mode, name, phone } : { mode, phone });
  if (!result.ok) return { error: result.error };
  redirect("/cuenta/codigo");
}

export async function verifyAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const code = str(fd, "code").replace(/\D/g, "");
  if (code.length !== 6) return { error: "El código tiene 6 dígitos." };
  const a = await auth();
  const pending = await a.pending();
  const result = await a.verify(code);
  if (!result.ok) return { error: result.error };
  const next = safeNext(str(fd, "next"));
  if (pending?.mode === "register") redirect("/cuenta/lista" + (next ? `?next=${encodeURIComponent(next)}` : ""));
  redirect(next ?? "/cuenta");
}

export async function resendAction(): Promise<ActionState> {
  const result = await (await auth()).resend();
  return result.ok ? { ok: true } : { error: result.error };
}

export async function cancelCodeAction() {
  await (await auth()).cancel();
  redirect("/cuenta");
}

export async function logoutAction() {
  await (await auth()).logout();
  await clearRole();
  redirect("/cuenta");
}

export async function saveProfileAction(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const name = str(fd, "name");
  const email = str(fd, "email");
  if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Ese correo no parece válido." };
  const result = await (await auth()).updateProfile({
    ...(name ? { name } : {}),
    email,
    description: str(fd, "description").slice(0, 1000),
  });
  return result.ok ? { ok: true } : { error: result.error };
}

/** Cambia el modo de la interfaz. `profiles.is_owner` no se toca aquí: se activa al publicar la primera casa (fase 2). */
export async function switchRoleAction(fd: FormData) {
  const role = str(fd, "role") === "owner" ? "owner" : "guest";
  await setRole(role);
  redirect(role === "owner" ? "/propietario" : "/explorar");
}
