// El botón de la barra tal como lo pinta el servidor (antes de hidratar): mismo HTML que el primer render del navegador.
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
  seedListing(client, l, []);
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
    expect(html).toMatch(/<button class="btn btn-wa" type="button" disabled="">.*No disponible para consultas<\/button>/);
    expect(html).not.toContain("Vuelve a estar disponible");
  });
  it("no disponible con fecha de reapertura: la nota debajo", () => {
    expect(bar(listing({ available: false, reopenAt: "2026-11-15" }))).toContain("Vuelve a estar disponible el 15 de noviembre");
  });
});
