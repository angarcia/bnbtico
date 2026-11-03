import { FakeDb } from "../../src/data/fake/db";
import { createFakeAdmin } from "../../src/data/fake/admin";
import { approveSubscription, createFakeBillingService, createFakeOwnerBilling } from "../../src/data/fake/billing";
import { createFakeCalendar } from "../../src/data/fake/calendar";
import { createFakeFavorites, createFakeInquiries } from "../../src/data/fake/inquiries";
import { createFakeListings } from "../../src/data/fake/listings";
import { createFakeOwnerListings } from "../../src/data/fake/owner";
import { createFakePhotos } from "../../src/data/fake/photos";
import { addDays, applyChange } from "../../src/domain/calendar";
import { MONTHLY_FEE_CRC } from "../../src/domain/subscription";
import { COMPLETE, type SeedOwner, type SubscriptionHarness } from "../contract/harness";

export const FAKE_SUPABASE_URL = "http://supabase.test";

export function fakeHarness(db = new FakeDb()): SubscriptionHarness & { db: FakeDb } {
  const owners: Record<SeedOwner, string> = {
    owner: db.addProfile({ fullName: "Yorleny Prueba", phone: "+50687770001", phoneVerified: true, isAdmin: false }).id,
    other: db.addProfile({ fullName: "Ana Prueba", phone: "+50688881234", phoneVerified: true, isAdmin: false }).id,
  };
  const adminId = db.addProfile({ fullName: "Admin Prueba", phone: "+50688990001", phoneVerified: true, isAdmin: true }).id;
  const as = (who: SeedOwner | "anon") => ({ userId: () => (who === "anon" ? null : owners[who]) });
  const tokens: Record<SeedOwner, string> = { owner: "jwt-owner", other: "jwt-other" };
  db.authSessions.set(tokens.owner, owners.owner);
  db.authSessions.set(tokens.other, owners.other);
  return {
    db,
    billing: (who) => createFakeOwnerBilling(db, as(who)),
    service: createFakeBillingService(db),
    ownerId: (who) => owners[who],
    async jwt(who) {
      return tokens[who];
    },
    async takeSlots(n) {
      for (let slot = 1; slot <= n; slot++) {
        const l = db.insertListing(adminId, { ...COMPLETE, status: "inactive", reviewedAt: db.now(), firstPublishedAt: db.now(), title: `Relleno ${slot}` });
        db.subscriptions.set(l.id, { listingId: l.id, plan: "promo", promoSlot: slot, promoMonths: 12, promoEndsOn: addDays(db.today(), 365), paidSince: null, stoppedOn: null, monthlyPriceCrc: MONTHLY_FEE_CRC });
      }
    },
    async setDaysLeft(listingId, days) {
      db.subscriptions.get(listingId)!.promoEndsOn = addDays(db.today(), days);
    },
    async setAccountActive(who, active) {
      db.profiles.get(owners[who])!.isActive = active;
    },
    async reminders(listingId) {
      return db.reminders
        .filter((r) => r.listingId === listingId)
        .sort((a, b) => b.daysBefore - a.daysBefore)
        .map(({ daysBefore, status, attempts, toPhone, body, providerRef, sentAt }) => ({ daysBefore, status, attempts, toPhone, body, providerRef, sentAt }));
    },
    async storedMethod(who) {
      const m = db.paymentMethods.get(owners[who]);
      return m ? { customerRef: m.customerRef, methodRef: m.methodRef } : null;
    },
    async setTestClock(on) {
      const was = db.testClock;
      db.testClock = on;
      return was;
    },
    async adminActions(listingId) {
      return db.adminActions.filter((a) => a.listingId === listingId).map(({ action, reason }) => ({ action, reason }));
    },
    async backdateHold(listingId, days) {
      const l = db.listings.get(listingId)!;
      l.adminHoldAt = new Date(Date.parse(l.adminHoldAt!) - days * 86_400_000).toISOString();
    },
    inquiries: (who) => createFakeInquiries(db, as(who)),
    favorites: (who) => createFakeFavorites(db, as(who)),
    calendar: (who) => createFakeCalendar(db, as(who)),
    async reopenDue(today) {
      return db.reopenDue(today);
    },
    async putDay(listingId, row) {
      db.days.set(listingId, applyChange(db.days.get(listingId) ?? [], null, { days: [row.day], available: row.available, ...(row.specialPriceCrc === null ? {} : { priceCrc: row.specialPriceCrc }) }));
    },
    phone: (who) => db.profiles.get(owners[who])!.phone,
    async backdateInquiry(id, days) {
      const i = db.inquiries.find((x) => x.id === id)!;
      const back = (iso: string) => new Date(Date.parse(iso) - days * 86_400_000).toISOString();
      Object.assign(i, { createdAt: back(i.createdAt), updatedAt: back(i.updatedAt) });
    },
    async recordViews(publicId, n, daysAgo = 0) {
      const at = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
      for (let k = 0; k < n; k++) db.views.push({ publicId, at });
    },
    async recordTaps(publicId, n, daysAgo = 0) {
      const at = new Date(Date.now() - daysAgo * 86_400_000).toISOString();
      for (let k = 0; k < n; k++) db.taps.push({ publicId, at });
    },
    async seedContacts(who, n) {
      const other = who === "owner" ? "other" : "owner";
      for (let k = 0; k < n; k++) {
        const l = db.insertListing(owners[other], { ...COMPLETE, status: "active", reviewedAt: db.now(), firstPublishedAt: db.now(), title: `Contactada ${k}` });
        const at = new Date(Date.now() - 3_600_000).toISOString();
        db.inquiries.push({ id: db.newId(), listingId: l.id, clientId: owners[who], ownerId: owners[other], arrival: null, departure: null, people: null, message: "Hola", whatsappPhone: l.whatsappPhone, createdAt: at, updatedAt: at, ownerOpenedAt: null, source: "listing" });
      }
    },
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
        // Como en Supabase: solo la aprobación la rellena (activa, o activa y luego reabierta para editar).
        firstPublishedAt: spec.status === "active" || spec.status === "reopened" ? db.now() : null,
        reviewNote: spec.status === "changes" || spec.status === "rejected" ? "Faltan fotos del baño." : null,
      });
      // Como review_listing: la aprobación toma la plaza de la oferta y decide el estado (activa o pendiente de pago).
      if (spec.status === "active" || spec.status === "reopened") {
        const status = approveSubscription(db, listing);
        if (spec.status === "active") listing.status = status;
      }
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
    photos: (who) => createFakePhotos(db, { supabaseUrl: FAKE_SUPABASE_URL, userId: () => owners[who] }),
    admin: (as) =>
      createFakeAdmin(db, {
        supabaseUrl: FAKE_SUPABASE_URL,
        session: () => (as === "aal2" || as === "aal1" ? { userId: adminId, aal: as } : { userId: owners[as], aal: "aal1" }),
      }),
    async dropPhoto(listingId) {
      const last = db.photosOf(listingId).at(-1);
      db.photos = db.photos.filter((p) => p !== last);
    },
    async setLegacyTitle(listingId, title) {
      db.listings.get(listingId)!.title = title;
    },
    async setClosed(listingId, closed, reopenAt = null) {
      Object.assign(db.listings.get(listingId)!, { available: !closed, reopenAt: closed ? reopenAt : null });
    },
    async objects(listingId) {
      return [...db.objects.entries()]
        .filter(([name]) => name.startsWith(`${listingId}/`))
        .map(([name, o]) => ({ name, cacheControl: o.cacheControl }))
        .sort((a, b) => (a.name < b.name ? -1 : 1));
    },
  };
}
