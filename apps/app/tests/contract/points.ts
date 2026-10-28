// Puntos fijos de las pruebas de ubicación (place_at, zones_near y el fake). Comprobados con PostGIS sobre los límites
// cargados (tests/db/ubicacion-limites.test.ts); el fake (src/data/fake/places.ts) dibuja sus polígonos para que den lo mismo.
import type { LatLng } from "../../src/domain/geo";

export const COCLES: LatLng = { lat: 9.6418, lng: -82.733 };
export const LIMON_CENTRO: LatLng = { lat: 9.9925, lng: -83.036 };
/** Valle La Estrella (cantón Limón), cerca del límite con Talamanca. */
export const ESTRELLA: LatLng = { lat: 9.8, lng: -82.93 };
export const MAR: LatLng = { lat: 10.2, lng: -82.8 };
export const PANAMA: LatLng = { lat: 9.43, lng: -82.52 };
// Pin en la playa de Punta Uva, calculado con PostGIS sobre los datos cargados: desde el punto C del borde de Cahuita
// (70403) más cercano a un punto de mar (9.66, -82.70), C = (9.641338, -82.69355), hacia el mar con azimut 341.07°,
// a 100 m y a 600 m. Ninguno queda dentro de un polígono; el de 600 m queda a 600 m del distrito más cercano.
export const COAST_C: LatLng = { lat: 9.641338, lng: -82.69355 };
export const COAST_AZIMUTH_DEG = 341.070481702853;
export const BEACH_100: LatLng = { lat: 9.642193, lng: -82.693846 };
export const BEACH_600: LatLng = { lat: 9.646469, lng: -82.695323 };
