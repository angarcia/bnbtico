import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { Shell } from "./shell";

export function startShell(root: HTMLElement): void {
  createRoot(root).render(<StrictMode><Shell /></StrictMode>);
}
