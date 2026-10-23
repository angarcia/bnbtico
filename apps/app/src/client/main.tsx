import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { StrictMode, useEffect, type ReactNode } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import { ListingScreen } from "../shared/listing-page";
import { listingQuery } from "../shared/listing-query";
import { SSR_DATA_ID, type SsrData } from "../shared/ssr-data";
import { BlockedPage, ErrorPage, MissingPage } from "../shared/status-pages";
import "../styles/global.css";

const root = document.getElementById("root")!;
const embedded = document.getElementById(SSR_DATA_ID)?.textContent;

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

if (embedded) {
  hydrateRoot(root, <StrictMode><Hydrated>{ssrPage(JSON.parse(embedded) as SsrData)}</Hydrated></StrictMode>, {
    onRecoverableError: (error) => console.error("Error de hidratación", error),
  });
} else {
  import("./shell").then(({ Shell }) => createRoot(root).render(<StrictMode><Shell /></StrictMode>));
}

// El service worker se registra cuando la página ya cargó (no compite con lo primero que se pinta) y solo en el build.
if (import.meta.env.PROD && "serviceWorker" in navigator) {
  const register = () => void import("./sw-register").then((m) => m.registerServiceWorker());
  if (document.readyState === "complete") register();
  else addEventListener("load", register, { once: true });
}
