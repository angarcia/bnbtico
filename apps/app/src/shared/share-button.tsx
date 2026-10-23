import { useEffect, useRef, useState } from "react";
import { I } from "./icons";

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
  return { share, copied };
}

/** Botón redondo sobre la foto (ficha pública). */
export function ShareButton(target: ShareTarget) {
  const { share, copied } = useShare(target);
  return (
    <button type="button" className="icon-btn overlay" aria-label={copied ? "Enlace copiado" : "Compartir ficha"} onClick={share}>
      {copied ? <I.check /> : <I.share />}
    </button>
  );
}
