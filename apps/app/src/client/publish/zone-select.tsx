// «Zona» del paso 2 (ubicación por punto): una lista nativa con las zonas a 5 km o menos del pin (la más cercana primero),
// el distrito del pin y, al final, «Otra…» (avisa con `onOther`: la pantalla abre su buscador). Una zona elegida con «Otra…»
// sale como una opción más con su nombre.
import type { ZoneChoice, ZoneSelectOption } from "../../domain/zones";

const OTHER = "other";
const CURRENT = "current";

const matches = (o: ZoneSelectOption, c: ZoneChoice) => (c.source === "list" ? o.source === "list" && o.zoneId === c.zoneId : c.source === "district" && o.source === "district" && o.name === c.name);

export function ZoneSelect({ options, value, onChange, onOther }: { options: ZoneSelectOption[]; value: ZoneChoice | null; onChange(c: ZoneChoice): void; onOther?(): void }) {
  const match = value ? options.find((o) => matches(o, value)) : undefined;
  // Lo elegido que no está entre las opciones (una zona de «Otra…», o la del borrador mientras se busca): se muestra igual.
  const current = value && !match ? value : null;
  return (
    <div className="field">
      <label htmlFor="pub-zone">Zona</label>
      <select
        id="pub-zone"
        value={match?.key ?? (current ? CURRENT : "")}
        onChange={(e) => {
          const key = e.currentTarget.value;
          if (key === OTHER) return onOther?.();
          const o = options.find((x) => x.key === key);
          if (o) onChange({ name: o.name, source: o.source, zoneId: o.zoneId, anchor: null });
        }}
      >
        {value ? null : (
          <option value="" disabled>
            {options.length ? "Elija la zona" : "Marque el punto en el mapa"}
          </option>
        )}
        {options.map((o) => (
          <option key={o.key} value={o.key}>
            {o.name}
          </option>
        ))}
        {current ? <option value={CURRENT}>{current.name}</option> : null}
        <option value={OTHER}>Otra…</option>
      </select>
    </div>
  );
}
