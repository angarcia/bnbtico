import { useLocation } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { applyUpdate, onUpdateChange, updateWaiting } from "./sw-register";
import { Button } from "../shared/button";

/** Rutas donde nunca se recarga: el asistente de publicar (se perdería lo que se está escribiendo). */
export const isWizardPath = (pathname: string) => pathname === "/propietario/publicar" || pathname.startsWith("/propietario/publicar/") || pathname.startsWith("/publicar/nueva/");

/** «Hay una versión nueva · Actualizar»: la versión nueva espera a que la persona toque; dentro del asistente no se ofrece. */
export function UpdateBanner() {
  const ready = useSyncExternalStore(onUpdateChange, updateWaiting, () => false);
  const { pathname } = useLocation();
  if (!ready || isWizardPath(pathname)) return null;
  return (
    <div className="update-banner" role="status">
      <span>Hay una versión nueva</span>
      <Button variant="primary" onClick={applyUpdate}>
        Actualizar
      </Button>
    </div>
  );
}
