import { describe, expect, it } from "vitest";
import { longDate, reopenLabel } from "../../src/domain/dates";
import {
  CONTACT_DRAFT_TTL_MS,
  composeInquiryMessage,
  contactDraftKey,
  firstName,
  parsePeople,
  redraft,
  restoreContactDraft,
  startDraft,
  storeContactDraft,
} from "../../src/domain/inquiry";

const TITLE = "Casa Manzanillo";
const NOW = Date.parse("2026-10-23T15:00:00Z");

describe("borrador de la hoja guardado en la pestaña (30 min)", () => {
  it("clave por casa", () => {
    expect(contactDraftKey("CT-1015")).toBe("bnbtico-contacto:CT-1015");
  });

  it("guarda fechas, personas, mensaje, si se editó y si la hoja estaba abierta", () => {
    const s = redraft(startDraft(TITLE), { type: "fields", patch: { arrival: "2026-12-20", departure: "2026-12-27", people: 4 } }, TITLE);
    expect(JSON.parse(storeContactDraft(s, true, NOW))).toEqual({
      arrival: "2026-12-20",
      departure: "2026-12-27",
      people: 4,
      message: composeInquiryMessage(TITLE, { arrival: "2026-12-20", departure: "2026-12-27", people: 4 }),
      edited: false,
      open: true,
      savedAt: NOW,
    });
  });

  it("vuelve igual y, sin editar, el mensaje sigue a las fechas", () => {
    const s = redraft(startDraft(TITLE), { type: "fields", patch: { people: 2 } }, TITLE);
    const back = restoreContactDraft(storeContactDraft(s, false, NOW), TITLE, NOW + 60_000)!;
    expect(back.open).toBe(false);
    expect(back.state).toEqual(s);
    const next = redraft(back.state, { type: "fields", patch: { people: 3 } }, TITLE);
    expect(next.message).toBe(composeInquiryMessage(TITLE, { people: 3 }));
  });

  it("el texto editado a mano se queda tras recargar, aunque luego cambien las fechas", () => {
    const s = redraft(startDraft(TITLE), { type: "message", text: "Hola, ¿aceptan perros?" }, TITLE);
    const back = restoreContactDraft(storeContactDraft(s, true, NOW), TITLE, NOW)!;
    expect(back.state).toMatchObject({ message: "Hola, ¿aceptan perros?", edited: true });
    expect(redraft(back.state, { type: "fields", patch: { people: 5 } }, TITLE).message).toBe("Hola, ¿aceptan perros?");
  });

  it("caduca a los 30 minutos y descarta lo que no entiende", () => {
    const raw = storeContactDraft(startDraft(TITLE), true, NOW);
    expect(restoreContactDraft(raw, TITLE, NOW + CONTACT_DRAFT_TTL_MS - 1)).not.toBeNull();
    expect(restoreContactDraft(raw, TITLE, NOW + CONTACT_DRAFT_TTL_MS + 1)).toBeNull();
    expect(restoreContactDraft(null, TITLE, NOW)).toBeNull();
    expect(restoreContactDraft("{", TITLE, NOW)).toBeNull();
    expect(restoreContactDraft(JSON.stringify({ message: 3, savedAt: NOW }), TITLE, NOW)).toBeNull();
    expect(restoreContactDraft(JSON.stringify({ arrival: 5, departure: null, people: null, message: "x", edited: true, open: false, savedAt: NOW }), TITLE, NOW)).toBeNull();
  });
});

describe("campos de la hoja", () => {
  it("personas: vacío es null; lo demás se valida con validateInquiryDraft", () => {
    expect(parsePeople("")).toBeNull();
    expect(parsePeople(" 4 ")).toBe(4);
    expect(parsePeople("0")).toBe(0);
    expect(parsePeople("2.5")).toBe(2.5);
  });
  it("nombre de pila del propietario", () => {
    expect(firstName("Daniel Aguado Muñoz")).toBe("Daniel");
    expect(firstName("  Yorleny ")).toBe("Yorleny");
    expect(firstName("")).toBe("el propietario");
  });
});

describe("fecha de reapertura", () => {
  it("día y mes en palabras, sin depender de la zona horaria", () => {
    expect(longDate("2026-11-15")).toBe("15 de noviembre");
    expect(longDate("2027-01-02")).toBe("2 de enero");
    expect(reopenLabel("2026-12-01")).toBe("Vuelve a estar disponible el 1 de diciembre");
    expect(reopenLabel(null)).toBeNull();
    expect(reopenLabel("mañana")).toBeNull();
  });
});
