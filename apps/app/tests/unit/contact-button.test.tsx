// El botón de la barra tal como lo pinta el servidor (antes de hidratar): mismo HTML que el primer render del navegador.
import { FX_INITIAL } from "../../src/domain/fx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderToString } from "react-dom/server";
import { describe, expect, it } from "vitest";
import type { PublicListing } from "../../src/domain/listing";
import { ListingPage } from "../../src/shared/listing-page";
import { seedListing } from "../../src/shared/listing-query";

const listing = (over: Partial<PublicListing> = {}): PublicListing => ({
  id: "l1",
  publicId: "CT-1042",
  kind: "completo",
  title: "Casa Manzanillo",
  description: "Frente al mar.",
  province: "Limón",
  canton: "Talamanca",
  zone: "Manzanillo",
  approx: null,
  capacity: 4,
  bedrooms: 2,
  bathrooms: 1,
  bathroomShared: null,
  features: [],
  parkingPaid: null,
  acceptsNightly: true,
  nightlyPriceCrc: 85000,
  minNights: null,
  acceptsMonthly: false,
  monthlyMode: null,
  monthlyPriceCrc: null,
  minMonths: null,
  available: true,
  reopenAt: null,
  ownerName: "Daniel Aguado",
  ownerWhatsappVerified: true,
  createdAt: "2026-10-18T10:00:00Z",
  updatedAt: "2026-10-21T10:00:00Z",
  photos: [],
  ...over,
});

const bar = (l: PublicListing) => {
  // Como en el worker: la caché de Query sembrada con la casa y sus días.
  const client = new QueryClient();
  seedListing(client, l, [], FX_INITIAL);
  const html = renderToString(
    <QueryClientProvider client={client}>
      <ListingPage listing={l} base="https://bnbtico.com" />
    </QueryClientProvider>,
  );
  return html.slice(html.indexOf('class="cta-bar"'));
};

describe("botón de contacto antes de hidratar", () => {
  it("disponible: caja apagada sin botón (no haría nada hasta hidratar)", () => {
    const html = bar(listing());
    expect(html).toContain('<span class="btn btn-wa is-pending" aria-hidden="true">');
    expect(html).not.toContain("<button");
  });
  it("no disponible, sin fecha: botón deshabilitado y sin nota", () => {
    const html = bar(listing({ available: false }));
    expect(html).toMatch(/<button class="btn btn-wa" type="button" disabled="">.*No disponible por ahora<\/button>/);
    expect(html).not.toContain("Vuelve a estar disponible");
  });
  it("no disponible con fecha de reapertura: la nota en la tarjeta de precios, encima del botón", () => {
    const html = bar(listing({ available: false, reopenAt: "2026-11-15" }));
    expect(html).toMatch(/<div class="cta-card float-card is-strong">.*<span class="xs muted cta-note">Vuelve a estar disponible el 15 de noviembre<\/span><\/div><button/);
  });
});

// Tarjetas flotantes, tanda 2 (decisión 6): volver, compartir y el corazón flotan fijos arriba y se esconden al bajar. Fuera del
// hero (su nombre de View Transition le quitaría el desenfoque) y, antes de hidratar, cajas iguales con su icono.
describe("botones de arriba de la ficha antes de hidratar", () => {
  const page = (preview?: boolean) => {
    const client = new QueryClient();
    seedListing(client, listing(), [], FX_INITIAL);
    return renderToString(
      <QueryClientProvider client={client}>
        <ListingPage listing={listing()} base="https://bnbtico.com" preview={preview} />
      </QueryClientProvider>,
    );
  };
  it("van fuera del hero, en una pieza que se esconde, como tarjetas flotantes con su icono", () => {
    const html = page();
    const top = html.slice(html.indexOf('<div class="hero-top chrome-hide">'));
    expect(html.indexOf('<div class="hero-top chrome-hide">')).toBeGreaterThan(html.indexOf('<div class="hero">'));
    expect(html.slice(html.indexOf('<div class="hero">'), html.indexOf('<div class="hero-top'))).not.toContain("icon-btn");
    expect(top).toMatch(/^<div class="hero-top chrome-hide"><a href="\/explorar" aria-label="Volver a Explorar" class="icon-btn float-card"><svg/);
    expect(top).toMatch(/<span class="icon-btn float-card" aria-hidden="true"><svg[^>]*>.*?<\/svg><\/span><span class="heart heart-hero float-card" aria-hidden="true"><svg/);
    expect(top.slice(0, top.indexOf('<div class="stack listing-body"'))).not.toContain("<button");
  });
  it("la vista previa del asistente no los lleva", () => {
    expect(page(true)).not.toContain("hero-top");
  });
});
