import { describe, expect, it } from "vitest";
import { waLink } from "../../src/client/support";
import { composePhone, DEFAULT_COUNTRY, formatPhone, normalizePhone, OTHER_COUNTRY, PHONE_COUNTRIES } from "../../src/domain/phone";

describe("teléfono de WhatsApp", () => {
  it("acepta un número tico de 8 dígitos y le pone +506", () => {
    expect(normalizePhone("8888 1234")).toBe("+50688881234");
    expect(normalizePhone("506 8888-1234")).toBe("+50688881234");
    expect(normalizePhone("+506 6000 0000")).toBe("+50660000000");
  });
  it("respeta un número internacional con código de país", () => {
    expect(normalizePhone("+34 600 11 22 33")).toBe("+34600112233");
    expect(normalizePhone("+1 (305) 555-0100")).toBe("+13055550100");
  });
  it("no adivina el país de un número largo sin «+»", () => {
    expect(normalizePhone("3055550100")).toBeNull();
    expect(normalizePhone("34600112233")).toBeNull();
  });
  it("solo acepta móviles de Costa Rica (empiezan por 5, 6, 7 u 8)", () => {
    expect(normalizePhone("2222 1234")).toBeNull();
    expect(normalizePhone("+506 2222 1234")).toBeNull();
    expect(normalizePhone("4000 1234")).toBeNull();
  });
  it("rechaza lo que no es un número", () => {
    expect(normalizePhone("")).toBeNull();
    expect(normalizePhone("hola")).toBeNull();
    expect(normalizePhone("123")).toBeNull();
    expect(normalizePhone("+506 1234")).toBeNull();
  });
  it("formatea para mostrar", () => {
    expect(formatPhone("+50688881234")).toBe("+506 8888 1234");
  });
});

describe("país + número (selector de la pantalla de ingresar)", () => {
  it("Costa Rica va primero y es el valor por defecto; la lista acaba en «Otro país»", () => {
    expect(PHONE_COUNTRIES[0]).toMatchObject({ code: "506", name: "Costa Rica" });
    expect(DEFAULT_COUNTRY).toBe("506");
    expect(PHONE_COUNTRIES.map((c) => c.code)).toEqual(expect.arrayContaining(["1", "505", "507", "52", "57", "34", "49", "33", "39", "44", "31", "41", "54", "58"]));
    expect(new Set(PHONE_COUNTRIES.map((c) => c.code)).size).toBe(PHONE_COUNTRIES.length);
    expect(OTHER_COUNTRY).toBe("other");
  });
  it("Costa Rica mantiene la regla de móviles", () => {
    expect(composePhone("506", "8888 1234")).toBe("+50688881234");
    expect(composePhone("506", "8888-1234")).toBe("+50688881234");
    expect(composePhone("506", "506 8888 1234")).toBe("+50688881234");
    expect(composePhone("506", "2222 1234")).toBeNull();
    expect(composePhone("506", "8888 123")).toBeNull();
  });
  it("Estados Unidos y Canadá (+1) con espacios, guiones y paréntesis", () => {
    expect(composePhone("1", "(415) 555-0100")).toBe("+14155550100");
    expect(composePhone("1", "415.555.0100")).toBe("+14155550100");
    expect(composePhone("1", "(415) 555-01")).toBeNull();
    expect(composePhone("1", "1 415 555 0100")).toBe("+14155550100");
    expect(composePhone("1", "2 415 555 0100")).toBeNull();
  });
  it("España, Nicaragua y otros países con su código", () => {
    expect(composePhone("34", "600 11 22 33")).toBe("+34600112233");
    expect(composePhone("505", "8123-4567")).toBe("+50581234567");
    expect(composePhone("49", "0151 2345 6789")).toBe("+4915123456789");
    expect(composePhone("44", "07700 900123")).toBe("+447700900123");
    expect(composePhone("39", "06 1234 5678")).toBe("+390612345678");
  });
  it("si escribe el número completo con «+», manda lo escrito sobre el país elegido", () => {
    expect(composePhone("506", "+34 600 11 22 33")).toBe("+34600112233");
    expect(composePhone("1", "+506 8888 1234")).toBe("+50688881234");
  });
  it("«Otro país» toma el número completo con su código, con o sin «+»", () => {
    expect(composePhone("other", "+81 90 1234 5678")).toBe("+819012345678");
    expect(composePhone("other", "81 90 1234 5678")).toBe("+819012345678");
    expect(composePhone("other", "+506 2222 1234")).toBeNull();
  });
  it("rechaza vacío, demasiado corto o demasiado largo", () => {
    expect(composePhone("1", "")).toBeNull();
    expect(composePhone("other", "")).toBeNull();
    expect(composePhone("34", "12345")).toBeNull();
    expect(composePhone("34", "123456789012345")).toBeNull();
    expect(composePhone("1", "415 555 01001 2345")).toBeNull();
    expect(composePhone("other", "+1 23")).toBeNull();
    expect(composePhone("506", "hola")).toBeNull();
  });
  it("lo compuesto vuelve igual por normalizePhone (lo que se manda a Supabase es E.164)", () => {
    for (const p of ["+14155550100", "+34600112233", "+50581234567", "+50688881234"]) expect(normalizePhone(p)).toBe(p);
  });
});

describe("formato de números internacionales", () => {
  it("separa el código de país y agrupa el resto", () => {
    expect(formatPhone("+14155550100")).toBe("+1 415 555 0100");
    expect(formatPhone("+34600112233")).toBe("+34 600 112 233");
    expect(formatPhone("+50581234567")).toBe("+505 8123 4567");
    expect(formatPhone("+4915123456789")).toBe("+49 151 234 567 89");
    expect(formatPhone("+819012345678")).toBe("+81 901 234 5678");
  });
  it("deja tal cual lo que no es E.164", () => {
    expect(formatPhone("")).toBe("");
    expect(formatPhone("hola")).toBe("hola");
  });
  it("el enlace de wa.me lleva solo dígitos con el código de país", () => {
    expect(waLink("+1 415 555 0100", "Hola")).toBe("https://wa.me/14155550100?text=Hola");
    expect(waLink(formatPhone("+50687770001"), "Hola")).toBe("https://wa.me/50687770001?text=Hola");
  });
});
