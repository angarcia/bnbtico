import type { ListingView } from "./listing";

/** Casa de prueba del esqueleto (ticket 01): demuestra el SSR de la ficha sin tocar la base. */
export const FIXTURE_LISTING: ListingView = {
  publicId: "CT-0000",
  title: "Casa de prueba frente a Playa Negra",
  place: "Puerto Viejo de Talamanca, Limón",
  summary: "Ficha de demostración: dos habitaciones a pasos de la playa, rancho con hamacas y parqueo. Así se verá una casa cuando alguien le abra el enlace desde WhatsApp.",
  nightlyPrice: 95000,
  currency: "CRC",
  hero: { src: "/fixture/ct-0000.jpg", width: 1000, height: 563, alt: "Playa Negra al atardecer" },
};
