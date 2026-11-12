// Diálogos modales de la ficha (hoja de contacto, descripción entera): mientras están abiertos, sin scroll de fondo y con
// el resto de la página inerte.
import { useEffect } from "react";

export function useModal() {
  useEffect(() => {
    const root = document.getElementById("root");
    document.documentElement.classList.add("sheet-open");
    if (root) root.inert = true;
    return () => {
      document.documentElement.classList.remove("sheet-open");
      if (root) root.inert = false;
    };
  }, []);
}
