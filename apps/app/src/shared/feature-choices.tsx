import { FEATURE_LABEL, FEATURE_SHORT, type Feature } from "../domain/listing";
import { FEATURE_ICON, I } from "./icons";

export const FEATURE_CHOICE_ORDER = ["wifi", "ac", "parking", "ev", "pets", "pool", "beachfront", "bbq"] as const satisfies readonly Feature[];
const FEATURE_CHOICE_LABEL = { ...FEATURE_SHORT, ev: "Cargador EV" };
export const FEATURE_CHOICE_NAME = FEATURE_LABEL;

export function FeatureChoiceContent({ feature, selected }: { feature: Feature; selected: boolean }) {
  const Icon = I[FEATURE_ICON[feature]];
  return (
    <>
      <Icon size={18} />
      {FEATURE_CHOICE_LABEL[feature]}
      <span className="feature-check" aria-hidden="true">
        {selected ? <I.check size={14} /> : null}
      </span>
    </>
  );
}
