// Moneda elegida por el cliente: estado local del navegador (localStorage), compartido entre pantallas.
import { useSyncExternalStore } from "react";
import { CURRENCY_STORAGE_KEY, parseCurrency, type Currency } from "../domain/currency";

const listeners = new Set<() => void>();

function read(): Currency {
  try {
    return parseCurrency(localStorage.getItem(CURRENCY_STORAGE_KEY));
  } catch {
    return "CRC";
  }
}

export function setCurrency(next: Currency): void {
  try {
    localStorage.setItem(CURRENCY_STORAGE_KEY, next);
  } catch {
    /* sin almacenamiento (modo privado): vale para esta visita */
  }
  listeners.forEach((l) => l());
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  const onStorage = (e: StorageEvent) => e.key === CURRENCY_STORAGE_KEY && listener();
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", onStorage);
  };
}

/** En el servidor y durante la hidratación siempre colones; después, la preferencia guardada. */
export function useCurrency(): Currency {
  return useSyncExternalStore(subscribe, read, () => "CRC");
}
