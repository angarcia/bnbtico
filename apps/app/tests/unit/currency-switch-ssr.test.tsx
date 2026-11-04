// La barra de la ficha tal como la pinta el servidor (antes de hidratar): colones y dólares a la vez y la nota de precios
// orientativos; la ficha no lleva selector de moneda (densidad y tarjetas, 2026-10-29), así que hidratar no cambia nada.
import { FX_INITIAL } from "../../src/domain/fx";
import { formatCRC, formatUSD } from "../../src/domain/money";
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

describe("barra de la ficha en el servidor", () => {
  it("lleva colones a la izquierda y dólares a la derecha en la tarjeta de precios, sin la nota ni selector de moneda", () => {
    const l = listing({ acceptsMonthly: true, monthlyPriceCrc: 650000 });
    const html = renderToString(
      <Providers>
        <ListingPage listing={l} base="https://bnbtico.com" />
      </Providers>,
    );
    expect(html).toContain(`data-testid="main-price"><span class="price-fig">${formatCRC(85000)}`);
    expect(html).toContain(`data-testid="price-usd" title="Orientativo: ≈ ₡510 por US$1, tipo de referencia del 26 oct.">≈ ${formatUSD(85000, FX_INITIAL.crcPerUsd)}`);
    // Sin fechas (el servidor no las conoce) la barra lleva solo el precio por noche: «Mensual» va con 30 noches o más, y el
    // precio al mes, en la casilla «Alquiler mensual» (ronda de Ana 2 nov, ticket 08).
    expect(html).not.toContain("Mensual:");
    expect(html).not.toContain('data-testid="monthly-usd"');
    expect(html).toContain(`<span>Alquiler mensual</span><small>${formatCRC(650000)} / mes</small>`);
    // Tarjetas flotantes, tanda 2 (decisiones 1 y 2): la tarjeta clara con los precios, aparte del botón, y fuera la nota.
    expect(html).toContain('<div class="cta-bar"><div class="cta-card float-card is-strong"><div class="cta-prices">');
    expect(html).not.toContain("Precios orientativos");
    expect(html).not.toContain("currency-switch");
    expect(html).not.toContain("orientativo</span>");
  });

  it("una casa no disponible tampoco lleva la nota", () => {
    const html = renderToString(
      <Providers>
        <ListingPage listing={listing({ available: false })} base="https://bnbtico.com" />
      </Providers>,
    );
    expect(html).toContain("No disponible por ahora");
    expect(html).not.toContain("Precios orientativos");
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
