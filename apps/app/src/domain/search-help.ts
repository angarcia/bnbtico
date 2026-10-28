// «¿No encuentra lo que busca?» (fase 6, ticket 01): mensaje para el WhatsApp de atención a clientes a partir de la búsqueda
// de Explorar. Solo lo que el cliente filtró (no hay datos personales en Explorar); «Fechas: » queda al final para que las
// escriba él, porque Explorar no filtra por fechas.
import { ALL_PROVINCES, effectiveFilters, type Filters } from "./filters";
import { FEATURE_LABEL } from "./listing";
import { formatCRC } from "./money";

export function searchHelpMessage(f: Filters): string {
  const q = effectiveFilters(f); // con el mensual, sin precio por noche
  return [
    "Hola, estoy buscando casa en bnbtico.",
    q.prov !== ALL_PROVINCES ? `Zona: ${q.prov}.` : null,
    q.ppl ? `Personas: ${q.ppl}.` : null,
    q.monthly ? "Busca alquiler mensual." : null,
    q.features.length ? `Necesito: ${q.features.map((x) => FEATURE_LABEL[x]).join(", ")}.` : null,
    q.max ? `Precio por noche: hasta ${formatCRC(q.max)}.` : null,
    "Fechas: ",
  ]
    .filter(Boolean)
    .join("\n");
}
