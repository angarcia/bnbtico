import { createContext, useContext, useLayoutEffect } from "react";

export const StepReadyContext = createContext<(ready: boolean) => void>(() => undefined);

/** Antes de pintar, comunica si el paso ya puede continuar. */
export function useStepReady(ready: boolean): void {
  const set = useContext(StepReadyContext);
  useLayoutEffect(() => {
    set(ready);
    return () => set(true);
  }, [set, ready]);
}
