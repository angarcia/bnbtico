import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "@tanstack/react-router";
import { Suspense, lazy, useState } from "react";
import type { PublicListing } from "../domain/listing";
import { firstName } from "../domain/person";
import { track } from "../shared/beacon";
import { I } from "../shared/ui/icons";
import { listingDaysQuery } from "../shared/listing-query";
import { FLAGS } from "../shared/flags";

// La hoja de contacto es la de la ficha, en su trozo: se pide al apuntar o tocar el botón, nunca en el JS inicial.
const loadSheet = () => import("../shared/contact-sheet");
const ContactSheet = lazy(() => loadSheet().then((m) => ({ default: m.ContactSheet })));

/** Botón redondo de WhatsApp de la tarjeta de Explorar (ticket 09 de la ronda del 2 nov), fuera del enlace como el corazón.
 *  Abre la misma hoja de contacto sobre Explorar, con las fechas de la pestaña (`stay-dates.ts`) y los días de esa casa: la
 *  hoja no envía mientras se leen ni con noches ocupadas, como en la ficha. Sin sesión, «Abrir WhatsApp» sigue el flujo de
 *  siempre (`contact-flow.ts`). Nunca `wa.me` directo: el número solo lo da `create_inquiry`. */
export function CardWhatsApp({ listing }: { listing: PublicListing }) {
  const [open, setOpen] = useState(false);
  const router = useRouter();
  const queryClient = useQueryClient();
  const days = useQuery({ ...listingDaysQuery(listing.publicId), enabled: open });
  return (
    <>
      <button
        type="button"
        className="card-wa"
        aria-label={`Contactar por WhatsApp a ${firstName(listing.ownerName)}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        onPointerDown={() => {
          void loadSheet();
          void queryClient.prefetchQuery(listingDaysQuery(listing.publicId));
        }}
        onClick={() => {
          track("whatsapp_tap", listing.publicId);
          setOpen(true);
        }}
      >
        <I.wa size={24} />
      </button>
      {open ? (
        // Mientras llega el trozo de la hoja, la página ya se atenúa: el toque responde al instante.
        <Suspense fallback={<div className="sheet-backdrop" />}>
          <ContactSheet
            listing={listing}
            days={days.isError ? null : days.data}
            navigate={(href) => void router.navigate({ href })}
            nightsChoice={FLAGS.exploreNights}
            onClose={() => setOpen(false)}
          />
        </Suspense>
      ) : null}
    </>
  );
}
