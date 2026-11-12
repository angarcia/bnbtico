// Ficha abierta desde la app (navegación SPA). La carga directa de /casa/CT-#### la sigue renderizando el worker.
// Con `?contacto=1` (vuelta de Ingresar tras «Abrir WhatsApp») reabre la hoja si hay un borrador y quita el parámetro.
import { useQueryClient } from "@tanstack/react-query";
import { getRouteApi, useCanGoBack, useRouter } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { shouldReopenContact } from "../../domain/contact-return";
import { webStore } from "../../data/storage";
import { ListingScreen } from "../../shared/listing-page";
import { listingSeed } from "../queries";

const route = getRouteApi("/casa/$publicId");

export function CasaScreen() {
  const { publicId } = route.useParams();
  const { contacto, escribir } = route.useSearch();
  const client = useQueryClient();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const [seed] = useState(() => listingSeed(client, publicId));
  const [openSheet] = useState<"return" | "write" | undefined>(() =>
    shouldReopenContact(contacto, webStore("session"), publicId) ? "return" : escribir === "1" ? "write" : undefined,
  );
  useEffect(() => {
    if (contacto || escribir) void router.navigate({ to: "/casa/$publicId", params: { publicId }, search: {}, replace: true });
  }, [contacto, escribir, publicId, router]);
  return (
    <ListingScreen
      key={publicId}
      publicId={publicId}
      base={window.location.origin}
      seed={seed}
      openSheet={openSheet}
      onBack={() => (canGoBack ? router.history.back() : router.navigate({ to: "/explorar" }))}
      navigate={(href) => void router.navigate({ href })}
    />
  );
}
