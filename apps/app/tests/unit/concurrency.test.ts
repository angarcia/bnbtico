import { describe, expect, it } from "vitest";
import { createLimiter } from "../../src/domain/concurrency";

const tick = () => new Promise((r) => setTimeout(r, 0));

describe("createLimiter", () => {
  it("como mucho n tareas a la vez, en orden de llegada", async () => {
    const limit = createLimiter(3);
    let running = 0;
    let peak = 0;
    const started: number[] = [];
    const releases: (() => void)[] = [];
    const tasks = Array.from({ length: 7 }, (_, i) =>
      limit(async () => {
        started.push(i);
        running++;
        peak = Math.max(peak, running);
        await new Promise<void>((r) => releases.push(r));
        running--;
        return i * 10;
      }),
    );
    await tick();
    expect(started).toEqual([0, 1, 2]);
    releases[1]!();
    await tick();
    expect(started).toEqual([0, 1, 2, 3]);
    while (releases.length < 7) {
      releases.forEach((r) => r());
      await tick();
    }
    releases.forEach((r) => r());
    expect(await Promise.all(tasks)).toEqual([0, 10, 20, 30, 40, 50, 60]);
    expect(peak).toBe(3);
  });

  it("una tarea que falla libera su sitio y propaga el error", async () => {
    const limit = createLimiter(1);
    const failed = limit(async () => {
      throw new Error("x");
    });
    const next = limit(async () => "ok");
    await expect(failed).rejects.toThrow("x");
    await expect(next).resolves.toBe("ok");
  });
});
