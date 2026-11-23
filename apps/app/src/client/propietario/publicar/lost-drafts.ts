// Borradores que el teléfono empezó sin esperar a la base y que la base no llegó a crear (new-draft.ts): sus guardados en
// cola fallan sin llevar a su paso (step-form.tsx). Sin imports: lo lee el trozo de los campos del asistente.
const lost = new Set<string>();

export const isLostDraft = (id: string) => lost.has(id);
export const markLostDraft = (id: string) => void lost.add(id);
