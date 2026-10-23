// Ventanilla del token de Turnstile: el widget lo deja cuando lo tiene y el formulario lo recoge al enviar. Cada token
// sirve una sola vez (Supabase Auth lo comprueba con Cloudflare); si al enviar aún no llegó, se espera un rato.
import { CAPTCHA_FAILED, DomainError } from "../domain/errors";

export { CAPTCHA_FAILED };

export function createTokenGate(timeoutMs: number) {
  let token: string | null = null;
  let waiters: ((t: string) => void)[] = [];
  return {
    set(t: string) {
      const waiter = waiters.shift();
      if (waiter) waiter(t);
      else token = t;
    },
    /** El token caducó (unos 5 min) o el widget se reinició: no se entrega. */
    clear() {
      token = null;
    },
    take(): Promise<string> {
      if (token) {
        const t = token;
        token = null;
        return Promise.resolve(t);
      }
      return new Promise<string>((resolve, reject) => {
        const waiter = (t: string) => {
          clearTimeout(timer);
          resolve(t);
        };
        const timer = setTimeout(() => {
          waiters = waiters.filter((w) => w !== waiter);
          reject(new DomainError(CAPTCHA_FAILED, "validation"));
        }, timeoutMs);
        waiters.push(waiter);
      });
    },
  };
}
