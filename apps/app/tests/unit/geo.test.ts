import { describe, expect, it } from "vitest";
import { APPROX_MAX_METERS, APPROX_MIN_METERS, EXPLORE_MAP, PROVINCE_CENTERS, distanceMeters, exploreMapView, inCostaRica, roundPoint } from "../../src/domain/geo";
import { PROVINCES } from "../../src/domain/listing";

it("la zona aproximada va de 150 a 499 m, como approx_point en SQL", () => expect([APPROX_MIN_METERS, APPROX_MAX_METERS]).toEqual([150, 499]));

describe("distanceMeters", () => {
  it("un grado de latitud son ~111 km", () => {
    expect(Math.round(distanceMeters({ lat: 9, lng: -84 }, { lat: 10, lng: -84 }) / 1000)).toBe(111);
  });
});

describe("inCostaRica", () => {
  it("acepta puntos del país y rechaza el resto", () => {
    expect(inCostaRica(9.98, -83.03)).toBe(true);
    expect(inCostaRica(10.63, -85.44)).toBe(true);
    expect(inCostaRica(0, 0)).toBe(false);
    expect(inCostaRica(40.4, -3.7)).toBe(false);
  });
});

describe("mapa del asistente", () => {
  it("cada provincia tiene su centro dentro de Costa Rica", () => {
    for (const p of PROVINCES) expect(inCostaRica(PROVINCE_CENTERS[p]!.lat, PROVINCE_CENTERS[p]!.lng), p).toBe(true);
  });
  it("el pin se guarda con seis decimales", () => {
    expect(roundPoint({ lat: 9.123456789, lng: -82.987654321 })).toEqual({ lat: 9.123457, lng: -82.987654 });
  });
});

describe("exploreMapView (mapa de Explorar)", () => {
  it("sin casas ni zona: el centro de Limón a zoom 10", () => {
    expect(exploreMapView([], null)).toEqual({ center: PROVINCE_CENTERS.Limón, zoom: 10 });
  });
  it("con zona y sin casas: el punto de la zona a zoom 13", () => {
    expect(exploreMapView([], { lat: 9.64, lng: -82.73 })).toEqual({ center: { lat: 9.64, lng: -82.73 }, zoom: 13 });
  });
  it("con casas: encaja los marcadores", () => {
    const p1 = { lat: 9.65, lng: -82.75 };
    const p2 = { lat: 9.62, lng: -82.68 };
    expect(exploreMapView([p1, p2], { lat: 9.64, lng: -82.73 })).toEqual({ fit: [p1, p2] });
  });
  it("relleno de 48 × 24 px (medio marcador) y zoom máximo 15", () => expect(EXPLORE_MAP).toEqual({ padding: [48, 24], maxZoom: 15, zoneZoom: 13, provinceZoom: 10 }));
});
