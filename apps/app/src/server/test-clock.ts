// Reloj de pruebas (fase 5): POST /_pruebas/oferta/CT-#### con { "diasRestantes": n } y `Authorization: Bearer
// <TEST_CLOCK_SECRET>` deja esa casa con n días de oferta (test_set_offer_days_left), corre el trabajo del día
// (run_subscription_day) y un lote de envío de avisos, y responde lo ocurrido. Doble cerrojo: aquí, 404 en producción y
// sin secreto; en la base, test_set_offer_days_left se niega sin el secreto de Vault bnbtico_test_clock.
import type { Context } from "hono";
import { DomainError } from "../domain/errors";
import { parsePublicId } from "../domain/share";
import type { Env } from "./app";
import { reminderBase, sendReminders, type ReminderRuntime } from "./reminders";

const MAX_DAYS = 1000;

/** Comparación en tiempo constante (como la del secreto de purga). */
function sameSecret(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

export async function testClock(c: Context<{ Bindings: Env }>, runtime: ((env: Env) => ReminderRuntime | null) | undefined, log: (line: string) => void = (l) => console.log(l)) {
  const secret = c.env.TEST_CLOCK_SECRET;
  if (c.env.ENVIRONMENT === "production" || !secret) return c.json({ error: "No encontrado." }, 404);
  const given = c.req.header("authorization")?.replace(/^Bearer /, "") ?? "";
  if (!sameSecret(given, secret)) return c.json({ error: "No autorizado." }, 401);

  const publicId = parsePublicId(c.req.param("publicId") ?? "");
  if (!publicId) return c.json({ error: "Id de casa no válido." }, 400);
  let days: unknown;
  try {
    days = ((await c.req.json()) as { diasRestantes?: unknown }).diasRestantes;
  } catch {
    days = undefined;
  }
  if (typeof days !== "number" || !Number.isInteger(days) || Math.abs(days) > MAX_DAYS) return c.json({ error: `diasRestantes debe ser un entero entre -${MAX_DAYS} y ${MAX_DAYS}.` }, 400);

  const rt = runtime?.(c.env) ?? null;
  if (!rt) return c.json({ error: "Falta la clave de servicio." }, 503);
  let promoEndsOn: string;
  try {
    promoEndsOn = await rt.service.setOfferDaysLeft(publicId, days);
  } catch (e) {
    if (e instanceof DomainError) return c.json({ error: e.message }, 409);
    throw e;
  }
  const day = await rt.service.runDay();
  const reminders = await sendReminders(rt, { base: reminderBase(c.env, new URL(c.req.url).origin), log });
  log(JSON.stringify({ event: "test_clock", publicId, diasRestantes: days, promoEndsOn, ...day }));
  return c.json({ publicId, diasRestantes: days, promoEndsOn, day, reminders });
}
