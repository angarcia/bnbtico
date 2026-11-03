import { describe, expect, it } from "vitest";
import {
  INQUIRY_MESSAGES,
  composeInquiryMessage,
  costaRicaToday,
  formatInquiryDates,
  initials,
  inquirySummary,
  redraft,
  relativeTime,
  startDraft,
  validateInquiryDraft,
  waUrl,
  type OwnerInquiry,
} from "../../src/domain/inquiry";
import { waLink } from "../../src/client/support";

const TITLE = "Casa Manzanillo, a pie de playa";

describe("composeInquiryMessage (casos del prototipo, tests/prototype/contacto-hoja.cjs)", () => {
  it("sin datos", () => {
    expect(composeInquiryMessage(TITLE, {})).toBe("Hola, vi Casa Manzanillo, a pie de playa en bnbtico y me interesa. ¿Está disponible? Gracias.");
  });
  it("fechas del mismo mes y personas", () => {
    expect(composeInquiryMessage(TITLE, { arrival: "2026-12-20", departure: "2026-12-23", people: 4 })).toBe(
      "Hola, vi Casa Manzanillo, a pie de playa en bnbtico y me interesa. ¿Está disponible del 20 al 23 de diciembre para 4 personas? Gracias.",
    );
  });
  it("fechas que cruzan mes y año", () => {
    expect(composeInquiryMessage(TITLE, { arrival: "2026-12-28", departure: "2027-01-02" })).toBe(
      "Hola, vi Casa Manzanillo, a pie de playa en bnbtico y me interesa. ¿Está disponible del 28 de diciembre al 2 de enero? Gracias.",
    );
  });
  it("una persona, en singular", () => {
    expect(composeInquiryMessage(TITLE, { people: 1 })).toBe("Hola, vi Casa Manzanillo, a pie de playa en bnbtico y me interesa. ¿Está disponible para 1 persona? Gracias.");
  });
  it("fechas incompletas o al revés no entran en el mensaje", () => {
    const plain = composeInquiryMessage(TITLE, {});
    expect(composeInquiryMessage(TITLE, { arrival: "2026-12-20" })).toBe(plain);
    expect(composeInquiryMessage(TITLE, { arrival: "2026-12-20", departure: "2026-12-20" })).toBe(plain);
    expect(composeInquiryMessage(TITLE, { people: 0 })).toBe(plain);
  });
});

describe("composeInquiryMessage · alquiler mensual («desde el…»)", () => {
  it("con y sin personas", () => {
    expect(composeInquiryMessage("Casa Cocles", { monthlyFrom: "2026-12-01", people: 4 })).toBe(
      "Hola, vi Casa Cocles en bnbtico. Me interesa alquilar por meses desde el 1 de diciembre, para 4 personas. ¿Está disponible? Gracias.",
    );
    expect(composeInquiryMessage("Casa Cocles", { monthlyFrom: "2026-12-01" })).toBe(
      "Hola, vi Casa Cocles en bnbtico. Me interesa alquilar por meses desde el 1 de diciembre. ¿Está disponible? Gracias.",
    );
  });
  it("con llegada y salida válidas manda la frase por noches", () => {
    expect(composeInquiryMessage("Casa Cocles", { arrival: "2026-11-23", departure: "2026-11-27", people: 4, monthlyFrom: "2026-12-01" })).toBe(
      "Hola, vi Casa Cocles en bnbtico y me interesa. ¿Está disponible del 23 al 27 de noviembre para 4 personas? Gracias.",
    );
  });
  it("al poner llegada y salida en un borrador mensual, pasa a la frase por noches", () => {
    const s = redraft(startDraft("Casa Cocles", { monthlyFrom: "2026-12-01" }), { type: "fields", patch: { arrival: "2026-11-23", departure: "2026-11-27" } }, "Casa Cocles");
    expect(s.message).toBe("Hola, vi Casa Cocles en bnbtico y me interesa. ¿Está disponible del 23 al 27 de noviembre? Gracias.");
    expect(s.edited).toBe(false);
  });
});

describe("costaRicaToday", () => {
  it("la fecha de Costa Rica (UTC−6, sin horario de verano)", () => {
    expect(costaRicaToday(Date.parse("2026-10-24T05:59:00Z"))).toBe("2026-10-23");
    expect(costaRicaToday(Date.parse("2026-10-24T06:00:00Z"))).toBe("2026-10-24");
  });
});

describe("validateInquiryDraft", () => {
  const today = "2026-10-23";
  const ok = { arrival: null, departure: null, people: null, message: "Hola" };
  it("sin fechas ni personas es válido", () => {
    expect(validateInquiryDraft(ok, today)).toBeNull();
    expect(validateInquiryDraft({ ...ok, arrival: today, departure: "2026-10-24", people: 50 }, today)).toBeNull();
  });
  it("fechas: las dos o ninguna, salida después de la llegada, llegada desde hoy", () => {
    expect(validateInquiryDraft({ ...ok, arrival: today }, today)).toEqual({ field: "departure", message: INQUIRY_MESSAGES.bothDates });
    expect(validateInquiryDraft({ ...ok, departure: today }, today)).toEqual({ field: "arrival", message: INQUIRY_MESSAGES.bothDates });
    expect(validateInquiryDraft({ ...ok, arrival: "2026-10-25", departure: "2026-10-25" }, today)).toEqual({ field: "departure", message: INQUIRY_MESSAGES.departureAfter });
    expect(validateInquiryDraft({ ...ok, arrival: "2026-10-22", departure: "2026-10-25" }, today)).toEqual({ field: "arrival", message: INQUIRY_MESSAGES.arrivalPast });
    expect(validateInquiryDraft({ ...ok, arrival: "no", departure: "2026-10-25" }, today)?.message).toBe(INQUIRY_MESSAGES.badDate);
  });
  it("personas entre 1 y 50", () => {
    expect(validateInquiryDraft({ ...ok, people: 0 }, today)).toEqual({ field: "people", message: INQUIRY_MESSAGES.people });
    expect(validateInquiryDraft({ ...ok, people: 51 }, today)?.message).toBe(INQUIRY_MESSAGES.people);
    expect(validateInquiryDraft({ ...ok, people: 2.5 }, today)?.message).toBe(INQUIRY_MESSAGES.people);
  });
  it("mensaje no vacío y como mucho 1000 caracteres tras quitar espacios", () => {
    expect(validateInquiryDraft({ ...ok, message: "   " }, today)).toEqual({ field: "message", message: INQUIRY_MESSAGES.messageEmpty });
    expect(validateInquiryDraft({ ...ok, message: `  ${"a".repeat(1000)}  ` }, today)).toBeNull();
    expect(validateInquiryDraft({ ...ok, message: "a".repeat(1001) }, today)).toEqual({ field: "message", message: INQUIRY_MESSAGES.messageLong });
  });
});

describe("redraft: el mensaje sigue al redactado mientras no se edite a mano", () => {
  it("cambia con fechas y personas", () => {
    let s = startDraft(TITLE);
    expect(s.message).toBe(composeInquiryMessage(TITLE, {}));
    s = redraft(s, { type: "fields", patch: { arrival: "2026-12-20", departure: "2026-12-23" } }, TITLE);
    s = redraft(s, { type: "fields", patch: { people: 4 } }, TITLE);
    expect(s.message).toBe(composeInquiryMessage(TITLE, { arrival: "2026-12-20", departure: "2026-12-23", people: 4 }));
    expect(s.edited).toBe(false);
  });
  it("editado a mano, se queda aunque cambien las fechas", () => {
    let s = redraft(startDraft(TITLE), { type: "message", text: "Texto mío" }, TITLE);
    s = redraft(s, { type: "fields", patch: { people: 3 } }, TITLE);
    expect(s).toMatchObject({ message: "Texto mío", people: 3, edited: true });
  });
  it("si vuelve a dejar el texto redactado, lo sigue otra vez", () => {
    let s = redraft(startDraft(TITLE), { type: "message", text: "x" }, TITLE);
    s = redraft(s, { type: "message", text: composeInquiryMessage(TITLE, {}) }, TITLE);
    s = redraft(s, { type: "fields", patch: { people: 2 } }, TITLE);
    expect(s.message).toBe(composeInquiryMessage(TITLE, { people: 2 }));
  });
});

describe("formatInquiryDates", () => {
  it("mismo mes, meses distintos, sin fechas", () => {
    expect(formatInquiryDates("2026-12-20", "2026-12-27")).toBe("20–27 dic");
    expect(formatInquiryDates("2026-12-28", "2027-01-02")).toBe("28 dic – 2 ene");
    expect(formatInquiryDates("2026-10-30", "2026-11-02")).toBe("30 oct – 2 nov");
    expect(formatInquiryDates(null, null)).toBe("sin fechas");
  });
});

describe("relativeTime (reloj inyectado)", () => {
  const now = Date.parse("2026-10-23T18:00:00Z"); // 12:00 en Costa Rica
  it("minutos, horas, ayer y fecha corta", () => {
    expect(relativeTime("2026-10-23T17:59:40Z", now)).toBe("ahora");
    expect(relativeTime("2026-10-23T17:35:00Z", now)).toBe("hace 25 min");
    expect(relativeTime("2026-10-23T16:00:00Z", now)).toBe("hace 2 h");
    expect(relativeTime("2026-10-23T06:30:00Z", now)).toBe("hace 11 h");
    expect(relativeTime("2026-10-22T20:00:00Z", now)).toBe("ayer");
    expect(relativeTime("2026-10-12T15:00:00Z", now)).toBe("12 oct");
    expect(relativeTime("2025-12-31T15:00:00Z", now)).toBe("31 dic 2025");
  });
  it("«ayer» es el día anterior en Costa Rica, no 24 h", () => {
    const morning = Date.parse("2026-10-23T13:00:00Z"); // 7:00 CR
    expect(relativeTime("2026-10-23T05:00:00Z", morning)).toBe("ayer"); // 23:00 CR del 22
  });
});

describe("initials", () => {
  it("primera letra del primer y del último nombre", () => {
    expect(initials("Andrea Castro")).toBe("AC");
    expect(initials("  maría josé  álvarez ")).toBe("MÁ");
    expect(initials("Yorleny")).toBe("Y");
    expect(initials("")).toBe("?");
  });
});

describe("waUrl", () => {
  it("solo dígitos y el texto codificado", () => {
    expect(waUrl("+506 8777 0001", "Hola, ¿está disponible?")).toBe("https://wa.me/50687770001?text=Hola%2C%20%C2%BFest%C3%A1%20disponible%3F");
  });
  it("sin texto, el chat a secas", () => {
    expect(waUrl("+50688881234")).toBe("https://wa.me/50688881234");
  });
  it("waLink de soporte la reutiliza sin cambiar lo que hacía", () => {
    expect(waLink("+506 6000-0000", "Hola: ")).toBe("https://wa.me/50660000000?text=Hola%3A%20");
    expect(waLink("", "x")).toBe("https://wa.me/?text=x");
  });
});

const inquiry = (o: Partial<OwnerInquiry>): OwnerInquiry => ({
  id: "i",
  listingId: "l",
  publicId: "CT-1001",
  listingTitle: "Casa Cocles",
  clientName: "Ana Prueba",
  clientPhone: "+50688881234",
  arrival: null,
  departure: null,
  people: null,
  message: "Hola",
  createdAt: "2026-10-23T12:00:00Z",
  updatedAt: "2026-10-23T12:00:00Z",
  openedAt: null,
  source: "listing",
  ...o,
});

describe("inquirySummary: fechas · personas", () => {
  it("con fechas y personas, sin fechas, una persona, sin personas", () => {
    expect(inquirySummary(inquiry({ arrival: "2026-12-20", departure: "2026-12-27", people: 4 }))).toBe("20–27 dic · 4 personas");
    expect(inquirySummary(inquiry({ people: 2 }))).toBe("sin fechas · 2 personas");
    expect(inquirySummary(inquiry({ people: 1 }))).toBe("sin fechas · 1 persona");
    expect(inquirySummary(inquiry({}))).toBe("sin fechas");
  });
});
