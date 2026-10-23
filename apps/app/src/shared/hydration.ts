import { useSyncExternalStore } from "react";

const noop = () => () => {};

/** false durante el render del servidor y la hidratación; true después. */
export function useHydrated(): boolean {
  return useSyncExternalStore(noop, () => true, () => false);
}
