import { describe, expect, it } from "vitest";
import { allSavesSettled, enqueueSave, savesPending, savesSettled } from "../../src/client/save-queue";

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
});
