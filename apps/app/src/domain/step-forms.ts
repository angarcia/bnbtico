// Lectura de cada pantalla del asistente de publicar: del formulario (claves → valores) a un parche del borrador.
// Misma semántica que el parser del formulario de la app anterior, ahora con zod.
import * as z from "zod/mini";
import type { ZoneSource } from "./zones";
import { DESCRIPTION_MAX, FEATURE_LABEL, KINDS, TITLE_MAX, parseColones, type Feature, type Kind, type ListingDraft, type Step } from "./listing";

/** Valores de un formulario agrupados por nombre (las casillas repiten nombre). */
export type FormInput = Readonly<Record<string, readonly string[]>>;

export function formInput(entries: Iterable<readonly [string, unknown]>): FormInput {
  const out: Record<string, string[]> = {};
  for (const [key, value] of entries) if (typeof value === "string") (out[key] ??= []).push(value);
  return out;
}

// zod/mini, como los filtros: el asistente comparte el núcleo de zod con Explorar en vez de traer la versión completa.
const all = z._default(z.array(z.string()), []);
const text = z.pipe(all, z.transform((v) => (v[0] ?? "").trim()));
const integer = z.pipe(text, z.transform((raw) => (raw === "" ? null : /^\d+$/.test(raw) ? Number(raw) : Number.NaN)));
const decimal = z.pipe(
  text,
  z.transform((raw) => {
    if (raw === "") return null;
    const n = Number(raw);
    return Number.isFinite(n) ? n : null;
  }),
);
const colones = z.pipe(text, z.transform(parseColones));
const choice = <T,>(map: Record<string, T>) => z.pipe(text, z.transform((raw) => (raw in map ? map[raw]! : null)));
const draft = <S extends z.ZodMiniType>(schema: S, fn: (v: z.output<S>) => Partial<ListingDraft>) => z.pipe(schema, z.transform(fn));
const nothing = draft(z.object({}), () => ({}));
const ZONE_SOURCES: Record<string, ZoneSource> = { list: "list", district: "district", other: "other" };

const STEP_SCHEMAS = {
  1: draft(z.object({ kind: text }), ({ kind }) => ({ kind: (KINDS as readonly string[]).includes(kind) ? (kind as Kind) : null })),
  // Ubicación por punto: el pin, lo que dio place_at (campos ocultos) y la zona con su origen; la base lo recalcula al enviar.
  2: draft(
    z.object({ lat: decimal, lng: decimal, province: text, canton: text, district: text, zone: text, zoneId: text, zoneSource: choice(ZONE_SOURCES) }),
    ({ zoneId, ...v }) => ({ ...v, zoneId: zoneId || null }),
  ),
  4: draft(z.object({ capacity: integer, bedrooms: integer, bathrooms: integer, bathroomShared: choice({ shared: true, private: false }) }), (v) => v),
  5: draft(z.object({ features: all, parkingPaid: choice({ paid: true, free: false }) }), ({ features, parkingPaid }) => ({
    features: features.filter((f): f is Feature => f in FEATURE_LABEL),
    parkingPaid,
  })),
  6: draft(z.object({ title: text, description: text }), ({ title, description }) => ({ title: [...title].slice(0, TITLE_MAX).join(""), description: [...description].slice(0, DESCRIPTION_MAX).join("") })),
  // El número de fotos sale de la lista del servidor, nunca de un campo del formulario.
  7: nothing,
  // «¿Acepta alquiler por meses?»: No por defecto; con No el precio al mes del formulario se descarta.
  8: draft(z.object({ nightlyPriceCrc: colones, acceptsMonthly: choice({ yes: true, no: false }), monthlyPriceCrc: colones }), (v) => ({
    nightlyPriceCrc: v.nightlyPriceCrc,
    acceptsMonthly: v.acceptsMonthly === true,
    monthlyPriceCrc: v.acceptsMonthly === true ? v.monthlyPriceCrc : null,
  })),
  9: nothing,
} satisfies Record<Step, z.ZodMiniType<Partial<ListingDraft>, unknown>>;

export function parseStep(step: Step, input: FormInput): Partial<ListingDraft> {
  return STEP_SCHEMAS[step].parse(input);
}
