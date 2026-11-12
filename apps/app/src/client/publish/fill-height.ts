// La descripción del paso 6 llena el alto que queda (revisión de Ana). Sin foco lo hace el flex de `.grow-col`; con el foco
// (teclado abierto y `--kb` en step-form.tsx) el campo sube hasta debajo de la cabecera (scroll-margin-top) y su alto,
// `--fill`, es lo que va de ahí a la barra «Atrás / Continuar» o al teclado (la vista visible), menos lo que hay debajo
// (la nota). Se recalcula cuando el teclado o la ventana cambian de alto.
import { useEffect, type RefObject } from "react";

const MIN = 96;
const GAP = 8;

function fit(area: HTMLTextAreaElement): void {
  if (document.activeElement !== area) return void area.style.removeProperty("--fill");
  const bar = area.form?.querySelector(".sticky-actions");
  let last = bar?.previousElementSibling;
  while (last instanceof HTMLInputElement && last.type === "hidden") last = last.previousElementSibling;
  if (!bar || !last) return;
  const below = last.getBoundingClientRect().bottom - area.getBoundingClientRect().bottom;
  const vv = window.visualViewport;
  const bottom = Math.min(bar.getBoundingClientRect().top, vv ? vv.offsetTop + vv.height : window.innerHeight);
  const top = parseFloat(getComputedStyle(area).scrollMarginTop) || 0;
  area.style.setProperty("--fill", `${Math.max(MIN, Math.floor(bottom - top - below - GAP))}px`);
}

export function useFillHeight(ref: RefObject<HTMLTextAreaElement | null>): void {
  useEffect(() => {
    const area = ref.current;
    if (!area) return;
    const run = () => fit(area);
    const vv = window.visualViewport;
    area.addEventListener("focus", run);
    area.addEventListener("blur", run);
    window.addEventListener("resize", run);
    vv?.addEventListener("resize", run);
    run();
    return () => {
      area.removeEventListener("focus", run);
      area.removeEventListener("blur", run);
      window.removeEventListener("resize", run);
      vv?.removeEventListener("resize", run);
    };
  }, [ref]);
}
