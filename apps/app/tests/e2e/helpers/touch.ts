import type { Locator, Page } from "@playwright/test";

// Toques reales por CDP (Input.dispatchTouchEvent): pasan por la entrada de Chromium, así que dan pointer/touch events de
// confianza, respetan touch-action, hacen scroll nativo y disparan pointercancel. page.touchscreen solo sabe tocar, y los
// PointerEvent sintéticos no capturan el puntero ni desplazan nada. Necesita hasTouch (lo trae el proyecto Pixel 7).
// Coordenadas en px CSS respecto al viewport, igual que boundingBox().
export interface Finger { x: number; y: number }

export async function touch(page: Page) {
  const cdp = await page.context().newCDPSession(page);
  let last: Finger = { x: 0, y: 0 };
  const point = (f: Finger, id: number) => ({ x: f.x, y: f.y, id, radiusX: 1, radiusY: 1, force: 1 });
  const send = (type: "touchStart" | "touchMove" | "touchEnd", touchPoints: ReturnType<typeof point>[]) =>
    cdp.send("Input.dispatchTouchEvent", { type, touchPoints });
  return {
    /** Primer dedo (id 0). */
    async down(x: number, y: number) {
      last = { x, y };
      await send("touchStart", [point(last, 0)]);
    },
    /** Mueve el primer dedo desde el último punto, en `steps` pasos. */
    async move(x: number, y: number, steps = 10) {
      const from = last;
      for (let i = 1; i <= steps; i++) {
        last = { x: from.x + ((x - from.x) * i) / steps, y: from.y + ((y - from.y) * i) / steps };
        await send("touchMove", [point(last, 0)]);
      }
    },
    /** Segundo dedo (id 1) con el primero quieto donde estaba. */
    async second(x: number, y: number) {
      await send("touchStart", [point(last, 0), point({ x, y }, 1)]);
    },
    /** Levanta todos los dedos. */
    async up() {
      await send("touchEnd", []);
    },
    async center(locator: Locator): Promise<Finger> {
      const b = await locator.boundingBox();
      if (!b) throw new Error("El elemento no se ve: no tiene caja");
      return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
    },
  };
}
