import { describe, expect, it } from "vitest";
import { OWNER_CTA_TEXT, WIZARD_CTA, ownerCtaTarget, withOwnerCta, withWizardCta } from "../../src/domain/portada";

// Revisión UX C1: el botón de propietarios de la portada solo existe cuando hay número de WhatsApp de bnbtico.
const HTML = `<p>antes</p><!--cta-propietarios--><p class="soon-later">Abrimos pronto en el Caribe sur.</p><!--/cta-propietarios--><p>después</p>`;

describe("botón de propietarios de la portada", () => {
  it("sin número se queda la frase de «abrimos pronto», sin botón muerto", () => {
    expect(withOwnerCta(HTML, undefined)).toBe(HTML);
    expect(withOwnerCta(HTML, "  ")).toBe(HTML);
  });
  it("con número, un enlace a WhatsApp con el mensaje redactado en vez de la frase", () => {
    const out = withOwnerCta(HTML, "+506 6000 0000");
    expect(out).toContain(`href="https://wa.me/50660000000?text=${encodeURIComponent(OWNER_CTA_TEXT)}"`);
    expect(out).toContain(">Quiero publicar mi casa gratis</a>");
    expect(out).not.toContain("Abrimos pronto");
    expect(out.startsWith("<p>antes</p>") && out.endsWith("<p>después</p>")).toBe(true);
  });
  it("el botón de WhatsApp conserva los marcadores del bloque", () => {
    const out = withOwnerCta(HTML, "+506 6000 0000");
    expect(out).toContain("<!--cta-propietarios--><a ");
    expect(out).toContain("</a><!--/cta-propietarios-->");
  });
  it("el destino del botón sigue al lanzamiento: WhatsApp antes, asistente después", () => {
    expect(ownerCtaTarget({ landingOnly: true })).toBe("whatsapp");
    expect(ownerCtaTarget({ landingOnly: false })).toBe("wizard");
  });
  it("withWizardCta pone el enlace a /publicar en vez de la frase, sin tocar lo de alrededor", () => {
    const out = withWizardCta(HTML);
    expect(out).toContain(WIZARD_CTA);
    expect(WIZARD_CTA).toBe('<a class="soon-cta" href="/publicar">Publicar mi casa</a>');
    expect(out).not.toContain("Abrimos pronto");
    expect(out.startsWith("<p>antes</p>") && out.endsWith("<p>después</p>")).toBe(true);
  });
  it("con VITE_WA_OWNERS ya aplicado en el build, el worker aún puede cambiarlo por el asistente", () => {
    const out = withWizardCta(withOwnerCta(HTML, "+506 6000 0000"));
    expect(out).toContain('href="/publicar"');
    expect(out).not.toContain("wa.me");
  });
});
