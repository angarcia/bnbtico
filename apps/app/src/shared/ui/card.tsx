// Tarjetas y filas de lista comunes (historia 07, paso 5; API en docs/componentes.md). Sin estado ni router; con el router:
// client/router-rows.tsx. Aparte de ./structure.tsx para que no entren en el JS inicial (solo las leen trozos diferidos).
import { createElement, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type HTMLAttributes, type Ref } from "react";

type Gap = 4 | 8 | 10 | 12 | 14 | 16;
const join = (...parts: (string | false | undefined)[]) => parts.filter(Boolean).join(" ");

// ---------- Card ----------

/** `plain`: blanco al 70 % (la de casi todo); `solid`: blanco opaco (antes «card-arena», D9); `soft`: verde tonal; `sun`: ocre. */
export type CardTone = "plain" | "solid" | "soft" | "sun";
const CARD_TONE: Record<CardTone, string> = { plain: "card", solid: "card-solid", soft: "card-soft", sun: "card-sun" };
/** Clases de sitio que ya tenían las tarjetas (ver las hojas de cada área). */
export type CardPlacement =
  | "return-card" | "contact-card" | "placeholder-card" | "publish-promo" | "subscription-offer" | "diff-fold" | "account-card"
  | "review-owner" | "listing-stats" | "inquiry-card" | "sub-house" | "sub-house-inactive" | "how-it-works" | "house-card"
  | "queue-card" | "counters" | "review-list" | "offer-line" | "about-price" | "cal-action-group" | "cal-airbnb";
const CARD_PLACEMENT: Record<CardPlacement, string> = {
  "return-card": "return-card", "contact-card": "return-card contact-card", "placeholder-card": "placeholder-card",
  "publish-promo": "offer-card publish-promo", "subscription-offer": "offer-card subscription-offer", "diff-fold": "diff-fold",
  "account-card": "account-card", "review-owner": "review-owner", "listing-stats": "listing-stats", "inquiry-card": "inquiry-card",
  "sub-house": "sub-house", "sub-house-inactive": "sub-house sub-house-inactive", "how-it-works": "small how-it-works",
  "house-card": "house-card", "queue-card": "queue-card", counters: "counters",
  "review-list": "review-list", "offer-line": "between baseline offer-line", "about-price": "about-price",
  "cal-action-group": "cal-action-group", "cal-airbnb": "cal-airbnb",
};

export type CardLook = {
  tone?: CardTone;
  /** `stack`: columna; `row`: fila. */
  layout?: "stack" | "row";
  gap?: Gap;
  placement?: CardPlacement;
  /** `new`: consulta nueva; `target`: la casa resaltada con `#pago=`. */
  mark?: "new" | "target";
};

export function cardClass({ tone = "plain", layout, gap, placement, mark }: CardLook): string {
  return join(CARD_TONE[tone], layout, gap && `gap-${gap}`, placement && CARD_PLACEMENT[placement], mark && `is-${mark}`);
}

type CardProps = CardLook & {
  as?: "section" | "article" | "div" | "details" | "nav";
  ref?: Ref<HTMLElement>;
  open?: boolean;
} & Omit<HTMLAttributes<HTMLElement>, "className">;

export function Card({ as = "section", tone, layout, gap, placement, mark, ...rest }: CardProps) {
  return createElement(as, { ...rest, className: cardClass({ tone, layout, gap, placement, mark }) });
}

/** Una tarjeta que es un enlace (la cola del admin). Con el router: `RouterCardLink`. */
export function CardLink({ tone, layout, gap, placement, mark, ...rest }: CardLook & { ref?: Ref<HTMLAnchorElement> } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className">) {
  return <a {...rest} className={cardClass({ tone, layout, gap, placement, mark })} />;
}

// ---------- List y ListRow ----------

export function List({ placement, ...rest }: { placement?: "account-actions" } & Omit<HTMLAttributes<HTMLElement>, "className">) {
  return <section {...rest} className={placement ? `list ${placement}` : "list"} />;
}

/** `sun`: la fila ocre (método de pago, publicar mi casa). */
export type ListRowLook = { tone?: "sun"; placement?: "house-row" | "publish-promo-row" };
const rowClass = ({ tone, placement }: ListRowLook) => join("list-item", tone && "list-item-sun", placement);

/** Fila de solo lectura (`aria-disabled` la pone en gris). */
export function ListRow({ tone, placement, ...rest }: ListRowLook & Omit<HTMLAttributes<HTMLDivElement>, "className">) {
  return <div {...rest} className={rowClass({ tone, placement })} />;
}

export function ListRowButton({ tone, placement, type = "button", ...rest }: ListRowLook & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">) {
  return <button {...rest} type={type} className={rowClass({ tone, placement })} />;
}

/** Fila que es un enlace. Con el router: `RouterListRow`. */
export function ListRowLink({ tone, placement, ...rest }: ListRowLook & { ref?: Ref<HTMLAnchorElement> } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className">) {
  return <a {...rest} className={rowClass({ tone, placement })} />;
}

