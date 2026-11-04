import { useEffect, useRef, useState } from "react";
import { I } from "./icons";
import { useChanged } from "./use-changed";

export interface ShareTarget {
  url: string;
  title: string;
  text: string;
}

/** Compartir el enlace de una ficha: hoja nativa si existe (móvil); si no, copia el enlace y avisa un momento. */
export function useShare(target: ShareTarget) {
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share(target);
        return;
      }
      await navigator.clipboard.writeText(target.url);
      setCopied(true);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setCopied(false), 2500);
    } catch {
      /* el usuario canceló la hoja de compartir o no hay portapapeles */
    }
  }
  // Clase del contenido que cambia con «Enlace copiado»: se anima al cambiar, no al montar.
  const swap = useChanged(copied) ? "swap-in changed" : "swap-in";
  return { share, copied, swap };
}

/** Botón sobre la foto de la ficha pública: tarjeta flotante (tarjetas flotantes, tanda 2). */
export function ShareButton(target: ShareTarget) {
  const { share, copied, swap } = useShare(target);
  return (
    <button type="button" className="icon-btn float-card" aria-label={copied ? "Enlace copiado" : "Compartir ficha"} onClick={share}>
      <span key={copied ? "copied" : "share"} className={swap}>
        {copied ? <I.check /> : <I.share />}
      </span>
    </button>
  );
}
