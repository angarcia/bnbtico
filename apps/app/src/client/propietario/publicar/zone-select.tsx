import type { ZoneChoice, ZoneSelectOption } from "../../../domain/zones";
import { HousePicker } from "../house-picker";
import * as ZONE_COPY from "./copy/zone-select";

const OTHER = "other";
const CURRENT = "current";

const matches = (o: ZoneSelectOption, c: ZoneChoice) => (c.source === "list" ? o.source === "list" && o.zoneId === c.zoneId : c.source === "district" && o.source === "district" && o.name === c.name);

export function ZoneSelect({ options, value, other, onChange, onOther }: { options: ZoneSelectOption[]; value: ZoneChoice | null; other?: boolean; onChange(c: ZoneChoice): void; onOther?(): void }) {
  const match = value ? options.find((option) => matches(option, value)) : undefined;
  const current = value && !match ? value : null;
  const choices = options.map((option) => ({ id: option.key, name: option.name }));
  if (current) choices.push({ id: CURRENT, name: current.name });
  choices.push({ id: OTHER, name: ZONE_COPY.other });

  function pick(id: string | null) {
    if (id === OTHER) return onOther?.();
    if (id === CURRENT && current) return onChange(current);
    const option = options.find((item) => item.key === id);
    if (option) onChange({ name: option.name, source: option.source, zoneId: option.zoneId, anchor: null });
  }

  return (
    <div className="field">
      <span className="label-plain">{ZONE_COPY.zone}</span>
      <HousePicker zone houses={choices} currentId={other ? OTHER : match?.key ?? (current ? CURRENT : null)}
        currentName={options.length ? ZONE_COPY.pickZone : ZONE_COPY.markPoint} onPick={pick} />
    </div>
  );
}
