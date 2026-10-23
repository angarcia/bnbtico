// Lectura de cada pantalla del asistente de publicar: del formulario (claves → valores) a un parche del borrador.
// Misma semántica que el parser del formulario de la app anterior, ahora con zod.
import { z } from "zod";
import { FEATURE_LABEL, KINDS, parseColones, type Feature, type Kind, type ListingDraft, type Step } from "./listing";

/** Valores de un formulario agrupados por nombre (las casillas repiten nombre). */
export type FormInput = Readonly<Record<string, readonly string[]>>;

export function formInput(entries: Iterable<readonly [string, unknown]>): FormInput {
  const out: Record<string, string[]> = {};
  for (const [key, value] of entries) if (typeof value === "string") (out[key] ??= []).push(value);
  return out;
}

const all = z.array(z.string()).default([]);
const text = all.transform((v) => (v[0] ?? "").trim());
const integer = text.transform((raw) => (raw === "" ? null : /^\d+$/.test(raw) ? Number(raw) : Number.NaN));
const decimal = text.transform((raw) => {
  if (raw === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
});
const colones = text.transform(parseColones);
const choice = <T>(map: Record<string, T>) => text.transform((raw) => (raw in map ? map[raw]! : null));

const STEP_SCHEMAS = {
  1: z.object({ kind: text, modes: all }).transform(({ kind, modes }): Partial<ListingDraft> => ({
    kind: (KINDS as readonly string[]).includes(kind) ? (kind as Kind) : null,
    acceptsNightly: modes.includes("nightly"),
    acceptsMonthly: modes.includes("monthly"),
  })),
  2: z.object({ province: text, canton: text, zone: text }),
  3: z.object({ lat: decimal, lng: decimal }),
  4: z.object({ capacity: integer, bedrooms: integer, bathrooms: integer, bathroomShared: choice({ shared: true, private: false }) }),
  5: z.object({ features: all, parkingPaid: choice({ paid: true, free: false }) }).transform(({ features, parkingPaid }): Partial<ListingDraft> => ({
    features: features.filter((f): f is Feature => f in FEATURE_LABEL),
    parkingPaid,
  })),
  6: z.object({ title: text, description: text }).transform(({ title, description }) => ({ title: title.slice(0, 100), description: description.slice(0, 2000) })),
  // El número de fotos sale de la lista del servidor, nunca de un campo del formulario.
  7: z.object({}).transform((): Partial<ListingDraft> => ({})),
  8: z.object({ nightlyPriceCrc: colones, monthlyPriceCrc: colones }),
  9: z.object({}).transform((): Partial<ListingDraft> => ({})),
} satisfies Record<Step, z.ZodType<Partial<ListingDraft>, unknown>>;

export function parseStep(step: Step, input: FormInput): Partial<ListingDraft> {
  return STEP_SCHEMAS[step].parse(input);
}
