// Lo que hace «Abrir WhatsApp» con un borrador ya validado y guardado en la pestaña. Va en el trozo diferido de la hoja.
// - Sin sesión (ticket 03): a Ingresar / Crear cuenta con `next=/casa/CT-####?contacto=1` (navegación completa en la ficha
//   del servidor, del router en la SPA: `ctx.navigate`); tras el código la ficha de la SPA reabre la hoja con lo escrito.
// - Con sesión (ticket 04): InquiriesApi.create y `location.assign(waUrl(número, mensaje))` → `{ kind: "leaving" }`; si la
//   base dice que no, `{ kind: "error", message }`. Hasta entonces, «Disponible muy pronto» en la hoja: nunca un botón muerto.
import { signInToContact } from "../domain/contact-return";
import type { InquiryDraft } from "../domain/inquiry";
import { hasStoredSession } from "../data/storage";

export type ContactOutcome = { kind: "soon" } | { kind: "error"; message: string } | { kind: "leaving" };

export interface ContactContext {
  publicId: string;
  draft: InquiryDraft;
  /** Ir a otra ruta de la app: en la SPA, el router; en la ficha del servidor, navegación completa. */
  navigate: (href: string) => void;
  /** ¿Hay sesión? Por defecto, como `client/session.ts`: sin sesión guardada se sabe sin descargar supabase-js. Inyectable en pruebas. */
  signedIn?: () => Promise<boolean>;
}

/** Sin sesión guardada responde al momento; con una, la lee supabase-js (el mismo cliente que usa la cuenta en la SPA, y
 *  el que necesitará el ticket 04 para registrar la consulta), que la refresca si caducó. */
async function storedSessionIsValid(): Promise<boolean> {
  if (!hasStoredSession()) return false;
  return !!(await (await import("../client/supabase-data")).authApi().session());
}

export async function proceedToWhatsApp(ctx: ContactContext): Promise<ContactOutcome> {
  if (!(await (ctx.signedIn ?? storedSessionIsValid)())) {
    ctx.navigate(signInToContact(ctx.publicId));
    return { kind: "leaving" };
  }
  return { kind: "soon" };
}
