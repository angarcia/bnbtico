"use client";

/** Envía el formulario GET al cambiar un select o una casilla (sin JavaScript queda el botón «Aplicar»). */
export function AutoSubmit({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="stack"
      style={{ gap: 14 }}
      onChange={(e) => {
        const target = e.target as HTMLElement;
        if (target instanceof HTMLSelectElement || (target instanceof HTMLInputElement && target.type === "checkbox")) {
          target.closest("form")?.requestSubmit();
        }
      }}
    >
      {children}
    </div>
  );
}
