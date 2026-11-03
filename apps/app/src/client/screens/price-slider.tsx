// Deslizador de precio de Filtros (ticket 11 de la ronda de Ana del 2 nov): la cifra del rango, el histograma de las casas de la
// búsqueda sin el rango de precio y dos <input type="range"> nativos superpuestos (teclado y lectores de pantalla gratis).
// Trozo diferido: Filtros lo pide con lazy(). Mientras se arrastra solo se mueve el estado local; el borrador (y con él el conteo
// «Ver N casas») cambia al soltar o tras una espera corta.
import { useEffect, useMemo, useRef, useState } from "react";
import { HISTOGRAM_BUCKETS, bucketInRange, limitsToSlider, priceBounds, priceHistogram, sliderToLimits } from "../../domain/price-slider";
import { formatMoney } from "../../domain/money";
import type { Currency } from "../../domain/currency";

const COMMIT_DELAY_MS = 250;

export function PriceSlider({
  prices,
  min,
  max,
  currency,
  fx,
  onCommit,
}: {
  prices: readonly (number | null)[]; // precios por noche de la búsqueda sin el rango de precio
  min: number; // límites actuales del borrador, en colones (0 = sin límite)
  max: number;
  currency: Currency;
  fx: number;
  onCommit: (limits: { min: number; max: number }) => void;
}) {
  const bounds = useMemo(() => priceBounds(prices), [prices]);
  const counts = useMemo(() => (bounds ? priceHistogram(prices, bounds) : []), [prices, bounds]);
  const [live, setLive] = useState<[number, number] | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const pending = useRef<[number, number] | null>(null);
  useEffect(() => () => clearTimeout(timer.current), []);
  if (!bounds) return null;

  const [a, b] = live ?? limitsToSlider(min, max, bounds);
  const tallest = Math.max(1, ...counts);
  const pct = (v: number) => ((v - bounds.lo) / (bounds.hi - bounds.lo)) * 100;
  const money = (v: number) => formatMoney(v, currency, fx);
  const label = `${money(a)} – ${money(b)}${b >= bounds.hi ? "+" : ""}`;

  const flush = () => {
    clearTimeout(timer.current);
    const next = pending.current;
    pending.current = null;
    if (!next) return;
    setLive(null);
    onCommit(sliderToLimits(next[0], next[1], bounds));
  };
  const move = (next: [number, number]) => {
    setLive(next);
    pending.current = next;
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, COMMIT_DELAY_MS);
  };
  const common = { type: "range" as const, min: bounds.lo, max: bounds.hi, step: bounds.step, onPointerUp: flush, onKeyUp: flush, onBlur: flush };
  const text = (v: number, edge: "min" | "max") => {
    if (edge === "min" && v <= bounds.lo) return `${money(v)}, sin mínimo`;
    if (edge === "max" && v >= bounds.hi) return `${money(v)} o más, sin máximo`;
    return money(v);
  };

  return (
    <div className="price-slider">
      <p className="price-slider-range" aria-live="polite">
        {label}
      </p>
      {/* Barras en SVG (atributos, no `style`: la CSP no admite estilos en línea). 24 cubetas de 1 de ancho en un lienzo de 24 × 100. */}
      <svg className="price-slider-bars" viewBox={`0 0 ${HISTOGRAM_BUCKETS} 100`} preserveAspectRatio="none" aria-hidden="true">
        {counts.map((n, i) => {
          const h = n ? Math.max(8, (n / tallest) * 100) : 0;
          return <rect key={i} className={bucketInRange(i, bounds, HISTOGRAM_BUCKETS, a, b) ? "in" : undefined} x={i + 0.1} width={0.8} y={100 - h} height={h} />;
        })}
      </svg>
      <div className="price-slider-track">
        <svg className="price-slider-fill" aria-hidden="true">
          <rect x={`${pct(a)}%`} width={`${pct(b) - pct(a)}%`} y={0} height={4} />
        </svg>
        <input
          {...common}
          aria-label="Rango de precio, límite inferior por noche"
          aria-valuetext={text(a, "min")}
          value={a}
          className={a > (bounds.lo + bounds.hi) / 2 ? "over" : undefined}
          onChange={(e) => move([Math.min(Number(e.target.value), b), b])}
        />
        <input
          {...common}
          aria-label="Rango de precio, límite superior por noche"
          aria-valuetext={text(b, "max")}
          value={b}
          onChange={(e) => move([a, Math.max(Number(e.target.value), a)])}
        />
      </div>
    </div>
  );
}
