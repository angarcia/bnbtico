// Contrato del asistente de publicar: crear el borrador, retomarlo, guardar cada pantalla y enviar a revisión.
// Mismas reglas y mensajes en el fake y en la base (validación por pantalla de src/domain/listing.ts, trigger
// listings_protect, RPC submit_listing).
import { beforeAll, describe, expect, it } from "vitest";
import type { OwnerListingsApi } from "../../src/domain/api";
import { DomainError } from "../../src/domain/errors";
import type { ListingDraft, Step } from "../../src/domain/listing";
import type { ListingsHarness, Seeded } from "./harness";

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

const WALK: { step: Step; invalid: [Partial<ListingDraft>, string][]; valid: Partial<ListingDraft> }[] = [
  {
    step: 1,
    invalid: [
      [{ kind: null, acceptsNightly: true, acceptsMonthly: false }, "Elija Alojamiento completo o Habitación."],
      [{ kind: "completo", acceptsNightly: false, acceptsMonthly: false }, "Marque Vacacional, Mensual o las dos."],
    ],
    valid: { kind: "habitacion", acceptsNightly: true, acceptsMonthly: true },
  },
  {
    step: 2,
    invalid: [
      [{ province: "Marte", canton: "Talamanca", zone: "Cahuita" }, "Elija la provincia."],
      [{ province: "Limón", canton: "", zone: "Cahuita" }, "Elija el cantón."],
      [{ province: "Limón", canton: "Nicoya", zone: "Cahuita" }, "Elija un cantón de la provincia."],
      [{ province: "Limón", canton: "Talamanca", zone: " " }, "Indique la zona, playa o barrio."],
    ],
    valid: { province: "Limón", canton: "Talamanca", zone: "Cahuita" },
  },
  {
    step: 3,
    invalid: [
      [{ lat: null, lng: null }, "Marque en el mapa la ubicación aproximada."],
      [{ lat: 40.4, lng: -3.7 }, "Marque un punto dentro de Costa Rica."],
    ],
    valid: { lat: 9.7366, lng: -82.8431 },
  },
  {
    step: 4,
    invalid: [
      [{ capacity: 0, bedrooms: 1, bathrooms: 1, bathroomShared: true }, "Indique cuántas personas pueden alojarse (mínimo 1)."],
      [{ capacity: 2, bedrooms: 0, bathrooms: 1, bathroomShared: true }, "Indique las habitaciones; solo un alojamiento completo tipo estudio puede tener 0."],
      [{ capacity: 2, bedrooms: 1, bathrooms: 0, bathroomShared: true }, "Indique el número de baños (mínimo 1)."],
      [{ capacity: 2, bedrooms: 1, bathrooms: 1, bathroomShared: null }, "Indique si el baño es privado o compartido."],
    ],
    valid: { capacity: 2, bedrooms: 1, bathrooms: 1, bathroomShared: true },
  },
  {
    step: 5,
    invalid: [[{ features: ["parking"], parkingPaid: null }, "Indique si el parqueo es gratuito o de pago."]],
    valid: { features: ["wifi", "parking"], parkingPaid: false },
  },
  {
    step: 6,
    invalid: [
      [{ title: " ", description: "Linda" }, "Póngale un nombre a la casa."],
      [{ title: "Cabina", description: "" }, "Escriba una descripción."],
      // Ticket 19: nombre de 5 a 60 caracteres y descripción de 80 a 2000.
      [{ title: "Casa", description: "Cabina de madera frente al parque nacional Cahuita, a cinco minutos a pie de la playa, con hamacas y rancho." }, "El nombre de la casa debe tener entre 5 y 60 caracteres."],
      [{ title: "Cabina", description: "Cabina frente al parque." }, "La descripción debe tener entre 80 y 2000 caracteres."],
    ],
    valid: { title: "Cabina Cahuita", description: "Cabina de madera frente al parque nacional Cahuita, a cinco minutos a pie de la playa, con hamacas y rancho." },
  },
  // Revisión UX C4: el paso 7 deja seguir con menos de 5 fotos; el mínimo se exige al enviar (submit).
  { step: 7, invalid: [], valid: {} },
  {
    step: 8,
    invalid: [
      [{ nightlyPriceCrc: null, monthlyPriceCrc: 480000 }, "Indique el precio por noche en colones."],
      [{ nightlyPriceCrc: 42000, monthlyPriceCrc: 0 }, "Indique el precio por mes en colones."],
    ],
    valid: { nightlyPriceCrc: 42000, monthlyPriceCrc: 480000 },
  },
  { step: 9, invalid: [], valid: {} },
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

      it("un borrador nuevo tiene su CT-####, el WhatsApp del perfil y nada preseleccionado", async () => {
        const { id, publicId } = await me.createDraft();
        expect(publicId).toMatch(/^CT-\d+$/);
        const l = await me.getOwn(id);
        expect(l).toMatchObject({
          id,
          publicId,
          status: "draft",
          kind: null,
          acceptsNightly: false,
          province: "Limón",
          canton: "",
          zone: "",
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
        expect(l!.acceptsMonthly).not.toBe(true);
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
          monthlyMode: "amount",
          canton: "Talamanca",
          bathroomShared: true,
          features: ["wifi", "parking"],
          parkingPaid: false,
          photoCount: 5,
          nightlyPriceCrc: 42000,
          monthlyPriceCrc: 480000,
        });
      });

      it("guarda todo lo que normalize limpia: precio por noche sin vacacional, baño sin habitación, datos mensuales sin mensual", async () => {
        await me.saveStep(id, 1, { kind: "completo", acceptsNightly: false, acceptsMonthly: true });
        expect(await me.getOwn(id)).toMatchObject({ kind: "completo", acceptsNightly: false, nightlyPriceCrc: null, bathroomShared: null, monthlyPriceCrc: 480000, monthlyMode: "amount" });
        await me.saveStep(id, 1, { kind: "completo", acceptsNightly: true, acceptsMonthly: false });
        expect(await me.getOwn(id)).toMatchObject({ acceptsMonthly: false, monthlyMode: null, monthlyPriceCrc: null });
        await me.saveStep(id, 5, { features: ["wifi"], parkingPaid: false });
        expect(await me.getOwn(id)).toMatchObject({ features: ["wifi"], parkingPaid: null });
      });

      it("con el borrador que ya tiene el navegador guarda sin releerlo, con las mismas reglas", async () => {
        const known = (await me.getOwn(id))!;
        expect((await rejection(me.saveStep(id, 6, { title: " ", description: "x" }, known))).message).toBe("Póngale un nombre a la casa.");
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
      const s = {} as Record<"ready" | "fewPhotos" | "noKind" | "parkingWithout" | "shortTitle" | "shortText" | "review" | "active" | "changes" | "theirs", Seeded>;

      beforeAll(async () => {
        h = await makeHarness();
        me = h.owner("owner");
        await h.reset();
        s.ready = await h.seed({ status: "draft", photos: 5 });
        s.fewPhotos = await h.seed({ status: "draft", photos: 4 });
        s.noKind = await h.seed({ status: "draft", photos: 5, draft: { kind: null } });
        s.parkingWithout = await h.seed({ status: "draft", photos: 5, draft: { features: ["wifi"], parkingPaid: true } });
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

      it("la base exige lo mismo que el asistente y explica en español lo que falta", async () => {
        expect((await rejection(me.submit(s.fewPhotos.id))).message).toBe("Agregue al menos 5 fotos.");
        expect((await rejection(me.submit(s.noKind.id))).message).toBe("Elija Alojamiento completo o Habitación.");
        expect((await rejection(me.submit(s.parkingWithout.id))).message).toBe("El tipo de parqueo solo aplica si el anuncio tiene parqueo.");
        for (const x of [s.fewPhotos, s.noKind, s.parkingWithout]) expect((await me.getOwn(x.id))?.status).toBe("draft");
      });

      it("nombre de 5 a 60 caracteres y descripción de 80 a 2000 al enviar", async () => {
        // Aquí y no en beforeAll: como mucho cinco borradores sin enviar (el primero ya se envió).
        s.shortTitle = await h.seed({ status: "draft", photos: 5, draft: { title: "Casa" } });
        s.shortText = await h.seed({ status: "draft", photos: 5, draft: { description: "Cabina frente al parque." } });
        expect((await rejection(me.submit(s.shortTitle.id))).message).toBe("El nombre de la casa debe tener entre 5 y 60 caracteres.");
        expect((await rejection(me.submit(s.shortText.id))).message).toBe("La descripción debe tener entre 80 y 2000 caracteres.");
        for (const x of [s.shortTitle, s.shortText]) expect((await me.getOwn(x.id))?.status).toBe("draft");
      });

      it("en revisión, activa o ajena no se envía; con cambios pedidos, sí", async () => {
        expect((await rejection(me.submit(s.review.id))).message).toBe("Este anuncio ya está en revisión.");
        expect((await rejection(me.submit(s.active.id))).message).toBe("Este anuncio no se puede enviar en su estado actual.");
        expect((await rejection(me.submit(s.theirs.id))).message).toBe(NOT_FOUND);
        await me.submit(s.changes.id);
        expect(await me.getOwn(s.changes.id)).toMatchObject({ status: "review", reviewNote: null });
      });
    });
  });
}
