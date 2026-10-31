import { describe, expect, it } from "vitest";
import { emptyDraft, type Listing } from "../../src/domain/listing";
import { EDIT_MESSAGES } from "../../src/domain/edit-messages";
import { NO_PHOTOS_NOTE, REVIEW_MESSAGES, applyDecision, editNoteRefusal, queueBadge, reviewNoteRefusal, splitQueue, type QueueItem } from "../../src/domain/review";

const item = (id: string, patch: Partial<Listing>): QueueItem => ({
  ownerName: "Ana",
  listing: { ...emptyDraft(), id, publicId: `CT-${id}`, ownerId: "o", status: "review", available: true, reopenAt: null, reviewNote: null, reviewedAt: null, firstPublishedAt: null, edit: null, adminHold: null, whatsappPhone: "", createdAt: "2026-10-01", updatedAt: "2026-10-01", photos: [], ...patch },
});

describe("revisión del admin", () => {
  it("mensajes de las fotos al aprobar", () => {
    expect(REVIEW_MESSAGES.fewPhotos).toBe("Para aprobarla hace falta al menos una foto.");
    expect(NO_PHOTOS_NOTE).toBe("Para publicarla necesitamos al menos una foto de la casa.");
  });

  it("motivo: obligatorio para pedir cambios o rechazar, como mucho 2000 caracteres", () => {
    expect(reviewNoteRefusal("approve", "")).toBeNull();
    expect(reviewNoteRefusal("changes", "  ")).toBe(REVIEW_MESSAGES.noteRequired);
    expect(reviewNoteRefusal("reject", "No.")).toBeNull();
    expect(reviewNoteRefusal("reject", "x".repeat(2000))).toBeNull();
    expect(reviewNoteRefusal("approve", "x".repeat(2001))).toBe(REVIEW_MESSAGES.noteTooLong);
  });

  it("nota de una edición: obligatoria para pedir cambios, sin hablar de rechazar (no hay «Rechazar» en las ediciones)", () => {
    expect(EDIT_MESSAGES.noteRequired).toBe("Escriba una nota para pedir cambios.");
    expect(editNoteRefusal("changes", "  ")).toBe(EDIT_MESSAGES.noteRequired);
    expect(editNoteRefusal("approve", "")).toBeNull();
    expect(editNoteRefusal("changes", "Cambie la foto 2.")).toBeNull();
    expect(editNoteRefusal("changes", "x".repeat(2001))).toBe(REVIEW_MESSAGES.noteTooLong);
  });

  it("separa la cola y ordena por antigüedad", () => {
    const q = splitQueue(
      [
        item("b", { updatedAt: "2026-10-03" }),
        item("a", { updatedAt: "2026-10-02" }),
        item("c", { status: "changes", reviewedAt: "2026-10-01" }),
        item("d", { status: "changes", reviewedAt: "2026-10-05" }),
        item("e", { status: "rejected", reviewedAt: "2026-10-04" }),
      ],
      3,
    );
    expect(q.review.map((i) => i.listing.id)).toEqual(["a", "b"]);
    expect(q.changes.map((i) => i.listing.id)).toEqual(["d", "c"]);
    expect(q.rejected.map((i) => i.listing.id)).toEqual(["e"]);
    expect(q.active).toBe(3);
  });

  it("una decisión saca la casa de «por revisar» y la pone donde toca", () => {
    const q = splitQueue([item("a", {}), item("b", {})], 1);
    const approved = applyDecision(q, "a", "approve", "", "2026-10-09");
    expect(approved.review.map((i) => i.listing.id)).toEqual(["b"]);
    expect(approved.active).toBe(2);
    const changes = applyDecision(q, "a", "changes", " Falta la cocina. ", "2026-10-09");
    expect(changes.changes[0]!.listing).toMatchObject({ id: "a", status: "changes", reviewNote: "Falta la cocina.", reviewedAt: "2026-10-09" });
    const rejected = applyDecision(q, "b", "reject", "No.", "2026-10-09");
    expect(rejected.rejected[0]!.listing.status).toBe("rejected");
    expect(applyDecision(q, "zzz", "approve", "", "x")).toBe(q);
  });

  it("Nueva o Corregida según si ya tuvo una decisión", () => {
    expect(queueBadge({ reviewedAt: null })).toBe("Nueva");
    expect(queueBadge({ reviewedAt: "2026-10-01" })).toBe("Corregida");
  });
});
