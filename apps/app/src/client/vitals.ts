// Web Vitals de usuarios reales (LCP, INP, CLS) → POST /vitals. Trozo aparte que main.tsx importa tras `load`: no compite
// con lo primero que se pinta ni cuenta en el JS inicial. Las métricas son de la página en la que se entró (la ruta de
// aterrizaje), aunque INP y CLS se informen al salir tras navegar dentro de la SPA.
import { onCLS, onINP, onLCP, type Metric } from "web-vitals";
import { sendBeacon } from "../shared/beacon";

export function startVitals(landingPath: string): void {
  const report = (m: Metric) =>
    sendBeacon("vitals", { name: m.name, value: Math.round(m.name === "CLS" ? m.value * 10_000 : m.value) / (m.name === "CLS" ? 10_000 : 1), rating: m.rating, id: m.id, navigationType: m.navigationType }, landingPath);
  onLCP(report);
  onINP(report);
  onCLS(report);
}
