// Hidratación de la ficha que llega renderizada del worker (y de sus páginas de estado). main.tsx la importa cuando la
// portada ya cargó, para que React y la ficha no le quiten ancho de banda al LCP.
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, useEffect, type ReactNode } from "react";
import { hydrateRoot } from "react-dom/client";
import { ListingScreen } from "../shared/listing-page";
import { listingQuery } from "../shared/listing-query";
import type { SsrData } from "../shared/ssr-data";
import { BlockedPage, ErrorPage, MissingPage } from "../shared/status-pages";

function Hydrated({ children }: { children: ReactNode }) {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return children;
}

function ssrPage(data: SsrData): ReactNode {
  if (data.page !== "listing") return { missing: <MissingPage />, blocked: <BlockedPage />, error: <ErrorPage /> }[data.page];
  // La caché de Query arranca con la casa del servidor: hidratar no vuelve a pedirla.
  const client = new QueryClient();
  client.setQueryData(listingQuery(data.listing.publicId).queryKey, data.listing);
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
