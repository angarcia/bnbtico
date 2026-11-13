import type { ReactNode } from "react";

export function CounterRow({ label, icon, iconByValue = false, value, decrease, increase }: {
  label: string;
  icon?: ReactNode;
  iconByValue?: boolean;
  value: ReactNode;
  decrease?: () => void;
  increase?: () => void;
}) {
  const unit = label.toLowerCase();
  return (
    <div className="counter">
      <span className="strong counter-label">{!iconByValue && icon}{label}</span>
      <div className="ctl">
        <button type="button" className="minus" aria-label={`Menos ${unit}`} onClick={decrease} disabled={!decrease}>−</button>
        {iconByValue && icon ? <span className="counter-value-icon" aria-hidden="true">{icon}</span> : null}
        <b aria-live="polite">{value}</b>
        <button type="button" className="plus" aria-label={`Más ${unit}`} onClick={increase} disabled={!increase}>+</button>
      </div>
    </div>
  );
}
