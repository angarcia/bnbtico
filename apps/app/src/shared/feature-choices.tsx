import { FEATURE_LABEL, FEATURE_SHORT, type Feature } from "../domain/listing";
import { FEATURE_ICON, I } from "./ui/icons";

export const FEATURE_CHOICE_ORDER = ["wifi", "ac", "parking", "ev", "pets", "pool", "beachfront", "bbq"] as const satisfies readonly Feature[];
const FEATURE_CHOICE_LABEL = { ...FEATURE_SHORT, ev: "Cargador EV" };
export const FEATURE_CHOICE_NAME = FEATURE_LABEL;

/** Icono y nombre corto de una característica, dentro de un chip de `ChoiceChips` (el ✓ lo pone el chip). */
export function FeatureChoiceLabel({ feature }: { feature: Feature }) {
  const Icon = I[FEATURE_ICON[feature]];
  return (
    <>
      <Icon size={18} />
      {FEATURE_CHOICE_LABEL[feature]}
    </>
  );
}
