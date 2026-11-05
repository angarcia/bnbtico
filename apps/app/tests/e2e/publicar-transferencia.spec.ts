import { expect, test } from "./helpers/test";
import type { ListingsHarness } from "../contract/harness";
import { postgrestHarness } from "../db/postgrest-harness";
import { emptyDraft } from "../../src/domain/listing";
import { PUBLISH_DRAFT_KEY, PUBLISH_STEP1_KEY, storeLocalDraft, storeStep1 } from "../../src/domain/publish-return";
import { injectSession } from "./helpers/session";

let h: ListingsHarness;

test.beforeAll(async () => {
  h = await postgrestHarness();
});

test.beforeEach(async () => {
  await h.reset();
});

test("transferencia: un guardado fallido conserva las claves; reintentar reutiliza la casa y limpia solo tras recibir el éxito", async ({ page }) => {
  await injectSession(page, "owner");
  const draft = { ...emptyDraft(), kind: "completo" as const, title: "Casa del teléfono", capacity: 3, features: ["wifi" as const] };
  const now = Date.now();
  const raw = { draft: storeLocalDraft(draft, now), step1: storeStep1("habitacion", now) };
  const keys = { draft: PUBLISH_DRAFT_KEY, step1: PUBLISH_STEP1_KEY };
  await page.evaluate(({ keys, raw }) => {
    localStorage.setItem(keys.draft, raw.draft);
    localStorage.setItem(keys.step1, raw.step1);
  }, { keys, raw });
  const stored = () => page.evaluate((keys) => ({ draft: localStorage.getItem(keys.draft), step1: localStorage.getItem(keys.step1) }), keys);

  const failure = "No se pudo guardar el borrador de prueba.";
  let creates = 0;
  const patchIds: (string | null)[] = [];
  let retryResponseStatus: number | null = null;
  let release!: () => void;
  const held = new Promise<void>((resolve) => (release = resolve));
  await page.route("**/rest/v1/listings?**", async (route) => {
    const request = route.request();
    if (request.method() === "POST") creates++;
    if (request.method() !== "PATCH") return route.fallback();
    patchIds.push(new URL(request.url()).searchParams.get("id"));
    if (patchIds.length === 1) {
      return route.fulfill({ status: 400, contentType: "application/json", body: JSON.stringify({ code: "P0001", message: failure }) });
    }
    const response = await route.fetch();
    retryResponseStatus = response.status();
    await held;
    await route.fulfill({ response });
  });

  try {
    await page.goto("/publicar/continuar");
    await expect(page.getByRole("alert")).toHaveText(failure);
    await expect(page).toHaveURL(/\/publicar\/continuar$/);
    expect(await stored()).toEqual(raw);
    expect(creates).toBe(1);
    const afterFailure = await h.owner("owner").listOwn();
    expect(afterFailure).toHaveLength(1);
    const id = afterFailure[0]!.id;
    expect(afterFailure[0]).toMatchObject({ status: "draft", title: "", kind: null });
    expect(patchIds).toEqual([`eq.${id}`]);

    await page.getByRole("button", { name: "Intentar de nuevo" }).click();
    await expect.poll(() => retryResponseStatus).toBe(200);
    await expect(page).toHaveURL(/\/publicar\/continuar$/);
    expect(await stored()).toEqual(raw);
    expect(creates).toBe(1);
    expect(patchIds).toEqual([`eq.${id}`, `eq.${id}`]);
    const beforeAcknowledgement = await h.owner("owner").listOwn();
    expect(beforeAcknowledgement).toHaveLength(1);
    expect(beforeAcknowledgement[0]).toMatchObject({ id, status: "draft", kind: draft.kind, title: draft.title, capacity: draft.capacity, features: draft.features });

    release();
    await expect(page).toHaveURL(new RegExp(`/propietario/publicar/${id}/7$`));
    await expect.poll(stored).toEqual({ draft: null, step1: null });
    expect(creates).toBe(1);
    expect(patchIds).toEqual([`eq.${id}`, `eq.${id}`]);
    expect((await h.owner("owner").listOwn()).map((listing) => listing.id)).toEqual([id]);
  } finally {
    release();
    await page.unrouteAll({ behavior: "ignoreErrors" });
  }
});
