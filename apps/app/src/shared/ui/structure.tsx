// Estructura y contenido comunes (historia 07, paso 5; API en docs/componentes.md): etiquetas de estado, avisos, error de
// carga, estados vacíos, esqueletos y contadores. Las tarjetas y filas están en ./card.tsx y el campo cerrado en
// ./closed-field.tsx, aparte para que no entren en el JS inicial (solo las leen trozos diferidos). Sin estado, sin router y sin
// consultas: la ficha SSR (shared/listing-page.tsx, shared/status-pages.tsx) los usa tal cual; las variantes sobre `Link`
// están en client/router-buttons.tsx. El aspecto sale de props cerradas (CSS en shared/ui/componentes.css, «Estructura»); las
// pantallas no escriben estas clases. `placement` solo admite las clases de colocación que ya existían.
import { createElement, type HTMLAttributes, type ReactNode } from "react";
import type { StatusLabel, StatusTone } from "../../domain/status-label";
import { TextButton } from "./button";
import { I, type IconName } from "./icons";

const join = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

// ---------- StatusTag ----------

/** La clase de cada tono en una fila (`badge-*`) y sobre la foto (`state-*`). */
// El borrador va en arena, como sobre la foto (decisión de Ana del 2026-11-20); `neutral` también.
const rowTone = (t: StatusTone) => (t === "pay" ? "badge-sun" : t === "changes" ? "badge-review" : t === "off" ? "badge-mute" : t === "neutral" || t === "draft" ? "" : `badge-${t}`);
const photoTone = (t: StatusTone) => `state-${t === "changes" ? "review" : t === "neutral" ? "draft" : t === "new" ? "pay" : t === "admin" ? "ok" : t}`;

type StatusTagProps = {
  /** `row`: en una fila o un texto; `photo`: sobre la foto de una tarjeta; `field`: en la fila de un dato que se edita. */
  placement?: "row" | "photo" | "field";
  /** Menos relleno (filas densas del admin). */
  tight?: boolean;
  /** Letra de 14 px. */
  small?: boolean;
  /** El texto y el tono: de domain/status-label.ts (`statusLabel(status, context)`, `holdLabel`, `editStatusLabel`,
   *  `cardLabel`) o, para lo que no es un estado («Nueva», «Admin»), escrito en la pantalla. */
  label: StatusLabel;
} & Pick<HTMLAttributes<HTMLSpanElement>, "aria-hidden" | "id"> & { "data-testid"?: string };

/** Etiqueta de estado redonda (D5). */
export function StatusTag({ placement = "row", tight = false, small = false, label: { text, tone }, ...rest }: StatusTagProps) {
  const cls =
    placement === "photo" ? `state ${photoTone(tone)}`
    : placement === "field" ? `tag-rev ${tone === "changes" ? "is-changes" : "is-pending"}`
    : join("badge", rowTone(tone), tight && "badge-tight", small && "xs");
  return <span {...rest} className={cls}>{text}</span>;
}

// ---------- CountBadge ----------

/** Contador de cosas nuevas: terracota en la pestaña (`tab`) y en «Consultas» de una casa (`house`); verde redondo con
 *  borde en el botón Filtros (`filters`). */
export function CountBadge({ n, placement = "tab", ...rest }: { n: number; placement?: "tab" | "house" | "filters" } & Pick<HTMLAttributes<HTMLElement>, "aria-hidden"> & { "data-testid"?: string }) {
  return n > 0 ? <b {...rest} className={`count-badge count-${placement} num`}>{n}</b> : null;
}

// ---------- Notice y LoadError ----------

/** `info`: neutro; `solid`: blanco opaco (antes «note-arena»); `sun`: ocre; `review`: arena de revisión; `error`: rojo, con
 *  `role="alert"` siempre (no hay que elegirlo). */
export type NoticeTone = "info" | "solid" | "sun" | "review" | "error";
const NOTICE_TONE: Record<NoticeTone, string> = { info: "", solid: "note-solid", sun: "note-sun", review: "note-review", error: "" };

type NoticeProps = {
  tone?: NoticeTone;
  as?: "p" | "div" | "span";
  /** Letra de 15 px. */
  small?: boolean;
  /** `column`: título y texto en columna (8 px); `stack`: líneas en columna (4 px). */
  layout?: "column" | "stack";
  /** Un aviso que no interrumpe (`role="status"`); no vale con `error`. */
  announce?: boolean;
  /** Sin caja: solo el fondo del tono, dentro de otra pieza (la línea de un dato en revisión). */
  inline?: boolean;
  /** Acción al final, a la derecha («Reintentar»). */
  action?: ReactNode;
  placement?: "sheet-line";
  children: ReactNode;
} & Pick<HTMLAttributes<HTMLElement>, "id"> & { "data-testid"?: string };

export function Notice({ tone = "info", as = "p", small = false, layout, announce = false, inline = false, action, placement, children, ...rest }: NoticeProps) {
  const cls = join(placement, !inline && "note", NOTICE_TONE[tone], small && "small", layout === "column" ? "note-col" : layout === "stack" && "stack gap-4", action !== undefined && "note-action");
  const role = tone === "error" ? "alert" : announce ? "status" : undefined;
  return createElement(as, { ...rest, className: cls, role }, action !== undefined ? <><span>{children}</span>{action}</> : children);
}

/** El error de carga, igual en todas las pantallas: aviso rojo con `role="alert"` y «Reintentar». */
export function LoadError({ onRetry, children = "No pudimos cargar las casas. Revise su conexión e inténtelo de nuevo." }: { onRetry: () => void; children?: ReactNode }) {
  return (
    <Notice tone="error" as="div" action={<TextButton tone="link" onClick={onRetry}>Reintentar</TextButton>}>
      {children}
    </Notice>
  );
}

// ---------- EmptyState ----------

/** Estado vacío o de «no hay nada aquí»: título opcional, texto y una acción. `framed`: dentro de una tarjeta (por defecto);
 *  sin ella, en columna. `titleLevel={1}`: el título es el de la página (páginas de estado de la ficha). */
export function EmptyState({ title, titleLevel = 3, text, action, framed = true, gap, placement }: {
  title?: ReactNode;
  titleLevel?: 1 | 3;
  text?: ReactNode;
  action?: ReactNode;
  framed?: boolean;
  gap?: 12 | 14;
  placement?: "placeholder-card" | "fav-empty";
}) {
  const body = (
    <>
      {title ? titleLevel === 1 ? <h1 className="status-title">{title}</h1> : <h3>{title}</h3> : null}
      {text}
      {action}
    </>
  );
  // Con caja, las clases de `<Card layout="stack">` (./card.tsx), escritas aquí para no traer las tarjetas al JS inicial.
  return <section className={join(framed && "card", "stack", gap && `gap-${gap}`, placement)}>{body}</section>;
}

// ---------- Skeleton ----------

/** `row`: miniatura y línea (una casa); `line`: solo la línea; `avatar`: inicial redonda y línea (una consulta); `account`,
 *  `subscription` (con su línea) y `calendar` (vacía): cajas de alto fijo; `grid`: `count` tarjetas de casa (≤ 4 si no se dice) de Explorar y
 *  Favoritos. Con `label`, `aria-busy` y `aria-label`; la rejilla sin `label` queda oculta para lectores (`aria-hidden`). */
export type SkeletonShape = "row" | "line" | "avatar" | "account" | "subscription" | "calendar" | "grid";

export function Skeleton({ shape, label, count = 3, placement }: { shape: SkeletonShape; label?: string; count?: number; placement?: "explore-results" }) {
  const a11y = label ? { "aria-busy": true, "aria-label": label } : { "aria-hidden": true };
  if (shape === "grid")
    return (
      <div className={join("listing-grid", placement, "skeleton")} {...a11y}>
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="listing-card">
            <span className="sk photo" />
            <span className="sk sk-line" />
          </div>
        ))}
      </div>
    );
  return (
    <section className={`card skeleton ${shape === "account" ? "account" : shape === "subscription" ? "sub" : shape === "calendar" ? "cal" : "owner"}-skeleton`} {...a11y}>
      {shape === "row" ? <span className="sk thumb" /> : shape === "avatar" ? <span className="sk inquiry-avatar" /> : null}
      {shape === "calendar" ? null : <span className="sk sk-line" />}
    </section>
  );
}

// ---------- NavBar ----------
// La barra de pestañas: la presentación que comparten la barra de la app (TabsFrame, client/chrome.tsx; abajo en el teléfono,
// arriba en escritorio) y la barra de escritorio de la ficha SSR (SiteTopBar). Sin router ni sesión: cada lado decide las
// pestañas y pinta sus enlaces con `renderLink` (Link del router o <a>).

export interface NavTab {
  to: string;
  label: string;
  icon: IconName;
  /** Contador de nuevas (Anuncios, Consultas); 0 o nada: sin contador. */
  count?: number;
  countTestId?: string;
  /** Nombre accesible si no basta la etiqueta («Consultas, 2 nuevas»). */
  ariaLabel?: string;
  /** «Qué es 3bstays» sin sesión: el logo en vez del texto (que queda para lectores). */
  wordmark?: boolean;
}

/** Lo de dentro de una pestaña: icono de 26 px, etiqueta y contador. */
export function NavItemContent({ icon, label, count = 0, countTestId, iconSize = 26, labelHidden = false, countHidden = false, wordmark = false }: {
  icon: IconName;
  label: string;
  count?: number;
  countTestId?: string;
  iconSize?: number;
  /** La etiqueta se ve pero no se lee (el nombre lo da `aria-label`). */
  labelHidden?: boolean;
  countHidden?: boolean;
  wordmark?: boolean;
}) {
  const Icon = I[icon];
  return (
    <>
      <Icon size={iconSize} />
      {wordmark ? (
        <>
          <img className="nav-wordmark" src="/logo-horizontal.png" alt="" />
          <span className="sr-only">{label}</span>
        </>
      ) : <span aria-hidden={labelHidden || undefined}>{label}</span>}
      <CountBadge n={count} data-testid={countTestId} aria-hidden={countHidden || undefined} />
    </>
  );
}

/** El logo de la barra de escritorio (109 × 38). */
export const BrandLogo = () => <img src="/logo-horizontal.png" alt="3bstays" width={109} height={38} />;

export function NavBar<T extends NavTab>({ desktop, three = false, tabs, renderLink, brand, end }: {
  desktop: boolean;
  /** Tres pestañas en el teléfono: etiquetas más grandes. */
  three?: boolean;
  tabs: readonly T[];
  /** Pinta el enlace de una pestaña con estas props (`className` incluida). */
  renderLink: (tab: T, props: { className: string; children: ReactNode; "aria-label"?: string }) => ReactNode;
  /** El logo de escritorio, ya dentro de su enlace. */
  brand?: ReactNode;
  /** Lo que va al final en escritorio (moneda, Ingresar, Consultas, Ayuda). */
  end?: ReactNode;
}) {
  return (
    <nav className={`tabbar ${desktop ? "desktop-nav" : "chrome-hide"}${three ? " three" : ""}`} aria-label="Navegación principal">
      {brand}
      {tabs.map((tab) =>
        renderLink(tab, {
          className: "nav",
          "aria-label": tab.ariaLabel,
          children: <NavItemContent icon={tab.icon} label={tab.label} count={tab.count} countTestId={tab.countTestId} wordmark={tab.wordmark} />,
        }),
      )}
      {end}
    </nav>
  );
}
