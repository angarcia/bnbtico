// Nombre de pila e iniciales de una persona. Aparte de inquiry.ts para que la ficha (JS del servidor y de la hidratación)
// los use sin cargar el resto de las consultas.

/** «Escríbale a Daniel»: el nombre de pila del propietario. */
export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] || "el propietario";
}

/** Iniciales para el avatar: primera letra del primer y del último nombre. */
export function initials(name: string): string {
  const words = name.trim().split(/\s+/).filter(Boolean);
  if (words.length === 0) return "?";
  const first = words[0]!.charAt(0);
  const last = words.length > 1 ? words[words.length - 1]!.charAt(0) : "";
  return (first + last).toLocaleUpperCase("es");
}
