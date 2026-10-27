// Botón de propietarios de la portada (revisión UX C1). La portada es HTML estático sin JS: el build sustituye el bloque
// marcado por el enlace a WhatsApp cuando hay número de atención a propietarios (`VITE_WA_OWNERS`); sin él se queda la
// frase «Abrimos pronto en el Caribe sur.», nunca un botón que no lleva a ningún sitio.
import { waUrl } from "./whatsapp";

export const OWNER_CTA_TEXT = "Hola, tengo una casa en el Caribe sur y quiero publicarla en bnbtico.";

const BLOCK = /<!--cta-propietarios-->[\s\S]*?<!--\/cta-propietarios-->/;

export function withOwnerCta(html: string, ownersNumber: string | undefined): string {
  if (!ownersNumber?.trim()) return html;
  const href = waUrl(ownersNumber, OWNER_CTA_TEXT).replace(/&/g, "&amp;");
  return html.replace(BLOCK, `<a class="soon-cta" href="${href}" rel="noopener">Quiero publicar mi casa gratis</a>`);
}
