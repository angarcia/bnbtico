// El panel de los días elegidos del Calendario del propietario (disponibilidad y precio), en su propio trozo: se pide en
// reposo al abrir el Calendario o al tocar el primer día (historia 07, paso 5).
import { useEffect, useId, useRef, useState, type FocusEvent } from "react";
import { selectionLabel, setAvailability, setPrice, type Selection } from "../../../domain/calendar";
import { formatCRC } from "../../../domain/money";
import { FLAGS } from "../../../shared/flags";
import { Button, TextButton } from "../../../shared/ui/button";
import { Segmented } from "../../../shared/ui/choice";
import { AffixInput } from "../../../shared/ui/field";
import { AirbnbAvailability } from "./airbnb-calendar-row";

const AVAILABILITY = [
  { value: "free", label: "Disponible" },
  { value: "busy", label: "Ocupado" },
] as const;
const KB_RELEASE_MS = 400;
const grouped = (digits: string) => digits.replace(/\B(?=(\d{3})+(?!\d))/g, " ");

interface PanelProps {
  sel: Selection;
  base: number | null;
  hasSpecial: boolean;
  importedCount: number;
  manualCount: number;
  problem: string | null;
  canSave: boolean;
  onChange: (s: Selection) => void;
  onCancel: () => void;
  onSave: () => void;
}

export function Panel({ sel, base, hasSpecial, importedCount, manualCount, problem, canSave, onChange, onCancel, onSave }: PanelProps) {
  // Teclado del iPhone (no encoge la vista): mientras el precio tiene el foco el panel gana sitio abajo y el campo sube por
  // encima. Se quita un poco después de salir del campo para que «Guardar cambios» no se mueva bajo el dedo.
  const [kb, setKb] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);
  const isPrice = (el: EventTarget | null) => el instanceof HTMLInputElement;
  function onFocus(e: FocusEvent<HTMLElement>) {
    if (!isPrice(e.target)) return;
    clearTimeout(timer.current);
    setKb(true);
  }
  function onBlur(e: FocusEvent<HTMLElement>) {
    if (!isPrice(e.target)) return;
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setKb(false), KB_RELEASE_MS);
  }
  const price = sel.priceEdited ? sel.price : grouped(sel.price);
  const problemId = useId();
  // Precios por fecha apagados (feature flag, #61): solo disponibilidad; el precio de la noche es el de la casa.
  const priceField = base !== null && FLAGS.datePrices ? (
    <AffixInput
      size="sm"
      prefix="₡"
      aria-label="Precio por noche"
      inputMode="numeric"
      enterKeyHint="done"
      autoComplete="off"
      placeholder={sel.mixedPrice ? "Varios precios" : undefined}
      value={price}
      aria-invalid={problem ? true : undefined}
      aria-describedby={problem ? problemId : undefined}
      onChange={(e) => onChange(setPrice(sel, e.target.value))}
      onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()}
    />
  ) : null;
  return (
    <section className={`cal-panel${kb ? " kb" : ""}`} aria-label="Días seleccionados" onFocus={onFocus} onBlur={onBlur}>
      <div className="row between baseline">
        <b className="display">{selectionLabel(sel.days)}</b>
        <TextButton tone="quiet" onClick={onCancel}>
          Cancelar
        </TextButton>
      </div>
      {importedCount ? <AirbnbAvailability sel={sel} importedCount={importedCount} manualCount={manualCount} onChange={onChange}>{priceField}</AirbnbAvailability> : <>
      {manualCount ? <p className="small muted">Bloqueo manual</p> : null}
      <div className="row gap-8 cal-day-fields">
        <Segmented
          fill
          label="Disponibilidad"
          options={AVAILABILITY}
          value={sel.available === null ? null : sel.available ? "free" : "busy"}
          onChange={(v) => onChange(setAvailability(sel, v === "free"))}
        />
        {priceField}
      </div>
      </>}
      {base !== null && hasSpecial && FLAGS.datePrices ? (
        <TextButton tone="link" placement="cal-base" onClick={() => onChange(setPrice(sel, grouped(String(base))))}>
          Usar el precio base ({formatCRC(base)})
        </TextButton>
      ) : null}
      {problem ? (
        <p id={problemId} className="field-error" role="alert">
          {problem}
        </p>
      ) : null}
      <Button variant="primary" block disabled={!canSave} onClick={onSave}>
        Guardar cambios
      </Button>
    </section>
  );
}
