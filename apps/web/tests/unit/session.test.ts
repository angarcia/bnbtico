import { describe, expect, it } from "vitest";
import { readSigned, sign } from "@/lib/signed";

describe("cookies firmadas", () => {
  it("firma y lee un valor", async () => {
    const token = await sign({ a: 1, b: "dos" }, "secreto");
    expect(await readSigned<{ a: number }>(token, "secreto")).toEqual({ a: 1, b: "dos" });
  });
  it("rechaza una firma alterada o un secreto distinto", async () => {
    const token = await sign({ a: 1 }, "secreto");
    expect(await readSigned(token + "x", "secreto")).toBeNull();
    expect(await readSigned(token, "otro")).toBeNull();
    expect(await readSigned("basura", "secreto")).toBeNull();
  });
});
