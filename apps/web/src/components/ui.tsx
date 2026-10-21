import Link from "next/link";
import { I } from "./icons";

/** Fila de lista del diseño (icono, texto con línea secundaria, chevron). Enlace, botón de formulario o solo texto. */
export function ListItem({ href, icon, title, detail, right, disabled, onClickForm }: { href?: string; icon?: React.ReactNode; title: React.ReactNode; detail?: React.ReactNode; right?: React.ReactNode; disabled?: boolean; onClickForm?: (fd: FormData) => Promise<void> }) {
  const body = (
    <>
      {icon ? <span style={{ color: disabled ? "inherit" : "var(--muted)", display: "inline-flex" }}>{icon}</span> : null}
      <span className="body">
        {title}
        {detail ? <small>{detail}</small> : null}
      </span>
      {right ?? (href || onClickForm ? <span className="chev"><I.chevron /></span> : null)}
    </>
  );
  if (onClickForm) {
    return (
      <form action={onClickForm} style={{ display: "contents" }}>
        <button type="submit" className="list-item" disabled={disabled}>{body}</button>
      </form>
    );
  }
  if (href && !disabled) return <Link href={href} className="list-item">{body}</Link>;
  return <div className="list-item" aria-disabled={disabled || undefined}>{body}</div>;
}

export function Initials({ name, small }: { name: string; small?: boolean }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const text = ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
  return <span className={`avatar${small ? " avatar-sm" : ""}`} aria-hidden="true">{text}</span>;
}

/** Fecha relativa corta en es-CR: «hoy», «ayer», «hace 3 días», «12 oct». */
export function relativeDate(iso: string, now = Date.now()): string {
  const d = new Date(iso).getTime();
  const days = Math.floor((now - d) / 86_400_000);
  if (days <= 0) return "hoy";
  if (days === 1) return "ayer";
  if (days < 7) return `hace ${days} días`;
  return new Date(iso).toLocaleDateString("es-CR", { day: "numeric", month: "short" });
}
