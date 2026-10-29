import { describe, expect, it } from "vitest";
import { cooldownError, PENDING_TTL_MS, parsePending, RESEND_COOLDOWN_MS, resendWaitSeconds, safeNext, validateProfilePatch, validateStart } from "../../src/domain/account";
import { DomainError, toDomainError } from "../../src/domain/errors";

const T = 1_700_000_000_000;

describe("enfriamiento entre códigos", () => {
  it("30 segundos desde el último envío", () => {
    expect(resendWaitSeconds(T, T)).toBe(30);
    expect(resendWaitSeconds(T, T + 29_100)).toBe(1);
    expect(resendWaitSeconds(T, T + RESEND_COOLDOWN_MS)).toBe(0);
    expect(cooldownError(T, T + 1000)?.message).toBe("Espere 29 segundos antes de pedir otro código.");
    expect(cooldownError(T, T + 1000)?.kind).toBe("rate_limit");
    expect(cooldownError(T, T + RESEND_COOLDOWN_MS)).toBeNull();
    expect(cooldownError(undefined, T)).toBeNull();
  });
});

describe("número pendiente", () => {
  const raw = JSON.stringify({ mode: "register", name: "Ana", phone: "+50688881234", sentAt: T });
  it("dura diez minutos desde el último envío", () => {
    expect(parsePending(raw, T + PENDING_TTL_MS - 1)).toEqual({ mode: "register", name: "Ana", phone: "+50688881234", sentAt: T });
    expect(parsePending(raw, T + PENDING_TTL_MS)).toBeNull();
  });
  it("ignora lo que no tiene la forma esperada", () => {
    expect(parsePending(null, T)).toBeNull();
    expect(parsePending("{roto", T)).toBeNull();
    expect(parsePending(JSON.stringify({ mode: "x", phone: "+50688881234", sentAt: T }), T)).toBeNull();
  });
});

describe("validateStart", () => {
  it("normaliza el número y recorta el nombre", () => {
    expect(validateStart({ name: "  Ana Prueba ", phone: "8888 1234" })).toEqual({ name: "Ana Prueba", phone: "+50688881234" });
    expect(validateStart({ phone: "+506 8888 1234" })).toEqual({ phone: "+50688881234" });
  });
  it("rechaza número o nombre inválidos con mensajes en español", () => {
    expect(() => validateStart({ phone: "123" })).toThrow("Escriba un WhatsApp válido, con código de país si no es de Costa Rica.");
    expect(() => validateStart({ name: "A", phone: "88881234" })).toThrow("Escriba su nombre.");
  });
});

describe("validateProfilePatch", () => {
  it("recorta, vacía a null y limita la descripción", () => {
    expect(validateProfilePatch({ name: " Ana ", email: "", description: "  " })).toEqual({ name: "Ana", email: null, description: null });
    expect(validateProfilePatch({ description: "x".repeat(1200) }).description).toHaveLength(1000);
    expect(validateProfilePatch({ name: "   " })).toEqual({});
  });
  it("rechaza un correo que no parece correo", () => {
    expect(() => validateProfilePatch({ email: "ana@" })).toThrow("Ese correo no parece válido.");
  });
});

describe("errores de la cuenta", () => {
  it.each([
    ["código incorrecto", { code: "otp_expired", message: "Token has expired or is invalid" }, "Ese código no es correcto o caducó.", "validation"],
    ["código caducado", { code: "otp_expired", message: "Token has expired" }, "Ese código no es correcto o caducó.", "validation"],
    ["demasiados intentos", { code: "over_request_rate_limit", message: "Request rate limit reached" }, "Demasiados intentos. Espere un momento y vuelva a intentarlo.", "rate_limit"],
    ["límite de Supabase con segundos", { code: "over_sms_send_rate_limit", message: "For security purposes, you can only request this after 42 seconds." }, "Espere 42 segundos antes de pedir otro código.", "rate_limit"],
    ["límite de Supabase de un segundo", { code: "over_sms_send_rate_limit", message: "For security purposes, you can only request this after 0 seconds." }, "Espere un momento antes de pedir otro código.", "rate_limit"],
    ["número sin cuenta", { code: "otp_disabled", message: "Signups not allowed for otp" }, "No hay una cuenta con ese WhatsApp. Cree una cuenta.", "not_found"],
  ])("%s", (_name, raw, message, kind) => {
    const e = toDomainError(raw);
    expect(e).toBeInstanceOf(DomainError);
    expect(e).toMatchObject({ message, kind });
  });
});

describe("safeNext", () => {
  it("solo rutas internas", () => {
    expect(safeNext("/propietario/casas")).toBe("/propietario/casas");
    expect(safeNext("/explorar?prov=Todas")).toBe("/explorar?prov=Todas");
    for (const bad of ["//otro.com", "https://otro.com", "/\\otro.com", "propietario", "", undefined]) expect(safeNext(bad)).toBeNull();
  });
  it("rechaza tabuladores y saltos de línea, que el navegador quita de la URL y dejarían una ruta //otro.com", () => {
    for (const bad of ["/\t/evil.example", "/\n/evil.example", "/\r/evil.example", "/propietario\n", "/a\tb"]) expect(safeNext(bad)).toBeNull();
  });
});
