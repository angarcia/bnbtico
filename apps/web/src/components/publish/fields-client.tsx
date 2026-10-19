"use client";
import { useState } from "react";
import { FEATURES, type Feature, type MonthlyMode } from "@/lib/listings/schema";

/** Las 9 características; al marcar Parqueo aparece «Tipo de parqueo» sin preselección. */
export function FeaturesField({ selected, parkingPaid }: { selected: Feature[]; parkingPaid: boolean | null }) {
  const [parking, setParking] = useState(selected.includes("parking"));
  return (
    <>
      <h3>Características principales</h3>
      <p className="small muted">Marcá lo que ofrece tu alojamiento.</p>
      <div className="stack" style={{ gap: 8 }}>
        {FEATURES.map(([key, label]) => (
          <label key={key} className="row" style={{ gap: 10, fontWeight: 600 }}>
            <input
              type="checkbox"
              name="features"
              value={key}
              id={`feature-${key}`}
              defaultChecked={selected.includes(key)}
              onChange={key === "parking" ? (e) => setParking(e.currentTarget.checked) : undefined}
            />
            <span>{label}</span>
          </label>
        ))}
      </div>
      {parking ? (
        <div className="field">
          <label htmlFor="pub-parkingPaid">Tipo de parqueo *</label>
          <select id="pub-parkingPaid" name="parkingPaid" defaultValue={parkingPaid === null ? "" : parkingPaid ? "paid" : "free"}>
            <option value="">Seleccioná una opción</option>
            <option value="free">Gratuito</option>
            <option value="paid">De pago</option>
          </select>
        </div>
      ) : null}
    </>
  );
}

/** Alquiler mensual: «Indicar precio» muestra el importe; «Consultar» lo explica. */
export function MonthlyField({ mode, priceCrc, minMonths }: { mode: MonthlyMode | null; priceCrc: number | null; minMonths: number | null }) {
  const [current, setCurrent] = useState<string>(mode ?? "");
  return (
    <>
      <h3>Alquiler mensual</h3>
      <div className="field">
        <label htmlFor="pub-monthlyMode">Precio mensual *</label>
        <select id="pub-monthlyMode" name="monthlyMode" value={current} onChange={(e) => setCurrent(e.currentTarget.value)}>
          <option value="">Seleccioná una opción</option>
          <option value="amount">Indicar precio mensual orientativo</option>
          <option value="contact">Consultar con el propietario</option>
        </select>
      </div>
      {current === "amount" ? (
        <div className="field">
          <label htmlFor="pub-monthlyPriceCrc">Precio mensual (₡) *</label>
          <input id="pub-monthlyPriceCrc" name="monthlyPriceCrc" inputMode="numeric" defaultValue={priceCrc ?? ""} />
        </div>
      ) : null}
      {current === "contact" ? <p className="note small">Se mostrará «Consultar precio mensual con el propietario».</p> : null}
      <div className="field">
        <label htmlFor="pub-minMonths">Estancia mínima del alquiler mensual (meses, opcional)</label>
        <input id="pub-minMonths" name="minMonths" inputMode="numeric" defaultValue={minMonths ?? ""} />
      </div>
    </>
  );
}
