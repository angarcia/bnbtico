// Fake en memoria del calendario del propietario: las reglas de la RPC save_listing_days (validateChange, en su orden y
// con sus mensajes) y el mismo guardado por día (applyChange). «Hoy» sale del reloj de la base (FakeDb.clock).
import type { OwnerCalendarApi } from "../../domain/api";
import { applyChange, calendarWindow, validateChange, type CalendarListing } from "../../domain/calendar";
import { ADMIN_HOLD_MESSAGES } from "../../domain/admin-actions";
import { DomainError } from "../../domain/errors";
import type { FakeDb, FakeListing } from "./db";

function session(userId: () => string | null): string {
  const id = userId();
  if (!id) throw new DomainError("Su sesión venció. Ingrese de nuevo.", "session");
  return id;
}

/** El precio por noche que vale como base; null en un borrador sin precio por noche todavía. */
export const nightlyBase = (l: Pick<FakeListing, "acceptsNightly" | "nightlyPriceCrc">): number | null => (l.acceptsNightly ? l.nightlyPriceCrc : null);

export function createFakeCalendar(db: FakeDb, opts: { userId: () => string | null }): OwnerCalendarApi {
  function own(id: string): FakeListing | undefined {
    const uid = session(opts.userId);
    const l = db.listings.get(id);
    return l && l.ownerId === uid && l.deletedAt === null ? l : undefined;
  }

  return {
    async days(listingId) {
      const l = own(listingId);
      if (!l) return [];
      const { first, last } = calendarWindow(db.today());
      return (db.days.get(l.id) ?? []).filter((d) => d.day >= first && d.day <= last).map((d) => ({ ...d }));
    },

    async save(listingId, change) {
      const l = own(listingId);
      if (l?.adminHold?.kind === "blocked") throw new DomainError(ADMIN_HOLD_MESSAGES.ownerBlocked, "validation");
      const listing: CalendarListing | null = l ? { status: l.status, available: l.available, nightlyPriceCrc: nightlyBase(l) } : null;
      const refusal = validateChange(change, { today: db.today(), listing });
      if (refusal) throw new DomainError(refusal, "validation");
      db.days.set(l!.id, applyChange(db.days.get(l!.id) ?? [], nightlyBase(l!), change));
    },
  };
}
