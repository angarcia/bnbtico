// El error de un campo va debajo de ese campo y enlazado a él (historia 07, paso 4): `aria-invalid`, el mensaje en su
// descripción accesible y el párrafo del error justo debajo, sin el aviso general del formulario.
import { expect, type Locator, type Page } from "@playwright/test";

const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/** `control`: el campo (o, en un contador, uno de sus botones). `invalid`: si el control lleva `aria-invalid`. */
export async function expectErrorUnder(page: Page, control: Locator, message: string, { invalid = true }: { invalid?: boolean } = {}) {
  if (invalid) await expect(control).toHaveAttribute("aria-invalid", "true");
  await expect(control).toHaveAccessibleDescription(new RegExp(`^${escape(message)}`));
  const errorId = (await control.getAttribute("aria-describedby"))!.split(" ")[0]!;
  const error = page.locator(`[id="${errorId}"]`);
  await expect(error).toHaveText(message);
  await expect(error).toHaveAttribute("role", "alert");
  const [box, below] = [await control.boundingBox(), await error.boundingBox()];
  expect(below!.y, "el error va debajo del campo").toBeGreaterThanOrEqual(box!.y + box!.height - 1);
  await expect(page.locator('.note[role="alert"]')).toHaveCount(0);
}
