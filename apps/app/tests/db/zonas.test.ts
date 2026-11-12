import { describe, expect, it } from "vitest";
import { anonClient, signIn, sql } from "./local";

const COCLES = { p_lat: 9.6418, p_lng: -82.733 };
describe("zones y zones_near", () => {
  it("ordena por distancia y respeta el radio de 5 km", async () => {
    const { data } = await anonClient().rpc("zones_near", COCLES);
    const names = data!.map((z) => z.name);
    expect(names[0]).toBe("Cocles");
    expect(names).toEqual(expect.arrayContaining(["Puerto Viejo", "Playa Chiquita"]));
    expect(names).not.toContain("Manzanillo"); // ~8,2 km
    expect(names).not.toContain("Cahuita"); // ~16 km
    const d = data!.map((z) => z.distance_m);
    expect(d).toEqual([...d].sort((a, b) => a - b));
    expect(Math.max(...d)).toBeLessThanOrEqual(5000);
    expect((await anonClient().rpc("zones_near", { ...COCLES, p_km: 10 })).data!.map((z) => z.name)).toContain("Manzanillo");
  });
  it("anon lee las zonas activas sin la geometría; un usuario que no es admin no escribe", async () => {
    const read = await anonClient().from("zones").select("id, name, canton_code, lat, lng").eq("id", "704-cocles").single();
    expect(read.data).toMatchObject({ name: "Cocles", canton_code: "704" });
    expect((await anonClient().from("zones").select("point").limit(1)).error?.code).toBe("42501");
    const owner = await signIn("owner");
    const ins = await owner.from("zones").insert({ id: "704-prueba", name: "Prueba", canton_code: "704", point: "SRID=4326;POINT(-82.7 9.6)" } as never);
    expect(ins.error?.code).toBe("42501"); // RLS: zones_admin exige is_admin()
    expect(sql("select count(*) from zones where id = '704-prueba'")).toBe("0");
  });
  it("una zona inactiva («revisar» en zonas.md) no sale en zones_near ni en la lectura pública", async () => {
    const [id, lat, lng] = sql("select id, lat, lng from zones where not active order by id limit 1").split("|");
    expect(id).toBeTruthy();
    const near = await anonClient().rpc("zones_near", { p_lat: Number(lat), p_lng: Number(lng), p_km: 0.5 });
    expect(near.error).toBeNull();
    expect(near.data!.map((z) => z.id)).not.toContain(id);
    const read = await anonClient().from("zones").select("id").eq("id", id!);
    expect(read.error).toBeNull();
    expect(read.data).toEqual([]);
    expect(sql("select count(*) > 0 from zones where active")).toBe("t");
  });
  it("cada zona cae en su cantón según place_at", () => {
    expect(sql("select count(*) from zones z where not exists (select 1 from place_at(z.lat, z.lng) p join geo.admin_names c on c.name = p.canton and c.level = 'canton' where c.code = z.canton_code)")).toBe("0");
  });
});
