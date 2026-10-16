import { describe, expect, it } from "vitest";
import { sessionSecret } from "@/lib/auth/secret";

describe("secreto de las cookies firmadas", () => {
  it("usa el configurado", () => {
    expect(sessionSecret({ SESSION_SECRET: "x".repeat(32), NODE_ENV: "production" })).toBe("x".repeat(32));
  });
  it("en desarrollo y pruebas admite un valor por defecto", () => {
    expect(sessionSecret({ NODE_ENV: "development" })).toMatch(/dev/);
    expect(sessionSecret({ NODE_ENV: "test" })).toMatch(/dev/);
  });
  it("en producción falla si falta o es demasiado corto", () => {
    expect(() => sessionSecret({ NODE_ENV: "production" })).toThrow(/SESSION_SECRET/);
    expect(() => sessionSecret({ SESSION_SECRET: "corto", NODE_ENV: "production" })).toThrow(/SESSION_SECRET/);
  });
});
