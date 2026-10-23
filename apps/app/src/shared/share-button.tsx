import { useState } from "react";
import { I } from "./icons";

/** Botón redondo sobre la foto: hoja nativa de compartir si existe (móvil); si no, copia el enlace. */
export function ShareButton({ url, title, text }: { url: string; title: string; text: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    try {
      if (navigator.share) {
        await navigator.share({ title, text, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* el usuario canceló la hoja de compartir */
    }
  }
  return (
    <button type="button" className="icon-btn overlay" aria-label={copied ? "Enlace copiado" : "Compartir ficha"} onClick={share}>
      {copied ? <I.check /> : <I.share />}
    </button>
  );
}
