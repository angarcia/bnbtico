// Contrato de AuthApi: registro e ingreso con código por WhatsApp, enfriamiento, número pendiente, sesión que sobrevive
// a reinicios hasta cerrar sesión (que la revoca), perfil. Corre contra el fake y contra Supabase local.
import { beforeEach, describe, expect, it } from "vitest";
import { PENDING_TTL_MS, RESEND_COOLDOWN_MS } from "../../src/domain/account";
import { DomainError } from "../../src/domain/errors";
import type { AuthHarness } from "./harness";

async function failure(p: Promise<unknown>): Promise<DomainError> {
  try {
    await p;
  } catch (e) {
    expect(e).toBeInstanceOf(DomainError);
    return e as DomainError;
  }
  throw new Error("se esperaba un error");
}

export function authContract(name: string, makeHarness: () => Promise<AuthHarness>) {
  describe(`cuenta · ${name}`, () => {
    let h: AuthHarness;
    beforeEach(async () => {
      h = await makeHarness();
    });

    const register = async (auth = h.auth, fullName = "Ana Prueba") => {
      await auth.start({ name: fullName, phone: h.phone });
      return auth.verify(h.code);
    };

    it("registra con nombre y WhatsApp y deja la sesión abierta", async () => {
      expect(await h.auth.session()).toBeNull();
      expect(await h.auth.profile()).toBeNull();
      expect(await h.auth.start({ name: " Ana Prueba ", phone: h.phone.replace("+506", "") })).toBe("sent");
      expect(h.auth.pending()).toMatchObject({ name: "Ana Prueba", phone: h.phone });
      expect((await failure(h.auth.verify("000000"))).message).toBe("Ese código no es correcto o caducó.");
      const account = await h.auth.verify(h.code);
      expect(account).toMatchObject({ name: "Ana Prueba", phone: h.phone, phoneVerified: true, isOwner: false, isAdmin: false, email: null, description: null });
      expect(h.auth.pending()).toBeNull();
      expect(await h.auth.session()).toEqual({ userId: account.id, aal: "aal1" });
      expect(await h.auth.profile()).toEqual(account);
    });

    it("registra y vuelve a entrar con un WhatsApp de otro país; el número pendiente y el reenvío lo conservan", async () => {
      await h.auth.start({ name: "John Test", phone: "+1 (415) 555-0100" });
      expect(h.auth.pending()).toMatchObject({ mode: "register", phone: h.intlPhone });
      expect(h.restart().pending()?.phone).toBe(h.intlPhone);
      await h.advance(RESEND_COOLDOWN_MS);
      await h.auth.resend();
      const account = await h.auth.verify(h.code);
      expect(account).toMatchObject({ name: "John Test", phone: h.intlPhone, phoneVerified: true });
      await h.auth.logout();
      await h.advance(RESEND_COOLDOWN_MS);
      await h.auth.start({ phone: h.intlPhone });
      expect((await h.auth.verify(h.code)).id).toBe(account.id);
    });

    it("avisa a quien escucha cuando la sesión se abre y se cierra", async () => {
      const seen: (string | null)[] = [];
      const stop = h.auth.onSessionChange((s) => seen.push(s?.userId ?? null));
      const account = await register();
      await h.auth.logout();
      stop();
      expect(seen).toContain(account.id);
      expect(seen.at(-1)).toBeNull();
    });

    it("un único flujo (ticket 18): sin cuenta pide el nombre sin enviar nada; con el nombre crea la cuenta", async () => {
      expect(await h.auth.start({ phone: h.phone })).toBe("needs-name");
      expect(h.auth.pending()).toBeNull();
      // No se envió ningún código: el nombre se puede mandar al momento (sin enfriamiento ni tope por segundo).
      expect(await h.auth.start({ name: "Ana Prueba", phone: h.phone })).toBe("sent");
      expect(h.auth.pending()).toMatchObject({ mode: "register", name: "Ana Prueba", phone: h.phone });
      const account = await h.auth.verify(h.code);
      expect(account.name).toBe("Ana Prueba");
    });

    it("un número con cuenta recibe el código al primer paso, sin pedir el nombre", async () => {
      const account = await register();
      await h.auth.logout();
      await h.advance(RESEND_COOLDOWN_MS);
      expect(await h.auth.start({ phone: h.phone })).toBe("sent");
      expect(h.auth.pending()).toMatchObject({ mode: "login", phone: h.phone });
      expect((await h.auth.verify(h.code)).id).toBe(account.id);
    });

    it("valida nombre y número antes de pedir el código", async () => {
      expect((await failure(h.auth.start({ name: "A", phone: h.phone }))).message).toBe("Escriba su nombre.");
      expect((await failure(h.auth.start({ phone: "12" }))).kind).toBe("validation");
      expect((await failure(h.auth.start({ name: "Ana", phone: "12" }))).kind).toBe("validation");
    });

    it("la sesión sobrevive a reiniciar la app y cerrar sesión la revoca en el servidor", async () => {
      const account = await register();
      const reopened = h.restart();
      expect((await reopened.session())?.userId).toBe(account.id);
      expect((await reopened.profile())?.name).toBe("Ana Prueba");
      const valid = await h.captureSession();
      expect(await valid()).toBe(true);
      await reopened.logout();
      expect(await reopened.session()).toBeNull();
      expect(await reopened.profile()).toBeNull();
      expect(await h.restart().session()).toBeNull();
      expect(await valid()).toBe(false);
    });

    it("vuelve a entrar tras cerrar sesión y conserva el perfil", async () => {
      await register();
      const updated = await h.auth.updateProfile({ description: "Viajo con mi familia", email: "ana@ejemplo.com" });
      expect(updated).toMatchObject({ name: "Ana Prueba", description: "Viajo con mi familia", email: "ana@ejemplo.com" });
      await h.auth.logout();
      await h.advance(RESEND_COOLDOWN_MS);
      await h.auth.start({ phone: h.phone });
      const account = await h.auth.verify(h.code);
      expect(account).toMatchObject({ name: "Ana Prueba", description: "Viajo con mi familia", email: "ana@ejemplo.com" });
    });

    it("el perfil solo cambia nombre, correo y descripción, y valida el correo", async () => {
      await register();
      expect(await h.auth.updateProfile({ name: "  Ana María ", email: "", description: "" })).toMatchObject({ name: "Ana María", email: null, description: null });
      expect((await failure(h.auth.updateProfile({ email: "ana@" }))).message).toBe("Ese correo no parece válido.");
      await h.auth.logout();
      expect((await failure(h.auth.updateProfile({ name: "Otra" }))).kind).toBe("session");
    });

    it("registrarse con un número que ya tiene cuenta entra en ella sin renombrarla", async () => {
      await register();
      await h.auth.logout();
      await h.advance(RESEND_COOLDOWN_MS);
      const account = await register(h.auth, "Otra Persona");
      expect(account.name).toBe("Ana Prueba");
    });

    it("espera 30 segundos entre códigos para el mismo número", async () => {
      await h.auth.start({ name: "Ana Prueba", phone: h.phone });
      const tooSoon = await failure(h.auth.resend());
      expect(tooSoon.kind).toBe("rate_limit");
      expect(tooSoon.message).toBe("Espere 30 segundos antes de pedir otro código.");
      expect((await failure(h.auth.start({ name: "Ana Prueba", phone: h.phone }))).message).toMatch(/^Espere \d+ segundos antes de pedir otro código\.$/);
      await h.advance(RESEND_COOLDOWN_MS);
      await h.auth.resend();
      expect((await h.auth.verify(h.code)).name).toBe("Ana Prueba");
    });

    it("el límite de envíos de Supabase llega como aviso en español", async () => {
      await h.auth.start({ name: "Ana Prueba", phone: h.phone });
      h.auth.cancel();
      const e = await failure(h.auth.start({ name: "Ana Prueba", phone: h.phone }));
      expect(e.kind).toBe("rate_limit");
      expect(e.message).toMatch(/^Espere (un momento|\d+ segundos) antes de pedir otro código\.$/);
    });

    it("cancelar olvida el número pendiente", async () => {
      await h.auth.start({ name: "Ana Prueba", phone: h.phone });
      h.auth.cancel();
      expect(h.auth.pending()).toBeNull();
      expect((await failure(h.auth.verify(h.code))).message).toBe("No hay ningún código pendiente. Vuelva a empezar.");
      expect((await failure(h.auth.resend())).message).toBe("No hay ningún número pendiente. Vuelva a empezar.");
    });

    it("el número pendiente sobrevive a reabrir la pestaña durante diez minutos", async () => {
      await h.auth.start({ name: "Ana Prueba", phone: h.phone });
      expect(h.restart().pending()?.phone).toBe(h.phone);
      await h.advance(PENDING_TTL_MS);
      expect(h.restart().pending()).toBeNull();
    });

    describe("segundo factor (app de autenticación)", () => {
      // Solo el admin tiene segundo factor: seed_admin le da el rótulo que GoTrue exige para inscribir un TOTP.
      const registerAdmin = async () => {
        const account = await register();
        await h.makeAdmin();
        return account;
      };
      const pending = async () => {
        const factor = await h.auth.enrolMfa();
        if (factor.verified) throw new Error("se esperaba un factor sin verificar");
        return factor;
      };

      it("la primera vez inscribe un factor con QR y secreto; un código de la app sube la sesión a aal2 (también tras reiniciar)", async () => {
        const account = await registerAdmin();
        const seen: string[] = [];
        const stop = h.auth.onSessionChange((s) => s && seen.push(s.aal));
        const factor = await pending();
        expect(factor.qrCode).toMatch(/^data:image\/svg\+xml/);
        expect(factor.secret).toMatch(/^[A-Z2-7]{16,}$/);
        expect((await failure(h.auth.verifyMfa(factor.factorId, "12345"))).message).toBe("El código tiene 6 dígitos.");
        expect(await h.auth.session()).toEqual({ userId: account.id, aal: "aal1" });
        await h.auth.verifyMfa(factor.factorId, h.mfaCode(factor.secret));
        stop();
        expect(await h.auth.session()).toEqual({ userId: account.id, aal: "aal2" });
        expect(seen.at(-1)).toBe("aal2");
        expect(await h.restart().session()).toEqual({ userId: account.id, aal: "aal2" });
        expect(await h.auth.enrolMfa()).toEqual({ factorId: factor.factorId, verified: true });
      });

      it("un código equivocado no sube la sesión ni verifica el factor", async () => {
        await registerAdmin();
        const factor = await pending();
        const right = h.mfaCode(factor.secret);
        const wrong = right === "000000" ? "111111" : "000000";
        expect((await failure(h.auth.verifyMfa(factor.factorId, wrong))).message).toBe("Ese código no es correcto o caducó.");
        expect((await h.auth.session())?.aal).toBe("aal1");
      });

      it("si no se verificó, volver a entrar inscribe otro factor con otro secreto y el anterior deja de servir", async () => {
        await registerAdmin();
        const first = await pending();
        const second = await pending();
        expect(second.factorId).not.toBe(first.factorId);
        expect(second.secret).not.toBe(first.secret);
        expect((await h.auth.session())?.aal).toBe("aal1");
        await h.auth.verifyMfa(second.factorId, h.mfaCode(second.secret));
        expect((await h.auth.session())?.aal).toBe("aal2");
      });

      it("al volver a ingresar la sesión empieza en aal1 y el mismo factor, sin QR, sirve para subirla", async () => {
        await registerAdmin();
        const first = await pending();
        await h.auth.verifyMfa(first.factorId, h.mfaCode(first.secret));
        await h.auth.logout();
        await h.advance(1000);
        await h.auth.start({ phone: h.phone });
        await h.auth.verify(h.code);
        expect((await h.auth.session())?.aal).toBe("aal1");
        const again = await h.auth.enrolMfa();
        expect(again).toEqual({ factorId: first.factorId, verified: true });
        await h.auth.verifyMfa(again.factorId, h.mfaCode(first.secret));
        expect((await h.auth.session())?.aal).toBe("aal2");
      });
    });
  });
}
