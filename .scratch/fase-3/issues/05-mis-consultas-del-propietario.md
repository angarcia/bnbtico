# 05: Mis consultas (owner) with new-count on Inicio and the tab

**What to build:** the owner's Mis consultas per design 18 replacing the placeholder, with filter by house, «Nueva» marker, «Abrir WhatsApp» directly with the client, and the count of new inquiries on Inicio and as a terracotta badge on the Consultas tab. Spec § Mis consultas.

**Blocked by:** 04

**Status:** done

- [x] Lazy route `/propietario/consultas` with its own `size-limit` entry; query `["inquiries", uid]` (30 s stale, persisted with the private keys, removed on sign-out, refetch on focus/resume); visited screen renders from cache without network.
- [x] Cards: initials, name, relative date, «<casa> · <fechas> · N personas» («sin fechas» when none), message in quotes, «Abrir WhatsApp» (WhatsApp green). Chips «Todas · N» + per house (only houses with inquiries). Empty state with «Compartir ficha» when there's an active house. Closing note.
- [x] «Abrir WhatsApp»: optimistic `markOpened` (keepalive, rollback not needed if it fails — retried next time) + `location.assign(wa.me/<client digits>)` with no text.
- [x] Inicio card «N consultas nuevas» → Mis consultas (replaces «Llega más adelante»); tab badge with the count (hidden at 0, `aria-label` «Consultas, N nuevas»).
- [x] Playwright: client contacts two houses of the same owner → owner sees two «Nueva», filter by house, badge 2 → Abrir WhatsApp on one → intercepted `wa.me/50688881234` → badge 1; offline revisit renders from cache. Gates green.

## Cierre (2026-10-23)

- **Pantalla** `src/client/screens/consultas.tsx` (`ConsultasScreen`, ruta perezosa `/propietario/consultas` en `shell.tsx`, precargada en reposo con las del propietario; fuera el marcador): cabecera raíz, texto del diseño 18, chips «Todas · N» + una por casa con consultas (`aria-pressed`, salvia como Explorar), tarjetas (iniciales 44 px, nombre, `relativeTime`, «casa · fechas · N personas», mensaje entre comillas, «Nueva» terracota si no se abrió, «Creada por bnbtico» si `source = 'bnbtico'`, «Abrir WhatsApp» verde), nota de cierre, vacío «Todavía no le han escrito…» + «Compartir ficha» si hay casa activa. Dominio: `inquirySummary` e `inquiryHouses` en `inquiry.ts`.
- **Consulta** `src/client/inquiries.ts` (JS inicial, sin el dominio de consultas): `inquiriesQuery` `["inquiries", uid]` 30 s, en `PRIVATE_KEYS` (persistida con sesión, borrada al cerrarla, refresco al volver a la app como las demás privadas); `countNew`; `openInquiry`: cambio optimista en la caché, `markOpened` (keepalive por `keepaliveFetch`), espera ≤ 400 ms y `location.assign(wa.me/<dígitos del cliente>)` sin texto; sin vuelta atrás si falla.
- **Inicio:** tarjeta «N consultas nuevas» / «1 consulta nueva» / «Sin consultas nuevas» → Mis consultas, con flecha. **Pestaña:** contador terracota (`nav-count`), oculto en 0, `aria-label` «Consultas, N nuevas»; la barra pide la consulta solo en `/propietario/*`, fuera solo lee la caché.
- **Pruebas:** unitarias **534/534** (nuevas: `owner-inquiries.test.ts` 5, `inquiry.test.ts` +2). Base **144/144**. Playwright **77/77 + 2 omitidas**: nuevo `consultas.spec.ts` (3): el cliente contacta dos casas del mismo propietario desde la ficha → Inicio «2 consultas nuevas» y contador 2 → dos «Nueva», la más reciente primero, filtro por casa → «Abrir WhatsApp» → `https://wa.me/50688881234` interceptado y `owner_opened_at` en la base → atrás: contador 1, «Consultas, 1 nueva»; recarga igual; sin red desde la caché; Inicio «1 consulta nueva». Cerrar sesión saca `inquiries` de la caché de IndexedDB. Vacío con «Compartir ficha» y sin contador. Capturas Pixel 7 revisadas: `consultas-inicio.png`, `consultas-lista.png`, `consultas-filtro.png`, `consultas-abierta.png`, `consultas-vacio.png`.
- **Tamaños (gz):** zona privada inicial **136,07 → 136,44 KB**; Mis consultas **1,73 / 4 KB** (entrada nueva); pantallas de las pestañas **18,58 KB**, límite subido de 18 a **20 KB** (incluye ahora `consultas-*` y `owner-*`: Rolldown separa `client/owner.ts` al compartirlo con Mis consultas; si no se excluía del inicial contaba +1,5 KB allí sin cargarse al inicio).
- **Lighthouse (mediana de 3):** ficha en frío LCP **1,60 s** (100 puntos, TBT 0, CLS 0); shell instalado **0,52 s**. Sin cambio.
- **Desviaciones:** el diseño 18 no tiene marcador «Nueva»: es una píldora terracota junto a la fecha (la tarjeta abierta lleva iniciales en arena). Abrir WhatsApp espera hasta 400 ms a la base antes de salir (para que la petición salga antes de dejar la página).
- Sin migraciones. **Para Daniel:** aplicar en `bnbtico-pruebas` la migración `20261023230813_fase3_consultas` del ticket 01 (si no se hizo ya) antes de desplegar.
