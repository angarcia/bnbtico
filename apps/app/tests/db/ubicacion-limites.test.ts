import { describe, expect, it } from "vitest";
import { anonClient, sql } from "./local";

const at = async (lat: number, lng: number) => (await anonClient().rpc("place_at", { p_lat: lat, p_lng: lng })).data ?? [];
// Puntos fijos (comprobados con ST_Covers al escribir la prueba; ver el paso 3).
const COCLES = { lat: 9.6418, lng: -82.733 };
const LIMON_CENTRO = { lat: 9.9925, lng: -83.036 };
const MAR = { lat: 10.2, lng: -82.8 };
const PANAMA = { lat: 9.43, lng: -82.52 };
// Pin en la playa de Punta Uva, calculado con PostGIS sobre los datos cargados: desde el punto C del borde de Cahuita
// (70403) más cercano a un punto de mar (9.66, -82.70), C = (9.641338, -82.69355), hacia el mar con azimut 341.07°,
// a 100 m y a 600 m. Ninguno queda dentro de un polígono; el de 600 m queda a 600 m del distrito más cercano.
const BEACH_100 = { lat: 9.642193, lng: -82.693846 };
const BEACH_600 = { lat: 9.646469, lng: -82.695323 };

describe("place_at y los límites de OpenStreetMap", () => {
  it("Cocles: Limón / Talamanca / Cahuita", async () => {
    expect(await at(COCLES.lat, COCLES.lng)).toEqual([{ province: "Limón", canton: "Talamanca", district: "Cahuita", district_code: "70403" }]);
  });
  it("Limón centro: Limón / Limón / Limón", async () => {
    expect((await at(LIMON_CENTRO.lat, LIMON_CENTRO.lng))[0]).toMatchObject({ province: "Limón", canton: "Limón", district: "Limón" });
  });
  it("mar adentro y Panamá: sin fila", async () => {
    expect(await at(MAR.lat, MAR.lng)).toEqual([]);
    expect(await at(PANAMA.lat, PANAMA.lng)).toEqual([]);
  });
  it("un pin en la playa a 100 m fuera del polígono cae en el distrito más cercano; a 600 m, sin fila", async () => {
    expect((await at(BEACH_100.lat, BEACH_100.lng))[0]).toMatchObject({ district: "Cahuita" });
    expect(await at(BEACH_600.lat, BEACH_600.lng)).toEqual([]);
  });
  it("7 / 84 / 494 y sin Conte Burica", () => {
    expect(sql("select string_agg(level || '=' || n, ',' order by level) from (select level, count(*) n from geo.admin_names group by 1) t")).toBe("canton=84,district=494,province=7");
    expect(sql("select count(*) from geo.admin_names where name = 'Conte Burica'")).toBe("0");
  });
  it("anon y authenticated no leen los polígonos ni los nombres", () => {
    for (const role of ["anon", "authenticated"]) for (const t of ["geo.district_shapes", "geo.admin_names"])
      expect(sql(`select has_table_privilege('${role}', '${t}', 'select')`)).toBe("f");
    expect(sql("select has_function_privilege('anon', 'geo.load_district_shape(text,text)', 'execute')")).toBe("f");
  });
  it("place_at no devuelve geometría", () => {
    expect(sql("select string_agg(p.data_type, ',' order by p.ordinal_position) from information_schema.routines r join information_schema.parameters p using (specific_name) where r.routine_name = 'place_at' and p.parameter_mode = 'OUT'")).toBe("text,text,text,text");
  });
});
