// Envío de los avisos (fase 5, ticket 03): sendReminders del worker sobre la cola real (fake en memoria y Supabase local),
// con un remitente inyectado. Un aviso nunca sale dos veces: ni con reintentos, ni con dos pasadas a la vez, ni tras un
// resultado dudoso.
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { costaRicaToday } from "../../src/domain/inquiry";
import { payLink, reminderWhatsApp, type PaymentEvent } from "../../src/domain/subscription";
import type { WhatsAppSendResult, WhatsAppSender } from "../../src/domain/whatsapp-sender";
import { REMINDER_BATCH, sendReminders } from "../../src/server/reminders";
import type { SubscriptionHarness } from "./harness";

const BASE = "https://nueva.bnbtico.com";
const today = () => costaRicaToday(Date.now());

/** Remitente de prueba: responde en orden lo que se le pide (después, ok) y anota cada intento. */
function scripted(script: Array<WhatsAppSendResult | "throw"> = [], delayMs = 0) {
  const calls: { to: string; body: string }[] = [];
  let n = 0;
  const sender: WhatsAppSender = {
    async send(to, body) {
      calls.push({ to, body });
      if (delayMs) await new Promise((r) => setTimeout(r, delayMs));
      const next = script.shift();
      if (next === "throw") throw new Error("se cayó el remitente");
      return next ?? { ok: true, ref: `ref-${++n}` };
    },
  };
  return { sender, calls };
}

export function reminderSendContract(name: string, makeHarness: () => Promise<SubscriptionHarness>) {
  describe(`envío de avisos · ${name}`, () => {
    let h: SubscriptionHarness;
    const lines: string[] = [];
    const log = (l: string) => lines.push(l);
    const run = (sender: WhatsAppSender | null, allowlist: ReadonlySet<string> | null = null, limit?: number) =>
      sendReminders({ service: h.service, sender, allowlist }, { base: BASE, log, ...(limit ? { limit } : {}) });
    /** Casa activa con oferta, sin método, con `days` días por delante y su aviso en cola. */
    const queued = async (days = 30, spec: Parameters<SubscriptionHarness["seed"]>[0] = { status: "active" }) => {
      const l = await h.seed(spec);
      await h.setDaysLeft(l.id, days);
      await h.service.runDay(today());
      return l;
    };

    beforeAll(async () => {
      h = await makeHarness();
    }, 90_000);

    beforeEach(async () => {
      lines.length = 0;
      await h.reset();
    }, 60_000);

    it("compone el texto del dominio con el enlace de pago y lo guarda como enviado con el número", async () => {
      const l = await queued(30, { status: "active", draft: { title: "Casa Cocles" } });
      const { sender, calls } = scripted();
      const r = await run(sender);
      const [stored] = (await h.reminders(l.id)).filter((x) => x.daysBefore === 30);
      const endsOn = (await h.billing("owner").overview()).houses.find((x) => x.listingId === l.id)!.promoEndsOn!;
      const body = reminderWhatsApp({ name: h.ownerName("owner"), title: "Casa Cocles", endsOn, link: payLink(BASE, l.publicId), daysBefore: 30 });
      expect(calls).toEqual([{ to: h.phone("owner"), body }]);
      expect(body).toContain(`${BASE}/propietario/suscripcion#pago=${l.publicId}`);
      expect(stored).toMatchObject({ status: "sent", attempts: 1, toPhone: h.phone("owner"), body, providerRef: "ref-1" });
      expect(stored!.sentAt).not.toBeNull();
      expect(r).toMatchObject({ claimed: 1, sent: 1, retry: 0, unknown: 0, skipped: 0 });
      expect(JSON.parse(lines.at(-1)!)).toMatchObject({ event: "reminders", claimed: 1, sent: 1 });
    });

    it("el día 0 manda el texto del último día", async () => {
      const l = await queued(0);
      const { sender, calls } = scripted();
      await run(sender);
      expect(calls[0]!.body).toContain("termina hoy");
      expect((await h.reminders(l.id))[0]).toMatchObject({ daysBefore: 0, status: "sent" });
    });

    it(`lote de ${REMINDER_BATCH} como mucho: lo que sobra sale en la pasada siguiente`, async () => {
      await queued(30);
      await queued(7);
      await queued(0);
      const first = scripted();
      expect(await run(first.sender, null, 2)).toMatchObject({ claimed: 2, sent: 2 });
      expect(first.calls).toHaveLength(2);
      const second = scripted();
      expect(await run(second.sender, null, 2)).toMatchObject({ claimed: 1, sent: 1 });
      const third = scripted();
      expect(await run(third.sender)).toMatchObject({ claimed: 0, sent: 0 });
      expect(third.calls).toHaveLength(0);
    });

    it("un rechazo seguro de la pasarela vuelve a la cola y la pasada siguiente lo manda una sola vez", async () => {
      const l = await queued(30);
      const refused = scripted([{ ok: false, definite: true, error: "Twilio 400 21211" }]);
      expect(await run(refused.sender)).toMatchObject({ claimed: 1, sent: 0, retry: 1 });
      expect((await h.reminders(l.id))[0]).toMatchObject({ status: "queued", attempts: 1 });
      const ok = scripted();
      expect(await run(ok.sender)).toMatchObject({ claimed: 1, sent: 1 });
      expect(await run(ok.sender)).toMatchObject({ claimed: 0 });
      expect(ok.calls).toHaveLength(1);
      expect((await h.reminders(l.id))[0]).toMatchObject({ status: "sent", attempts: 2 });
    });

    it("un resultado dudoso (sin respuesta) queda «unknown» y no se vuelve a mandar nunca", async () => {
      const l = await queued(30);
      const doubtful = scripted([{ ok: false, definite: false, error: "sin respuesta en 10 s" }]);
      expect(await run(doubtful.sender)).toMatchObject({ claimed: 1, unknown: 1 });
      await h.service.runDay(today());
      const again = scripted();
      expect(await run(again.sender)).toMatchObject({ claimed: 0 });
      expect(again.calls).toHaveLength(0);
      expect((await h.reminders(l.id))[0]).toMatchObject({ status: "unknown", attempts: 1 });
    });

    it("si el remitente lanza, también es dudoso (nunca se reintenta)", async () => {
      const l = await queued(30);
      expect(await run(scripted(["throw"]).sender)).toMatchObject({ unknown: 1 });
      expect((await h.reminders(l.id))[0]).toMatchObject({ status: "unknown" });
    });

    it("dos pasadas a la vez mandan cada aviso una sola vez", async () => {
      await queued(30);
      await queued(7);
      await queued(0);
      const { sender, calls } = scripted([], 30);
      const [a, b] = await Promise.all([run(sender, null, 2), run(sender, null, 2)]);
      expect(a.claimed + b.claimed).toBe(3);
      expect(calls).toHaveLength(3);
      expect(new Set(calls.map((c) => c.body)).size).toBe(3);
    });

    it("si la casa ya tiene método de pago o se paró, el aviso se omite sin mandarlo", async () => {
      const withCard = await queued(30);
      const stopped = await queued(7, { status: "active", as: "other" });
      const card: PaymentEvent = { provider: "fake", eventId: `evt_${Date.now()}`, type: "setup_completed", ownerId: h.ownerId("owner"), customerRef: "cus_x", methodRef: "pm_x", brand: "visa", last4: "4242", expMonth: 12, expYear: 2029 };
      await h.service.applyPaymentEvent(card);
      await h.billing("other").stop(stopped.id);
      const { sender, calls } = scripted();
      expect(await run(sender)).toMatchObject({ claimed: 0, sent: 0 });
      expect(calls).toHaveLength(0);
      expect((await h.reminders(withCard.id))[0]).toMatchObject({ status: "skipped" });
      expect((await h.reminders(stopped.id))[0]).toMatchObject({ status: "skipped" });
    });

    it("con lista de números permitidos, los de fuera se omiten (y no se mandan) y los de dentro salen", async () => {
      const outside = await queued(30);
      const inside = await queued(7, { status: "active", as: "other" });
      const { sender, calls } = scripted();
      expect(await run(sender, new Set([h.phone("other")]))).toMatchObject({ claimed: 2, sent: 1, skipped: 1 });
      expect(calls.map((c) => c.to)).toEqual([h.phone("other")]);
      expect((await h.reminders(outside.id))[0]).toMatchObject({ status: "skipped" });
      expect((await h.reminders(inside.id))[0]).toMatchObject({ status: "sent" });
    });

    it("sin remitente configurado no reclama nada: los avisos siguen en cola", async () => {
      const l = await queued(30);
      expect(await run(null)).toMatchObject({ claimed: 0, sent: 0 });
      expect((await h.reminders(l.id))[0]).toMatchObject({ status: "queued", attempts: 0 });
      expect(JSON.parse(lines.at(-1)!)).toMatchObject({ event: "reminders", skipped: 0, off: "sin remitente" });
    });
  });
}
