import { FakeDb } from "../../src/data/fake/db";
import { createFakeListings } from "../../src/data/fake/listings";
import { createFakeOwnerListings } from "../../src/data/fake/owner";
import { COMPLETE, type ListingsHarness, type SeedOwner } from "../contract/harness";

export const FAKE_SUPABASE_URL = "http://supabase.test";

export function fakeHarness(db = new FakeDb()): ListingsHarness & { db: FakeDb } {
  const owners: Record<SeedOwner, string> = {
    owner: db.addProfile({ fullName: "Yorleny Prueba", phone: "+50687770001", phoneVerified: true, isAdmin: false }).id,
    other: db.addProfile({ fullName: "Ana Prueba", phone: "+50688881234", phoneVerified: true, isAdmin: false }).id,
  };
  return {
    db,
    anon: createFakeListings(db, { supabaseUrl: FAKE_SUPABASE_URL }),
    owner: (who) => createFakeOwnerListings(db, { supabaseUrl: FAKE_SUPABASE_URL, userId: () => owners[who] }),
    async reset() {
      db.clear();
    },
    async seed(spec) {
      const draft = { ...COMPLETE, ...spec.draft };
      const reviewed = spec.status === "active" || spec.status === "changes" || spec.status === "rejected" || spec.status === "reopened";
      const listing = db.insertListing(owners[spec.as ?? "owner"], {
        ...draft,
        status: spec.status === "reopened" ? "draft" : spec.status,
        reviewedAt: reviewed ? db.now() : null,
        reviewNote: spec.status === "changes" || spec.status === "rejected" ? "Faltan fotos del baño." : null,
      });
      const n = spec.photos ?? (spec.status === "draft" ? 0 : 5);
      const photoPaths = Array.from({ length: n }, (_, i) => `${listing.id}/foto-${i}.jpg`);
      for (let i = n - 1; i >= 0; i--) db.photos.push({ id: db.newId(), listingId: listing.id, path: photoPaths[i]!, position: i });
      return { id: listing.id, publicId: listing.publicId, exact: { lat: draft.lat!, lng: draft.lng! }, photoPaths };
    },
    async addPhotos(listingId, n) {
      const start = db.photosOf(listingId).length;
      const paths = Array.from({ length: n }, (_, i) => `${listingId}/extra-${start + i}.jpg`);
      paths.forEach((path, i) => db.photos.push({ id: db.newId(), listingId, path, position: start + i }));
      return paths;
    },
    ownerName: (who) => db.profiles.get(owners[who])!.fullName,
  };
}
