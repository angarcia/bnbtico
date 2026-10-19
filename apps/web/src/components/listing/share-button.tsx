"use client";
import { useState } from "react";

/** Compartir el enlace de la ficha: hoja nativa si existe (móvil); si no, copia el enlace y avisa. */
export function ShareButton({ url, title, text, label = "Compartir ficha", disabled = false, className = "btn btn-primary" }: { url: string; title: string; text: string; label?: string; disabled?: boolean; className?: string }) {
  const [copied, setCopied] = useState(false);
  async function share() {
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
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
    <span className="stack" style={{ gap: 4 }} data-share-url={url}>
      <button type="button" className={className} onClick={share} disabled={disabled}>{label}</button>
      {copied ? <span role="status" className="xs muted center">Enlace copiado</span> : null}
    </span>
  );
}
