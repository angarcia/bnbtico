// Contacto con 3bstays: solo WhatsApp, un número por rol (variables VITE_WA_OWNERS y VITE_WA_GUESTS del build).
import { waUrl } from "../domain/whatsapp";
import { SUPPORT_NUMBERS } from "./support-numbers";

export const SUPPORT = {
  owner: {
    label: "3bstays · atención a anfitriones",
    number: SUPPORT_NUMBERS.owner,
    intro: "Para cualquier duda o problema con su cuenta, sus casas o una consulta recibida, escríbanos por WhatsApp. Es el único canal de atención de 3bstays.",
    greeting: "Hola, soy anfitrión en 3bstays y necesito ayuda con: ",
    other: "clientes",
  },
  guest: {
    label: "3bstays · atención a clientes",
    number: SUPPORT_NUMBERS.guest,
    intro: "Para cualquier duda o problema con su cuenta, una casa o un anfitrión, escríbanos por WhatsApp. Es el único canal de atención de 3bstays. Si quiere, cuéntenos zona, fechas y personas y le ayudamos a encontrar casas compatibles.",
    greeting: "Hola, estoy buscando casa en 3bstays y necesito ayuda con: ",
    other: "anfitriones",
  },
} as const;

export function waLink(number: string, text: string): string {
  return waUrl(number, text);
}
