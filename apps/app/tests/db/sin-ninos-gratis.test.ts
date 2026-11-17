// Migración sin_ninos_gratis (2026-11-17): «Niños pequeños gratis» sale del tipo feature, no solo de la pantalla. Las
// vistas y search_listings, que se crean de nuevo, conservan su forma y sus permisos.
import { beforeAll, describe, expect, it } from "vitest";
import { FEATURES } from "../../src/domain/listing";
import type { ListingsHarness } from "../contract/harness";
import { anonClient, sql } from "./local";
import { postgrestHarness } from "./postgrest-harness";

let h: ListingsHarness;

beforeAll(async () => {
  h = await postgrestHarness();
}, 60_000);

describe("sin «Niños pequeños gratis» en la base", () => {
  it("el tipo feature tiene exactamente las ocho características de la app", () => {
    const values = sql("select string_agg(v::text, ',' order by v) from unnest(enum_range(null::public.feature)) v;").split(",");
    expect(values).toEqual(FEATURES.map(([k]) => k));
    expect(values).not.toContain("kids_free");
    expect(sql("select count(*) from pg_type where typname = 'feature_old';")).toBe("0");
  });

  it("las columnas, las vistas y la búsqueda usan el tipo nuevo", () => {
    expect(sql("select string_agg(table_name || '.' || column_name || ':' || udt_name, ',' order by table_name, column_name) from information_schema.columns where table_schema = 'public' and udt_name in ('feature', '_feature');"))
      .toBe("features_with_listings.feature:feature,listings.features:_feature,listings_public.features:_feature,requests.must_have:_feature");
    expect(sql("select pg_get_function_arguments('public.search_listings'::regproc);")).toContain("p_features feature[]");
  });

  it("el público sigue leyendo las vistas y buscando con características; un valor retirado da error", async () => {
    await h.reset();
    const s = await h.seed({ status: "active", draft: { features: ["wifi", "pool"] } });
    const anon = anonClient();
    const view = await anon.from("listings_public").select("public_id, features").eq("public_id", s.publicId).single();
    expect(view.error).toBeNull();
    expect(view.data?.features).toEqual(["wifi", "pool"]);
    expect((await anon.from("features_with_listings").select("feature")).error).toBeNull();
    expect((await anon.from("provinces_with_listings").select("province")).error).toBeNull();
    const found = await anon.rpc("search_listings", { p_features: ["wifi"] });
    expect(found.error).toBeNull();
    expect(found.data?.map((r) => r.public_id)).toContain(s.publicId);
    expect(() => sql("select count(*) from public.search_listings(p_features => array['kids_free']::public.feature[]);")).toThrow();
  });

  it("search_listings no la ejecuta PUBLIC, sí anon, authenticated y service_role", () => {
    const acl = sql("select proacl::text from pg_proc where proname = 'search_listings';");
    expect(acl).not.toMatch(/[{,]=X/);
    for (const role of ["anon", "authenticated", "service_role"]) expect(acl).toContain(`${role}=X`);
  });
});
