// Avisos por WhatsApp en el worker (fase 5, ticket 03): remitente Twilio con fetch, remitente según el entorno, horas del
// cron horario, límite de subpeticiones de un lote y la ruta del reloj de pruebas (costura HTTP). El envío sobre la cola
// está en tests/contract/reminders-send.contract.ts (fake y Supabase local).
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createBillingService } from "../../src/data/postgrest/billing-service";
import { costaRicaToday } from "../../src/domain/inquiry";
import { SUBSCRIPTION_MESSAGES } from "../../src/domain/subscription";
import { costaRicaHour, inSendingHours, parseAllowlist } from "../../src/domain/whatsapp-sender";
import { createApp, type Env } from "../../src/server/app";
import { runHourly } from "../../src/server/cron";
import { FakeSender, REMINDER_BATCH, createTwilioSender, reminderBase, sendReminders, senderFromEnv, type ReminderRuntime } from "../../src/server/reminders";
import { fakeHarness } from "./fake-harness";

const at = (iso: string) => Date.parse(iso);

describe("remitente Twilio (solo fetch)", () => {
  const cfg = { accountSid: "AC123", authToken: "tok", from: "+14155238886" };

  it("POST a Messages.json con Basic auth y direcciones whatsapp:", async () => {
    const fetch = vi.fn(async (_u: string, _i?: RequestInit) => Response.json({ sid: "SM42" }, { status: 201 }));
    const r = await createTwilioSender({ ...cfg, fetch: fetch as unknown as typeof globalThis.fetch }).send("+50687770001", "Hola «Casa»");
    expect(r).toEqual({ ok: true, ref: "SM42" });
    const [url, init] = fetch.mock.calls[0]!;
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC123/Messages.json");
    expect(init).toMatchObject({ method: "POST", headers: { authorization: `Basic ${btoa("AC123:tok")}`, "content-type": "application/x-www-form-urlencoded" } });
    expect(Object.fromEntries(new URLSearchParams(String(init!.body)))).toEqual({ From: "whatsapp:+14155238886", To: "whatsapp:+50687770001", Body: "Hola «Casa»" });
  });

  it.each([400, 401, 429, 500, 503])("HTTP %i es un rechazo seguro (se puede reintentar)", async (status) => {
    const fetch = async () => Response.json({ code: 21211, message: "Invalid 'To' Phone Number: +50687770001" }, { status });
    const r = await createTwilioSender({ ...cfg, fetch: fetch as unknown as typeof globalThis.fetch }).send("+50687770001", "x");
    expect(r).toEqual({ ok: false, definite: true, error: `Twilio ${status} 21211` });
  });

  it("un error de red es dudoso", async () => {
    const fetch = async () => Promise.reject(new TypeError("fetch failed"));
    expect(await createTwilioSender({ ...cfg, fetch: fetch as unknown as typeof globalThis.fetch }).send("+50687770001", "x")).toMatchObject({ ok: false, definite: false });
  });

  it("sin respuesta en el tiempo límite, dudoso", async () => {
    const fetch = (_u: string, init?: RequestInit) =>
      new Promise<Response>((_, reject) => init!.signal!.addEventListener("abort", () => reject(init!.signal!.reason)));
    const r = await createTwilioSender({ ...cfg, fetch: fetch as unknown as typeof globalThis.fetch, timeoutMs: 20 }).send("+50687770001", "x");
    expect(r).toEqual({ ok: false, definite: false, error: "Twilio sin respuesta en 20 ms" });
  });
});

describe("remitente según el entorno", () => {
  const twilio = { WHATSAPP_SENDER: "twilio", TWILIO_ACCOUNT_SID: "AC1", TWILIO_AUTH_TOKEN: "t", TWILIO_WHATSAPP_FROM: "+14155238886" };
  const pick = (env: Record<string, string>) => senderFromEnv(env as unknown as Env, fetch, () => {});

  it("producción: apagado en esta fase, aunque estén los secretos", () => {
    expect(pick({ ENVIRONMENT: "production", ...twilio, WHATSAPP_ALLOWLIST: "+50687770001" })).toEqual({ sender: null, off: "producción" });
    expect(pick({ ENVIRONMENT: "production", WHATSAPP_SENDER: "fake" }).sender).toBeNull();
  });

  it("pruebas con Twilio exige la lista de números permitidos", () => {
    expect(pick({ ENVIRONMENT: "pruebas", ...twilio })).toEqual({ sender: null, off: "falta WHATSAPP_ALLOWLIST" });
    expect(pick({ ENVIRONMENT: "pruebas", ...twilio, WHATSAPP_ALLOWLIST: "+50687770001" }).sender).not.toBeNull();
  });

  it("sin secretos de Twilio o sin WHATSAPP_SENDER, apagado", () => {
    expect(pick({ ENVIRONMENT: "pruebas", WHATSAPP_SENDER: "twilio", WHATSAPP_ALLOWLIST: "+50687770001" }).off).toBe("faltan los secretos de Twilio");
    expect(pick({ ENVIRONMENT: "local" }).off).toBe("WHATSAPP_SENDER sin valor");
  });

  it("local con el falso", () => {
    expect(pick({ ENVIRONMENT: "local", WHATSAPP_SENDER: "fake" }).sender).toBeInstanceOf(FakeSender);
  });

  it("lista de números: E.164 separados por comas o punto y coma; vacía = sin lista", () => {
    expect([...parseAllowlist("+50687770001, +506 8888 1234;+1 (604) 555-0100")!]).toEqual(["+50687770001", "+50688881234", "+16045550100"]);
    expect(parseAllowlist(undefined)).toBeNull();
    expect(parseAllowlist("  ")).toBeNull();
  });

  it("enlace del aviso: bnbtico.com en producción; en pruebas PUBLIC_ORIGIN o el de la petición", () => {
    expect(reminderBase({ ENVIRONMENT: "production" }, "https://x.workers.dev")).toBe("https://bnbtico.com");
    expect(reminderBase({ ENVIRONMENT: "pruebas", PUBLIC_ORIGIN: "https://nueva.bnbtico.com" }, "https://x.workers.dev")).toBe("https://nueva.bnbtico.com");
    expect(reminderBase({ ENVIRONMENT: "local" }, "http://localhost:4173/")).toBe("http://localhost:4173");
  });

  it("el falso responde fake-… y guarda lo «enviado»", async () => {
    const s = new FakeSender();
    const r = await s.send("+50687770001", "Hola");
    expect(r).toMatchObject({ ok: true, ref: expect.stringMatching(/^fake-/) });
    expect(s.sent).toEqual([{ to: "+50687770001", body: "Hola", ref: (r as { ref: string }).ref }]);
  });
});

describe("horas de envío (Costa Rica, UTC−6)", () => {
  it.each([
    ["2026-10-27T13:59:00Z", 7, false],
    ["2026-10-27T14:00:00Z", 8, true],
    ["2026-10-27T14:17:00Z", 8, true],
    ["2026-10-27T23:17:00Z", 17, true],
    ["2026-10-28T00:17:00Z", 18, false],
    ["2026-10-27T09:17:00Z", 3, false],
  ])("%s → %i h en Costa Rica, envía: %s", (iso, hour, sends) => {
    expect(costaRicaHour(at(iso))).toBe(hour);
    expect(inSendingHours(at(iso))).toBe(sends);
  });
});

describe("cron horario (17 * * * *)", () => {
  const env = { ENVIRONMENT: "pruebas", SUPABASE_URL: "https://proyecto.supabase.co", SUPABASE_ANON_KEY: "anon" } as Env;
  function deps(keepalive: () => Promise<Response> = async () => Response.json([])) {
    const lines: string[] = [];
    const fetch = vi.fn(async () => keepalive());
    const reminders = vi.fn(async () => undefined);
    return { lines, fetch, reminders, d: { fetch: fetch as unknown as typeof globalThis.fetch, log: (l: string) => lines.push(l), now: () => 0, telemetry: null, reminders } };
  }

  it("a las 09 UTC hace el trabajo diario y no manda avisos (03:17 en Costa Rica)", async () => {
    const x = deps();
    await runHourly(env, x.d, "17 * * * *", at("2026-10-27T09:17:00Z"));
    expect(x.fetch).toHaveBeenCalledOnce();
    expect(x.reminders).not.toHaveBeenCalled();
  });

  it.each(["2026-10-27T14:17:00Z", "2026-10-27T18:17:00Z", "2026-10-27T23:17:00Z"])("a las %s manda avisos y no repite el diario", async (iso) => {
    const x = deps();
    await runHourly(env, x.d, "17 * * * *", at(iso));
    expect(x.reminders).toHaveBeenCalledOnce();
    expect(x.fetch).not.toHaveBeenCalled();
  });

  it.each(["2026-10-27T00:17:00Z", "2026-10-27T05:17:00Z", "2026-10-27T13:17:00Z"])("a las %s (de noche en Costa Rica) no hace nada", async (iso) => {
    const x = deps();
    await runHourly(env, x.d, "17 * * * *", at(iso));
    expect(x.reminders).not.toHaveBeenCalled();
    expect(x.fetch).not.toHaveBeenCalled();
    expect(x.lines).toEqual([]);
  });

  it("«solo portada» (producción antes del lanzamiento) no manda avisos ni consulta nada", async () => {
    const x = deps();
    await runHourly({ ENVIRONMENT: "production" } as Env, x.d, "17 * * * *", at("2026-10-27T15:17:00Z"));
    await runHourly({ ENVIRONMENT: "production" } as Env, x.d, "17 * * * *", at("2026-10-27T09:17:00Z"));
    expect(x.reminders).not.toHaveBeenCalled();
    expect(x.fetch).not.toHaveBeenCalled();
  });

  it("un fallo de los avisos queda en una línea JSON y no hace fallar el cron", async () => {
    const x = deps();
    x.reminders.mockRejectedValueOnce(new Error("PostgREST caído"));
    await expect(runHourly(env, x.d, "17 * * * *", at("2026-10-27T15:17:00Z"))).resolves.toBeUndefined();
    expect(x.lines.map((l) => JSON.parse(l))).toEqual([{ event: "reminders", ok: false, cron: "17 * * * *", error: "Error: PostgREST caído" }]);
  });

  it("el keep-alive sigue haciendo fallar la ejecución de las 09 UTC", async () => {
    const x = deps(async () => new Response("caído", { status: 503 }));
    await expect(runHourly(env, x.d, "17 * * * *", at("2026-10-27T09:17:00Z"))).rejects.toThrow(/503/);
  });

  it("sin avisos configurados (sin clave de servicio) solo hace lo diario", async () => {
    const x = deps();
    await runHourly(env, { ...x.d, reminders: null }, "17 * * * *", at("2026-10-27T15:17:00Z"));
    expect(x.fetch).not.toHaveBeenCalled();
  });
});

describe(`lote de envío: ≤ ${REMINDER_BATCH} avisos y ≤ 22 subpeticiones (plan gratuito: 50)`, () => {
  it("con la cola llena: 1 claim (p_limit 20) + 20 envíos + 1 finish", async () => {
    const calls: string[] = [];
    let finished: unknown[] = [];
    const fetch = vi.fn(async (url: string, init?: RequestInit) => {
      calls.push(url);
      if (url.endsWith("/rpc/claim_reminders")) {
        const { p_limit } = JSON.parse(String(init!.body)) as { p_limit: number };
        return Response.json(
          Array.from({ length: p_limit }, (_, k) => ({ id: `r${k}`, listing_id: `l${k}`, public_id: `CT-${1000 + k}`, title: `Casa ${k}`, owner_name: "Yorleny", to_phone: "+50687770001", days_before: 30, promo_ends_on: "2026-11-26" })),
        );
      }
      if (url.endsWith("/rpc/finish_reminders")) {
        finished = (JSON.parse(String(init!.body)) as { p_results: unknown[] }).p_results;
        return Response.json(finished.length);
      }
      return Response.json({ sid: `SM${calls.length}` }, { status: 201 });
    });
    const f = fetch as unknown as typeof globalThis.fetch;
    const rt: ReminderRuntime = {
      service: createBillingService({ supabaseUrl: "https://p.supabase.co", serviceKey: "service", anonKey: "anon", fetch: f }),
      sender: createTwilioSender({ accountSid: "AC1", authToken: "t", from: "+14155238886", fetch: f }),
      allowlist: null,
    };
    const r = await sendReminders(rt, { base: "https://nueva.bnbtico.com", log: () => {}, limit: 50 });
    expect(r).toMatchObject({ claimed: 20, sent: 20 });
    expect(calls).toHaveLength(22);
    expect(calls.filter((u) => u.includes("api.twilio.com"))).toHaveLength(20);
    expect(finished).toHaveLength(20);
    expect(finished[0]).toMatchObject({ id: "r0", outcome: "sent", provider_ref: "SM2", to_phone: "+50687770001", body: expect.stringContaining("https://nueva.bnbtico.com/propietario/suscripcion#pago=CT-1000") });
  });

  it("si falla el cierre, lo registra y no lanza (las filas quedan en «sending»: nunca se reenvían)", async () => {
    const h = fakeHarness();
    const l = await h.seed({ status: "active" });
    await h.setDaysLeft(l.id, 30);
    await h.service.runDay(costaRicaToday(Date.now()));
    const lines: string[] = [];
    const service = { ...h.service, finishReminders: async () => Promise.reject(new Error("PostgREST 500")) };
    const r = await sendReminders({ service, sender: new FakeSender(), allowlist: null }, { base: "https://x", log: (x) => lines.push(x) });
    expect(r).toMatchObject({ claimed: 1, sent: 1, error: "finish: Error: PostgREST 500" });
    expect(JSON.parse(lines.at(-1)!)).toMatchObject({ event: "reminders", ok: false, error: "finish: Error: PostgREST 500" });
    expect((await h.reminders(l.id))[0]).toMatchObject({ status: "sending" });
    expect(await h.service.claimReminders(20)).toEqual([]);
  });

  it("si falla el reclamo, lo registra y no lanza", async () => {
    const h = fakeHarness();
    const lines: string[] = [];
    const service = { ...h.service, claimReminders: async () => Promise.reject(new Error("sin red")) };
    expect(await sendReminders({ service, sender: new FakeSender(), allowlist: null }, { base: "https://x", log: (x) => lines.push(x) })).toMatchObject({ claimed: 0, error: "claim: Error: sin red" });
    expect(JSON.parse(lines[0]!)).toMatchObject({ event: "reminders", ok: false });
  });
});

describe("worker · reloj de pruebas POST /_pruebas/oferta/CT-####", () => {
  const ORIGIN = "https://nueva.bnbtico.com";
  let h: ReturnType<typeof fakeHarness>;
  let sender: FakeSender;
  let withRuntime = true;

  beforeEach(async () => {
    h = fakeHarness();
    sender = new FakeSender();
    withRuntime = true;
    await h.setTestClock(true);
  });

  function request(path: string, init: { secret?: string; body?: unknown } = {}, over: Partial<Env> = {}) {
    const app = createApp({
      listings: () => h.anon,
      cache: () => null,
      purgeFetch: fetch,
      reminders: () => (withRuntime ? { service: h.service, sender, allowlist: null } : null),
    });
    const env = {
      ENVIRONMENT: "pruebas",
      SUPABASE_URL: "http://supabase.test",
      SUPABASE_ANON_KEY: "anon",
      TEST_CLOCK_SECRET: "reloj",
      ASSETS: { fetch: async () => new Response("shell") },
      ...over,
    } as Env;
    const headers: Record<string, string> = { "content-type": "application/json" };
    if (init.secret !== undefined) headers.authorization = `Bearer ${init.secret}`;
    return app.request(`${ORIGIN}${path}`, { method: "POST", headers, body: JSON.stringify(init.body ?? { diasRestantes: 30 }) }, env);
  }

  it("deja la casa con n días, corre el día, manda un lote y responde lo ocurrido", async () => {
    const l = await h.seed({ status: "active", draft: { title: "Casa Cahuita" } });
    const res = await request(`/_pruebas/oferta/${l.publicId}`, { secret: "reloj", body: { diasRestantes: 7 } });
    expect(res.status).toBe(200);
    const json = (await res.json()) as Record<string, unknown>;
    expect(json).toMatchObject({ publicId: l.publicId, diasRestantes: 7, day: { paid: 0, paymentDue: 0, queued: 1 }, reminders: { claimed: 1, sent: 1 } });
    expect((json.reminders as { outcomes: { body: string }[] }).outcomes[0]).toMatchObject({ publicId: l.publicId, daysBefore: 7, outcome: "sent", providerRef: expect.stringMatching(/^fake-/) });
    expect(sender.sent[0]!.body).toContain(`${ORIGIN}/propietario/suscripcion#pago=${l.publicId}`);
    expect((await h.reminders(l.id))[0]).toMatchObject({ daysBefore: 7, status: "sent", providerRef: sender.sent[0]!.ref });
  });

  it("con −1 días la oferta vence: pendiente de pago y el enlace da 410", async () => {
    const l = await h.seed({ status: "active" });
    const res = await request(`/_pruebas/oferta/${l.publicId}`, { secret: "reloj", body: { diasRestantes: -1 } });
    expect(await res.json()).toMatchObject({ day: { paymentDue: 1 }, reminders: { claimed: 0 } });
    expect(await h.anon.blockedReason(l.publicId)).toBe("payment");
  });

  it("404 en producción, aunque el secreto sea el bueno", async () => {
    const l = await h.seed({ status: "active" });
    expect((await request(`/_pruebas/oferta/${l.publicId}`, { secret: "reloj" }, { ENVIRONMENT: "production", LAUNCHED: "true" })).status).toBe(404);
    expect((await request(`/_pruebas/oferta/${l.publicId}`, { secret: "reloj" }, { ENVIRONMENT: "production" })).status).toBe(404);
    expect(sender.sent).toEqual([]);
  });

  it("404 sin TEST_CLOCK_SECRET", async () => {
    const l = await h.seed({ status: "active" });
    expect((await request(`/_pruebas/oferta/${l.publicId}`, { secret: "" }, { TEST_CLOCK_SECRET: undefined })).status).toBe(404);
  });

  it("401 con otro secreto o sin cabecera, sin tocar nada", async () => {
    const l = await h.seed({ status: "active" });
    expect((await request(`/_pruebas/oferta/${l.publicId}`, { secret: "otro!" })).status).toBe(401);
    expect((await request(`/_pruebas/oferta/${l.publicId}`)).status).toBe(401);
    expect(await h.reminders(l.id)).toEqual([]);
  });

  it("400 con un id o un cuerpo no válidos", async () => {
    const l = await h.seed({ status: "active" });
    expect((await request("/_pruebas/oferta/casa-1", { secret: "reloj" })).status).toBe(400);
    expect((await request(`/_pruebas/oferta/${l.publicId}`, { secret: "reloj", body: { diasRestantes: "7" } })).status).toBe(400);
    expect((await request(`/_pruebas/oferta/${l.publicId}`, { secret: "reloj", body: { diasRestantes: 1.5 } })).status).toBe(400);
    expect((await request(`/_pruebas/oferta/${l.publicId}`, { secret: "reloj", body: { diasRestantes: 5000 } })).status).toBe(400);
  });

  it("409 con el mensaje de la base si el reloj está apagado (sin el secreto de Vault)", async () => {
    const l = await h.seed({ status: "active" });
    await h.setTestClock(false);
    const res = await request(`/_pruebas/oferta/${l.publicId}`, { secret: "reloj" });
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: SUBSCRIPTION_MESSAGES.testClockOff });
  });

  it("503 sin clave de servicio", async () => {
    const l = await h.seed({ status: "active" });
    withRuntime = false;
    expect((await request(`/_pruebas/oferta/${l.publicId}`, { secret: "reloj" })).status).toBe(503);
  });
});

/** wrangler.jsonc sin comentarios de línea completa (las URL llevan `//` dentro de cadenas). */
const wrangler = JSON.parse(
  readFileSync(new URL("../../wrangler.jsonc", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => !l.trim().startsWith("//"))
    .join("\n"),
);

describe("wrangler.jsonc · fase 5", () => {
  it("un solo cron por entorno y cada hora (el plan gratuito permite 5 triggers por cuenta)", () => {
    for (const cfg of [wrangler, wrangler.env.pruebas, wrangler.env.production]) expect(cfg.triggers.crons).toEqual(["17 * * * *"]);
  });

  it("la ruta del reloj de pruebas pasa por el worker", () => {
    expect(wrangler.assets.run_worker_first).toContain("/_pruebas/*");
    expect(wrangler.env.production.assets.run_worker_first).toBe(true);
  });

  it("pruebas: remitente Twilio y base pública del enlace; producción sin remitente", () => {
    expect(wrangler.env.pruebas.vars).toMatchObject({ WHATSAPP_SENDER: "twilio", PUBLIC_ORIGIN: "https://nueva.bnbtico.com" });
    expect(wrangler.env.production.vars.WHATSAPP_SENDER).toBeUndefined();
    expect(wrangler.env.production.vars.TEST_CLOCK_SECRET).toBeUndefined();
  });
});
