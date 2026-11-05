import { useRouter } from "@tanstack/react-router";
import { useEffect } from "react";
import { isContactNext, isPublishNext, listingInNext } from "../../domain/contact-return";
import { firstName } from "../../domain/person";
import { useReturnListing } from "../sign-in";

export function useGoTo() {
  const router = useRouter();
  return (href: string) => router.navigate({ href, replace: true });
}

/** Como `<Navigate replace>`, pero con una ruta que ya trae su búsqueda. */
export function Replace({ href }: { href: string }) {
  const goTo = useGoTo();
  useEffect(() => void goTo(href), [href]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Adónde lleva «Volver» desde Ingresar: a la ficha si se venía de escribirle al propietario (sin reabrir la hoja). */
export const backFrom = (next?: string) => {
  const publicId = listingInNext(next);
  return publicId ? `/casa/${publicId}` : "/explorar";
};

/**
 * Verificar el WhatsApp para escribirle a un propietario (revisión UX C2) o para guardar la casa que se publica (§E): la
 * pantalla habla de eso, no de ingresar.
 */
export function useContactMode(next?: string) {
  const contact = isContactNext(next);
  const publish = isPublishNext(next);
  const listing = useReturnListing(contact ? next : undefined);
  const owner = listing ? firstName(listing.ownerName) : null;
  const header = contact ? `Escribirle a ${owner ?? "el anfitrión"}` : publish ? "Publicar casa" : "Ingresar";
  return { contact, publish, listing, header, owner };
}
