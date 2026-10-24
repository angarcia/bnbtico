// Lo que hace «Abrir WhatsApp» con un borrador ya validado y guardado en la pestaña. Va en el trozo diferido de la hoja.
// - Sin sesión (ticket 03): a Ingresar / Crear cuenta con `next=/casa/CT-####?contacto=1` (navegación completa en la ficha
//   del servidor, del router en la SPA: `ctx.navigate`); tras el código la ficha de la SPA reabre la hoja con lo escrito.
// - Con sesión (ticket 04): `InquiriesApi.create` registra la consulta y es lo único que entrega el número de la casa; con él,
//   `location.assign(wa.me)` en la misma pestaña (una ventana abierta tras una espera la bloquea el iPhone). El número no se
//   guarda en ningún sitio: ni caché, ni pestaña, ni balizas. Si la base dice que no, su mensaje en la hoja y nada se abre;
//   si pide ingresar (sesión vencida o revocada), a Ingresar como sin sesión.
import { signInToContact } from "../domain/contact-return";
import { INQUIRY_MESSAGES, type InquiryDraft } from "../domain/inquiry";
import { waUrl } from "../domain/whatsapp";
import { hasStoredSession } from "../data/storage";
import { track } from "./beacon";

export type ContactOutcome = { kind: "sent" } | { kind: "error"; message: string } | { kind: "leaving" };

const OFFLINE = "Sin conexión. Revise su internet e intente de nuevo.";

export interface ContactContext {
  publicId: string;
  draft: InquiryDraft;
  /** Ir a otra ruta de la app: en la SPA, el router; en la ficha del servidor, navegación completa. */
  navigate: (href: string) => void;
  /** ¿Hay sesión guardada? Sin ella se sabe sin descargar supabase-js. Inyectable en pruebas, como lo que sigue. */
  hasSession?: () => boolean;
  /** Registra la consulta y devuelve el WhatsApp de la casa. Por defecto, `InquiriesApi` de supabase-js (trozo diferido). */
  create?: (publicId: string, draft: InquiryDraft) => Promise<{ whatsappPhone: string }>;
  /** Abre WhatsApp. Por defecto, `location.assign`. */
  open?: (url: string) => void;
  /** Consulta registrada: baliza `inquiry_created`, solo con la casa. */
  created?: (publicId: string) => void;
}

const createInquiry = async (publicId: string, draft: InquiryDraft) => (await import("../client/supabase-data")).inquiriesApi().create(publicId, draft);

export async function proceedToWhatsApp(ctx: ContactContext): Promise<ContactOutcome> {
  const { publicId, draft } = ctx;
  if (!(ctx.hasSession ?? hasStoredSession)()) {
    ctx.navigate(signInToContact(publicId));
    return { kind: "leaving" };
  }
  let phone: string;
  try {
    phone = (await (ctx.create ?? createInquiry)(publicId, draft)).whatsappPhone;
  } catch (e) {
    // Los errores del adaptador son DomainError (`kind`); cualquier otro es no haber podido bajar el trozo o llegar a la base.
    const kind = e instanceof Error && "kind" in e ? e.kind : null;
    if (kind === "session" || (e instanceof Error && e.message === INQUIRY_MESSAGES.signIn)) {
      ctx.navigate(signInToContact(publicId));
      return { kind: "leaving" };
    }
    return { kind: "error", message: kind && e instanceof Error ? e.message : OFFLINE };
  }
  (ctx.created ?? ((id: string) => track("inquiry_created", id)))(publicId);
  (ctx.open ?? ((url: string) => location.assign(url)))(waUrl(phone, draft.message));
  return { kind: "sent" };
}
