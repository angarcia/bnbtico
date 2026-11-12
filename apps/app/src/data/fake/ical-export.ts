import { calendarWindow } from "../../domain/calendar";
import { DomainError } from "../../domain/errors";
import { ICAL_EXPORT_MESSAGES as M, ICAL_EXPORT_TOKEN, type IcalExportService } from "../../domain/ical-export";
import type { FakeDb, FakeListing } from "./db";

export interface FakeIcalExport { id: string; token: string | null; revokedAt: string | null; generation: number }

function randomToken() {
  return [...crypto.getRandomValues(new Uint8Array(32))].map(byte => byte.toString(16).padStart(2, "0")).join("");
}

export function invalidateFakeIcalExport(db: FakeDb, id: string) {
  const entry = db.icalExports.get(id);
  if (entry) { entry.token = null; entry.revokedAt = db.now(); }
}

export function createFakeIcalExportService(db: FakeDb): IcalExportService {
  function own(jwt: string, id: string) {
    const uid = db.authSessions.get(jwt);
    if (!uid) throw new DomainError(M.session, "session");
    const l = db.listings.get(id);
    if (!l || l.deletedAt || l.ownerId !== uid) throw new DomainError(M.missing, "validation");
    const profile = db.profiles.get(uid);
    if (!profile?.isActive || !profile.phoneVerified) throw new DomainError(M.account, "validation");
    return l;
  }
  const suspended = (l: FakeListing) => l.status === "rejected" || l.adminHold?.kind === "blocked";
  function nights(id: string) {
    const { first, last } = calendarWindow(db.today());
    return [...new Set((db.days.get(id) ?? []).filter(d => !d.available && d.day >= first && d.day <= last).map(d => d.day))].sort();
  }
  return {
    async owner(jwt, id, generate) {
      const l = own(jwt, id);
      if (generate && (suspended(l) || l.status === "draft" && !l.firstPublishedAt)) throw new DomainError(M.unavailable, "validation");
      let entry = db.icalExports.get(id);
      if (generate && !entry?.token) {
        entry = { id: entry?.id ?? crypto.randomUUID(), token: randomToken(), revokedAt: null, generation: (entry?.generation ?? 0) + 1 };
        db.icalExports.set(id, entry);
      }
      return { generated: !!entry?.token, suspended: suspended(l), token: suspended(l) ? null : entry?.token ?? null, nights: nights(id).length, generation: entry?.generation ?? 0 };
    },
    async revoke(jwt, id, expectedGeneration) {
      own(jwt, id);
      if (expectedGeneration !== undefined && expectedGeneration !== (db.icalExports.get(id)?.generation ?? 0)) throw new DomainError(M.changed, "validation");
      invalidateFakeIcalExport(db, id);
    },
    async read(token) {
      if (!ICAL_EXPORT_TOKEN.test(token)) return null;
      const found = [...db.icalExports.entries()].find(([, entry]) => entry.token === token && !entry.revokedAt);
      if (!found) return null;
      const [id, entry] = found;
      const l = db.listings.get(id);
      const profile = l ? db.profiles.get(l.ownerId) : undefined;
      if (!l || l.deletedAt || suspended(l) || l.status === "draft" && !l.firstPublishedAt || !profile?.isActive || !profile.phoneVerified) return null;
      return { id: entry.id, nights: nights(id) };
    },
  };
}
