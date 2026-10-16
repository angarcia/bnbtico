// Contacto con bnbtico: solo WhatsApp, un número por rol. Los números reales se configuran por variables de entorno.
import type { Role } from "@/lib/auth/types";

export const SUPPORT = {
  owner: {
    label: "bnbtico · atención a propietarios",
    number: process.env.NEXT_PUBLIC_WA_OWNERS || "",
    intro: "Para cualquier duda o problema con tu cuenta, tus casas o una consulta recibida, escribinos por WhatsApp. Es el único canal de atención de bnbtico.",
  },
  guest: {
    label: "bnbtico · buscadores de alojamiento",
    number: process.env.NEXT_PUBLIC_WA_GUESTS || "",
    intro: "Para cualquier duda o problema con tu cuenta, una casa o un propietario, escribinos por WhatsApp. Es el único canal de atención de bnbtico. Si querés, contanos zona, fechas y personas y te ayudamos a encontrar casas compatibles.",
  },
} as const;

export function supportFor(role: Role) {
  return SUPPORT[role === "owner" ? "owner" : "guest"];
}

export function waLink(number: string, text: string): string {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
