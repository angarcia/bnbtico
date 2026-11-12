// Números de WhatsApp de atención de 3bstays (variables VITE_WA_OWNERS y VITE_WA_GUESTS del build). Aparte de support.ts para
// que Explorar («¿No encuentra lo que busca?», JS inicial) use el mismo número que Ayuda sin cargar los textos de Ayuda.
export const SUPPORT_NUMBERS = {
  owner: import.meta.env.VITE_WA_OWNERS ?? "",
  guest: import.meta.env.VITE_WA_GUESTS ?? "",
} as const;
