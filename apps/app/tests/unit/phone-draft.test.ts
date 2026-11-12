import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { localPort } from "../../src/client/publish/local-port";
import { clearPhoneDraft, readFullPhoneDraft, readPhoneDraft, writePhoneDraft } from "../../src/client/publish/phone-draft";
import { memoryStore, type KeyValueStore } from "../../src/data/storage";
import { emptyDraft } from "../../src/domain/listing";
import { PUBLISH_DRAFT_KEY, PUBLISH_STEP1_KEY, PUBLISH_STEP1_TTL_MS, storeLocalDraft, storeStep1 } from "../../src/domain/publish-return";

const NOW = 1_730_000_000_000;
const draft = { ...emptyDraft(), kind: "completo" as const, title: "Casa Cocles", province: "Limón", features: ["wifi" as const] };
let storage: KeyValueStore;

beforeEach(() => {
  storage = memoryStore();
  vi.stubGlobal("localStorage", storage);
  vi.spyOn(Date, "now").mockReturnValue(NOW);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("acceso al borrador del teléfono", () => {
  it("sin datos no inventa un borrador", () => {
    expect(readPhoneDraft()).toBeNull();
  });

  it("conserva las claves, el formato y lo escrito al volver a leer", () => {
    storage.setItem(PUBLISH_STEP1_KEY, storeStep1("habitacion", NOW));
    storage.setItem("otra-clave", "conservar");
    writePhoneDraft(draft);
    expect(PUBLISH_DRAFT_KEY).toBe("3bstays-publicar-borrador");
    expect(PUBLISH_STEP1_KEY).toBe("3bstays-publicar-paso1");
    expect(storage.getItem(PUBLISH_DRAFT_KEY)).toBe(storeLocalDraft(draft, NOW));
    expect(storage.getItem(PUBLISH_STEP1_KEY)).toBeNull();
    expect(storage.getItem("otra-clave")).toBe("conservar");
    expect(readPhoneDraft()).toEqual(draft);
  });

  it("el formato anterior se lee sin migrarlo y el entero tiene prioridad", () => {
    const legacy = storeStep1("habitacion", NOW);
    storage.setItem(PUBLISH_STEP1_KEY, legacy);
    expect(readPhoneDraft()).toEqual({ ...emptyDraft(), kind: "habitacion", bedrooms: 1, bathrooms: 1 });
    expect(storage.getItem(PUBLISH_STEP1_KEY)).toBe(legacy);
    expect(storage.getItem(PUBLISH_DRAFT_KEY)).toBeNull();
    storage.setItem(PUBLISH_DRAFT_KEY, storeLocalDraft(draft, NOW));
    expect(readPhoneDraft()).toEqual(draft);
    expect(storage.getItem(PUBLISH_STEP1_KEY)).toBe(legacy);
  });

  it("distingue el entero del anterior para continuar en Fotos o en el paso 2", () => {
    storage.setItem(PUBLISH_STEP1_KEY, storeStep1("completo", NOW));
    expect(readFullPhoneDraft()).toBeNull();
    storage.setItem(PUBLISH_DRAFT_KEY, storeLocalDraft(draft, NOW));
    expect(readFullPhoneDraft()).toEqual(draft);
    expect(readFullPhoneDraft(NOW + PUBLISH_STEP1_TTL_MS + 1)).toBeNull();
    expect(readPhoneDraft(NOW)).toEqual(draft);
  });

  it("un entero ilegible deja usar el anterior sin borrar ninguno", () => {
    storage.setItem(PUBLISH_DRAFT_KEY, "{roto");
    storage.setItem(PUBLISH_STEP1_KEY, storeStep1("completo", NOW));
    expect(readPhoneDraft()).toEqual({ ...emptyDraft(), kind: "completo" });
    expect(storage.getItem(PUBLISH_DRAFT_KEY)).toBe("{roto");
    expect(storage.getItem(PUBLISH_STEP1_KEY)).toBe(storeStep1("completo", NOW));
  });

  it.each([
    [PUBLISH_DRAFT_KEY, storeLocalDraft(draft, NOW)],
    [PUBLISH_STEP1_KEY, storeStep1("completo", NOW)],
  ])("respeta los siete días y el futuro sin eliminar %s", (key, raw) => {
    storage.setItem(key, raw);
    expect(readPhoneDraft(NOW - 1)).toBeNull();
    expect(readPhoneDraft(NOW + PUBLISH_STEP1_TTL_MS)).not.toBeNull();
    expect(readPhoneDraft(NOW + PUBLISH_STEP1_TTL_MS + 1)).toBeNull();
    expect(storage.getItem(key)).toBe(raw);
  });

  it("limpiar elimina solo las dos claves del borrador", () => {
    storage.setItem(PUBLISH_DRAFT_KEY, storeLocalDraft(draft, NOW));
    storage.setItem(PUBLISH_STEP1_KEY, storeStep1("completo", NOW));
    storage.setItem("otra-clave", "conservar");
    clearPhoneDraft();
    expect(readPhoneDraft()).toBeNull();
    expect(storage.getItem(PUBLISH_DRAFT_KEY)).toBeNull();
    expect(storage.getItem(PUBLISH_STEP1_KEY)).toBeNull();
    expect(storage.getItem("otra-clave")).toBe("conservar");
  });

  it("si falla la escritura propaga el error y conserva ambos formatos", () => {
    const previous = storeLocalDraft(draft, NOW);
    const legacy = storeStep1("habitacion", NOW);
    storage.setItem(PUBLISH_DRAFT_KEY, previous);
    storage.setItem(PUBLISH_STEP1_KEY, legacy);
    const failure = new Error("quota");
    vi.spyOn(storage, "setItem").mockImplementation(() => { throw failure; });
    const remove = vi.spyOn(storage, "removeItem");
    expect(() => writePhoneDraft({ ...draft, title: "Otro nombre" })).toThrow(failure);
    expect(remove).not.toHaveBeenCalled();
    expect(storage.getItem(PUBLISH_DRAFT_KEY)).toBe(previous);
    expect(storage.getItem(PUBLISH_STEP1_KEY)).toBe(legacy);
  });

  it("no oculta un error de lectura", () => {
    const failure = new Error("blocked");
    vi.spyOn(storage, "getItem").mockImplementation(() => { throw failure; });
    expect(() => readPhoneDraft()).toThrow(failure);
  });

  it("si falla quitar el anterior, la escritura entera ya permanece guardada", () => {
    storage.setItem(PUBLISH_STEP1_KEY, storeStep1("habitacion", NOW));
    const failure = new Error("blocked");
    vi.spyOn(storage, "removeItem").mockImplementation(() => { throw failure; });
    expect(() => writePhoneDraft(draft)).toThrow(failure);
    expect(storage.getItem(PUBLISH_DRAFT_KEY)).toBe(storeLocalDraft(draft, NOW));
    expect(storage.getItem(PUBLISH_STEP1_KEY)).toBe(storeStep1("habitacion", NOW));
  });

  it("el puerto lee el mismo borrador y guarda el siguiente paso sin perder el resto", async () => {
    writePhoneDraft(draft);
    const listings = await localPort.listings();
    const before = await listings.getOwn("nueva");
    expect(before).toMatchObject(draft);
    await listings.saveStep("nueva", 5, { title: "Casa nueva" }, before!);
    expect(readPhoneDraft()).toEqual({ ...draft, title: "Casa nueva" });
  });

  it("un paso rechazado no toca lo persistido", async () => {
    writePhoneDraft(draft);
    const raw = storage.getItem(PUBLISH_DRAFT_KEY);
    const listings = await localPort.listings();
    await expect(listings.saveStep("otra", 1, { kind: "habitacion" })).rejects.toThrow("No encontramos ese anuncio.");
    expect(storage.getItem(PUBLISH_DRAFT_KEY)).toBe(raw);
  });
});
