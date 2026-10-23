// Ficha abierta desde la app (navegación SPA). La carga directa de /casa/CT-#### la sigue renderizando el worker.
import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useCanGoBack, useRouter } from "@tanstack/react-router";
import { useState } from "react";
import { ListingScreen } from "../../shared/listing-page";
import { listingSeed } from "../queries";

const route = getRouteApi("/casa/$publicId");

export function CasaScreen() {
  const { publicId } = route.useParams();
  const client = useQueryClient();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const [seed] = useState(() => listingSeed(client, publicId));
  return (
    <ListingScreen
      key={publicId}
      publicId={publicId}
      base={window.location.origin}
      seed={seed}
      onBack={() => (canGoBack ? router.history.back() : router.navigate({ to: "/explorar" }))}
    />
  );
}
