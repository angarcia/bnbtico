// Botones comunes (historia 07, paso 2; API en docs/componentes.md). Sin router ni consultas: la ficha SSR
// (shared/listing-page.tsx) los usa tal cual; las variantes con `Link` de TanStack Router están en client/router-buttons.tsx.
// El aspecto sale solo de `variant`, `size`, `tone` y `block` (CSS de shared/ui/componentes.css, «Botones»): las pantallas no
// escriben clases de botón. `placement` es la única puerta para clases, y solo admite las de colocación que ya existían
// (márgenes, flex, orden en una fila): no cambian el aspecto del botón.
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, HTMLAttributes, ReactNode, Ref } from "react";
import { I } from "./icons";

export type ButtonVariant = "primary" | "secondary" | "pay" | "whatsapp" | "danger";
/** 44, 52 y 56 px de alto. */
export type ButtonSize = "md" | "lg" | "xl";
export type TextButtonTone = "link" | "quiet" | "danger";
export type IconButtonTone = "plain" | "overlay" | "float";

/** Clases de colocación que ya usaban las pantallas (ver los comentarios de cada regla en las hojas de cada área). */
export type ButtonPlacement = "grow" | "back" | "desktop-sign-in";
export type TextButtonPlacement = "delete-house" | "sub-stop" | "logout-link" | "account-profile-toggle" | "sent-link" | "cal-base" | "header-close";
export type IconButtonPlacement = "cal-arrow" | "status-back" | "search-close" | "map-card-close" | "map-locate" | "header-close" | "remove" | "photo-share" | "house-tool";

const VARIANT: Record<ButtonVariant, string> = {
  primary: "btn-primary",
  secondary: "btn-secondary",
  pay: "btn-sun",
  whatsapp: "btn-wa",
  danger: "btn-danger",
};
const SIZE: Record<ButtonSize, string> = { md: "", lg: " btn-lg", xl: " btn-xl" };
const PLACEMENT: Record<ButtonPlacement, string> = { grow: "grow", back: "btn-back", "desktop-sign-in": "desktop-sign-in" };
const TONE: Record<TextButtonTone, string> = { link: "btn-link", quiet: "btn-text", danger: "btn-text-danger" };
const ICON_TONE: Record<IconButtonTone, string> = { plain: "", overlay: " overlay", float: " float-card" };

type Look = {
  variant: ButtonVariant;
  size?: ButtonSize;
  /** A todo el ancho. */
  block?: boolean;
  /** Icono a la izquierda del texto. */
  icon?: ReactNode;
  placement?: ButtonPlacement;
};

function buttonClass({ variant, size = "md", block = false, placement }: Look): string {
  return `btn ${VARIANT[variant]}${SIZE[size]}${block ? " btn-block" : ""}${placement ? ` ${PLACEMENT[placement]}` : ""}`;
}

/** El icono de WhatsApp en su verde (`--wa-icon`), para los secundarios que abren WhatsApp con 3bstays (D4). */
export function WaIcon({ size = 20 }: { size?: number }) {
  return (
    <span className="wa-tint" aria-hidden="true">
      <I.wa size={size} />
    </span>
  );
}

type ButtonProps = Look & {
  /** Mientras se envía: `aria-busy` y `disabled`; el texto («Guardando…») lo pone quien lo usa. */
  pending?: boolean;
  ref?: Ref<HTMLButtonElement>;
} & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">;

export function Button({ variant, size, block, icon, placement, pending = false, disabled, type = "button", children, ...rest }: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      className={buttonClass({ variant, size, block, placement })}
      disabled={disabled || pending}
      aria-busy={pending || rest["aria-busy"] || undefined}
    >
      {icon}
      {children}
    </button>
  );
}

type ButtonLinkProps = Look & { ref?: Ref<HTMLAnchorElement> } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className">;

/** El mismo aspecto sobre `<a>` (enlaces externos, wa.me o la ficha SSR). Con el router: `RouterButtonLink`. */
export function ButtonLink({ variant, size, block, icon, placement, children, ...rest }: ButtonLinkProps) {
  return (
    <a {...rest} className={buttonClass({ variant, size, block, placement })}>
      {icon}
      {children}
    </a>
  );
}

/** La caja del botón antes de hidratar o en una vista previa: mismo tamaño y aspecto, sin acción. Con `aria-disabled`, el
 *  desactivado común. */
export function ButtonPlaceholder({ variant, size, block, icon, placement, children, ...rest }: Look & Pick<HTMLAttributes<HTMLSpanElement>, "aria-hidden" | "aria-disabled" | "aria-label" | "children">) {
  return (
    <span {...rest} className={buttonClass({ variant, size, block, placement })}>
      {icon}
      {children}
    </span>
  );
}

type TextLook = { tone: TextButtonTone; placement?: TextButtonPlacement };
const textClass = ({ tone, placement }: TextLook) => `${TONE[tone]}${placement ? ` ${placement}` : ""}`;

/** Acción en texto, 44 px de alto: `link` en verde, `quiet` en gris subrayado, `danger` en terracota. */
export function TextButton({ tone, placement, type = "button", ...rest }: TextLook & { ref?: Ref<HTMLButtonElement> } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className">) {
  return <button {...rest} type={type} className={textClass({ tone, placement })} />;
}

export function TextButtonLink({ tone, placement, ...rest }: TextLook & { ref?: Ref<HTMLAnchorElement> } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className">) {
  return <a {...rest} className={textClass({ tone, placement })} />;
}

type IconLook = {
  /** Nombre accesible obligatorio (`aria-label`): el botón solo enseña un icono. */
  label: string;
  tone?: IconButtonTone;
  placement?: IconButtonPlacement;
};
const iconClass = ({ tone = "plain", placement }: Omit<IconLook, "label">) => `icon-btn${ICON_TONE[tone]}${placement ? ` ${placement}` : ""}`;

/** 44 × 44 con un icono: `plain` sin fondo, `overlay` sobre las fotos, `float` en las tarjetas flotantes del mapa. */
export function IconButton({ label, tone, placement, type = "button", ...rest }: IconLook & { ref?: Ref<HTMLButtonElement> } & Omit<ButtonHTMLAttributes<HTMLButtonElement>, "className" | "aria-label">) {
  return <button {...rest} type={type} aria-label={label} className={iconClass({ tone, placement })} />;
}

export function IconButtonLink({ label, tone, placement, ...rest }: IconLook & { ref?: Ref<HTMLAnchorElement> } & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, "className" | "aria-label">) {
  return <a {...rest} aria-label={label} className={iconClass({ tone, placement })} />;
}

/** La caja de 44 × 44 de un botón de icono que se monta tras hidratar (compartir, favorito en la ficha SSR). */
export function IconButtonPlaceholder() {
  return <span className="icon-btn" aria-hidden="true" />;
}
