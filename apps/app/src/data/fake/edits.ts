// Reglas de la edición de una casa publicada en el fake (migraciones editar_casa_*): own_published_listing, start_edit,
// save_edit, listing_edit_check y update_listing_live, en su orden y con sus mensajes. Las usan el fake del propietario,
// el de las fotos y el del admin. También la ubicación por punto de submit_listing (locationOf), que comparten el envío
// de un borrador y el de una edición.
import { ADMIN_HOLD_MESSAGES } from "../../domain/admin-actions";
import { EDIT_MESSAGES, editedFields, editOverview, LIVE_KEYS, type EditPatch, type ListingEdit, type LivePatch, type ReviewedField } from "../../domain/edit";
import { DomainError } from "../../domain/errors";
import {
  DESCRIPTION_MAX,
  DESCRIPTION_MIN,
  FEATURES,
  TITLE_MAX,
  TITLE_MIN,
} from "../../domain/listing";
import {
  charCount,
  DESCRIPTION_LENGTH_ERROR,
  LOCATION_MESSAGES as LOC,
  MONTHLY_PRICE_ERROR,
  NIGHTLY_PRICE_ERROR,
  TITLE_LENGTH_ERROR,
} from "../../domain/listing-rules";
import { fromPhotoRows, type PhotoUrl } from "../../domain/rows";
import { OTHER_ZONE_MAX, ZONE_RADIUS_M } from "../../domain/zones";
import type { FakeDb, FakeEdit, FakeListing } from "./db";
import { FAKE_ZONES, fakePlaceAt, fakeZonesNear } from "./places";

const NOT_FOUND = "No encontramos ese anuncio.";
const BEDROOMS_ERROR = "Indique las habitaciones; solo un alojamiento completo tipo estudio puede tener 0.";
const BATHROOM_ERROR = "Indique si el baño es privado o compartido.";
const PARKING_ERROR = "Indique si el parqueo es gratuito o de pago.";
const PARKING_ONLY_ERROR = "El tipo de parqueo solo aplica si el anuncio tiene parqueo.";

export type Located = Pick<FakeListing, "province" | "canton" | "district" | "zone">;
type Pin = Pick<FakeListing, "lat" | "lng" | "zone" | "zoneId" | "zoneSource">;

/** Ubicación por punto, como submit_listing y edit_place: provincia, cantón y distrito salen del pin (place_at, aquí los
 *  polígonos del fake) y la zona se comprueba según su origen. Devuelve el mensaje o lo que se guarda. */
export function locationOf(l: Pin): { error: string } | Located {
  if (l.lat === null || l.lng === null) return { error: LOC.noPin };
  const place = fakePlaceAt(l.lat, l.lng);
  if (!place) return { error: LOC.notLand };
  const zone = l.zone.trim();
  if (!zone || l.zoneSource === null) return { error: LOC.noZone };
  let name = zone;
  if (l.zoneSource === "list") {
    if (!l.zoneId) return { error: LOC.noZone };
    if (!fakeZonesNear(l.lat, l.lng, ZONE_RADIUS_M / 1000).some((z) => z.id === l.zoneId)) return { error: LOC.farZone };
    name = FAKE_ZONES.find((z) => z.id === l.zoneId)!.name;
  } else if (l.zoneSource === "district") {
    if (l.zoneId !== null || zone !== place.district) return { error: LOC.notDistrict };
  } else {
    if (l.zoneId !== null) return { error: LOC.noZone };
    if (charCount(zone) > OTHER_ZONE_MAX) return { error: LOC.longZone };
  }
  return { province: place.province, canton: place.canton, district: place.district, zone: name };
}

const invalid = (message: string) => new DomainError(message, "validation");
const EDIT_FIELDS = ["title", "kind", "bathroomShared", "description", "lat", "lng", "zone", "zoneId", "zoneSource"] as const;
const LOCATION_KEYS = ["lat", "lng", "zone", "zoneSource"] as const;
const KNOWN_FEATURES = new Set(FEATURES.map(([f]) => f));

/** Los valores de un dato a null (sin cambio). */
function clearField(field: ReviewedField): Partial<FakeEdit> {
  if (field === "nombre") return { title: null };
  if (field === "descripcion") return { description: null };
  if (field === "tipo") return { kind: null, bathroomShared: null };
  return { lat: null, lng: null, zone: null, zoneId: null, zoneSource: null };
}

export function editStore(db: FakeDb) {
  const emptyEdit = (listingId: string): FakeEdit => ({
    listingId,
    fields: {},
    title: null,
    kind: null,
    bathroomShared: null,
    description: null,
    lat: null,
    lng: null,
    zone: null,
    zoneId: null,
    zoneSource: null,
  });

  /** listing_edit_empty. */
  const isEmpty = (e: FakeEdit) =>
    e.title === null && e.kind === null && e.bathroomShared === null && e.description === null && e.lat === null && db.editPhotosOf(e.listingId).length === 0;

  /** La edición que hay (en cualquier estado) o una vacía sin guardar. */
  function current(l: FakeListing): FakeEdit {
    return db.edits.get(l.id) ?? emptyEdit(l.id);
  }

  /** La edición con solo ese dato (los demás a null), para comprobarlo con check (listing_edit_only). */
  const only = (e: FakeEdit, field: ReviewedField): FakeEdit => ({
    ...e,
    title: field === "nombre" ? e.title : null,
    kind: field === "tipo" ? e.kind : null,
    bathroomShared: field === "tipo" ? e.bathroomShared : null,
    description: field === "descripcion" ? e.description : null,
    ...(field === "ubicacion" ? {} : { lat: null, lng: null, zone: null, zoneId: null, zoneSource: null }),
  });

  return {
    /** own_published_listing: mía y publicada (aprobada alguna vez y activa, pendiente de pago o inactiva). */
    published(listingId: string, owner: string): FakeListing {
      const l = db.listings.get(listingId);
      if (!l || l.ownerId !== owner || l.deletedAt !== null) throw new DomainError(NOT_FOUND, "not_found");
      if (l.adminHold?.kind === "blocked") throw new DomainError(ADMIN_HOLD_MESSAGES.ownerBlocked, "validation");
      if (!(["active", "payment_due", "inactive"].includes(l.status) && l.firstPublishedAt !== null)) throw invalid(EDIT_MESSAGES.notPublished);
      return l;
    },

    /** start_edit. */
    start(l: FakeListing): FakeEdit {
      const e = current(l);
      if (!db.edits.has(l.id)) db.edits.set(l.id, e);
      return e;
    },

    /** save_edit: lo igual a lo aprobado queda como null y sale de la revisión; cada dato que cambia se comprueba y va a
     *  revisión con su fecha; sin cambios, la edición se borra. */
    save(l: FakeListing, patch: EditPatch): FakeEdit | null {
      const keys = Object.keys(patch);
      const hasLocation = keys.some((k) => (LOCATION_KEYS as readonly string[]).includes(k) || k === "zoneId");
      if (keys.some((k) => !(EDIT_FIELDS as readonly string[]).includes(k)) || (hasLocation && !LOCATION_KEYS.every((k) => k in patch))) {
        throw invalid(EDIT_MESSAGES.notHere);
      }
      const m: FakeEdit = { ...current(l), fields: { ...current(l).fields } };
      const touched: ReviewedField[] = [];
      if ("title" in patch) touched.push("nombre");
      if ("kind" in patch || "bathroomShared" in patch) touched.push("tipo");
      if ("description" in patch) touched.push("descripcion");
      if (hasLocation) touched.push("ubicacion");
      for (const k of EDIT_FIELDS) if (k in patch) (m as unknown as Record<string, unknown>)[k] = patch[k] ?? null;

      if (m.title !== null) {
        m.title = m.title.trim();
        if (charCount(m.title) < TITLE_MIN || charCount(m.title) > TITLE_MAX) throw invalid(TITLE_LENGTH_ERROR);
        if (m.title === l.title.trim()) m.title = null;
      }
      if (m.description !== null) {
        m.description = m.description.trim();
        if (charCount(m.description) > DESCRIPTION_MAX) throw invalid(DESCRIPTION_LENGTH_ERROR);
        if (m.description === l.description.trim()) m.description = null;
      }
      if (m.kind === l.kind) m.kind = null;
      if ((m.kind ?? l.kind) !== "habitacion" || m.bathroomShared === l.bathroomShared) m.bathroomShared = null;
      if (hasLocation) {
        // La ubicación va entera: sin zoneId en el parche, la zona no es de la lista.
        m.zoneId = patch.zoneId ?? null;
        if (
          m.lat === null ||
          m.lng === null ||
          !(m.zone ?? "").trim() ||
          m.zoneSource === null ||
          !["list", "district", "other"].includes(m.zoneSource) ||
          (m.zoneId !== null && !FAKE_ZONES.some((z) => z.id === m.zoneId))
        ) {
          throw invalid(EDIT_MESSAGES.notHere);
        }
        m.zone = m.zone!.trim();
        if (charCount(m.zone) > OTHER_ZONE_MAX) throw invalid(LOC.longZone);
        if (m.lat === l.lat && m.lng === l.lng && m.zone === l.zone.trim() && m.zoneId === l.zoneId && m.zoneSource === l.zoneSource) {
          Object.assign(m, { lat: null, lng: null, zone: null, zoneId: null, zoneSource: null });
        }
      }

      const changed = editedFields({ ...m, location: m.lat !== null ? {} : null } as unknown as ListingEdit);
      for (const f of touched) if (changed.includes(f)) this.check(l, only(m, f));
      const at = db.now();
      for (const f of touched) {
        if (changed.includes(f)) m.fields[f] = { status: "review", reviewNote: null, submittedAt: at };
        else delete m.fields[f];
      }
      if (isEmpty(m)) {
        db.edits.delete(l.id);
        return null;
      }
      db.edits.set(l.id, m);
      return m;
    },

    /** discard_edit_field: el dato vuelve a lo aprobado; sin nada más, la edición se borra. */
    discardField(listingId: string, field: ReviewedField): void {
      const e = db.edits.get(listingId);
      if (!e) return;
      Object.assign(e, clearField(field));
      delete e.fields[field];
      this.dropIfEmpty(listingId);
    },

    /** Copia a la casa un dato aprobado y lo quita de la edición (review_edit_field). */
    applyField(l: FakeListing, field: ReviewedField): void {
      const e = db.edits.get(l.id)!;
      const place = this.check(l, only(e, field));
      if (field === "nombre") l.title = e.title!;
      else if (field === "descripcion") l.description = e.description!;
      else if (field === "tipo") {
        const kind = e.kind ?? l.kind;
        Object.assign(l, { kind, bathroomShared: kind === "habitacion" ? (e.bathroomShared ?? l.bathroomShared) : null });
      } else Object.assign(l, { lat: e.lat, lng: e.lng, zoneId: e.zoneId, zoneSource: e.zoneSource, ...place });
      l.updatedAt = db.now();
      Object.assign(e, clearField(field));
      delete e.fields[field];
      this.dropIfEmpty(l.id);
    },

    /** listing_edit_check: la casa resultante con las reglas de submit_listing de los datos revisados, en su orden.
     *  Devuelve el lugar (provincia, cantón, distrito y nombre de zona) si la edición cambia la ubicación. */
    check(l: FakeListing, e: FakeEdit): Located | null {
      let place: Located | null = null;
      if (e.lat !== null) {
        const located = locationOf({ lat: e.lat, lng: e.lng, zone: e.zone ?? "", zoneId: e.zoneId, zoneSource: e.zoneSource });
        if ("error" in located) throw invalid(located.error);
        place = located;
      }
      const kind = e.kind ?? l.kind;
      if (l.bedrooms === null || (l.bedrooms < 1 && kind !== "completo" && kind !== "apartamento")) throw invalid(BEDROOMS_ERROR);
      if (kind === "habitacion" && (e.bathroomShared ?? l.bathroomShared) === null) throw invalid(BATHROOM_ERROR);
      // Solo el nombre nuevo: una casa publicada con un nombre de más de 32 lo conserva hasta que su dueño lo cambie.
      if (e.title !== null && (charCount(e.title.trim()) < TITLE_MIN || charCount(e.title.trim()) > TITLE_MAX)) throw invalid(TITLE_LENGTH_ERROR);
      // La descripción, como el nombre, solo si cambia: una anterior fuera de la regla no bloquea otros datos.
      const description = (e.description ?? "").trim();
      if (e.description !== null && description !== "" && (charCount(description) < DESCRIPTION_MIN || charCount(description) > DESCRIPTION_MAX)) throw invalid(DESCRIPTION_LENGTH_ERROR);
      return place;
    },

    /** update_listing_live: la fila resultante con las reglas y mensajes de submit_listing; el tipo es el aprobado. */
    live(l: FakeListing, patch: LivePatch): void {
      const keys = Object.keys(patch);
      if (keys.some((k) => !(LIVE_KEYS as readonly string[]).includes(k))) throw invalid(EDIT_MESSAGES.notHere);
      const m = { ...l, ...patch };
      if (!Array.isArray(m.features) || m.features.some((f) => !KNOWN_FEATURES.has(f)) || typeof m.acceptsMonthly !== "boolean") throw invalid(EDIT_MESSAGES.notHere);
      if (!m.acceptsMonthly) m.monthlyPriceCrc = null;
      if ((m.capacity ?? 0) < 1) throw invalid("Indique cuántas personas pueden alojarse (mínimo 1).");
      if (m.bedrooms === null || (m.bedrooms < 1 && l.kind !== "completo" && l.kind !== "apartamento")) throw invalid(BEDROOMS_ERROR);
      if ((m.bathrooms ?? 0) < 1) throw invalid("Indique el número de baños (mínimo 1).");
      if (m.features.includes("parking")) {
        if (m.parkingPaid === null) throw invalid(PARKING_ERROR);
      } else if (m.parkingPaid !== null) throw invalid(PARKING_ONLY_ERROR);
      if ((m.nightlyPriceCrc ?? 0) <= 0) throw invalid(NIGHTLY_PRICE_ERROR);
      if (m.acceptsMonthly && m.monthlyPriceCrc !== null && m.monthlyPriceCrc <= 0) throw invalid(MONTHLY_PRICE_ERROR);
      Object.assign(l, {
        capacity: m.capacity,
        bedrooms: m.bedrooms,
        bathrooms: m.bathrooms,
        features: [...m.features],
        parkingPaid: m.parkingPaid,
        nightlyPriceCrc: m.nightlyPriceCrc,
        acceptsMonthly: m.acceptsMonthly,
        monthlyPriceCrc: m.monthlyPriceCrc,
        updatedAt: db.now(),
      });
    },

    /** La edición de una casa como la lee el propietario (o el admin), con el estado de cada dato y sus fotos nuevas. */
    toEdit(listingId: string, url: PhotoUrl): ListingEdit | null {
      const e = db.edits.get(listingId);
      if (!e) return null;
      const location = e.lat !== null && e.lng !== null && e.zoneSource !== null ? { lat: e.lat, lng: e.lng, zone: e.zone ?? "", zoneId: e.zoneId, zoneSource: e.zoneSource } : null;
      const rows = db.editPhotosOf(listingId);
      const photos = fromPhotoRows(rows, url).map((p) => {
        const r = rows.find((x) => x.id === p.id)!;
        return { ...p, status: r.status, reviewNote: r.reviewNote, submittedAt: r.submittedAt };
      });
      const fields = Object.fromEntries(Object.entries(e.fields).map(([k, v]) => [k, { ...v }]));
      return {
        ...editOverview([...Object.values(fields), ...photos]),
        fields,
        title: e.title,
        kind: e.kind,
        bathroomShared: e.bathroomShared,
        description: e.description,
        location,
        photos,
      };
    },

    /** Sin ningún dato cambiado ni foto nueva, la edición se borra (remove_edit_photo). */
    dropIfEmpty(listingId: string): void {
      const e = db.edits.get(listingId);
      if (e && isEmpty(e)) db.edits.delete(listingId);
    },

    isEmpty,
  };
}
