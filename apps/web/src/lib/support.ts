// Contacto con bnbtico: solo WhatsApp, un número por rol. Los números reales se configuran por variables de entorno.
import type { Role } from "@/lib/auth/types";

export const SUPPORT = {
  owner: {
    label: "bnbtico · atención a propietarios",
    number: process.env.NEXT_PUBLIC_WA_OWNERS || "",
    intro: "Para cualquier duda o problema con su cuenta, sus casas o una consulta recibida, escríbanos por WhatsApp. Es el único canal de atención de bnbtico.",
  },
  guest: {
    label: "bnbtico · atención a clientes",
    number: process.env.NEXT_PUBLIC_WA_GUESTS || "",
    intro: "Para cualquier duda o problema con su cuenta, una casa o un propietario, escríbanos por WhatsApp. Es el único canal de atención de bnbtico. Si quiere, cuéntenos zona, fechas y personas y le ayudamos a encontrar casas compatibles.",
  },
} as const;

export function supportFor(role: Role) {
  return SUPPORT[role === "owner" ? "owner" : "guest"];
}

export function waLink(number: string, text: string): string {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
