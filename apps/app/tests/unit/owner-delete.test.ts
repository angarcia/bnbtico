// Historia 28: en qué estados el anfitrión ve «Eliminar casa» (la base aplica lo mismo en delete_own_listing).
import { describe, expect, it } from "vitest";
import type { ListingStatus } from "../../src/domain/listing";
import { OWNER_DELETE_MESSAGES as M, canDelete, deleteRefusal } from "../../src/domain/owner-delete";

describe("eliminar casa", () => {
  it.each<[ListingStatus, string | null, boolean]>([
    ["changes", "2026-10-20T10:00:00Z", true],
    ["payment_due", "2026-10-20T10:00:00Z", true],
    ["active", "2026-10-20T10:00:00Z", true],
    ["inactive", "2026-10-20T10:00:00Z", true],
    ["draft", "2026-10-20T10:00:00Z", true],
    ["draft", null, false],
    ["review", null, false],
    ["rejected", "2026-10-20T10:00:00Z", false],
  ])("%s (revisada: %s) → %s", (status, reviewedAt, ok) => {
    expect(canDelete({ status, reviewedAt })).toBe(ok);
  });

  it("bloqueada no; pausada por 3bstays sí; cada negativa con su mensaje", () => {
    const at = "2026-10-20T10:00:00Z";
    expect(deleteRefusal({ status: "active", reviewedAt: at, adminHold: { kind: "blocked", reason: "x" } })).toBe(M.blocked);
    expect(canDelete({ status: "active", reviewedAt: at, adminHold: { kind: "paused", reason: "x" } })).toBe(true);
    expect(deleteRefusal({ status: "review", reviewedAt: null })).toBe(M.inReview);
    expect(deleteRefusal({ status: "draft", reviewedAt: null })).toBe(M.draft);
  });
});
