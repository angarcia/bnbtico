// «¿Es admin?» para los adaptadores del admin (admin.ts y admin-edit.ts). Solo decide qué mensaje ve la interfaz: la
// autorización la pone la base (RLS e is_admin() en aal2). Se pide en paralelo con los datos y una sola vez por token:
// la respuesta «admin» se recuerda mientras dure ese token (al confirmar el segundo código o renovarse, cambia y se
// vuelve a preguntar); «no» o «falta el código» no se recuerdan, para que marcar a alguien como admin surta efecto ya.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../domain/database.types";
import { DomainError, toDomainError } from "../../domain/errors";
import { aalOf } from "./auth";

export type AdminAccess = "admin" | "mfa" | "none";

const known = new WeakMap<object, { token: string; answer: Promise<AdminAccess> }>();

export async function adminAccess(db: SupabaseClient<Database>): Promise<AdminAccess> {
  const { data } = await db.auth.getSession();
  const s = data.session;
  if (!s) throw new DomainError("Su sesión venció. Ingrese de nuevo.", "session");
  const hit = known.get(db);
  if (hit?.token === s.access_token) return hit.answer;
  const answer = (async (): Promise<AdminAccess> => {
    const { data: me, error } = await db.from("profiles").select("is_admin").eq("id", s.user.id).maybeSingle();
    if (error) throw toDomainError(error);
    if (!me?.is_admin) return "none";
    return aalOf(s.access_token) === "aal2" ? "admin" : "mfa";
  })();
  const entry = { token: s.access_token, answer };
  known.set(db, entry); // las peticiones simultáneas comparten la misma pregunta
  const forget = () => {
    if (known.get(db) === entry) known.delete(db);
  };
  answer.then((a) => a !== "admin" && forget(), forget);
  return answer;
}
