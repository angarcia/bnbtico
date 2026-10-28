// «¿No encuentra lo que busca?» (fase 6, ticket 01): mensaje para el WhatsApp de atención a clientes a partir de la búsqueda
// de Explorar. Solo lo que el cliente filtró (no hay datos personales en Explorar); «Fechas: » queda al final para que las
// escriba él, porque Explorar no filtra por fechas.
import { ALL_PROVINCES, modeFilter, type Filters } from "./filters";
import { FEATURE_LABEL } from "./listing";
import { formatCRC } from "./money";

export function searchHelpMessage(f: Filters): string {
  const mode = modeFilter(f);
  return [
    "Hola, estoy buscando casa en bnbtico.",
    f.prov !== ALL_PROVINCES ? `Zona: ${f.prov}.` : null,
    f.ppl ? `Personas: ${f.ppl}.` : null,
    mode ? `Modalidad: ${mode === "monthly" ? "Mensual" : "Vacacional"}.` : null,
    f.features.length ? `Necesito: ${f.features.map((x) => FEATURE_LABEL[x]).join(", ")}.` : null,
    f.max ? `Precio por noche: hasta ${formatCRC(f.max)}.` : null,
    "Fechas: ",
  ]
    .filter(Boolean)
    .join("\n");
}
