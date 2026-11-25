import { useLocation } from "@tanstack/react-router";
import { useSyncExternalStore } from "react";
import { applyUpdate, isWizardPath, onUpdateChange, updateWaiting } from "./sw-register";
import { Button } from "../../shared/ui/button";
import * as UPDATE_COPY from "./copy/update-banner";

/** «Hay una versión nueva · Actualizar»: la versión nueva espera a que la persona toque; dentro del asistente no se ofrece. */
export function UpdateBanner() {
  const ready = useSyncExternalStore(onUpdateChange, updateWaiting, () => false);
  const { pathname } = useLocation();
  if (!ready || isWizardPath(pathname)) return null;
  return (
    <div className="update-banner" role="status">
      <span>{UPDATE_COPY.text}</span>
      <Button variant="primary" onClick={applyUpdate}>
        {UPDATE_COPY.update}
      </Button>
    </div>
  );
}
