import { describe, expect, it } from "vitest";
import { CHIP_MAX, filterInquiries, inquiryChips } from "../../src/domain/inquiry-filter";

const of = (listingId: string, n: number) => Array.from({ length: n }, (_, k) => ({ listingId, id: `${listingId}${k}` }));

describe("filterInquiries: filtra antes de tomar las últimas", () => {
  it("sin casa devuelve la lista en el mismo orden", () => {
    const list = [...of("a", 2), ...of("b", 1)];
    expect(filterInquiries(list, null)).toEqual(list);
  });
  it("una casa tranquila conserva sus consultas aunque otra tenga 25 más recientes", () => {
    const list = [...of("a", 25), ...of("b", 3)];
    const latest = filterInquiries(list, "b").slice(0, 20);
    expect(latest).toHaveLength(3);
    expect(latest.every((i) => i.listingId === "b")).toBe(true);
  });
  it("una casa desconocida no da ninguna", () => {
    expect(filterInquiries(of("a", 2), "x")).toEqual([]);
  });
});

describe("inquiryChips: un chip por casa publicada", () => {
  const published = "2026-10-01T00:00:00Z";
  it("con menos de dos casas publicadas, ninguno", () => {
    expect(inquiryChips([{ id: "a", title: "Casa Cocles", firstPublishedAt: published }, { id: "c", title: "Borrador", firstPublishedAt: null }])).toBeNull();
  });
  it("en el orden de las casas, sin borradores, con el nombre recortado a 18", () => {
    expect(
      inquiryChips([
        { id: "a", title: "Casa Cocles", firstPublishedAt: published },
        { id: "b", title: "Casa Manzanillo, a pie de playa", firstPublishedAt: published },
        { id: "c", title: "Borrador", firstPublishedAt: null },
      ]),
    ).toEqual([
      { id: "a", label: "Casa Cocles", name: "Casa Cocles" },
      { id: "b", label: "Casa Manzanillo…", name: "Casa Manzanillo, a pie de playa" },
    ]);
  });
  it("18 caracteres justos se quedan; sin título, «Casa sin título»", () => {
    expect(CHIP_MAX).toBe(18);
    expect(inquiryChips([{ id: "a", title: "Cabina Punta Uva 2", firstPublishedAt: published }, { id: "b", title: "  ", firstPublishedAt: published }])).toEqual([
      { id: "a", label: "Cabina Punta Uva 2", name: "Cabina Punta Uva 2" },
      { id: "b", label: "Casa sin título", name: "Casa sin título" },
    ]);
  });
});
