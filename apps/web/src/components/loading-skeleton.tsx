/** Esqueleto mientras llega una pantalla: hace que la navegación cambie al instante (la pestaña se marca y el contenido
 *  anterior desaparece) en vez de esperar la respuesta del servidor sin reacción visible. Mismo ritmo que las pantallas
 *  raíz: cabecera y tres tarjetas. Solo en las carpetas de las pestañas: con streaming el código HTTP ya es 200 cuando la
 *  página llama a notFound(), y /admin y /casa/[id] deben seguir devolviendo 404. */
export function LoadingSkeleton() {
  return (
    <div className="skeleton stack" aria-busy="true" aria-label="Cargando" style={{ gap: 14 }}>
      <div className="row between" style={{ minHeight: 44 }}>
        <span className="sk" style={{ width: 120, height: 32 }} />
        <span className="sk" style={{ width: 44, height: 44, borderRadius: 999 }} />
      </div>
      <span className="sk" style={{ width: "70%", height: 30 }} />
      <span className="sk" style={{ width: "100%", height: 112, borderRadius: "var(--r)" }} />
      <span className="sk" style={{ width: "100%", height: 112, borderRadius: "var(--r)" }} />
      <span className="sk" style={{ width: "100%", height: 72, borderRadius: "var(--r)" }} />
    </div>
  );
}
