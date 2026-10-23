import { describe, expect, it } from "vitest";
import { DomainError, GENERIC_MESSAGE, toDomainError } from "../../src/domain/errors";
import { fromListingRow, fromPublicRow, storagePhotoUrl, toListingUpdate, type ListingRow, type PublicRow } from "../../src/domain/rows";

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
    accepts_nightly: false, nightly_price_crc: null, min_nights: null, accepts_monthly: null, monthly_mode: null, monthly_price_crc: null, min_months: null,
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

  it("acceptsMonthly del dueño conserva null (aún no elegido); en público es booleano", () => {
    expect(fromListingRow(listingRow(), [], url).acceptsMonthly).toBeNull();
    expect(fromPublicRow({ accepts_monthly: null, photos: [] } as unknown as PublicRow, url).acceptsMonthly).toBe(false);
  });

  it("fotos ordenadas por posición y photoCount desde la lista", () => {
    const l = fromListingRow(listingRow(), [{ id: "b", path: "l1/b.jpg", position: 1 }, { id: "a", path: "l1/a.jpg", position: 0 }], url);
    expect(l.photos.map((p) => p.id)).toEqual(["a", "b"]);
    expect(l.photoCount).toBe(2);
  });

  it("las fotos de la vista pública son rutas en orden", () => {
    const l = fromPublicRow({ photos: ["l1/a.jpg", "l1/b.jpg", 3] } as unknown as PublicRow, url);
    expect(l.photos).toEqual([{ path: "l1/a.jpg", url: url("l1/a.jpg") }, { path: "l1/b.jpg", url: url("l1/b.jpg") }]);
  });

  it("toListingUpdate solo escribe lo que viene en el parche; NaN y vacío son null", () => {
    expect(toListingUpdate({ title: "Casa", capacity: Number.NaN })).toEqual({ title: "Casa", capacity: null });
    expect(toListingUpdate({ acceptsNightly: undefined as unknown as boolean })).toEqual({ accepts_nightly: false });
    expect(toListingUpdate({})).toEqual({});
  });
});
