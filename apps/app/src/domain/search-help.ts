// «¿No encuentra lo que busca?» (fase 6, ticket 01): mensaje para el WhatsApp de atención a clientes a partir de la búsqueda
// de Explorar. Solo lo que el cliente filtró (no hay datos personales en Explorar); «Fechas: » queda al final para que las
// escriba él si Explorar no tenía fechas.
import { ALL_PROVINCES, type Filters } from "./filters";
import { FEATURE_LABEL } from "./listing";
import { stayLabel } from "./search";
import { formatCRC } from "./money";

export function searchHelpMessage(q: Filters, zoneName: string | null = null): string {
  const stay = stayLabel(q);
  return [
    "Hola, estoy buscando casa en bnbtico.",
    zoneName && q.zone ? `Zona: ${zoneName}.` : q.prov !== ALL_PROVINCES ? `Zona: ${q.prov}.` : null,
    q.ppl ? `Personas: ${q.ppl}.` : null,
    q.features.length ? `Necesito: ${q.features.map((x) => FEATURE_LABEL[x]).join(", ")}.` : null,
    q.max ? `Precio por noche: hasta ${formatCRC(q.max)}.` : null,
    stay ? `Fechas: ${stay}.` : "Fechas: ",
  ]
    .filter(Boolean)
    .join("\n");
}
