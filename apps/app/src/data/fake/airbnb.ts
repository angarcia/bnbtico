import type { AirbnbService, AirbnbSummary } from "../../domain/airbnb";
import { AIRBNB_BUSY_MESSAGE } from "../../domain/airbnb";
import { addDays, calendarWindow, type CalendarDay } from "../../domain/calendar";
import { DomainError } from "../../domain/errors";
import { validateAirbnbUrl, type IcalErrorCode, type ImportedBlock } from "../../domain/ical";
import type { FakeDb, FakeListing } from "./db";

export interface FakeAirbnbConnection { url: string; connected: boolean; version: number; lastSuccessAt: string | null; errorCode: IcalErrorCode | null; blocks: ImportedBlock[] }
export interface FakeAirbnbAttempt { listingId: string; version: number; claimed: boolean; state: "running" | "success" | "error" | "obsolete"; started: number }

export function fakeEffectiveDays(db: FakeDb, listingId: string, privateOrigin = false): CalendarDay[] {
  const manual = new Map((db.days.get(listingId) ?? []).map(d => [d.day, d]));
  const connection = db.airbnbConnections.get(listingId);
  const blocks = connection?.connected ? connection.blocks : [];
  const { first, last } = calendarWindow(db.today());
  const days: CalendarDay[] = [];
  for (let date = first; date <= last; date = addDays(date, 1)) {
    const row = manual.get(date);
    const imported = blocks.some(b => b.start <= date && b.end > date);
    if (row || imported) days.push({ day: date, available: (row?.available ?? true) && !imported, specialPriceCrc: row?.specialPriceCrc ?? null,
      ...(privateOrigin && imported ? { imported: true, manualAvailable: row?.available ?? true } : {}) });
  }
  return days;
}

export function fakeBusyNights(db: FakeDb, id: string, from: string, to: string) {
  if ((db.days.get(id) ?? []).some(d => !d.available && d.day >= from && d.day < to)) return true;
  const c = db.airbnbConnections.get(id);
  if (!c?.connected) return false;
  const { first, last } = calendarWindow(db.today());
  const a = from > first ? from : first;
  const end = addDays(last, 1);
  const b = to < end ? to : end;
  return a < b && c.blocks.some(block => block.start < b && block.end > a);
}
export { AIRBNB_BUSY_MESSAGE };

/** Equivalente al trigger SQL: las respuestas anteriores no reviven conexiones tras bloquear o eliminar. */
export function invalidateFakeAirbnb(db: FakeDb, listingId: string, deleted = false) {
  const connection = db.airbnbConnections.get(listingId);
  if (connection) {
    connection.version++;
    if (deleted) { connection.connected = false; connection.url = ""; }
  }
  for (const attempt of db.airbnbAttempts.values()) if (attempt.listingId === listingId && attempt.state === "running") attempt.state = "obsolete";
}

export function createFakeAirbnbService(db: FakeDb): AirbnbService {
  function own(jwt: string, id: string) {
    const uid = db.authSessions.get(jwt);
    if (!uid) throw new DomainError("Su sesión venció. Ingrese de nuevo.", "session");
    const l = db.listings.get(id);
    if (!l || l.ownerId !== uid || l.deletedAt) throw new DomainError("No encontramos ese anuncio.", "validation");
    return l;
  }
  const allowed = (l: FakeListing | undefined) => l && !l.deletedAt && l.status !== "rejected" && l.adminHold?.kind !== "blocked" && !(l.status === "draft" && !l.firstPublishedAt);
  function reserve(id: string, requestId: string, url: string | null, initial: boolean) {
    const l = db.listings.get(id);
    if (!allowed(l)) throw new DomainError("Esta casa no permite conectar calendarios.", "validation");
    const profile = db.profiles.get(l!.ownerId);
    if (!profile?.isActive || !profile.phoneVerified) throw new DomainError("Verifique su cuenta para conectar el calendario.", "validation");
    const prior = db.airbnbAttempts.get(requestId);
    if (prior) {
      if (prior.listingId !== id) throw new DomainError("No encontramos ese intento.", "validation");
      return { run: false };
    }
    const c = db.airbnbConnections.get(id) ?? { url: "", connected: false, version: 0, lastSuccessAt: null, errorCode: null, blocks: [] };
    const attempts = [...db.airbnbAttempts.values()].filter(a => a.listingId === id && a.state === "running");
    if (attempts.some(a => db.clock() - a.started < 30000)) throw new DomainError("Ya estamos leyendo este calendario.", "validation");
    if (initial && c.connected) throw new DomainError("Esta casa ya tiene Airbnb conectado.", "validation");
    if (!initial && !c.connected) throw new DomainError("Esta casa no tiene Airbnb conectado.", "validation");
    if (initial) c.url = validateAirbnbUrl(url ?? "");
    attempts.forEach(a => { a.state = "obsolete"; });
    c.version++;
    c.errorCode = null;
    db.airbnbConnections.set(id, c);
    db.airbnbAttempts.set(requestId, { listingId: id, version: c.version, state: "running", claimed: false, started: db.clock() });
    return { run: true };
  }
  function live(id: string, requestId: string) {
    const a = db.airbnbAttempts.get(requestId);
    const c = db.airbnbConnections.get(id);
    const l = db.listings.get(id);
    const profile = l ? db.profiles.get(l.ownerId) : undefined;
    return a && c && a.listingId === id && a.version === c.version && a.state === "running" && db.clock() - a.started < 30000 && allowed(l) && profile?.isActive && profile.phoneVerified ? { a, c } : null;
  }
  return {
    async begin(jwt, id, url, requestId) { own(jwt, id); return reserve(id, requestId, url, true); },
    async claim(id, requestId) { return reserve(id, requestId, null, false); },
    async context(id, requestId) {
      const active = live(id, requestId);
      if (!active || active.a.claimed) return null;
      active.a.claimed = true;
      return { url: active.c.url };
    },
    async finish(id, requestId, blocks, error) {
      const active = live(id, requestId);
      if (!active || !active.a.claimed) return;
      if (error) { active.a.state = "error"; active.c.errorCode = error; return; }
      if (!blocks || blocks.length > 5000 || blocks.some(b => !b.uid || b.uid.length > 512 || b.end <= b.start) || new Set(blocks.map(b => b.uid)).size !== blocks.length) throw new DomainError("Calendario no válido.", "validation");
      active.c.blocks = blocks.map(b => ({ ...b }));
      active.c.connected = true;
      active.c.errorCode = null;
      active.c.lastSuccessAt = db.now();
      active.a.state = "success";
    },
    async overview(jwt, id): Promise<AirbnbSummary> {
      const l = own(jwt, id);
      const c = db.airbnbConnections.get(id);
      const running = [...db.airbnbAttempts.values()].some(a => a.listingId === id && a.state === "running" && db.clock() - a.started < 30000);
      return { connected: c?.connected ?? false, exportGenerated: !!db.icalExports.get(id)?.token,
        state: l.status === "rejected" || l.adminHold?.kind === "blocked" ? "suspended" : running ? "running" : c?.errorCode ? "error" : c?.connected ? "connected" : "none",
        lastSuccessAt: c?.lastSuccessAt ?? null, errorCode: c?.errorCode ?? null,
        nights: fakeEffectiveDays(db, id, true).filter(d => d.imported).length };
    },
  };
}
