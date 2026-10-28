// El selector de moneda de la ficha tal como lo pinta el servidor (antes de hidratar): una caja del mismo tamaño, sin
// botones; el navegador monta el selector después de hidratar.
import { FX_INITIAL } from "../../src/domain/fx";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
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

function Providers({ children }: { children: ReactNode }) {
  // Como en el worker: la caché de Query sembrada con la casa y sus días.
  const client = new QueryClient();
  seedListing(client, listing(), [], FX_INITIAL);
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("selector de moneda de la ficha antes de hidratar", () => {
  it("la ficha del servidor lleva la caja de la moneda, no los botones", () => {
    const html = renderToString(
      <Providers>
        <ListingPage listing={listing()} base="https://bnbtico.com" />
      </Providers>,
    );
    expect(html).toContain('<span class="currency-switch currency-switch-box overlay" aria-hidden="true"></span>');
    expect(html).not.toContain('aria-label="Dólares"');
  });

  it("la vista previa del borrador no lleva selector", () => {
    const html = renderToString(
      <Providers>
        <ListingPage listing={listing()} base="https://bnbtico.com" preview />
      </Providers>,
    );
    expect(html).not.toContain("currency-switch");
  });
});
