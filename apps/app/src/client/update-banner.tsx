import { useLocation } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { applyUpdate, onUpdateChange, updateWaiting } from "./sw-register";

/** Rutas donde nunca se recarga: el asistente de publicar (se perdería lo que se está escribiendo). */
export const isWizardPath = (pathname: string) => pathname === "/propietario/publicar" || pathname.startsWith("/propietario/publicar/");

/** «Hay una versión nueva · Actualizar»: la versión nueva espera a que la persona toque; dentro del asistente no se ofrece. */
export function UpdateBanner() {
  const ready = useSyncExternalStore(onUpdateChange, updateWaiting, () => false);
  const { pathname } = useLocation();
  if (!ready || isWizardPath(pathname)) return null;
  return (
    <div className="update-banner" role="status">
      <span>Hay una versión nueva</span>
      <button type="button" className="btn btn-primary btn-sm" onClick={applyUpdate}>
        Actualizar
      </button>
    </div>
  );
}
