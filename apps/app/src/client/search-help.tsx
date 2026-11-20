// «¿No encuentra lo que busca?» en Explorar (fase 6, ticket 01; sustituto de «Buscan casa»): enlace al WhatsApp de atención a
// clientes con la búsqueda ya redactada. Sin número en el build (VITE_WA_GUESTS vacío), no sale. Va en el JS inicial: corto.
import type { Filters } from "../domain/filters";
import { searchHelpMessage } from "../domain/search-help";
import { waUrl } from "../domain/whatsapp";
import { track } from "../shared/beacon";
import { I } from "../shared/icons";
import { ButtonLink, TextButton } from "../shared/button";
import { EmptyState, Notice } from "../shared/structure";

/**
 * Sin resultados (`onClear`): tarjeta «No hay casas con esos filtros», la nota si hay número y «Quitar filtros» si hay
 * filtros puestos. Con resultados: solo la nota arena, al final de la rejilla.
 */
export function SearchHelp({ filters, zoneName = null, number, onClear }: { filters: Filters; zoneName?: string | null; number: string; onClear?: (() => void) | null }) {
  const help = number ? (
    <>
      <p>¿No encuentra lo que busca? Cuéntenos qué necesita por WhatsApp y le ayudamos a encontrar casa.</p>
      {/* Se abre como «Abrir WhatsApp» de Ayuda; la baliza no lleva el mensaje ni los filtros (solo ruta, build y país). */}
      <ButtonLink variant="primary" block icon={<I.wa size={20} />} href={waUrl(number, searchHelpMessage(filters, zoneName))} target="_blank" rel="noopener" onClick={() => track("search_help_tap")}>
        Escribir a 3bstays por WhatsApp
      </ButtonLink>
    </>
  ) : null;
  if (onClear === undefined) return help && <Notice as="div" layout="column">{help}</Notice>;
  return (
    <EmptyState
      gap={14}
      title="No hay casas con esos filtros"
      text={help}
      action={onClear ? <TextButton tone="link" onClick={onClear}>Quitar filtros</TextButton> : null}
    />
  );
}
