// Contacto con bnbtico: solo WhatsApp, un número por rol (variables VITE_WA_OWNERS y VITE_WA_GUESTS del build).

export const SUPPORT = {
  owner: {
    label: "bnbtico · atención a propietarios",
    number: import.meta.env.VITE_WA_OWNERS ?? "",
    intro: "Para cualquier duda o problema con su cuenta, sus casas o una consulta recibida, escríbanos por WhatsApp. Es el único canal de atención de bnbtico.",
    greeting: "Hola, soy propietario en bnbtico y necesito ayuda con: ",
    other: "clientes",
  },
  guest: {
    label: "bnbtico · atención a clientes",
    number: import.meta.env.VITE_WA_GUESTS ?? "",
    intro: "Para cualquier duda o problema con su cuenta, una casa o un propietario, escríbanos por WhatsApp. Es el único canal de atención de bnbtico. Si quiere, cuéntenos zona, fechas y personas y le ayudamos a encontrar casas compatibles.",
    greeting: "Hola, estoy buscando casa en bnbtico y necesito ayuda con: ",
    other: "propietarios",
  },
} as const;

export function waLink(number: string, text: string): string {
  return `https://wa.me/${number.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
}
