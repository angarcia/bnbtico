import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { withTimeout } from "../../src/shared/timeout";

describe("withTimeout", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("devuelve el valor si llega a tiempo", async () => {
    const p = withTimeout(new Promise<string>((r) => setTimeout(() => r("lista"), 100)), 5000, "tarde");
    await vi.advanceTimersByTimeAsync(100);
    await expect(p).resolves.toBe("lista");
  });

  it("devuelve el valor de reserva si no llega a tiempo", async () => {
    const p = withTimeout(new Promise<string>((r) => setTimeout(() => r("lista"), 9000)), 5000, "tarde");
    await vi.advanceTimersByTimeAsync(5000);
    await expect(p).resolves.toBe("tarde");
  });

  it("deja pasar el error si falla antes", async () => {
    const p = withTimeout(Promise.reject(new Error("sin red")), 5000, "tarde");
    await expect(p).rejects.toThrow("sin red");
  });

  it("no deja el temporizador colgado", async () => {
    await withTimeout(Promise.resolve(1), 5000, 0);
    expect(vi.getTimerCount()).toBe(0);
  });
});
