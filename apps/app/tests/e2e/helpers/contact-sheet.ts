// La hoja de contacto desde las pruebas (revisión UX 2026-10-29, N2): las fechas se eligen en el calendario de rango de la
// hoja (como en «¿Cuándo?») y el mensaje es una vista previa, sin caja de texto.
import type { Locator } from "@playwright/test";
import { longDateWithYear, shortDate } from "../../../src/domain/dates";

/** La casilla «Llegada», «Salida» o «Desde» (botón que abre el calendario). */
export const dateBox = (sheet: Locator, label: "Llegada" | "Salida" | "Desde") => sheet.getByRole("button", { name: new RegExp(`^${label}`) });

/** El texto que muestra una casilla para ese día («8 nov»). */
export const boxText = (label: string, day: string | null) => `${label}${day ? shortDate(day) : "Elegir fecha"}`;

/** Un día del calendario de la hoja. */
export const calendarDay = (sheet: Locator, day: string) => sheet.locator(".contact-calendar").getByRole("button", { name: longDateWithYear(day)!, exact: true });

/** Abre el calendario (si no está abierto) y toca los días: llegada y salida, o solo uno. */
export async function pickDates(sheet: Locator, ...days: string[]) {
  if ((await sheet.locator(".contact-calendar").count()) === 0) await dateBox(sheet, "Llegada").or(dateBox(sheet, "Desde")).first().click();
  for (const d of days) await calendarDay(sheet, d).click();
}

/** La vista previa del mensaje. */
export const messagePreview = (sheet: Locator) => sheet.getByTestId("contact-message");
