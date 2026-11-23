// Plurales con las reglas del idioma (Intl.PluralRules), para los catálogos de textos (estructura por áreas, paso 3).
// En español: «one» solo para 1; «many» para los millones redondos («1 000 000 de casas»): si el mensaje no la da, «other».

const RULES = new Intl.PluralRules("es");

export interface PluralForms {
  one: string;
  other: string;
  many?: string;
}

/** La forma de `forms` que toca a `n`. */
export function plural(n: number, forms: PluralForms): string {
  const category = RULES.select(n);
  return category === "one" ? forms.one : category === "many" ? (forms.many ?? forms.other) : forms.other;
}
