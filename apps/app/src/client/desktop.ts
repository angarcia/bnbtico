import { useSyncExternalStore } from "react";

// El mismo corte que el marco de escritorio en 13-escritorio.css.
const query = "(min-width: 1024px)";

export function isDesktop(): boolean {
  return typeof window !== "undefined" && window.matchMedia(query).matches;
}

function subscribe(listener: () => void): () => void {
  const media = window.matchMedia(query);
  media.addEventListener("change", listener);
  return () => media.removeEventListener("change", listener);
}

export function useDesktop(): boolean {
  return useSyncExternalStore(subscribe, isDesktop, () => false);
}
