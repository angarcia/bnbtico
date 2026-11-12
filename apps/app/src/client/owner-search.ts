import type { SuscripcionSearch } from "../domain/subscription-scope";

export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
export const PUBLIC_ID = /^CT-\d{4,}$/;

/** Paso del asistente de publicar: `volver=revisar` (el paso se abrió desde «Revisar y enviar») hace que «Continuar» y
 *  «Atrás» vuelvan a ese resumen. Se pierde al llegar a él. */
export const pasoSearch = (p: Record<string, unknown>): { volver?: "revisar" } => (p.volver === "revisar" ? { volver: "revisar" } : {});

/** Calendario: `casa` (id de una casa propia) y `mes` (`YYYY-MM`); la pantalla elige la casa y acota el mes a la ventana. */
export const calendarioSearch = (p: Record<string, unknown>): { casa?: string; mes?: string } => ({
  ...(typeof p.casa === "string" && UUID.test(p.casa) ? { casa: p.casa } : {}),
  ...(typeof p.mes === "string" && /^\d{4}-(0[1-9]|1[0-2])$/.test(p.mes) ? { mes: p.mes } : {}),
});

/** Suscripción: `pago=ok` (vuelta de la pasarela; la pantalla lo quita al leerlo) y `casa=CT-####` (acota a una casa). */
export const suscripcionSearch = (p: Record<string, unknown>): SuscripcionSearch => ({
  ...(p.pago === "ok" ? { pago: "ok" as const } : {}),
  ...(typeof p.casa === "string" && PUBLIC_ID.test(p.casa) ? { casa: p.casa } : {}),
});

/** Actividad: `casa` es el id (uuid) de la casa a filtrar. */
export const actividadSearch = (p: Record<string, unknown>): { casa?: string } =>
  typeof p.casa === "string" && UUID.test(p.casa) ? { casa: p.casa } : {};
