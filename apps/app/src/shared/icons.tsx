type P = { size?: number };
const base = { fill: "none", stroke: "currentColor", strokeWidth: 2, strokeLinecap: "round", strokeLinejoin: "round", viewBox: "0 0 24 24", "aria-hidden": true } as const;
const S = (p: P, d = 20) => ({ ...base, width: p.size ?? d, height: p.size ?? d });

// Iconos de línea del diseño v1 (design/pantallas): trazo 2, 24×24, color del texto.
export const I = {
  search: (p: P) => <svg {...S(p)}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>,
  heart: (p: P) => <svg {...S(p)}><path d="M12 21s-7-4.6-9.3-9A5.3 5.3 0 0 1 12 6.4 5.3 5.3 0 0 1 21.3 12C19 16.4 12 21 12 21z" /></svg>,
  user: (p: P) => <svg {...S(p)}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>,
  pin: (p: P) => <svg {...S(p)}><path d="M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z" /><circle cx="12" cy="10" r="2.2" /></svg>,
  back: (p: P) => <svg {...S(p, 22)}><path d="m15 5-7 7 7 7" /></svg>,
  share: (p: P) => <svg {...S(p)}><path d="M12 15V4" /><path d="m8 8 4-4 4 4" /><path d="M5 12v6a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-6" /></svg>,
  check: (p: P) => <svg {...S(p)}><path d="m5 12 5 5L20 7" /></svg>,
  wa: (p: P) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 20} height={p.size ?? 20} fill="currentColor" aria-hidden="true"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 11.9 11.9 0 0 0 4.6 4 5.3 5.3 0 0 0 3.2.7 2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" /></svg>
  ),
  pool: (p: P) => <svg {...S(p)}><path d="M3 17c2 1.5 4 1.5 6 0s4-1.5 6 0 4 1.5 6 0" /><path d="M7 15V5a2 2 0 0 1 4 0v1M13 15V5a2 2 0 0 1 4 0v1" /></svg>,
  pets: (p: P) => <svg {...S(p)}><circle cx="7" cy="9" r="2" /><circle cx="17" cy="9" r="2" /><circle cx="10" cy="5" r="2" /><circle cx="14" cy="5" r="2" /><path d="M12 11c-3 0-5 2.5-5 5s2 3 5 3 5-.5 5-3-2-5-5-5z" /></svg>,
  wifi: (p: P) => <svg {...S(p)}><path d="M2 9a15 15 0 0 1 20 0M5.5 12.5a10 10 0 0 1 13 0M9 16a5 5 0 0 1 6 0" /><circle cx="12" cy="19.5" r="1" /></svg>,
  ac: (p: P) => <svg {...S(p)}><rect x="3" y="6" width="18" height="8" rx="2" /><path d="M7 18l-1 2M12 18v3M17 18l1 2" /></svg>,
  parking: (p: P) => <svg {...S(p)}><path d="M5 16l1.5-5h11L19 16" /><rect x="3" y="16" width="18" height="4" /><circle cx="7.5" cy="20" r="1.5" /><circle cx="16.5" cy="20" r="1.5" /></svg>,
  ev: (p: P) => <svg {...S(p)}><path d="M13 2 5 13h6l-1 9 8-12h-6z" /></svg>,
  kids: (p: P) => <svg {...S(p)}><circle cx="12" cy="7" r="3" /><path d="M6 21v-5a6 6 0 0 1 12 0v5" /></svg>,
  beach: (p: P) => <svg {...S(p)}><circle cx="17" cy="7" r="3" /><path d="M2 19c2-1.5 4-1.5 6 0s4 1.5 6 0 4-1.5 6 0M3 14c3-3 6-3 9 0" /></svg>,
  bbq: (p: P) => <svg {...S(p)}><path d="M4 10h16a8 8 0 0 1-16 0z" /><path d="M8 18l-2 4M16 18l2 4M9 3c0 1.5 1 1.5 1 3M13 3c0 1.5 1 1.5 1 3" /></svg>,
};

export type IconName = keyof typeof I;
