import { describe, expect, it } from "vitest";
import { DomainError, GENERIC_MESSAGE, toDomainError } from "../../src/domain/errors";
import { fromBillingJson, fromListingRow, fromPublicRow, fromSetupContextJson, storagePhotoUrl, toListingUpdate, type ListingRow, type PublicRow } from "../../src/domain/rows";
import { houseSubscription } from "../../src/domain/subscription";

describe("toDomainError", () => {
  it("los mensajes que lanza la base pasan tal cual", () => {
    const e = toDomainError({ code: "P0001", message: "Agregue al menos 5 fotos." });
    expect(e).toBeInstanceOf(DomainError);
    expect(e.message).toBe("Agregue al menos 5 fotos.");
    expect(e.kind).toBe("validation");
  });

  it.each([
    ["42501", "No tiene permiso para hacer esto.", "forbidden"],
    ["PGRST116", "No encontramos lo que busca.", "not_found"],
    ["PGRST301", "Su sesión venció. Ingrese de nuevo.", "session"],
    ["23514", "Algún dato no es válido. Revise el formulario.", "validation"],
    ["otp_expired", "Ese código no es correcto o caducó.", "validation"],
    ["over_sms_send_rate_limit", "Espere un momento antes de pedir otro código.", "rate_limit"],
    ["insufficient_aal", "Confirme el segundo código para continuar.", "forbidden"],
  ])("traduce %s", (code, message, kind) => {
    expect(toDomainError({ code, message: "new row violates row-level security policy" })).toMatchObject({ message, kind });
  });

  it("el límite de códigos de GoTrue dice cuántos segundos esperar", () => {
    const soon = toDomainError({ code: "over_sms_send_rate_limit", message: "For security purposes, you can only request this after 0 seconds." });
    expect(soon).toMatchObject({ kind: "rate_limit", message: "Espere un momento antes de pedir otro código." });
    const later = toDomainError({ code: "over_sms_send_rate_limit", message: "For security purposes, you can only request this after 27 seconds." });
    expect(later).toMatchObject({ message: "Espere 27 segundos antes de pedir otro código." });
  });

  it("los errores del segundo factor (app de autenticación)", () => {
    expect(toDomainError({ code: "mfa_verification_failed", message: "Invalid TOTP code entered" })).toMatchObject({ kind: "validation", message: "Ese código no es correcto o caducó." });
    expect(toDomainError({ code: "mfa_factor_not_found" }).kind).toBe("conflict");
    expect(toDomainError({ code: "mfa_totp_enroll_not_enabled" }).message).toBe("El segundo código no está disponible ahora. Escríbale a bnbtico por WhatsApp.");
  });

  it("errores de red", () => {
    expect(toDomainError(new TypeError("Failed to fetch")).kind).toBe("network");
    expect(toDomainError({ name: "AuthRetryableFetchError", message: "{}" }).message).toBe("Sin conexión. Revise su internet e intente de nuevo.");
  });

  it("todo lo demás recibe un mensaje genérico, aunque parezca español", () => {
    expect(toDomainError({ code: "XX000", message: "Algo raro pasó en el servidor." }).message).toBe(GENERIC_MESSAGE);
    expect(toDomainError({ message: "duplicate key value" }).message).toBe(GENERIC_MESSAGE);
    expect(toDomainError(undefined).message).toBe(GENERIC_MESSAGE);
  });

  it("un DomainError se devuelve igual", () => {
    const e = new DomainError("Ya está.", "conflict");
    expect(toDomainError(e)).toBe(e);
  });
});

const url = storagePhotoUrl("http://127.0.0.1:54321/");

function listingRow(over: Partial<ListingRow> = {}): ListingRow {
  return {
    id: "l1", public_id: "CT-1042", owner_id: "o1", status: "draft", kind: null, title: "", description: "", province: "Limón", canton: null, zone: null,
    lat: null, lng: null, capacity: null, bedrooms: null, bathrooms: null, bathroom_shared: null, features: [], parking_paid: null,
    accepts_nightly: true, nightly_price_crc: null, min_nights: null, accepts_monthly: false, monthly_mode: null, monthly_price_crc: null, min_months: null,
    whatsapp_phone: "+50687770001", available: true, review_note: null, reviewed_at: null, created_at: "2026-10-01", updated_at: "2026-10-02",
    ...over,
  } as ListingRow;
}

describe("mapeo de filas", () => {
  it("URL pública de Storage", () => expect(url("l1/a.jpg")).toBe("http://127.0.0.1:54321/storage/v1/object/public/listings/l1/a.jpg"));

  it("acceptsNightly: solo true cuenta, igual para el dueño y para el público", () => {
    for (const v of [true, false, null]) {
      const owner = fromListingRow(listingRow({ accepts_nightly: v as boolean }), [], url).acceptsNightly;
      const pub = fromPublicRow({ accepts_nightly: v, photos: [] } as unknown as PublicRow, url).acceptsNightly;
      expect(owner).toBe(v === true);
      expect(pub).toBe(owner);
    }
  });

  it("acceptsMonthly es booleano para el dueño y para el público (null, por si acaso, es No)", () => {
    expect(fromListingRow(listingRow(), [], url).acceptsMonthly).toBe(false);
    expect(fromListingRow(listingRow({ accepts_monthly: true }), [], url).acceptsMonthly).toBe(true);
    expect(fromListingRow(listingRow({ accepts_monthly: null as unknown as boolean }), [], url).acceptsMonthly).toBe(false);
    expect(fromPublicRow({ accepts_monthly: null, photos: [] } as unknown as PublicRow, url).acceptsMonthly).toBe(false);
  });

  it("fotos ordenadas por posición y photoCount desde la lista", () => {
    const l = fromListingRow(listingRow(), [{ id: "b", path: "l1/b.jpg", position: 1 }, { id: "a", path: "l1/a.jpg", position: 0 }], url);
    expect(l.photos.map((p) => p.id)).toEqual(["a", "b"]);
    expect(l.photoCount).toBe(2);
  });

  it("la fecha de reapertura de la vista pública pasa tal cual (null si no hay)", () => {
    expect(fromPublicRow({ reopen_at: "2026-11-15", photos: [] } as unknown as PublicRow, url).reopenAt).toBe("2026-11-15");
    expect(fromPublicRow({ reopen_at: null, photos: [] } as unknown as PublicRow, url).reopenAt).toBeNull();
  });

  it("las fotos de la vista pública son rutas en orden", () => {
    const l = fromPublicRow({ photos: ["l1/a.jpg", "l1/b.jpg", 3] } as unknown as PublicRow, url);
    expect(l.photos).toEqual([{ path: "l1/a.jpg", url: url("l1/a.jpg"), srcSet: null }, { path: "l1/b.jpg", url: url("l1/b.jpg"), srcSet: null }]);
  });

  it("toListingUpdate solo escribe lo que viene en el parche; NaN y vacío son null", () => {
    expect(toListingUpdate({ title: "Casa", capacity: Number.NaN })).toEqual({ title: "Casa", capacity: null });
    expect(toListingUpdate({ acceptsMonthly: true })).toEqual({ accepts_monthly: true });
    expect(toListingUpdate({ acceptsMonthly: undefined as unknown as boolean })).toEqual({ accepts_monthly: false });
    // Toda casa se alquila por noches (check en la base): el parche nunca escribe accepts_nightly.
    expect(toListingUpdate({ acceptsNightly: false })).toEqual({});
    expect(toListingUpdate({})).toEqual({});
  });
});

describe("fromBillingJson y fromSetupContextJson (fase 5)", () => {
  it("traduce owner_billing a camelCase y la pasa a las reglas con houseSubscription", () => {
    const json = {
      houses: [
        {
          listing_id: "l1", public_id: "CT-1001", title: "Casa", status: "inactive", plan: "promo", promo_slot: 7, promo_months: 12,
          promo_ends_on: "2027-10-14", paid_since: null, stopped_on: "2026-10-27", monthly_price_crc: 2900,
          reminders: [{ days_before: 90, status: "sent", sent_at: "2027-07-16T14:00:00Z" }],
        },
      ],
      method: { brand: "visa", last4: "4242", exp_month: 12, exp_year: 2029, added_at: "2026-10-27T10:00:00Z" },
      today: "2026-10-27",
    };
    const o = fromBillingJson(json);
    expect(o).toEqual({
      houses: [
        { listingId: "l1", publicId: "CT-1001", title: "Casa", status: "inactive", plan: "promo", promoSlot: 7, promoMonths: 12, promoEndsOn: "2027-10-14", paidSince: null, stoppedOn: "2026-10-27", monthlyPriceCrc: 2900, reminders: [{ daysBefore: 90, status: "sent", sentAt: "2027-07-16T14:00:00Z" }] },
      ],
      method: { brand: "visa", last4: "4242", expMonth: 12, expYear: 2029, addedAt: "2026-10-27T10:00:00Z" },
      today: "2026-10-27",
    });
    expect(houseSubscription(o.houses[0]!, o.method)).toEqual({ status: "inactive", plan: "promo", promoEndsOn: "2027-10-14", paidSince: null, stoppedOn: "2026-10-27", monthlyPriceCrc: 2900, hasMethod: true });
  });

  it("sin casas ni método, o con basura, no rompe", () => {
    expect(fromBillingJson({ houses: [], method: null, today: "2026-10-27" })).toEqual({ houses: [], method: null, today: "2026-10-27" });
    expect(fromBillingJson(null)).toEqual({ houses: [], method: null, today: "" });
    expect(fromSetupContextJson({ owner_id: "u", full_name: "Yorleny", phone: "+50687770001", customer_ref: null })).toEqual({ ownerId: "u", fullName: "Yorleny", phone: "+50687770001", customerRef: null });
  });
});
