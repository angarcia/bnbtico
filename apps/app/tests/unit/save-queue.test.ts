import { describe, expect, it } from "vitest";
import { allSavesSettled, enqueueSave, flushOnHide, flushSaves, savesPending, savesSettled } from "../../src/client/save-queue";

const deferred = () => {
  let resolve!: () => void;
  let reject!: (e: Error) => void;
  const promise = new Promise<void>((res, rej) => ((resolve = res), (reject = rej)));
  return { promise, resolve, reject };
};

describe("cola de guardados por casa", () => {
  it("los guardados de una casa van en orden aunque uno falle, y las lecturas esperan", async () => {
    const order: string[] = [];
    const a = deferred();
    const first = enqueueSave("l1", async () => {
      await a.promise;
      order.push("1");
    });
    const second = enqueueSave("l1", async () => void order.push("2"));
    expect(savesPending("l1")).toBe(2);
    let read = false;
    const waiting = savesSettled("l1").then(() => (read = true));
    await Promise.resolve();
    expect(order).toEqual([]);
    expect(read).toBe(false);
    a.reject(new Error("sin red"));
    await expect(first).rejects.toThrow("sin red");
    await second;
    await waiting;
    expect(order).toEqual(["2"]);
    expect(read).toBe(true);
    expect(savesPending("l1")).toBe(0);
  });

  it("casas distintas no se esperan entre sí", async () => {
    const a = deferred();
    void enqueueSave("l2", () => a.promise);
    await enqueueSave("l3", async () => undefined);
    expect(savesPending("l2")).toBe(1);
    a.resolve();
    await allSavesSettled();
    expect(savesPending("l2")).toBe(0);
  });

  it("con la cola libre, el guardado arranca en el mismo tick (sin esperar a nada)", async () => {
    let started = false;
    const done = enqueueSave("l4", async () => void (started = true));
    expect(started).toBe(true);
    await done;
  });

  it("al ocultarse la página, los guardados en espera salen ya y una sola vez", async () => {
    const a = deferred();
    let runs = 0;
    void enqueueSave("l5", () => a.promise);
    const second = enqueueSave("l5", async () => void runs++);
    await Promise.resolve();
    expect(runs).toBe(0);
    flushSaves();
    expect(runs).toBe(1);
    a.resolve();
    await second;
    await savesSettled("l5");
    expect(runs).toBe(1);
    expect(savesPending("l5")).toBe(0);
  });

  it("pagehide y visibilitychange (oculta) vacían la cola", async () => {
    const win = new EventTarget();
    const doc = Object.assign(new EventTarget(), { visibilityState: "visible" as DocumentVisibilityState });
    const stop = flushOnHide(win, doc);
    const fires = [
      () => win.dispatchEvent(new Event("pagehide")),
      () => {
        doc.visibilityState = "hidden";
        doc.dispatchEvent(new Event("visibilitychange"));
      },
    ];
    for (const fire of fires) {
      const a = deferred();
      let started = false;
      void enqueueSave("l6", () => a.promise);
      void enqueueSave("l6", async () => void (started = true));
      fire();
      expect(started).toBe(true);
      a.resolve();
      await savesSettled("l6");
    }
    stop();
  });
});
