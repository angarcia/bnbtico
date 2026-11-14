// Barra superior de escritorio de la ficha y sus páginas de estado (revisión de escritorio 2026-11-13, A4). La ficha la
// renderiza el worker sin el router de la app, así que no usa la barra de TabsFrame: repite sus pestañas con enlaces y
// `navigate` (el router en la SPA, navegación completa en la ficha del servidor). Consultas abre su pantalla, sin contador.
// Depende de la sesión guardada y del ancho de la ventana: se monta tras hidratar, dentro de una caja que ya mide lo mismo
// en el HTML del servidor.
import type { MouseEvent } from "react";
import { hasStoredSession } from "../data/storage";
import { tabsFor } from "../domain/tabs";
import { useDesktop } from "../client/desktop";
import { CurrencySwitch } from "./currency-switch";
import { useHydrated } from "./hydration";
import { I } from "./icons";
import { ownListingsHint } from "./own-listings";

type Navigate = (href: string) => void;

export function SiteTopBar({ navigate, next }: { navigate?: Navigate; next?: string }) {
  const hydrated = useHydrated();
  const desktop = useDesktop();
  return <div className="site-top-bar">{hydrated && desktop ? <Bar navigate={navigate} next={next} /> : null}</div>;
}

function Bar({ navigate, next }: { navigate?: Navigate; next?: string }) {
  const session = hasStoredSession();
  const all = tabsFor({ session, isAdmin: false, listingsCount: session ? ownListingsHint() : 0, desktop: true });
  // Como en TabsFrame: sin «3Btico» ni la pestaña de Ingresar, y Consultas como icono junto a la moneda.
  const inquiries = all.some((t) => t.badge === "inquiries");
  const tabs = all.filter(({ to, badge }) => to !== "/que-es-3bstays" && badge !== "inquiries" && (session || to !== "/cuenta"));
  const go = (href: string) =>
    navigate
      ? (e: MouseEvent) => {
          e.preventDefault();
          navigate(href);
        }
      : undefined;
  const signIn = `/cuenta${next ? `?next=${encodeURIComponent(next)}` : ""}`;
  return (
    <nav className="tabbar desktop-nav" aria-label="Navegación principal">
      <a className="desktop-brand" href="/explorar" aria-label="3bstays, inicio" onClick={go("/explorar")}>
        <img src="/logo-horizontal.png" alt="3bstays" width={109} height={38} />
      </a>
      {tabs.map(({ to, label, icon }) => {
        const Icon = I[icon];
        return (
          <a key={to} href={to} className="nav" onClick={go(to)}>
            <Icon size={26} />
            <span>{label}</span>
          </a>
        );
      })}
      <CurrencySwitch className="desktop-currency" />
      {session ? null : (
        <a href={signIn} className="btn btn-ghost desktop-sign-in" onClick={go(signIn)}>
          <I.user size={22} /> Ingresar
        </a>
      )}
      {inquiries ? (
        <a href="/propietario/actividad" className="nav desktop-inquiries" aria-label="Consultas" title="Consultas" onClick={go("/propietario/actividad")}>
          <I.chat size={26} />
          <span aria-hidden="true">Consultas</span>
        </a>
      ) : null}
      <a href="/ayuda" className="nav desktop-help" aria-label="Ayuda por WhatsApp" title="Ayuda por WhatsApp" onClick={go("/ayuda")}>
        <I.wa size={24} />
        <span>Ayuda por WhatsApp</span>
      </a>
    </nav>
  );
}
