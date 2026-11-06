import { describe, expect, it, vi } from "vitest";
import { DATES_FILTER_KEY, contactDraftKey, contactNext, isContactNext, listingInNext, readSearchDates, searchDatesValue, shouldReopenContact, signInToContact } from "../../src/domain/contact-return";
import { memoryStore } from "../../src/data/storage";
import { proceedToWhatsApp } from "../../src/shared/contact-flow";
import { INQUIRY_MESSAGES, type InquiryDraft } from "../../src/domain/inquiry";
import { DomainError } from "../../src/domain/errors";

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
  const draft: InquiryDraft = { arrival: "2026-12-20", departure: "2026-12-27", people: 2, message: "Hola, ¿tienen parqueo? Gracias & saludos" };
  const signedIn = () => true;
  const contact = { publicId: "CT-1042", draft };

  it("sin sesión: va a Ingresar con la vuelta a la hoja y deja la página, sin registrar nada", async () => {
    const navigate = vi.fn();
    const create = vi.fn();
    const outcome = await proceedToWhatsApp({ ...contact, navigate, hasSession: () => false, create });
    expect(outcome).toEqual({ kind: "leaving" });
    expect(navigate).toHaveBeenCalledExactlyOnceWith("/cuenta?next=%2Fcasa%2FCT-1042%3Fcontacto%3D1");
    expect(create).not.toHaveBeenCalled();
  });

  it("sin sesión guardada en el dispositivo lo sabe sin cargar supabase-js", async () => {
    const navigate = vi.fn();
    expect(await proceedToWhatsApp({ ...contact, navigate })).toEqual({ kind: "leaving" });
    expect(navigate).toHaveBeenCalledOnce();
  });

  it("con sesión: guarda el texto de la consulta y abre wa.me con el enlace de la ficha en la primera línea", async () => {
    const navigate = vi.fn();
    const open = vi.fn();
    const created = vi.fn();
    const create = vi.fn(async () => ({ inquiryId: "i1", whatsappPhone: "+506 6000-1234" }));
    const outcome = await proceedToWhatsApp({ ...contact, origin: "https://bnbtico.com", navigate, hasSession: signedIn, create, open, created });
    expect(outcome).toEqual({ kind: "sent" });
    expect(create).toHaveBeenCalledExactlyOnceWith("CT-1042", draft);
    expect(open).toHaveBeenCalledExactlyOnceWith(`https://wa.me/50660001234?text=${encodeURIComponent(`https://bnbtico.com/casa/CT-1042\n\n${draft.message}`)}`);
    expect(created).toHaveBeenCalledExactlyOnceWith("CT-1042");
    expect(navigate).not.toHaveBeenCalled();
  });

  it("si la base dice que no: su mensaje, y nada se abre", async () => {
    const open = vi.fn();
    const created = vi.fn();
    const create = vi.fn(async () => {
      throw new DomainError(INQUIRY_MESSAGES.ownHouse, "validation");
    });
    expect(await proceedToWhatsApp({ ...contact, navigate: vi.fn(), hasSession: signedIn, create, open, created })).toEqual({
      kind: "error",
      message: "Esta es su propia casa.",
    });
    expect(open).not.toHaveBeenCalled();
    expect(created).not.toHaveBeenCalled();
  });

  it("sin red (o sin poder bajar el trozo de datos): «Sin conexión…»", async () => {
    const create = vi.fn(async () => {
      throw new TypeError("Failed to fetch dynamically imported module");
    });
    expect(await proceedToWhatsApp({ ...contact, navigate: vi.fn(), hasSession: signedIn, create, open: vi.fn() })).toEqual({
      kind: "error",
      message: "Sin conexión. Revise su internet e intente de nuevo.",
    });
  });

  it("sesión vencida o revocada (la base pide ingresar): a Ingresar con la vuelta a la hoja", async () => {
    for (const err of [new DomainError(INQUIRY_MESSAGES.signIn, "validation"), new DomainError("Su sesión venció. Ingrese de nuevo.", "session")]) {
      const navigate = vi.fn();
      const open = vi.fn();
      const outcome = await proceedToWhatsApp({ ...contact, navigate, hasSession: signedIn, open, create: async () => Promise.reject(err) });
      expect(outcome).toEqual({ kind: "leaving" });
      expect(navigate).toHaveBeenCalledExactlyOnceWith("/cuenta?next=%2Fcasa%2FCT-1042%3Fcontacto%3D1");
      expect(open).not.toHaveBeenCalled();
    }
  });
});

// Revisión UX C2: la verificación se lee como «Escribirle a <nombre>» solo cuando se viene de la hoja de contacto.
describe("¿se viene de la hoja de contacto?", () => {
  it("solo la ficha con contacto=1", () => {
    expect(isContactNext(contactNext("CT-1042"))).toBe(true);
    expect(isContactNext("/casa/CT-1042")).toBe(false);
    expect(isContactNext("/casa/CT-1042?contacto=0")).toBe(false);
    expect(isContactNext("/propietario")).toBe(false);
    expect(isContactNext(undefined)).toBe(false);
    expect(isContactNext("https://otro.com/casa/CT-1042?contacto=1")).toBe(false);
  });
});

describe("fechas de la búsqueda de Explorar en la pestaña (la hoja de contacto arranca con ellas)", () => {
  const T = "2026-11-01";
  it("clave", () => {
    expect(DATES_FILTER_KEY).toBe("bnbtico-fechas");
  });
  it("lee llegada y salida", () => {
    expect(readSearchDates('{"llegada":"2026-11-23","salida":"2026-11-27"}', T)).toEqual({ arrival: "2026-11-23", departure: "2026-11-27" });
    expect(readSearchDates('{"llegada":"2026-11-01","salida":"2026-12-15"}', T)).toEqual({ arrival: "2026-11-01", departure: "2026-12-15" });
  });
  it("descarta lo pasado, lo vacío, lo roto y lo incompleto", () => {
    for (const raw of [
      '{"llegada":"2026-10-30","salida":"2026-11-02"}',
      '{"llegada":"2026-11-23","salida":"2026-11-23"}',
      '{"desde":"2026-12-01"}', // lo que guardaba el modo mensual (fin el 2026-11-02): la hoja arranca sin fechas
      "no-json",
      null,
      '{"llegada":"2026-11-23"}',
      '{"llegada":"2026-11-23","salida":"2026-11-31"}',
      '{"llegada":"2026-11-23","salida":"2026-11-27","desde":"2026-12-01"}',
      '{"desde":12}',
      "null",
      "[]",
    ])
      expect(readSearchDates(raw, T)).toBeNull();
  });
  it("lo que guarda Explorar: llegada y salida; sin fechas, nada", () => {
    expect(searchDatesValue({ from: "2026-11-23", to: "2026-11-27" })).toBe('{"llegada":"2026-11-23","salida":"2026-11-27"}');
    expect(searchDatesValue(null)).toBeNull();
  });
});
