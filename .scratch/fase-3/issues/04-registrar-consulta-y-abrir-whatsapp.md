# 04: Register the inquiry and open WhatsApp with the house's number

**What to build:** with a session, «Abrir WhatsApp» calls `InquiriesApi.create` and, on success, opens `https://wa.me/<house digits>?text=<message>` in the same tab; on error, shows the DB message and opens nothing. Spec § Listing page («Opening WhatsApp»).

**Blocked by:** 03

**Status:** done

- [x] Immediate pressed/loading state (< 50 ms), single flight (double tap does not create two calls), DB message in the sheet on error («Esta es su propia casa.», not available, rate limit, offline «Sin conexión…»).
- [x] `location.assign(waUrl(phone, message))` after the RPC; the draft is cleared on success; returning to the app (back) shows the listing with the sheet closed.
- [x] Number never present in SSR HTML, public view, persisted Query cache or logs; the RPC result is not cached.
- [x] Event `inquiry_created` (listing id only) via `/events`; the worker accepts the new type (worker seam test).
- [x] An inquiry for a house with a different `whatsapp_phone` than the owner's profile routes to the house's number (seed it with the service role in the test).
- [x] Playwright: signed-in client contacts → intercepted `wa.me` URL is exactly the expected number and encoded text; row exists in the DB with dates/people/message; repeat within 7 days updates the same row; owner on own house sees the refusal; unavailable house cannot be contacted even by forcing the RPC (contract already covers it). Gates green.

## Cierre (2026-10-23)

- **`proceedToWhatsApp`** (`src/shared/contact-flow.ts`, trozo de la hoja): sin `bnbtico-auth` guardado → Ingresar (como en el 03); con él, `InquiriesApi.create` (nuevo `inquiriesApi()` en `client/supabase-data`, trozo diferido) → baliza `inquiry_created` (solo la casa) → `location.assign(waUrl(número, mensaje))` → `{ kind: "sent" }`. Error de la base (`DomainError`): su mensaje; sesión vencida o «Ingrese con su WhatsApp…» → Ingresar con la vuelta a la hoja (lo escrito queda); cualquier otro error (trozo o red) → «Sin conexión. Revise su internet e intente de nuevo.». Ya no se llama antes a `authApi().session()`: la RPC (y el `getSession` del adaptador, que refresca) basta, una petición menos. `create`, `open`, `created` y `hasSession` inyectables.
- **Hoja:** un solo vuelo con `useRef` (el estado de React llega tarde para un doble toque); «Abriendo WhatsApp…» con `aria-busy` y `.btn-wa.is-sending` en el mismo evento; al registrar se borra el borrador y se cierra la hoja antes de salir, así al volver (atrás, bfcache o desde la app de WhatsApp) se ve la ficha sin la hoja. Fuera el estado «Disponible muy pronto».
- **Número:** solo vive en la variable de la función; ni Query, ni pestaña, ni balizas, ni consola. Playwright comprueba que no está en el HTML SSR ni en localStorage, sessionStorage e IndexedDB tras contactar.
- **Pruebas:** unitarias **527/527** (`contact-return.test.ts`: con sesión abre la URL exacta, error de la base, sin red, sesión vencida y «Ingrese…»). La costura del worker para `inquiry_created` ya estaba (ticket 01). Base **144/144**. Playwright **74/74 + 2 omitidas**: nuevo `contacto-whatsapp.spec.ts` (5: toque < 50 ms con «Abriendo…», doble toque y otro toque en espera → una sola RPC, wa.me exacto, fila con fechas/personas/mensaje, baliza, atrás con la hoja cerrada y sin borrador, repetir renueva la misma fila; casa con `whatsapp_phone` distinto puesto por el servicio → ese número, desde la SPA; propietario en su casa «Esta es su propia casa.» y sin red «Sin conexión…»; casa que deja de estar disponible con la hoja abierta → mensaje de la base; PGRST303 → Ingresar con lo escrito). `contacto.spec.ts` y `contacto-cuenta.spec.ts` sin «muy pronto»: la vuelta tras el código acaba en wa.me exacto y atrás. Ayudante `helpers/whatsapp.ts` (`page.route("https://wa.me/**")`); la CSP vigilada en todas, sin violaciones. Sin SMS nuevos salvo los que ya mandaba `contacto-cuenta`. Capturas Pixel 7 revisadas: `contacto-abriendo.png`, `contacto-propia.png`, `contacto-error-base.png`.
- **Tamaños (gz, contra un build de `a23bf18`):** zona privada inicial **135,89 → 136,07 KB**; hoja **4,21 → 4,45 / 5 KB** (sin subir el límite); grafo estático de la ficha SSR **91 502 → 91 527 B (+25 B)**.
- **Lighthouse (mediana de 3):** ficha en frío LCP **1,60 s** (100 puntos, TBT 0, CLS 0); shell instalado **0,52 s**. Sin cambio.
- Sin migraciones. **Para Daniel:** aplicar en `bnbtico-pruebas` la migración `20261023230813_fase3_consultas` del ticket 01 antes de desplegar 02–04 (sin ella, con sesión «Abrir WhatsApp» falla).
