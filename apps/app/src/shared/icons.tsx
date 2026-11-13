import type { Feature } from "../domain/listing";

type P = { size?: number };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24", "aria-hidden": true } as const;
const S = (p: P, d = 20) => ({ ...base, width: p.size ?? d, height: p.size ?? d });

// Iconos de línea del diseño v1 (design/pantallas): trazo 2, 24×24, color del texto.
export const I = {
  // Símbolo B de design/logo/3bstays-2026-11-10/icono.svg, con el margen ajustado a la barra.
  brand: (p: P) => (
    <svg {...S(p)} viewBox="30 23 196 196">
      <path strokeWidth={17} d="M 82 54 C 103 49 135 51 153 58 C 166 63 167 70 157 80 L 111 126 C 148 123 176 142 176 165 C 176 191 145 205 111 202 C 99 201 89 198 82 193 L 82 102" />
    </svg>
  ),
  search: (p: P) => <svg {...S(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>,
  heart: (p: P) => <svg {...S(p)}><path d="M12 21s-7-4.6-9.3-9A5.3 5.3 0 0 1 12 6.4 5.3 5.3 0 0 1 21.3 12C19 16.4 12 21 12 21z" /></svg>,
  user: (p: P) => <svg {...S(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>,
  eye: (p: P) => <svg {...S(p)}><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" /><circle cx="12" cy="12" r="3" /></svg>,
  pin: (p: P) => <svg {...S(p)}><path d="M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z" /><circle cx="12" cy="10" r="2.2" /></svg>,
  back: (p: P) => <svg {...S(p, 22)}><path d="m15 5-7 7 7 7" /></svg>,
  share: (p: P) => <svg {...S(p)}><path d="M12 15V4" /><path d="m8 8 4-4 4 4" /><path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>,
  link: (p: P) => <svg {...S(p)}><path d="m10 13 4-4M8 15l-2 2a3.5 3.5 0 0 1-5-5l5-5a3.5 3.5 0 0 1 5 0M16 9l2-2a3.5 3.5 0 0 1 5 5l-5 5a3.5 3.5 0 0 1-5 0" /></svg>,
  check: (p: P) => <svg {...S(p)}><path d="m5 12 5 5L20 7" /></svg>,
  wa: (p: P) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 20} height={p.size ?? 20} fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4 5.3 5.3 0 0 0 3.2.7 2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" /></svg>
  ),
  pool: (p: P) => <svg {...S(p)}><path d="M3 17c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0" /><path d="M7 15V5a2 2 0 0 1 4 0v1M13 15V5a2 2 0 0 1 4 0v1" /></svg>,
  // Lucide paw-print y baby (ISC; licencia en icons-lucide.LICENSE).
  pets: (p: P) => <svg {...S(p)}><circle cx="11" cy="4" r="2" /><circle cx="18" cy="8" r="2" /><circle cx="20" cy="16" r="2" /><path d="M9 10a5 5 0 0 1 5 5v3.5a3.5 3.5 0 0 1-6.84 1.045Q6.52 17.48 4.46 16.84A3.5 3.5 0 0 1 5.5 10Z" /></svg>,
  wifi: (p: P) => <svg {...S(p)}><path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0" /><circle cx="12" cy="19.5" r="1" /></svg>,
  ac: (p: P) => <svg {...S(p)}><rect x="3" y="6" width="18" height="8" rx="2" /><path d="M7 18l-1 2M12 18v3M17 18l1 2" /></svg>,
  parking: (p: P) => <svg {...S(p)}><path d="M5 16l1.5-5h11L19 16" /><rect x="3" y="16" width="18" height="4" /><circle cx="7.5" cy="20" r="1.5" /><circle cx="16.5" cy="20" r="1.5" /></svg>,
  ev: (p: P) => <svg {...S(p)}><path d="M13 2 5 13h6l-1 9 8-12h-6z" /></svg>,
  kids: (p: P) => <svg {...S(p)}><path d="M10 16c.5.3 1.2.5 2 .5s1.5-.2 2-.5M15 12h.01M9 12h.01" /><path d="M19.38 6.813A9 9 0 0 1 20.8 10.2a2 2 0 0 1 0 3.6 9 9 0 0 1-17.6 0 2 2 0 0 1 0-3.6A9 9 0 0 1 12 3c2 0 3.5 1.1 3.5 2.5s-.9 2.5-2 2.5c-.8 0-1.5-.4-1.5-1" /></svg>,
  beach: (p: P) => <svg {...S(p)}><circle cx="17" cy="7" r="3" /><path d="M2 19c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0M3 14c3-3 6-3 9 0" /></svg>,
  bbq: (p: P) => <svg {...S(p)}><path d="M4 10h16a8 8 0 0 1-16 0z" /><path d="M8 18l-2 4M16 18l2 4M9 3c0 1.5 1 1.5 1 3M13 3c0 1.5 1 1.5 1 3" /></svg>,
  // Casa con tejado y puerta (ronda de Ana 2026-10-30: «Mis casas» llevaba el mismo dibujo que el pin del mapa).
  camera: (p: P) => <svg {...S(p)}><path d="M4 8h3l2-3h6l2 3h3v11H4z" /><circle cx="12" cy="13" r="3.5" /></svg>,
  house: (p: P) => <svg {...S(p)}><path d="M3 10.5 12 3l9 7.5" /><path d="M5 9v12h14V9" /><path d="M10 21v-6h4v6" /></svg>,
  calendar: (p: P) => <svg {...S(p)}><rect x="4" y="5" width="16" height="15" rx="3" /><path d="M4 10h16M9 3v4M15 3v4" /></svg>,
  chat: (p: P) => <svg {...S(p)}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-5A8 8 0 1 1 21 12z" /></svg>,
  edit: (p: P) => <svg {...S(p)}><path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4z" /><path d="m13.5 6.5 4 4" /></svg>,
  // Lucide square-pen (ISC; licencia en icons-lucide.LICENSE).
  squarePen: (p: P) => (
    <svg {...S(p)}>
      <path d="M12 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M16 3.8a2.3 2.3 0 0 1 3.3 3.3l-8 8-4.3 1.1 1.1-4.3z" />
    </svg>
  ),
  phone: (p: P) => <svg {...S(p)}><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2z" /></svg>,
  plus: (p: P) => <svg {...S(p)}><path d="M12 5v14M5 12h14" /></svg>,
  x: (p: P) => <svg {...S(p)}><path d="M6 6l12 12M18 6 6 18" /></svg>,
  chevron: (p: P) => <svg {...S(p, 18)}><path d="m9 6 6 6-6 6" /></svg>,
  chevronDown: (p: P) => <svg {...S(p, 18)}><path d="m6 9 6 6 6-6" /></svg>,
  lock: (p: P) => <svg {...S(p)}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 0 1 8 0v3" /></svg>,
  shield: (p: P) => <svg {...S(p)}><path d="M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z" /><path d="m9 12 2 2 4-4" /></svg>,
  inbox: (p: P) => <svg {...S(p)}><path d="M4 13l2-7h12l2 7v6H4z" /><path d="M4 13h5l1 2h4l1-2h5" /></svg>,
  users: (p: P) => <svg {...S(p)}><circle cx="9" cy="8" r="3.5" /><path d="M2.5 20c0-3.6 2.9-6 6.5-6s6.5 2.4 6.5 6" /><circle cx="17" cy="9" r="2.5" /><path d="M16 14.5c3 .2 5.5 2.3 5.5 5.5" /></svg>,
  // Lucide, bed-double y bath (ISC; licencia en icons-lucide.LICENSE). Misma familia de trazo, sin añadir el paquete.
  bed: (p: P) => <svg {...S(p)}><path d="M2 20v-8a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v8" /><path d="M4 10V6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v4M12 4v6M2 18h20" /></svg>,
  bath: (p: P) => <svg {...S(p)}><path d="M10 4 8 6M17 19v2M2 12h20M7 19v2" /><path d="M9 5 7.6 3.6a2 2 0 0 0-3.4 1.4V12M3 12v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5" /></svg>,
  sliders: (p: P) => <svg {...S(p)}><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2.2" /><circle cx="9" cy="17" r="2.2" /></svg>,
  map: (p: P) => <svg {...S(p)}><path d="m3 6 6-2 6 2 6-2v14l-6 2-6-2-6 2z" /><path d="M9 4v14M15 6v14" /></svg>,
  list: (p: P) => <svg {...S(p)}><path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" /></svg>,
  help: (p: P) => <svg {...S(p)}><circle cx="12" cy="12" r="9" /><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .8-1 1.5M12 17h.01" /></svg>,
};

export type IconName = keyof typeof I;

export const FEATURE_ICON: Record<Feature, IconName> = {
  pool: "pool",
  pets: "pets",
  wifi: "wifi",
  ac: "ac",
  parking: "parking",
  ev: "ev",
  kids_free: "kids",
  beachfront: "beach",
  bbq: "bbq",
};
