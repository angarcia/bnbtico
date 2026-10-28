// «¿No encuentra lo que busca?» en Explorar (fase 6, ticket 01; sustituto de «Buscan casa»): enlace al WhatsApp de atención a
// clientes con la búsqueda ya redactada. Sin número en el build (VITE_WA_GUESTS vacío), no sale. Va en el JS inicial: corto.
import type { Filters } from "../domain/filters";
import { searchHelpMessage } from "../domain/search-help";
import { waUrl } from "../domain/whatsapp";
import { track } from "../shared/beacon";
import { I } from "../shared/icons";

/**
 * Sin resultados (`onClear`): tarjeta «No hay casas con esos filtros», la nota si hay número y «Quitar filtros» si hay
 * filtros puestos. Con resultados: solo la nota arena, al final de la rejilla.
 */
export function SearchHelp({ filters, number, onClear }: { filters: Filters; number: string; onClear?: (() => void) | null }) {
  const help = number ? (
    <>
      <p>¿No encuentra lo que busca? Cuéntenos qué necesita por WhatsApp y le ayudamos a encontrar casa.</p>
      {/* Se abre como «Abrir WhatsApp» de Ayuda; la baliza no lleva el mensaje ni los filtros (solo ruta, build y país). */}
      <a className="btn btn-outline btn-block" href={waUrl(number, searchHelpMessage(filters))} target="_blank" rel="noopener" onClick={() => track("search_help_tap")}>
        <I.wa size={20} /> Escribir a bnbtico por WhatsApp
      </a>
    </>
  ) : null;
  if (onClear === undefined) return help && <div className="note note-arena note-col">{help}</div>;
  return (
    <section className="card stack gap-14">
      <h3>No hay casas con esos filtros</h3>
      {help}
      {onClear ? (
        <button type="button" className="btn-link" onClick={onClear}>
          Quitar filtros
        </button>
      ) : null}
    </section>
  );
}
