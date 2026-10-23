// Turnstile en el inicio del código (ticket 11): la ficha del token y su paso a Supabase Auth.
import type { SupabaseClient } from "@supabase/supabase-js";
import { describe, expect, it, vi } from "vitest";
import { CAPTCHA_FAILED, createTokenGate } from "../../src/client/token-gate";
import { createPostgrestAuth } from "../../src/data/postgrest/auth";
import { memoryStore } from "../../src/data/storage";
import type { Database } from "../../src/domain/database.types";
import { toDomainError } from "../../src/domain/errors";

describe("token de Turnstile", () => {
  it("entrega el token que ya llegó y lo gasta (un token sirve una sola vez)", async () => {
    const gate = createTokenGate(1000);
    gate.set("t1");
    expect(await gate.take()).toBe("t1");
    const next = gate.take();
    gate.set("t2");
    expect(await next).toBe("t2");
  });

  it("si el token aún no llegó, espera a que llegue", async () => {
    const gate = createTokenGate(1000);
    const pending = gate.take();
    setTimeout(() => gate.set("tarde"), 10);
    expect(await pending).toBe("tarde");
  });

  it("un token caducado no se entrega", async () => {
    vi.useFakeTimers();
    try {
      const gate = createTokenGate(500);
      gate.set("viejo");
      gate.clear();
      const pending = gate.take();
      const settled = expect(pending).rejects.toThrow(CAPTCHA_FAILED);
      await vi.advanceTimersByTimeAsync(600);
      await settled;
    } finally {
      vi.useRealTimers();
    }
  });
});

describe("Supabase Auth recibe el token", () => {
  function auth() {
    const calls: unknown[] = [];
    const db = { auth: { signInWithOtp: async (args: unknown) => (calls.push(args), { error: null }) } } as unknown as SupabaseClient<Database>;
    let t = 0;
    const api = createPostgrestAuth(db, { pending: memoryStore(), now: () => (t += 60_000) });
    return { api, calls };
  }

  it("start y resend mandan captchaToken en options", async () => {
    const { api, calls } = auth();
    await api.start({ mode: "login", phone: "8888 1234" }, "tok-1");
    await api.resend("tok-2");
    expect(calls).toEqual([
      expect.objectContaining({ phone: "+50688881234", options: expect.objectContaining({ captchaToken: "tok-1" }) }),
      expect.objectContaining({ phone: "+50688881234", options: expect.objectContaining({ captchaToken: "tok-2" }) }),
    ]);
  });

  it("sin Turnstile configurado no manda captchaToken", async () => {
    const { api, calls } = auth();
    await api.start({ mode: "login", phone: "8888 1234" });
    expect((calls[0] as { options: Record<string, unknown> }).options).not.toHaveProperty("captchaToken");
  });

  it("el rechazo de la protección de bots de Supabase tiene su mensaje", () => {
    const e = toDomainError({ code: "captcha_failed", message: "captcha protection: request disallowed (no captcha response)" });
    expect(e.message).toBe(CAPTCHA_FAILED);
  });
});
