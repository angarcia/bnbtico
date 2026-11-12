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

async function fixture(kind: string, run: (page: Page) => Promise<void>) {
  const page = await browser.newPage({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 1 });
  try {
    await page.goto(`${origin}tests/unit/private-sheets.fixture.html?kind=${kind}`);
    await page.getByRole("button", { name: "Abrir hoja" }).click();
    await expect(page.getByRole("dialog")).toBeFocused();
    await run(page);
  } finally {
    await page.close();
  }
}

async function released(page: Page) {
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page.locator("#root")).toHaveJSProperty("inert", false);
  await expect(page.locator("html")).not.toHaveClass(/sheet-open/);
}

describe("hojas privadas: contrato de interacción en Chromium", () => {
  for (const kind of ["confirm", "close", "mark"]) {
    it(`${kind}: portal, etiquetas, foco, Tab, Shift+Tab y cierre sin confirmar`, async () => {
      await fixture(kind, async (page) => {
        const dialog = page.getByRole("dialog");
        await expect(dialog).toHaveAttribute("aria-modal", "true");
        await expect(dialog).toHaveAccessibleName(kind === "confirm" ? "¿Cerrar sesión?" : kind === "close" ? "Pausar la casa" : "Marcar una reserva");
        await expect(page.locator("body > section[role=dialog]")).toHaveCount(1);
        await expect(page.locator("#root")).toHaveJSProperty("inert", true);
        await expect(page.locator("html")).toHaveClass(/sheet-open/);
        if (process.env.PRIVATE_SHEET_CAPTURE_PREFIX) {
          await page.evaluate(() => document.fonts.ready);
          await page.screenshot({ path: `${process.env.PRIVATE_SHEET_CAPTURE_PREFIX}-${kind}.png`, animations: "disabled" });
        }
        await page.keyboard.press("Shift+Tab");
        await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
        await page.keyboard.press("Tab");
        const first = kind === "close" ? dialog.locator("input") : dialog.locator("button:not([disabled])").first();
        await expect(first).toBeFocused();
        await page.keyboard.press("Shift+Tab");
        await expect(dialog.getByRole("button", { name: "Cancelar" })).toBeFocused();
        await page.keyboard.press("Escape");
        await released(page);
        if (kind === "confirm") await expect(page.getByRole("button", { name: "Abrir hoja" })).toBeFocused();
        for (const method of ["backdrop", "cancel"]) {
          await page.getByRole("button", { name: "Abrir hoja" }).click();
          if (method === "backdrop") await page.locator(".sheet-backdrop").click({ position: { x: 8, y: 8 } });
          else await page.getByRole("button", { name: "Cancelar" }).click();
          await released(page);
          await expect(page.locator("output")).toHaveText("");
        }
      });
    });

    it(`${kind}: desmontar libera el fondo`, async () => {
      await fixture(kind, async (page) => {
        await page.evaluate(() => (window as unknown as { unmountSheetFixture(): void }).unmountSheetFixture());
        await released(page);
      });
    });
  }

  it("confirmación: confirmar usa returnFocus o el título principal", async () => {
    for (const suffix of ["", "&return=1"]) {
      await fixture(`confirm${suffix}`, async (page) => {
        await expect(page.getByRole("dialog")).toHaveAccessibleDescription("Tendrá que volver a ingresar.");
        await page.getByRole("button", { name: "Cerrar sesión", exact: true }).click();
        await released(page);
        await expect(page.locator("output")).toHaveText("Confirmado");
        await expect(page.getByRole("heading", { name: suffix ? "Destino de retorno" : "Calendario de prueba" })).toBeFocused();
      });
    }
  });

  it("confirmación: apertura eliminada o deshabilitada vuelve al título", async () => {
    for (const action of ["remove", "disable"]) {
      await fixture("confirm", async (page) => {
        await page.locator("#root button").evaluate((button, action) => {
          if (action === "remove") button.remove();
          else (button as HTMLButtonElement).disabled = true;
        }, action);
        await page.keyboard.press("Escape");
        await expect(page.getByRole("heading", { level: 1 })).toBeFocused();
      });
    }
  });

  it("confirmación: conserva los botones deshabilitados en los extremos del recorrido", async () => {
    await fixture("confirm", async (page) => {
      await page.getByRole("button", { name: "Cerrar sesión", exact: true }).evaluate((button) => (button as HTMLButtonElement).disabled = true);
      await page.getByRole("button", { name: "Cancelar" }).focus();
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Cancelar" })).toBeFocused();
      await page.keyboard.press("Escape");
      await released(page);
    });
  });

  it("pausa y reserva: el componente no devuelve el foco por su cuenta", async () => {
    for (const kind of ["close", "mark"]) {
      await fixture(kind, async (page) => {
        await page.keyboard.press("Escape");
        await released(page);
        await expect(page.getByRole("button", { name: "Abrir hoja" })).not.toBeFocused();
        await expect(page.getByRole("heading", { level: 1 })).not.toBeFocused();
      });
    }
  });

  it("pausa: el recorrido omite campos deshabilitados y conserva el valor confirmado", async () => {
    await fixture("close", async (page) => {
      await page.getByLabel("Volver a publicarla el (opcional)").evaluate((input) => (input as HTMLInputElement).disabled = true);
      await page.keyboard.press("Shift+Tab");
      await page.keyboard.press("Tab");
      await expect(page.getByRole("button", { name: "Pausar la casa", exact: true })).toBeFocused();
      await page.keyboard.press("Enter");
      await released(page);
      await expect(page.locator("output")).toHaveText("Sin fecha");
    });
  });

  it("reserva: no confirma sin fechas y el recorrido omite el botón deshabilitado", async () => {
    await fixture("mark", async (page) => {
      await expect(page.getByRole("button", { name: "Marcar como ocupado" })).toBeDisabled();
      await expect(page.getByRole("dialog")).toHaveAccessibleDescription("Marque de una vez las noches de una reserva larga como ocupadas. Elija la llegada y la salida. La noche de la salida queda libre.");
      await page.getByRole("button", { name: "Cancelar" }).focus();
      await page.keyboard.press("Shift+Tab");
      await expect(page.getByRole("dialog").locator("button:not([disabled])").nth(-2)).toBeFocused();
      await page.keyboard.press("Escape");
      await expect(page.locator("output")).toHaveText("");
    });
  });
});

for (const viewport of [{ width: 375, height: 667 }, { width: 390, height: 844 }]) {
  it(`selector compartido: foco, teclado y lista larga en ${viewport.width} px`, async () => {
    const page = await browser.newPage({ viewport });
    try {
      await page.goto(`${origin}tests/unit/private-sheets.fixture.html?kind=picker`);
      const trigger = page.getByTestId("house-picker-trigger");
      await trigger.click();
      const dialog = page.getByRole("dialog", { name: "Filtrar por casa" });
      const list = page.getByRole("listbox", { name: "Elegir casa" });
      await expect(dialog).toBeFocused();
      await expect(page.locator("#root")).toHaveJSProperty("inert", true);
      await expect(list.getByRole("option")).toHaveCount(15);
      await expect(list.getByRole("option", { name: "Casa Manzanillo frente al mar con jardín y acceso al parque nacional", exact: true })).toHaveText("Casa Manzanillo frente al mar con jardín y acceso al parque nacional");
      expect(await list.evaluate((el) => el.scrollHeight > el.clientHeight)).toBe(true);
      const box = (await dialog.boundingBox())!;
      expect(box.y).toBeGreaterThanOrEqual(0);
      await expect.poll(async () => {
        const settled = (await dialog.boundingBox())!;
        return settled.y + settled.height;
      }).toBeLessThanOrEqual(viewport.height + 1);
      // Redondeado: en Linux el alto sale con subpíxeles (51,99998 px en CI el 2026-11-12) aunque el CSS diga 52.
      for (const option of await list.getByRole("option").all()) expect(Math.round((await option.boundingBox())!.height)).toBeGreaterThanOrEqual(52);
      await page.keyboard.press("Shift+Tab");
      const all = list.getByRole("option", { name: "Todas las casas", exact: true });
      await expect(all).toBeFocused();
      await page.keyboard.press("Tab");
      await expect(dialog.getByRole("button", { name: "Cerrar", exact: true })).toBeFocused();
      await page.keyboard.press("Shift+Tab");
      await all.press("ArrowDown");
      const first = list.getByRole("option", { name: "Casa del Caribe 1", exact: true });
      await expect(first).toBeFocused();
      await first.press("Enter");
      await released(page);
      await expect(trigger).toBeFocused();
      await expect(trigger).toHaveText("Casa del Caribe 1");
      await expect(page.locator("output")).toHaveText("house-0");
      for (const close of ["escape", "x", "backdrop"]) {
        await trigger.click();
        await expect(list.getByRole("option", { name: "Casa del Caribe 1", exact: true })).toHaveAttribute("aria-selected", "true");
        if (close === "escape") await page.keyboard.press("Escape");
        else if (close === "x") await dialog.getByRole("button", { name: "Cerrar", exact: true }).click();
        else await page.locator(".sheet-backdrop").click({ position: { x: 8, y: 8 } });
        await released(page);
        await expect(trigger).toBeFocused();
      }
    } finally { await page.close(); }
  });
}
