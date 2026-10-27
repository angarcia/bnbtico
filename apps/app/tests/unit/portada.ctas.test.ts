import { describe, expect, it } from "vitest";
import { OWNER_CTA_TEXT, withOwnerCta } from "../../src/domain/portada";

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
});
