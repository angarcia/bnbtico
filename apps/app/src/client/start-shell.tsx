import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { startFavoritesSync } from "./favorites-sync";
import { Shell } from "./shell";

export function startShell(root: HTMLElement): void {
  startFavoritesSync();
  createRoot(root).render(<StrictMode><Shell /></StrictMode>);
}
