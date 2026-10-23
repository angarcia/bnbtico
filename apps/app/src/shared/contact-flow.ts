// Lo que hace «Abrir WhatsApp» con un borrador ya validado y guardado en la pestaña. Va en el trozo diferido de la hoja.
// Cada paso de la fase 3 entra aquí sin tocar la hoja:
// - ticket 03 (cuenta obligatoria): sin sesión, `{ kind: "leaving" }` tras navegar a `/cuenta?next=/casa/CT-####?contacto=1`
//   (navegación completa en la ficha del servidor, del router en la SPA: `ctx.navigate`);
// - ticket 04 (registrar y abrir): con sesión, InquiriesApi.create y `location.assign(waUrl(número, mensaje))` →
//   `{ kind: "leaving" }`; si la base dice que no, `{ kind: "error", message }`.
// Mientras tanto, «Disponible muy pronto» en la hoja: nunca un botón muerto.
import type { InquiryDraft } from "../domain/inquiry";

export type ContactOutcome = { kind: "soon" } | { kind: "error"; message: string } | { kind: "leaving" };

export interface ContactContext {
  publicId: string;
  draft: InquiryDraft;
  /** Ir a otra ruta de la app (ticket 03): en la SPA, el router; en la ficha del servidor, navegación completa. */
  navigate: (href: string) => void;
}

export async function proceedToWhatsApp(_ctx: ContactContext): Promise<ContactOutcome> {
  return { kind: "soon" };
}
