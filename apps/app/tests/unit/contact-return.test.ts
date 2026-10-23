import { describe, expect, it, vi } from "vitest";
import { contactDraftKey, contactNext, listingInNext, shouldReopenContact, signInToContact } from "../../src/domain/contact-return";
import { memoryStore } from "../../src/data/storage";
import { proceedToWhatsApp } from "../../src/shared/contact-flow";
import type { InquiryDraft } from "../../src/domain/inquiry";

describe("vuelta a la hoja de contacto tras ingresar", () => {
  it("la ficha con la hoja abierta y el enlace a Ingresar que vuelve a ella (pasando por safeNext)", () => {
    expect(contactNext("CT-1042")).toBe("/casa/CT-1042?contacto=1");
    expect(signInToContact("CT-1042")).toBe("/cuenta?next=%2Fcasa%2FCT-1042%3Fcontacto%3D1");
    expect(contactDraftKey("CT-1042")).toBe("bnbtico-contacto:CT-1042");
  });

  it("reconoce una ficha en `next`; nada más", () => {
    expect(listingInNext("/casa/CT-1042?contacto=1")).toBe("CT-1042");
    expect(listingInNext("/casa/CT-1042")).toBe("CT-1042");
    for (const other of ["/propietario/casas", "/casa/abc", "/casa/CT-12", "//casa/CT-1042", "https://x.com/casa/CT-1042", "", null, undefined])
      expect(listingInNext(other)).toBeNull();
  });

  it("reabre la hoja solo con `contacto=1` y un borrador guardado (aunque haya caducado: la hoja empieza de cero)", () => {
    const store = memoryStore();
    expect(shouldReopenContact("1", store, "CT-1042")).toBe(false);
    store.setItem(contactDraftKey("CT-1042"), JSON.stringify({ savedAt: 0 }));
    expect(shouldReopenContact("1", store, "CT-1042")).toBe(true);
    expect(shouldReopenContact(undefined, store, "CT-1042")).toBe(false);
    expect(shouldReopenContact("1", store, "CT-1043")).toBe(false);
  });
});

describe("«Abrir WhatsApp» con un borrador válido", () => {
  const draft: InquiryDraft = { arrival: null, departure: null, people: 2, message: "Hola" };

  it("sin sesión: va a Ingresar con la vuelta a la hoja y deja la página", async () => {
    const navigate = vi.fn();
    const outcome = await proceedToWhatsApp({ publicId: "CT-1042", draft, navigate, signedIn: async () => false });
    expect(outcome).toEqual({ kind: "leaving" });
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/cuenta?next=%2Fcasa%2FCT-1042%3Fcontacto%3D1");
  });

  it("sin sesión guardada en el dispositivo lo sabe sin cargar supabase-js", async () => {
    const navigate = vi.fn();
    expect(await proceedToWhatsApp({ publicId: "CT-1042", draft, navigate })).toEqual({ kind: "leaving" });
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("con sesión: sigue «muy pronto» hasta el ticket 04, sin navegar", async () => {
    const navigate = vi.fn();
    expect(await proceedToWhatsApp({ publicId: "CT-1042", draft, navigate, signedIn: async () => true })).toEqual({ kind: "soon" });
    expect(navigate).not.toHaveBeenCalled();
  });
});
