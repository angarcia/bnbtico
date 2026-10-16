import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone } from "@/lib/phone";

describe("teléfono de WhatsApp", () => {
  it("acepta un número tico de 8 dígitos y le pone +506", () => {
    expect(normalizePhone("8888 1234")).toBe("+50688881234");
    expect(normalizePhone("506 8888-1234")).toBe("+50688881234");
  });
  it("respeta un número internacional con código de país", () => {
    expect(normalizePhone("+34 600 11 22 33")).toBe("+34600112233");
    expect(normalizePhone("+1 (305) 555-0100")).toBe("+13055550100");
  });
  it("rechaza lo que no es un número", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("hola")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("+506 1234")).toBeNull();
  });
  it("formatea para mostrar", () => {
    expect(formatPhone("+50688881234")).toBe("+506 8888 1234");
    expect(formatPhone("+34600112233")).toBe("+34600112233");
  });
});
