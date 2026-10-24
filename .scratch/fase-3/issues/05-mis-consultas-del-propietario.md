# 05: Mis consultas (owner) with new-count on Inicio and the tab

**What to build:** the owner's Mis consultas per design 18 replacing the placeholder, with filter by house, «Nueva» marker, «Abrir WhatsApp» directly with the client, and the count of new inquiries on Inicio and as a terracotta badge on the Consultas tab. Spec § Mis consultas.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Lazy route `/propietario/consultas` with its own `size-limit` entry; query `["inquiries", uid]` (30 s stale, persisted with the private keys, removed on sign-out, refetch on focus/resume); visited screen renders from cache without network.
- [ ] Cards: initials, name, relative date, «<casa> · <fechas> · N personas» («sin fechas» when none), message in quotes, «Abrir WhatsApp» (WhatsApp green). Chips «Todas · N» + per house (only houses with inquiries). Empty state with «Compartir ficha» when there's an active house. Closing note.
- [ ] «Abrir WhatsApp»: optimistic `markOpened` (keepalive, rollback not needed if it fails — retried next time) + `location.assign(wa.me/<client digits>)` with no text.
- [ ] Inicio card «N consultas nuevas» → Mis consultas (replaces «Llega más adelante»); tab badge with the count (hidden at 0, `aria-label` «Consultas, N nuevas»).
- [ ] Playwright: client contacts two houses of the same owner → owner sees two «Nueva», filter by house, badge 2 → Abrir WhatsApp on one → intercepted `wa.me/50688881234` → badge 1; offline revisit renders from cache. Gates green.
