import { describe, expect, it } from "vitest";
import { safeNext } from "@/lib/safe-next";

describe("destino seguro tras verificar el código", () => {
  it("acepta rutas internas", () => {
    expect(safeNext("/explorar")).toBe("/explorar");
    expect(safeNext("/casa/CT-1001?x=1#pago")).toBe("/casa/CT-1001?x=1#pago");
  });
  it("rechaza URLs externas, relativas al protocolo o con esquema", () => {
    expect(safeNext("//estafa.com/cuenta")).toBeNull();
    expect(safeNext("https://estafa.com")).toBeNull();
    expect(safeNext("/\\estafa.com")).toBeNull();
    expect(safeNext("javascript:alert(1)")).toBeNull();
    expect(safeNext("explorar")).toBeNull();
  });
  it("devuelve null si no hay destino", () => {
    expect(safeNext(undefined)).toBeNull();
    expect(safeNext("")).toBeNull();
  });
});
