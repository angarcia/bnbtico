// Trozos diferidos (client/chunk-error.ts): distinguir «no llegó el trozo» (sin red o despliegue nuevo) de un fallo de
// pintado, para avisar de la conexión solo cuando toca.
import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "../../src/client/chunk-error";

describe("isChunkLoadError", () => {
  it("reconoce los mensajes de Chrome, Firefox, Safari y la precarga de Vite", () => {
    expect(isChunkLoadError(new TypeError("Failed to fetch dynamically imported module: https://x/assets/photos-a.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("error loading dynamically imported module: https://x/assets/photos-a.js"))).toBe(true);
    expect(isChunkLoadError(new TypeError("Importing a module script failed."))).toBe(true);
    expect(isChunkLoadError(new Error("Unable to preload CSS for /assets/photos-a.css"))).toBe(true);
  });
  it("un fallo de pintado no es de carga", () => {
    expect(isChunkLoadError(new TypeError("Cannot read properties of undefined (reading 'map')"))).toBe(false);
    expect(isChunkLoadError("texto")).toBe(false);
    expect(isChunkLoadError(undefined)).toBe(false);
  });
});
