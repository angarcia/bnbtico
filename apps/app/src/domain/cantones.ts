// División territorial de Costa Rica: 84 cantones por provincia, en el orden oficial (número de cantón).
// Vive en la aplicación, no en Postgres: la base guarda el nombre como texto y la validación del formulario exige que el
// cantón pertenezca a la provincia elegida. Últimos creados: Monteverde (2021) y Puerto Jiménez (2022), ambos en Puntarenas.

export const CANTONES: Readonly<Record<string, readonly string[]>> = {
  "San José": ["San José", "Escazú", "Desamparados", "Puriscal", "Tarrazú", "Aserrí", "Mora", "Goicoechea", "Santa Ana", "Alajuelita", "Vázquez de Coronado", "Acosta", "Tibás", "Moravia", "Montes de Oca", "Turrubares", "Dota", "Curridabat", "Pérez Zeledón", "León Cortés Castro"],
  Alajuela: ["Alajuela", "San Ramón", "Grecia", "San Mateo", "Atenas", "Naranjo", "Palmares", "Poás", "Orotina", "San Carlos", "Zarcero", "Sarchí", "Upala", "Los Chiles", "Guatuso", "Río Cuarto"],
  Cartago: ["Cartago", "Paraíso", "La Unión", "Jiménez", "Turrialba", "Alvarado", "Oreamuno", "El Guarco"],
  Heredia: ["Heredia", "Barva", "Santo Domingo", "Santa Bárbara", "San Rafael", "San Isidro", "Belén", "Flores", "San Pablo", "Sarapiquí"],
  Guanacaste: ["Liberia", "Nicoya", "Santa Cruz", "Bagaces", "Carrillo", "Cañas", "Abangares", "Tilarán", "Nandayure", "La Cruz", "Hojancha"],
  Puntarenas: ["Puntarenas", "Esparza", "Buenos Aires", "Montes de Oro", "Osa", "Quepos", "Golfito", "Coto Brus", "Parrita", "Corredores", "Garabito", "Monteverde", "Puerto Jiménez"],
  Limón: ["Limón", "Pococí", "Siquirres", "Talamanca", "Matina", "Guácimo"],
};

/** Cantones de una provincia; vacío si la provincia no existe. */
export function cantonesDe(province: string): readonly string[] {
  return CANTONES[province] ?? [];
}

/** ¿Es `canton` un cantón de `province`? Comparación exacta (los valores vienen de la lista, no se escriben a mano). */
export function esCanton(province: string, canton: string): boolean {
  return cantonesDe(province).includes(canton);
}
