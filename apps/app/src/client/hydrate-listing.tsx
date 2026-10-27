// Hidratación de la ficha que llega renderizada del worker (y de sus páginas de estado). main.tsx la importa cuando la
// portada ya cargó, para que React y la ficha no le quiten ancho de banda al LCP.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, useEffect, type ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { ListingScreen } from "../shared/listing-page";
import { seedListing } from "../shared/listing-query";
import type { SsrData } from "../shared/ssr-data";
import { BlockedPage, ErrorPage, MissingPage } from "../shared/status-pages";

function Hydrated({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return children;
}

function ssrPage(data: SsrData): ReactNode {
  if (data.page === "blocked") return <BlockedPage reason={data.reason} />;
  if (data.page !== "listing") return { missing: <MissingPage />, error: <ErrorPage /> }[data.page];
  // La caché de Query arranca con la casa, los días y el tipo de cambio del servidor: hidratar no vuelve a pedirlos.
  const client = new QueryClient();
  seedListing(client, data.listing, data.days, data.fx);
  return (
    <QueryClientProvider client={client}>
      <ListingScreen publicId={data.listing.publicId} base={data.base} />
    </QueryClientProvider>
  );
}

export function hydrate(root: HTMLElement, data: SsrData): void {
  hydrateRoot(root, <StrictMode><Hydrated>{ssrPage(data)}</Hydrated></StrictMode>, {
    onRecoverableError: (error) => console.error("Error de hidratación", error),
  });
}
