// Barra superior de escritorio de la ficha y sus páginas de estado (revisión de escritorio 2026-11-13, A4). La ficha la
// renderiza el worker sin el router de la app, así que no usa la barra de TabsFrame: repite sus pestañas con enlaces y
// `navigate` (el router en la SPA, navegación completa en la ficha del servidor). Consultas abre su pantalla, sin contador.
// Depende de la sesión guardada y del ancho de la ventana: se monta tras hidratar, dentro de una caja que ya mide lo mismo
// en el HTML del servidor.
import type { MouseEvent } from "react";
import { hasStoredSession } from "../data/storage";
import { tabsFor } from "../domain/tabs";
import { useDesktop } from "./desktop";
import { CurrencySwitch } from "./currency-switch";
import { useHydrated } from "./hydration";
import { I } from "./ui/icons";
import { ownListingsHint } from "./own-listings";
import { ButtonLink } from "./ui/button";
import { BrandLogo, NavBar, NavItemContent } from "./ui/structure";
import * as TOP_BAR_COPY from "./copy/top-bar";

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
    <NavBar
      desktop
      tabs={tabs.map(({ to, label, icon }) => ({ to, label, icon }))}
      brand={
        <a className="desktop-brand" href="/explorar" aria-label={TOP_BAR_COPY.home} onClick={go("/explorar")}>
          <BrandLogo />
        </a>
      }
      renderLink={(tab, props) => <a key={tab.to} href={tab.to} onClick={go(tab.to)} {...props} />}
      end={
        <>
          <CurrencySwitch placement="desktop-currency" />
          {session ? null : (
            <ButtonLink href={signIn} variant="secondary" placement="desktop-sign-in" icon={<I.user size={22} />} onClick={go(signIn)}>
              {TOP_BAR_COPY.signIn}
            </ButtonLink>
          )}
          {inquiries ? (
            <a href="/propietario/actividad" className="nav desktop-inquiries" aria-label={TOP_BAR_COPY.inquiries} title={TOP_BAR_COPY.inquiries} onClick={go("/propietario/actividad")}>
              <NavItemContent icon="chat" label={TOP_BAR_COPY.inquiries} labelHidden />
            </a>
          ) : null}
          <a href="/ayuda" className="nav desktop-help" aria-label={TOP_BAR_COPY.help} title={TOP_BAR_COPY.help} onClick={go("/ayuda")}>
            <NavItemContent icon="wa" label={TOP_BAR_COPY.help} iconSize={24} />
          </a>
        </>
      }
    />
  );
}
