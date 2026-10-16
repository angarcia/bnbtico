// Iconos del prototipo (mismos trazos), como componentes.
const base = { fill: "none", stroke: "currentColor", strokeWidth: 2, viewBox: "0 0 24 24" } as const;

export const I = {
  search: (p: { size?: number }) => (
    <svg {...base} width={p.size ?? 20} height={p.size ?? 20}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></svg>
  ),
  heart: (p: { size?: number }) => (
    <svg {...base} width={p.size ?? 20} height={p.size ?? 20}><path d="M12 21s-7-4.6-9.3-9A5.3 5.3 0 0 1 12 6.4 5.3 5.3 0 0 1 21.3 12C19 16.4 12 21 12 21z" /></svg>
  ),
  user: (p: { size?: number }) => (
    <svg {...base} width={p.size ?? 20} height={p.size ?? 20}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>
  ),
  home: (p: { size?: number }) => (
    <svg {...base} width={p.size ?? 20} height={p.size ?? 20}><path d="M3 11 12 3l9 8v10h-6v-6H9v6H3z" /></svg>
  ),
  pin: (p: { size?: number }) => (
    <svg {...base} width={p.size ?? 20} height={p.size ?? 20}><path d="M12 22s7-7 7-12a7 7 0 0 0-14 0c0 5 7 12 7 12z" /><circle cx="12" cy="10" r="2.5" /></svg>
  ),
  calendar: (p: { size?: number }) => (
    <svg {...base} width={p.size ?? 20} height={p.size ?? 20}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>
  ),
  chat: (p: { size?: number }) => (
    <svg {...base} width={p.size ?? 20} height={p.size ?? 20}><path d="M21 12a8 8 0 0 1-11.6 7.1L4 20l1-5A8 8 0 1 1 21 12z" /></svg>
  ),
  back: (p: { size?: number }) => (
    <svg {...base} width={p.size ?? 22} height={p.size ?? 22}><path d="m15 5-7 7 7 7" /></svg>
  ),
  wa: (p: { size?: number }) => (
    <svg viewBox="0 0 24 24" width={p.size ?? 20} height={p.size ?? 20} fill="currentColor"><path d="M12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2zm0 18.2a8.2 8.2 0 0 1-4.2-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8.2 8.2 0 1 1 12 20.2zm4.5-6.1c-.2-.1-1.5-.7-1.7-.8s-.4-.1-.6.1-.6.8-.8 1-.3.2-.5.1a6.7 6.7 0 0 1-3.3-2.9c-.3-.4.2-.4.7-1.3.1-.2 0-.3 0-.4l-.8-1.8c-.2-.5-.4-.4-.6-.4h-.5a1 1 0 0 0-.7.3 3 3 0 0 0-.9 2.2 5.2 5.2 0 0 0 1.1 2.8 12 12 0 0 0 4.6 4c1.7.7 2.4.8 3.2.7a2.7 2.7 0 0 0 1.8-1.3 2.2 2.2 0 0 0 .2-1.3c-.1-.1-.3-.2-.5-.3z" /></svg>
  ),
};
