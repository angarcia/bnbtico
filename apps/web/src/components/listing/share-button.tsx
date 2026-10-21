"use client";
import { useState } from "react";
import { I } from "@/components/icons";

type Props = {
  url: string;
  title: string;
  text: string;
  label?: string;
  disabled?: boolean;
  className?: string;
  /** Icono de WhatsApp delante del texto (botón relleno de Inicio). */
  icon?: boolean;
  /** Fila de lista (detalle de la casa) en vez de botón. */
  asListItem?: { detail: string };
  /** Botón redondo sobre la foto (ficha pública). */
  round?: boolean;
};

/** Compartir el enlace de la ficha: hoja nativa si existe (móvil); si no, copia el enlace y avisa. */
export function ShareButton({ url, title, text, label = "Compartir ficha", disabled = false, className = "btn btn-primary", icon, asListItem, round }: Props) {
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
  if (round) {
    return (
      <button type="button" className="icon-btn overlay" aria-label="Compartir ficha" onClick={share} data-share-url={url}>
        {copied ? <I.check /> : <I.share />}
      </button>
    );
  }
  if (asListItem) {
    return (
      <button type="button" className="list-item" onClick={share} disabled={disabled} aria-disabled={disabled || undefined} data-share-url={url}>
        <span style={{ color: disabled ? "inherit" : "var(--muted)", display: "inline-flex" }}><I.share /></span>
        <span className="body">
          {label}
          <small>{copied ? "Enlace copiado" : asListItem.detail}</small>
        </span>
        <span className="chev"><I.chevron /></span>
      </button>
    );
  }
  return (
    <span className="stack" style={{ gap: 4 }} data-share-url={url}>
      <button type="button" className={className} onClick={share} disabled={disabled}>
        {icon ? <I.wa size={20} /> : null}
        {label}
      </button>
      {copied ? <span role="status" className="xs muted center">Enlace copiado</span> : null}
    </span>
  );
}
