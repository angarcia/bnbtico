import { describe, expect, it } from "vitest";
import { plural } from "../../src/domain/plural";
import * as FAVORITES_COPY from "../../src/client/explorar/copy/favorites";

describe("plural (catálogos de textos)", () => {
  const casas = (n: number) => plural(n, { one: `${n} casa`, other: `${n} casas` });

  it("en español, «one» solo para 1; el 0 y los decimales van en plural", () => {
    expect([0, 1, 2, 1.5, 21].map(casas)).toEqual(["0 casas", "1 casa", "2 casas", "1.5 casas", "21 casas"]);
  });

  it("los millones redondos usan «many» si el mensaje lo da, y si no la forma general", () => {
    expect(casas(1_000_000)).toBe("1000000 casas");
    expect(plural(1_000_000, { one: "un millón", other: "otra", many: "un millón de casas" })).toBe("un millón de casas");
  });

  it("Favoritos cuenta las casas con y sin sesión", () => {
    expect(FAVORITES_COPY.count({ count: 1, signedIn: true })).toBe("1 casa guardada");
    expect(FAVORITES_COPY.count({ count: 3, signedIn: true })).toBe("3 casas guardadas");
    expect(FAVORITES_COPY.count({ count: 1, signedIn: false })).toBe("1 casa · guardada en este teléfono");
    expect(FAVORITES_COPY.count({ count: 2, signedIn: false })).toBe("2 casas · guardadas en este teléfono");
  });
});
