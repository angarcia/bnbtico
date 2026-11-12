// Turnstile de Cloudflare en Ingresar y en Código (reenviar): la protección de bots de Supabase Auth exige un token por
// cada envío del código. El script se pide solo al abrir esas pantallas (nunca en el JS inicial) y es la única excepción de
// terceros de la CSP del shell (script-src y frame-src https://challenges.cloudflare.com; ver src/shared/security.ts).
// Sin VITE_TURNSTILE_SITE_KEY no se carga nada y el código se pide sin token.
import { useCallback, useEffect, useRef } from "react";
import { CAPTCHA_FAILED, DomainError } from "../domain/errors";
import { TURNSTILE_ORIGIN } from "../shared/security";
import { createTokenGate } from "./token-gate";

interface TurnstileApi {
  render(el: HTMLElement, options: Record<string, unknown>): string;
  reset(id: string): void;
  remove(id: string): void;
}

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const SITE_KEY = import.meta.env.VITE_TURNSTILE_SITE_KEY;
const TOKEN_WAIT_MS = 20_000;

let script: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  script ??= new Promise<TurnstileApi>((resolve, reject) => {
    if (window.turnstile) return resolve(window.turnstile);
    const el = document.createElement("script");
    el.src = `${TURNSTILE_ORIGIN}/turnstile/v0/api.js?render=explicit`;
    el.async = true;
    el.onload = () => (window.turnstile ? resolve(window.turnstile) : reject(new Error("Turnstile sin API")));
    el.onerror = () => {
      script = null;
      reject(new Error("No se pudo cargar Turnstile"));
    };
    document.head.appendChild(el);
  });
  return script;
}

/**
 * Widget invisible salvo que Cloudflare pida interacción («interaction-only»). `token()` devuelve el token para el
 * siguiente envío (o undefined sin Turnstile configurado) y deja el widget preparado para otro.
 */
export function useTurnstile() {
  const container = useRef<HTMLDivElement>(null);
  const gate = useRef(createTokenGate(TOKEN_WAIT_MS));
  const widget = useRef<{ api: TurnstileApi; id: string } | null>(null);

  useEffect(() => {
    if (!SITE_KEY || !container.current) return;
    let cancelled = false;
    const el = container.current;
    loadTurnstile()
      .then((api) => {
        if (cancelled) return;
        const id = api.render(el, {
          sitekey: SITE_KEY,
          action: "otp",
          appearance: "interaction-only",
          language: "es",
          callback: (t: string) => gate.current.set(t),
          "expired-callback": () => gate.current.clear(),
          "error-callback": () => gate.current.clear(),
        });
        widget.current = { api, id };
      })
      .catch((error: unknown) => console.warn("Turnstile", error));
    return () => {
      cancelled = true;
      if (widget.current) widget.current.api.remove(widget.current.id);
      widget.current = null;
    };
  }, []);

  const token = useCallback(async (): Promise<string | undefined> => {
    if (!SITE_KEY) return undefined;
    if (!script) throw new DomainError(CAPTCHA_FAILED, "validation");
    const t = await gate.current.take();
    const w = widget.current;
    if (w) w.api.reset(w.id);
    return t;
  }, []);

  return { container, token };
}
