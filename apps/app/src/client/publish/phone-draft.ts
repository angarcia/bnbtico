import type { ListingDraft } from "../../domain/listing";
import { PUBLISH_DRAFT_KEY, PUBLISH_STEP1_KEY, readLocalDraft, readPublishDraft, storeLocalDraft } from "../../domain/publish-return";

export const readPhoneDraft = (now = Date.now()): ListingDraft | null =>
  readPublishDraft(localStorage.getItem(PUBLISH_DRAFT_KEY), localStorage.getItem(PUBLISH_STEP1_KEY), now);

export const readFullPhoneDraft = (now = Date.now()): ListingDraft | null =>
  readLocalDraft(localStorage.getItem(PUBLISH_DRAFT_KEY), now);

export function writePhoneDraft(draft: ListingDraft, now = Date.now()): void {
  localStorage.setItem(PUBLISH_DRAFT_KEY, storeLocalDraft(draft, now));
  localStorage.removeItem(PUBLISH_STEP1_KEY); // el borrador entero ya lleva el tipo
}

export function clearPhoneDraft(): void {
  localStorage.removeItem(PUBLISH_DRAFT_KEY);
  localStorage.removeItem(PUBLISH_STEP1_KEY);
}
