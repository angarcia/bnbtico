import { describe, expect, it, vi } from "vitest";
import { keepaliveFetch } from "../../src/data/postgrest/keepalive-fetch";

const URL_REST = "http://127.0.0.1:54321/rest/v1/listings?id=eq.1";

describe("keepaliveFetch: los guardados sobreviven a que la app pase a segundo plano", () => {
  it("las escrituras a PostgREST con cuerpo pequeño salen con keepalive", async () => {
    const base = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("[]"));
    const f = keepaliveFetch(base);
    for (const method of ["PATCH", "POST", "DELETE"]) {
      await f(URL_REST, { method, body: JSON.stringify({ title: "Casa" }) });
      expect(base.mock.lastCall?.[1]).toMatchObject({ method, keepalive: true });
    }
    await f("http://127.0.0.1:54321/rest/v1/rpc/submit_listing", { method: "POST", body: '{"p_listing":"x"}' });
    expect(base.mock.lastCall?.[1]?.keepalive).toBe(true);
  });

  it("las lecturas, la cuenta y los cuerpos grandes (límite de 64 KB del navegador) salen como siempre", async () => {
    const base = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) => new Response("[]"));
    const f = keepaliveFetch(base);
    await f(URL_REST, { method: "GET" });
    expect(base.mock.lastCall?.[1]?.keepalive).toBeUndefined();
    await f(URL_REST);
    expect(base.mock.lastCall?.[1]).toBeUndefined();
    await f("http://127.0.0.1:54321/auth/v1/token?grant_type=refresh_token", { method: "POST", body: "{}" });
    expect(base.mock.lastCall?.[1]?.keepalive).toBeUndefined();
    await f(URL_REST, { method: "PATCH", body: "x".repeat(70_000) });
    expect(base.mock.lastCall?.[1]?.keepalive).toBeUndefined();
    await f(URL_REST, { method: "PATCH", body: new Blob(["x"]) });
    expect(base.mock.lastCall?.[1]?.keepalive).toBeUndefined();
  });
});
