import { StrictMode, useEffect } from "react";
import { createRoot, hydrateRoot } from "react-dom/client";
import type { ListingView } from "../shared/listing";
import { ListingPage } from "../shared/listing-page";
import { Shell } from "./shell";
import "../styles/global.css";

const root = document.getElementById("root")!;
const embedded = document.getElementById("listing-data");

function HydratedListing({ listing }: { listing: ListingView }) {
  useEffect(() => {
    document.documentElement.dataset.hydrated = "true";
  }, []);
  return <ListingPage listing={listing} />;
}

if (embedded?.textContent) {
  const listing = JSON.parse(embedded.textContent) as ListingView;
  hydrateRoot(root, <StrictMode><HydratedListing listing={listing} /></StrictMode>, {
    onRecoverableError: (error) => console.error("Error de hidratación en la ficha", error),
  });
} else {
  createRoot(root).render(<StrictMode><Shell /></StrictMode>);
}
