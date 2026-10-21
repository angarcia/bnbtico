"use client";
import { useState } from "react";
import { FEATURES, type Feature } from "@/lib/listings/schema";

/** Tarjetas de elección (pantalla 11): casillas o radios con aspecto de tarjeta y aria-pressed. */
export function ChoiceCards({ name, type, options, selected }: { name: string; type: "checkbox" | "radio"; options: { value: string; label: string; hint: string }[]; selected: string[] }) {
  const [current, setCurrent] = useState<string[]>(selected);
  const toggle = (v: string) => setCurrent((c) => (type === "radio" ? [v] : c.includes(v) ? c.filter((x) => x !== v) : [...c, v]));
  return (
    <div className="grid-2">
      {options.map((o) => {
        const on = current.includes(o.value);
        return (
          <label key={o.value} className="choice" aria-pressed={on} style={{ cursor: "pointer" }}>
            <input type={type} name={name} value={o.value} checked={on} onChange={() => toggle(o.value)} className="sr-input" />
            <b>{o.label}</b>
            <span>{o.hint}</span>
          </label>
        );
      })}
    </div>
  );
}

/** Contador −/+ (pantalla 13) con el valor en un campo oculto del formulario. */
export function Counter({ name, label, value, min, max = 30 }: { name: string; label: string; value: number | null; min: number; max?: number }) {
  const [n, setN] = useState<number | null>(value);
  const current = n ?? min;
  return (
    <div className="counter">
      <span style={{ fontWeight: 600 }}>{label}</span>
      <div className="ctl">
        <button type="button" className="minus" aria-label={`Menos ${label.toLowerCase()}`} onClick={() => setN(Math.max(min, current - 1))} disabled={current <= min}>−</button>
        <b aria-live="polite">{n === null ? "–" : n}</b>
        <button type="button" className="plus" aria-label={`Más ${label.toLowerCase()}`} onClick={() => setN(n === null ? Math.max(min, 1) : Math.min(max, current + 1))}>+</button>
      </div>
      <input type="hidden" name={name} value={n === null ? "" : n} />
    </div>
  );
}

/** Chips de características (checkbox); al marcar Parqueo aparece «Tipo de parqueo». */
export function FeatureChips({ selected, parkingPaid }: { selected: Feature[]; parkingPaid: boolean | null }) {
  const [on, setOn] = useState<Feature[]>(selected);
  const toggle = (f: Feature) => setOn((c) => (c.includes(f) ? c.filter((x) => x !== f) : [...c, f]));
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="row" style={{ flexWrap: "wrap", gap: 8 }}>
        {FEATURES.map(([key, label]) => (
          <label key={key} className="chip" aria-pressed={on.includes(key)} style={{ cursor: "pointer" }}>
            <input type="checkbox" name="features" value={key} checked={on.includes(key)} onChange={() => toggle(key)} className="sr-input" />
            {label}
          </label>
        ))}
      </div>
      <span className="xs muted">Son las mismas que usan los clientes para filtrar.</span>
      {on.includes("parking") ? (
        <div className="field">
          <label htmlFor="pub-parkingPaid">Tipo de parqueo</label>
          <select id="pub-parkingPaid" name="parkingPaid" defaultValue={parkingPaid === null ? "" : parkingPaid ? "paid" : "free"}>
            <option value="">Seleccione una opción</option>
            <option value="free">Gratuito</option>
            <option value="paid">De pago</option>
          </select>
        </div>
      ) : null}
    </div>
  );
}

/** Baño privado o compartido (solo habitaciones). */
export function BathroomChoice({ shared }: { shared: boolean | null }) {
  const [v, setV] = useState<string>(shared === null ? "" : shared ? "shared" : "private");
  return (
    <div className="stack" style={{ gap: 8 }}>
      <span className="eyebrow" style={{ textTransform: "none", letterSpacing: 0, fontSize: 12 }}>Baño de la habitación</span>
      <div className="row" style={{ gap: 8 }}>
        {([["private", "Privado"], ["shared", "Compartido"]] as const).map(([val, label]) => (
          <label key={val} className="chip" aria-pressed={v === val} style={{ cursor: "pointer" }}>
            <input type="radio" name="bathroomShared" value={val} checked={v === val} onChange={() => setV(val)} className="sr-input" />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}

/** Descripción con contador de caracteres. */
export function DescriptionField({ value, max = 2000 }: { value: string; max?: number }) {
  const [n, setN] = useState(value.length);
  return (
    <div className="field">
      <label htmlFor="pub-description">Descripción</label>
      <textarea id="pub-description" name="description" rows={4} maxLength={max} defaultValue={value} onChange={(e) => setN(e.currentTarget.value.length)} />
      <span className="xs muted num" style={{ alignSelf: "flex-end" }}>{n} / {max}</span>
    </div>
  );
}
