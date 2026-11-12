import { describe, expect, it } from "vitest";
import { adminAccess } from "../../src/data/postgrest/admin-access";

/** Un cliente mínimo: la sesión que se le dé y una tabla profiles que cuenta las preguntas. */
function fakeDb(state: { token: string; isAdmin: boolean }) {
  const db = {
    asked: 0,
    auth: { getSession: async () => ({ data: { session: { access_token: state.token, user: { id: "u1" } } } }) },
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => {
            db.asked++;
            return { data: { is_admin: state.isAdmin }, error: null };
          },
        }),
      }),
    }),
  };
  return db;
}
// Un JWT sin firmar con el aal que toque (aalOf solo lee la carga).
const jwt = (aal: string, n = 0) => `x.${btoa(JSON.stringify({ aal, n })).replace(/=+$/, "")}.y`;

describe("adminAccess", () => {
  it("las comprobaciones simultáneas y las siguientes con el mismo token comparten una sola pregunta", async () => {
    const db = fakeDb({ token: jwt("aal2"), isAdmin: true });
    const run = () => adminAccess(db as never);
    expect(await Promise.all([run(), run(), run()])).toEqual(["admin", "admin", "admin"]);
    expect(await run()).toBe("admin");
    expect(db.asked).toBe(1);
  });

  it("con otro token (segundo código confirmado o sesión renovada) se vuelve a preguntar", async () => {
    const state = { token: jwt("aal1"), isAdmin: true };
    const db = fakeDb(state);
    expect(await adminAccess(db as never)).toBe("mfa");
    state.token = jwt("aal2", 1);
    expect(await adminAccess(db as never)).toBe("admin");
    expect(db.asked).toBe(2);
  });

  it("«no es admin» no se recuerda: marcarlo admin surte efecto en la siguiente lectura", async () => {
    const state = { token: jwt("aal2"), isAdmin: false };
    const db = fakeDb(state);
    expect(await adminAccess(db as never)).toBe("none");
    state.isAdmin = true;
    expect(await adminAccess(db as never)).toBe("admin");
    expect(db.asked).toBe(2);
  });
});
