// Contrato del asistente de publicar: crear el borrador, retomarlo, guardar cada pantalla y enviar a revisión.
// Mismas reglas y mensajes en el fake y en la base (validación por pantalla de src/domain/listing.ts, trigger
// listings_protect, RPC submit_listing).
import { beforeAll, describe, expect, it } from "vitest";
import type { OwnerListingsApi } from "../../src/domain/api";
import { DomainError } from "../../src/domain/errors";
import { type ListingDraft, type Step } from "../../src/domain/listing";
import { NIGHTLY_PRICE_ERROR, TITLE_LENGTH_ERROR } from "../../src/domain/listing-rules";
import type { ListingsHarness, Seeded } from "./harness";
import { MAR } from "./points";

const NOT_FOUND = "No encontramos ese anuncio.";
const FROZEN = "Este anuncio no se puede editar en su estado actual. Ábralo para editar y volverá a revisión.";

async function rejection(p: Promise<unknown>): Promise<DomainError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    return e as DomainError;
  }
  throw new Error("se esperaba un error");
}

/** Cada pantalla con un parche inválido (mensaje esperado) y uno válido, sobre un borrador recién creado y relleno en orden. */
/** Descripción válida (80–2000 caracteres, ticket 19) para las pruebas que guardan el paso 6. */
const TEXT = "Descripción de prueba con lo justo para pasar el mínimo de ochenta caracteres que pide el paso seis.";

/** Paso 2 válido: el pin de COMPLETE (Cahuita) con lo que da place_at y la zona Cahuita de la lista. */
const LOCATION_OK: Partial<ListingDraft> = { lat: 9.7366, lng: -82.8431, province: "Limón", canton: "Talamanca", district: "Cahuita", zone: "Cahuita", zoneId: "704-cahuita", zoneSource: "list" };

// Publicar avanza siempre (2026-10-30): solo el tipo del paso 1 rechaza; las demás pantallas guardan lo que se pueda (ver
// PARTIAL). Lo obligatorio se exige al enviar.
const WALK: { step: Step; invalid: [Partial<ListingDraft>, string][]; valid: Partial<ListingDraft> }[] = [
  {
    step: 1,
    invalid: [[{ kind: null }, "Elija Alojamiento completo o Habitación."]],
    valid: { kind: "habitacion" },
  },
  // Ubicación por punto: el mapa, el cantón y la provincia que da el pin, y la zona (con su origen) en una pantalla.
  { step: 2, invalid: [], valid: LOCATION_OK },
  { step: 4, invalid: [], valid: { capacity: 2, bedrooms: 1, bathrooms: 1, bathroomShared: true } },
  { step: 5, invalid: [], valid: { features: ["wifi", "parking"], parkingPaid: false } },
  {
    step: 6,
    invalid: [],
    valid: { title: "Cabina Cahuita", description: "Cabina de madera frente al parque nacional Cahuita, a cinco minutos a pie de la playa, con hamacas y rancho." },
  },
  // Revisión UX C4: el paso 7 deja seguir con menos de 5 fotos; el mínimo (una) se exige al enviar (submit).
  { step: 7, invalid: [], valid: {} },
  { step: 8, invalid: [], valid: { nightlyPriceCrc: 42000, acceptsMonthly: true, monthlyPriceCrc: 480000 } },
  { step: 9, invalid: [], valid: {} },
];

/** Parches incompletos o mal escritos que antes se rechazaban: ahora se guardan (lo que no cabe en la tabla, como null). */
const PARTIAL: { step: Step; patch: Partial<ListingDraft>; stored: Partial<ListingDraft> }[] = [
  { step: 2, patch: { lat: null, lng: null, province: "", canton: "", district: "", zone: "", zoneId: null, zoneSource: null }, stored: { lat: null, lng: null, canton: "", zone: "", zoneSource: null } },
  { step: 2, patch: { ...LOCATION_OK, lat: 40.4, lng: -3.7, canton: "" }, stored: { lat: 40.4, lng: -3.7, canton: "" } },
  { step: 2, patch: { ...LOCATION_OK, zone: " ", zoneId: null, zoneSource: null }, stored: { zoneSource: null, zoneId: null } },
  { step: 4, patch: { capacity: 0, bedrooms: 1, bathrooms: 1, bathroomShared: true }, stored: { capacity: null, bedrooms: 1, bathrooms: 1 } },
  { step: 4, patch: { capacity: Number.NaN, bedrooms: null, bathrooms: 0, bathroomShared: null }, stored: { capacity: null, bedrooms: null, bathrooms: 0, bathroomShared: null } },
  { step: 5, patch: { features: ["parking"], parkingPaid: null }, stored: { features: ["parking"], parkingPaid: null } },
  { step: 6, patch: { title: "", description: "Linda" }, stored: { title: "", description: "Linda" } },
  { step: 6, patch: { title: "Casa", description: "Cabina frente al parque." }, stored: { title: "Casa", description: "Cabina frente al parque." } },
  { step: 8, patch: { nightlyPriceCrc: null, acceptsMonthly: true, monthlyPriceCrc: 480000 }, stored: { nightlyPriceCrc: null, monthlyPriceCrc: 480000 } },
  { step: 8, patch: { nightlyPriceCrc: 0, acceptsMonthly: true, monthlyPriceCrc: 0 }, stored: { nightlyPriceCrc: null, acceptsMonthly: true, monthlyPriceCrc: null } },
];

export function publishContract(name: string, makeHarness: () => Promise<ListingsHarness>) {
  describe(`asistente de publicar · ${name}`, () => {
    let h: ListingsHarness;
    let me: OwnerListingsApi;
    let other: OwnerListingsApi;

    describe("crear y retomar", () => {
      beforeAll(async () => {
        h = await makeHarness();
        me = h.owner("owner");
        other = h.owner("other");
        await h.reset();
      }, 90_000);

      it("sin borradores no hay nada que retomar", async () => {
        expect(await me.findResumable()).toBeNull();
      });

      it("un borrador nuevo tiene su CT-####, el WhatsApp del perfil, se alquila por noches y no por meses", async () => {
        const { id, publicId } = await me.createDraft();
        expect(publicId).toMatch(/^CT-\d+$/);
        const l = await me.getOwn(id);
        expect(l).toMatchObject({
          id,
          publicId,
          status: "draft",
          kind: null,
          acceptsNightly: true,
          acceptsMonthly: false,
          province: "Limón",
          canton: "",
          district: "",
          zone: "",
          zoneId: null,
          zoneSource: null,
          lat: null,
          lng: null,
          capacity: null,
          bedrooms: null,
          bathrooms: null,
          bathroomShared: null,
          title: "",
          description: "",
          features: [],
          parkingPaid: null,
          nightlyPriceCrc: null,
          monthlyPriceCrc: null,
          photoCount: 0,
          photos: [],
          reviewedAt: null,
          reviewNote: null,
          whatsappPhone: "+50687770001",
        });
        expect(await h.anon.linkState(publicId)).toBeNull(); // un borrador que nunca se revisó no tiene enlace público
      });

      it("retomar trae el borrador pendiente más reciente; nunca uno que ya estuvo publicado, enviado o ajeno", async () => {
        await h.reset();
        await h.seed({ status: "draft", draft: { title: "Viejo" } });
        const newest = await h.seed({ status: "draft", draft: { title: "Nuevo" } });
        await h.seed({ status: "reopened", draft: { title: "Estuvo publicada" } });
        await h.seed({ status: "review", draft: { title: "En revisión" } });
        await h.seed({ status: "draft", as: "other", draft: { title: "De Ana" } });
        const found = await me.findResumable();
        expect(found).toMatchObject({ id: newest.id, title: "Nuevo", status: "draft" });
        expect((await other.findResumable())?.title).toBe("De Ana");
      });

      it("como mucho cinco borradores sin enviar; las casas enviadas o reabiertas no cuentan", async () => {
        await h.reset();
        await h.seed({ status: "reopened" });
        await h.seed({ status: "review" });
        for (let i = 0; i < 5; i++) await me.createDraft();
        expect((await rejection(me.createDraft())).message).toBe("Ya tiene 5 borradores sin enviar. Termine o descarte uno antes de empezar otro.");
        await other.createDraft(); // los borradores de otro propietario no cuentan
        const drafts = (await me.listOwn()).filter((l) => l.status === "draft" && l.reviewedAt === null);
        expect(drafts).toHaveLength(5);
        await me.deleteDraft(drafts[0]!.id);
        await me.createDraft();
      });

      it("con solo casas revisadas o enviadas no hay borrador pendiente", async () => {
        await h.reset();
        await h.seed({ status: "reopened" });
        await h.seed({ status: "changes" });
        expect(await me.findResumable()).toBeNull();
      });
    });

    describe("guardar pantalla a pantalla", () => {
      let id: string;

      beforeAll(async () => {
        h = await makeHarness();
        me = h.owner("owner");
        await h.reset();
        id = (await me.createDraft()).id;
      }, 90_000);

      it("cada pantalla rechaza lo inválido con el mensaje del dominio y guarda lo válido", async () => {
        for (const { step, invalid, valid } of WALK) {
          for (const [patch, message] of invalid) {
            const before = await me.getOwn(id);
            expect((await rejection(me.saveStep(id, step, patch))).message, `paso ${step}`).toBe(message);
            expect(await me.getOwn(id), `paso ${step}: nada cambia`).toEqual(before);
          }
          if (step === 7) await h.addPhotos(id, 5);
          const saved = await me.saveStep(id, step, valid);
          expect(saved, `paso ${step}`).toMatchObject(valid);
          expect(await me.getOwn(id)).toEqual(saved);
        }
        expect(await me.getOwn(id)).toMatchObject({
          status: "draft",
          kind: "habitacion",
          acceptsNightly: true,
          acceptsMonthly: true,
          canton: "Talamanca",
          district: "Cahuita",
          zone: "Cahuita",
          zoneId: "704-cahuita",
          zoneSource: "list",
          bathroomShared: true,
          features: ["wifi", "parking"],
          parkingPaid: false,
          photoCount: 5,
          nightlyPriceCrc: 42000,
          monthlyPriceCrc: 480000,
        });
      });

      it("«Continuar» avanza siempre: lo incompleto o mal escrito se guarda (lo que rompería la tabla, como null)", async () => {
        for (const { step, patch, stored } of PARTIAL) {
          const draft = await me.createDraft();
          const saved = await me.saveStep(draft.id, step, patch);
          expect(saved, `paso ${step} ${JSON.stringify(patch)}`).toMatchObject(stored);
          expect(await me.getOwn(draft.id)).toEqual(saved);
          await me.deleteDraft(draft.id);
        }
      });

      it("el tipo (paso 1) sigue siendo obligatorio para guardar, y tampoco cambia nada si falta", async () => {
        const draft = await me.createDraft();
        await me.saveStep(draft.id, 1, { kind: "completo" });
        expect((await rejection(me.saveStep(draft.id, 1, { kind: null }))).message).toBe("Elija Alojamiento completo o Habitación.");
        expect((await me.getOwn(draft.id))?.kind).toBe("completo");
        await me.deleteDraft(draft.id);
      });

      it("Habitación = 1 habitación: al elegir el tipo y aunque el paso 4 no mande habitaciones; de Habitación a completo se queda en 1", async () => {
        const draft = await me.createDraft();
        expect((await me.saveStep(draft.id, 1, { kind: "habitacion" })).bedrooms).toBe(1);
        expect(await me.saveStep(draft.id, 4, { capacity: 2, bedrooms: null, bathrooms: 1, bathroomShared: true })).toMatchObject({ bedrooms: 1, capacity: 2 });
        expect(await me.saveStep(draft.id, 4, { capacity: 2, bedrooms: 4, bathrooms: 1, bathroomShared: true })).toMatchObject({ bedrooms: 1 });
        expect(await me.saveStep(draft.id, 1, { kind: "completo" })).toMatchObject({ kind: "completo", bedrooms: 1 });
        expect(await me.saveStep(draft.id, 4, { capacity: 2, bedrooms: 3, bathrooms: 1, bathroomShared: null })).toMatchObject({ bedrooms: 3 });
        await me.deleteDraft(draft.id);
      });

      it("Sí sin precio se guarda; Sí con precio y luego No no guarda el precio", async () => {
        await me.saveStep(id, 8, { nightlyPriceCrc: 42000, acceptsMonthly: true, monthlyPriceCrc: null });
        expect(await me.getOwn(id)).toMatchObject({ acceptsMonthly: true, monthlyPriceCrc: null });
        await me.saveStep(id, 8, { nightlyPriceCrc: 42000, acceptsMonthly: true, monthlyPriceCrc: 480000 });
        expect(await me.getOwn(id)).toMatchObject({ acceptsMonthly: true, monthlyPriceCrc: 480000 });
        await me.saveStep(id, 8, { nightlyPriceCrc: 42000, acceptsMonthly: false, monthlyPriceCrc: 480000 });
        expect(await me.getOwn(id)).toMatchObject({ acceptsMonthly: false, monthlyPriceCrc: null });
        await me.saveStep(id, 1, { kind: "completo" });
        expect(await me.getOwn(id)).toMatchObject({ kind: "completo", bathroomShared: null });
        await me.saveStep(id, 5, { features: ["wifi"], parkingPaid: false });
        expect(await me.getOwn(id)).toMatchObject({ features: ["wifi"], parkingPaid: null });
      });

      it("con el borrador que ya tiene el navegador guarda sin releerlo, con las mismas reglas", async () => {
        const known = (await me.getOwn(id))!;
        expect((await rejection(me.saveStep(id, 1, { kind: null }, known))).message).toBe("Elija Alojamiento completo o Habitación.");
        const saved = await me.saveStep(id, 6, { title: "Con lo del navegador", description: TEXT }, known);
        expect(saved).toMatchObject({ title: "Con lo del navegador", description: TEXT, status: "draft" });
        expect(await me.getOwn(id)).toEqual(saved);
        const review = await h.seed({ status: "review" });
        const stale = { ...(await me.getOwn(review.id))!, status: "draft" as const };
        expect((await rejection(me.saveStep(review.id, 6, { title: "Otro nombre", description: TEXT }, stale))).message).toBe(FROZEN);
        expect((await rejection(me.saveStep(review.id, 6, { title: "Otro nombre", description: TEXT }, known))).message).toBe(NOT_FOUND);
      });

      it("el paso 7 cuenta las fotos del servidor, nunca un número del formulario, y deja seguir con menos de 5", async () => {
        const four = await h.seed({ status: "draft", photos: 4 });
        expect((await me.saveStep(four.id, 7, { photoCount: 9 })).photoCount).toBe(4);
        await h.addPhotos(four.id, 1);
        expect((await me.saveStep(four.id, 7, { photoCount: 0 })).photoCount).toBe(5);
      });

      it("con cambios pedidos se edita; en revisión o activa, el mensaje del trigger; ajena o inexistente, no existe", async () => {
        const changes = await h.seed({ status: "changes" });
        expect(await me.saveStep(changes.id, 6, { title: "Cabina corregida", description: TEXT })).toMatchObject({ status: "changes", title: "Cabina corregida" });
        for (const status of ["review", "active"] as const) {
          const s = await h.seed({ status });
          expect((await rejection(me.saveStep(s.id, 6, { title: "Otro nombre", description: TEXT }))).message).toBe(FROZEN);
          expect((await me.getOwn(s.id))?.title).toBe("Cabina Cahuita");
        }
        const theirs = await h.seed({ status: "draft", as: "other" });
        expect((await rejection(me.saveStep(theirs.id, 6, { title: "Mía propia", description: TEXT }))).message).toBe(NOT_FOUND);
        expect((await rejection(me.saveStep("00000000-0000-4000-8000-999999999999", 6, { title: "Casa x", description: TEXT }))).message).toBe(NOT_FOUND);
        expect((await rejection(me.saveStep("no-es-un-id", 6, { title: "Casa x", description: TEXT }))).message).toBe(NOT_FOUND);
      });
    });

    describe("enviar a revisión", () => {
      const s = {} as Record<"ready" | "noPhotos" | "noKind" | "loose" | "shortTitle" | "review" | "active" | "changes" | "theirs", Seeded>;

      beforeAll(async () => {
        h = await makeHarness();
        me = h.owner("owner");
        await h.reset();
        s.ready = await h.seed({ status: "draft", photos: 5 });
        s.noPhotos = await h.seed({ status: "draft", photos: 0 });
        s.noKind = await h.seed({ status: "draft", photos: 5, draft: { kind: null } });
        s.review = await h.seed({ status: "review" });
        s.active = await h.seed({ status: "active" });
        s.changes = await h.seed({ status: "changes" });
        s.theirs = await h.seed({ status: "draft", as: "other", photos: 5 });
      }, 90_000);

      it("un borrador completo con 5 fotos pasa a revisión y sigue sin verse en público", async () => {
        await me.submit(s.ready.id);
        expect(await me.getOwn(s.ready.id)).toMatchObject({ status: "review", reviewNote: null });
        expect(await h.anon.linkState(s.ready.publicId)).toBe("blocked");
        expect((await me.findResumable())?.id).not.toBe(s.ready.id);
      });

      it("la base exige lo obligatorio y explica en español lo que falta: tipo y fotos", async () => {
        expect((await rejection(me.submit(s.noKind.id))).message).toBe("Elija Alojamiento completo o Habitación.");
        expect((await rejection(me.submit(s.noPhotos.id))).message).toBe("Añada al menos una foto.");
        for (const x of [s.noKind, s.noPhotos]) expect((await me.getOwn(x.id))?.status).toBe("draft");
      });

      it("con una sola foto se envía a revisión", async () => {
        await h.addPhotos(s.noPhotos.id, 1);
        await me.submit(s.noPhotos.id);
        expect(await me.getOwn(s.noPhotos.id)).toMatchObject({ status: "review", photoCount: 1 });
      });

      it("capacidad, habitaciones, baños, baño, descripción y parqueo sin decir no bloquean el envío (publicar avanza siempre)", async () => {
        s.loose = await h.seed({
          status: "draft",
          photos: 1,
          draft: { kind: "habitacion", capacity: null, bedrooms: null, bathrooms: null, bathroomShared: null, description: "Cabina frente al parque.", features: ["parking"], parkingPaid: null, acceptsMonthly: true, monthlyPriceCrc: null },
        });
        await me.submit(s.loose.id);
        expect(await me.getOwn(s.loose.id)).toMatchObject({ status: "review", capacity: null, bathroomShared: null, parkingPaid: null });
      });

      it("el nombre de 5 a 32 caracteres sigue siendo obligatorio", async () => {
        s.shortTitle = await h.seed({ status: "draft", photos: 5, draft: { title: "Casa" } });
        expect((await rejection(me.submit(s.shortTitle.id))).message).toBe(TITLE_LENGTH_ERROR);
        const blank = await h.seed({ status: "draft", photos: 5, draft: { title: "" } });
        expect((await rejection(me.submit(blank.id))).message).toBe("Póngale un nombre a la casa.");
        for (const x of [s.shortTitle, blank]) expect((await me.getOwn(x.id))?.status).toBe("draft");
      });

      it("la descripción solo tiene tope duro de 2000: corta se envía, de 2001 no", async () => {
        const short = await h.seed({ status: "draft", photos: 1, draft: { description: "Corta." } });
        await me.submit(short.id);
        expect((await me.getOwn(short.id))?.status).toBe("review");
        const long = await h.seed({ status: "draft", photos: 1, draft: { description: "D".repeat(2001) } });
        expect((await rejection(me.submit(long.id))).message).toBe("La descripción debe tener entre 80 y 2000 caracteres o quedar vacía.");
        expect((await me.getOwn(long.id))?.status).toBe("draft");
      });

      it("en revisión, activa o ajena no se envía; con cambios pedidos, sí", async () => {
        expect((await rejection(me.submit(s.review.id))).message).toBe("Este anuncio ya está en revisión.");
        expect((await rejection(me.submit(s.active.id))).message).toBe("Este anuncio no se puede enviar en su estado actual.");
        expect((await rejection(me.submit(s.theirs.id))).message).toBe(NOT_FOUND);
        await me.submit(s.changes.id);
        expect(await me.getOwn(s.changes.id)).toMatchObject({ status: "review", reviewNote: null });
      });
    });

    describe("enviar: noche obligatoria y mensual opcional", () => {
      // Su propio reset: «enviar a revisión» ya llega al tope de cinco borradores sin enviar.
      beforeAll(async () => {
        h = await makeHarness();
        me = h.owner("owner");
        await h.reset();
      }, 90_000);

      it("sin precio por noche no se envía; mensual sin precio (a negociar) sí", async () => {
        const noNightly = await h.seed({ status: "draft", photos: 5, draft: { nightlyPriceCrc: null } });
        expect((await rejection(me.submit(noNightly.id))).message).toBe(NIGHTLY_PRICE_ERROR);
        expect((await me.getOwn(noNightly.id))?.status).toBe("draft");
        const negotiable = await h.seed({ status: "draft", photos: 5, draft: { acceptsMonthly: true, monthlyPriceCrc: null } });
        await me.submit(negotiable.id);
        expect(await me.getOwn(negotiable.id)).toMatchObject({ status: "review", acceptsMonthly: true, monthlyPriceCrc: null });
      });
    });

    describe("enviar: la ubicación sale del pin y la zona se comprueba", () => {
      // Mismo orden y mensajes que submit_listing (20261028071444_ubicacion_en_listings.sql). Cada prueba con su reset:
      // como mucho cinco borradores sin enviar.
      beforeAll(async () => {
        h = await makeHarness();
        me = h.owner("owner");
      }, 90_000);

      const refused = async (draft: Parameters<ListingsHarness["seed"]>[0]["draft"]) => {
        const s = await h.seed({ status: "draft", photos: 5, draft });
        const message = (await rejection(me.submit(s.id))).message;
        expect((await me.getOwn(s.id))?.status).toBe("draft");
        return message;
      };

      it("provincia, cantón y distrito se recalculan desde el pin: un cantón equivocado se guarda corregido", async () => {
        await h.reset();
        const s = await h.seed({ status: "draft", photos: 5, draft: { province: "Limón", canton: "Limón", district: "Limón" } });
        await me.submit(s.id);
        expect(await me.getOwn(s.id)).toMatchObject({ status: "review", province: "Limón", canton: "Talamanca", district: "Cahuita", zone: "Cahuita", zoneSource: "list" });
      });

      it("una zona de la lista guarda el nombre de la lista; «Otra…» guarda lo escrito sin espacios de más", async () => {
        await h.reset();
        const list = await h.seed({ status: "draft", photos: 5, draft: { zone: "cahuita", zoneId: "704-cahuita", zoneSource: "list" } });
        const other = await h.seed({ status: "draft", photos: 5, draft: { zone: "  Rancho Escondido ", zoneId: null, zoneSource: "other" } });
        const district = await h.seed({ status: "draft", photos: 5, draft: { zone: "Cahuita", zoneId: null, zoneSource: "district" } });
        for (const x of [list, other, district]) await me.submit(x.id);
        expect(await me.getOwn(list.id)).toMatchObject({ status: "review", zone: "Cahuita" });
        expect(await me.getOwn(other.id)).toMatchObject({ status: "review", zone: "Rancho Escondido", zoneId: null, zoneSource: "other" });
        expect(await me.getOwn(district.id)).toMatchObject({ status: "review", zone: "Cahuita", zoneSource: "district" });
      });

      it("sin pin, en el mar o fuera del país no se envía", async () => {
        await h.reset();
        expect(await refused({ lat: null, lng: null })).toBe("Marque en el mapa la ubicación aproximada.");
        expect(await refused({ ...MAR })).toBe("Ponga el punto sobre tierra, dentro de Costa Rica.");
      });

      it("sin zona, una de la lista a más de 5 km o un distrito que no es el del pin no se envían", async () => {
        await h.reset();
        expect(await refused({ zone: "Cahuita", zoneSource: null })).toBe("Elija la zona.");
        expect(await refused({ zone: " ", zoneSource: "other", zoneId: null })).toBe("Elija la zona.");
        expect(await refused({ zone: "Cahuita", zoneSource: "list", zoneId: null })).toBe("Elija la zona.");
        expect(await refused({ zone: "Manzanillo", zoneSource: "list", zoneId: "704-manzanillo" })).toBe("La zona elegida queda a más de 5 km del punto. Elija otra.");
        expect(await refused({ zone: "Sixaola", zoneSource: "district", zoneId: null })).toBe("La zona no coincide con el distrito del punto. Elija otra.");
      });

      it("«Otra…» admite como mucho 60 caracteres", async () => {
        await h.reset();
        expect(await refused({ zone: "x".repeat(61), zoneSource: "other", zoneId: null })).toBe("La zona puede tener como mucho 60 caracteres.");
        expect(await refused({ zone: "Cahuita", zoneSource: "other", zoneId: "704-cahuita" })).toBe("Elija la zona.");
      });
    });
  });
}
