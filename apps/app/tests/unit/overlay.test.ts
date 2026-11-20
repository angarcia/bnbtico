// Superficies comunes (historia 07, paso 3): la pila de shared/overlay-stack.ts y los contenedores de shared/overlay.tsx en
// Chromium, con el banco de overlay.fixture.tsx.
import { afterAll, beforeAll, describe, it } from "vitest";
import { chromium, expect, type Browser, type Page } from "@playwright/test";
import { createServer, type ViteDevServer } from "vite";
import react from "@vitejs/plugin-react";

let server: ViteDevServer;
let browser: Browser;
let origin: string;

beforeAll(async () => {
  server = await createServer({ configFile: false, plugins: [react()], server: { host: "127.0.0.1", port: 0 } });
  await server.listen();
  origin = server.resolvedUrls!.local[0]!;
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH });
}, 30_000);
afterAll(async () => {
  await browser?.close();
  await server?.close();
});

const PHONE = { width: 393, height: 851 };
const DESKTOP = { width: 1280, height: 800 };

async function bench(run: (page: Page) => Promise<void>, { viewport = PHONE, kind = "sheet" } = {}) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  try {
    await page.goto(`${origin}tests/unit/overlay.fixture.html?kind=${kind}`);
    await page.getByRole("button", { name: "Abrir hoja" }).click();
    await expect(page.getByRole("dialog", { name: "Hoja de prueba" })).toBeFocused();
    await run(page);
  } finally {
    await page.close();
  }
}

const sheet = (page: Page) => page.getByRole("dialog", { name: "Hoja de prueba" });
const discard = (page: Page) => page.getByRole("dialog", { name: "¿Descartar los cambios?" });

async function closedTo(page: Page, reason: string) {
  await expect(sheet(page)).toHaveCount(0);
  await expect(page.locator("output")).toHaveText(new RegExp(`cerrada:${reason}$`));
  await expect(page.locator("#root")).toHaveJSProperty("inert", false);
  await expect(page.locator("html")).not.toHaveClass(/sheet-open/);
  await expect(page.getByRole("button", { name: "Abrir hoja" })).toBeFocused();
}

describe("superficies apiladas", () => {
  it("Escape cierra solo la de arriba; la de abajo sigue inerte mientras tanto y el foco vuelve a cada una", async () => {
    await bench(async (page) => {
      const opener = sheet(page).getByRole("button", { name: "Abrir otra" });
      await opener.click();
      const top = page.getByRole("dialog", { name: "Hoja de encima" });
      await expect(top).toBeFocused();
      await expect(sheet(page)).toHaveJSProperty("inert", true);
      await expect(page.locator("#root")).toHaveJSProperty("inert", true);
      await page.keyboard.press("Escape");
      await expect(top).toHaveCount(0);
      await expect(sheet(page)).toBeVisible();
      await expect(sheet(page)).toHaveJSProperty("inert", false);
      await expect(page.locator("html")).toHaveClass(/sheet-open/);
      await expect(opener).toBeFocused();
      await page.keyboard.press("Escape");
      await closedTo(page, "escape");
    });
  });

  it("Tab no sale de la de arriba", async () => {
    await bench(async (page) => {
      await sheet(page).getByRole("button", { name: "Abrir otra" }).click();
      const top = page.getByRole("dialog", { name: "Hoja de encima" });
      const only = top.getByRole("button", { name: "Cerrar la de encima" });
      await page.keyboard.press("Tab");
      await expect(top.getByRole("button", { name: "Cerrar", exact: true })).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(only).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(top.getByRole("button", { name: "Cerrar", exact: true })).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await expect(only).toBeFocused();
    });
  });

  it("el aviso se ve por encima de la hoja", async () => {
    await bench(async (page) => {
      await sheet(page).getByRole("button", { name: "Avisar" }).click();
      const toast = page.locator(".toast");
      await expect(toast).toHaveText("Aviso de prueba");
      const box = (await toast.boundingBox())!;
      const onTop = await page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.closest(".toast") !== null, { x: box.x + box.width / 2, y: box.y + box.height / 2 });
      expect(onTop).toBe(true);
    });
  });
});

describe("cambios sin guardar (D10)", () => {
  it("sin cambios, Escape, el fondo y la X cierran directamente", async () => {
    for (const how of ["escape", "backdrop", "button"] as const) {
      await bench(async (page) => {
        if (how === "escape") await page.keyboard.press("Escape");
        else if (how === "backdrop") await page.getByTestId("sheet-backdrop").click({ position: { x: 8, y: 8 } });
        else await sheet(page).getByRole("button", { name: "Cerrar", exact: true }).click();
        await expect(discard(page)).toHaveCount(0);
        await closedTo(page, how);
      });
    }
  });

  it("con cambios, pregunta «¿Descartar los cambios?»: «Seguir editando» vuelve con lo escrito y «Descartar» cierra las dos", async () => {
    await bench(async (page) => {
      const field = sheet(page).getByLabel("Nota");
      await field.fill("Remodelación");
      for (const how of ["escape", "backdrop", "button"] as const) {
        if (how === "escape") await page.keyboard.press("Escape");
        else if (how === "backdrop") await page.getByTestId("sheet-backdrop").first().click({ position: { x: 8, y: 8 } });
        else await sheet(page).getByRole("button", { name: "Cerrar", exact: true }).click();
        await expect(discard(page)).toBeVisible();
        await expect(discard(page)).toContainText("Los cambios que hizo no se guardarán.");
        await expect(discard(page).getByRole("button")).toHaveText(["Descartar", "Seguir editando"]);
        await discard(page).getByRole("button", { name: "Seguir editando" }).click();
        await expect(discard(page)).toHaveCount(0);
        await expect(field).toHaveValue("Remodelación");
      }
      // Escape en la pregunta solo cierra la pregunta.
      await page.keyboard.press("Escape");
      await page.keyboard.press("Escape");
      await expect(discard(page)).toHaveCount(0);
      await expect(sheet(page)).toBeVisible();
      await page.keyboard.press("Escape");
      await discard(page).getByRole("button", { name: "Descartar" }).click();
      await closedTo(page, "escape");
    });
  });

  it("mientras está ocupada no se cierra de ninguna forma", async () => {
    await bench(async (page) => {
      await sheet(page).getByRole("button", { name: "Ocupada" }).click();
      await page.keyboard.press("Escape");
      await page.getByTestId("sheet-backdrop").click({ position: { x: 8, y: 8 } });
      await expect(sheet(page).getByRole("button", { name: "Cerrar", exact: true })).toBeDisabled();
      await expect(sheet(page)).toBeVisible();
      await expect(sheet(page)).toHaveAttribute("aria-busy", "true");
    });
  });
});

describe("Atrás (D9)", () => {
  it("en el teléfono, Atrás cierra la hoja de arriba y deja la página donde estaba", async () => {
    await bench(async (page) => {
      const url = page.url();
      await sheet(page).getByRole("button", { name: "Abrir otra" }).click();
      await page.goBack();
      await expect(page.getByRole("dialog", { name: "Hoja de encima" })).toHaveCount(0);
      await expect(sheet(page)).toBeVisible();
      await page.goBack();
      await closedTo(page, "back");
      expect(page.url()).toBe(url);
    });
  });

  it("en el teléfono, cerrar con Escape quita su entrada del historial", async () => {
    await bench(async (page) => {
      const length = await page.evaluate(() => history.length);
      await page.keyboard.press("Escape");
      await closedTo(page, "escape");
      await expect.poll(() => page.evaluate(() => (history.state as Record<string, unknown> | null)?.["3bstaysCapa"] ?? 0)).toBe(0);
      expect(await page.evaluate(() => history.length)).toBe(length);
    });
  });

  it("con cambios, Atrás pregunta y la hoja sigue abierta con su entrada", async () => {
    await bench(async (page) => {
      await sheet(page).getByLabel("Nota").fill("Algo");
      await page.goBack();
      await expect(discard(page)).toBeVisible();
      await page.goBack();
      await expect(discard(page)).toHaveCount(0);
      await expect(sheet(page)).toBeVisible();
      await page.goBack();
      await discard(page).getByRole("button", { name: "Descartar" }).click();
      await closedTo(page, "back");
    });
  });

  it("en escritorio, la ventana no añade entradas: Atrás no la cierra", async () => {
    await bench(async (page) => {
      await expect(sheet(page)).toHaveClass(/dialog-normal/);
      expect(await page.evaluate(() => (history.state as Record<string, unknown> | null)?.["3bstaysCapa"] ?? 0)).toBe(0);
      await page.keyboard.press("Escape");
      await closedTo(page, "escape");
    }, { viewport: DESKTOP, kind: "dialog" });
  });
});

describe("subtítulo", () => {
  it("la ventana de escritorio pinta el subtítulo bajo el título, en su cabecera, igual que la hoja", async () => {
    for (const [kind, viewport] of [["dialog", DESKTOP], ["sheet", PHONE]] as const) {
      await bench(async (page) => {
        const title = sheet(page).getByRole("heading", { name: "Hoja de prueba" });
        const subtitle = sheet(page).getByText("Casa de prueba");
        await expect(subtitle).toBeVisible();
        // Las dos cajas en el mismo instante: la hoja sube animada y dos medidas seguidas la pillan en sitios distintos.
        const titleHandle = await title.elementHandle();
        const [t, s] = await subtitle.evaluate((el, h) => {
          const a = (h as Element).getBoundingClientRect(), b = el.getBoundingClientRect();
          return [{ y: a.y, height: a.height }, { y: b.y }];
        }, titleHandle);
        expect(s.y).toBeGreaterThanOrEqual(t.y + t.height - 1);
      }, { kind, viewport });
    }
  }, 30_000);
});

