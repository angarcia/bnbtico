# 03: Account required to contact; back to the sheet with what was written

**What to build:** without a session, «Abrir WhatsApp» keeps the draft and sends the client through Ingresar / Crear cuenta (`/cuenta?next=/casa/CT-####?contacto=1`), and after the code they land on the listing with the sheet open and the same dates, people and message. The code screen's card «recordando a qué casa vuelve» (design 07) shows the house. Spec § Listing page.

**Blocked by:** 02

**Status:** done

- [x] Session state on the SSR listing read after hydration from storage without loading supabase-js when there is no stored session (as `src/client/session.ts`).
- [x] Signed out: «Abrir WhatsApp» saves the draft (`open: true`) and navigates (full navigation from SSR, router navigation from the SPA) to the account flow with `next` built through `safeNext`; the sheet's copy under the button for signed-out users: «Para escribirle necesita verificar su WhatsApp con un código. Lo que escribió se guarda.».
- [x] Ingresar/Crear cuenta and Código: card «Vuelve a <casa>» (photo thumbnail, title) when `next` is a listing; new account path through `/cuenta/lista` keeps `next`.
- [x] Return: the SPA listing route opens the sheet when `contacto=1` and a draft exists, then removes the parameter with `replace`; without a draft it just shows the listing. Expired draft (> 30 min) → sheet with the composed default.
- [x] Country selector unchanged (any country).
- [x] Playwright: signed out → sheet → write → Abrir WhatsApp → Ingresar with `+50688881234` → code → back with the same text and the sheet open; new account variant with a fresh test number; foreign number (`+1 415 555 0100`). Gates green.

## Cierre (2026-10-23)

- **Dominio** `src/domain/contact-return.ts` (aparte de `inquiry.ts` para no meterlo en el JS inicial): `contactDraftKey` (movida aquí; `inquiry.ts` la reexporta), `contactNext`, `signInToContact` (pasa por `safeNext`), `listingInNext`, `shouldReopenContact`. `storage.ts` gana `hasStoredSession()` (la usa también `client/session.ts`).
- **`proceedToWhatsApp`** (`src/shared/contact-flow.ts`): sin sesión → `ctx.navigate("/cuenta?next=%2Fcasa%2FCT-####%3Fcontacto%3D1")` y `leaving` (navegación completa en la ficha SSR, router en la SPA). Sesión = `bnbtico-auth` guardado (sin supabase-js si no hay); si lo hay, la confirma `authApi().session()` de `client/supabase-data` (mismo cliente que la cuenta y que el ticket 04). Con sesión sigue `soon`. `signedIn` inyectable para las pruebas. Importar `client/session` aquí partía ese módulo en un trozo propio (+0,9 KB en la zona privada): descartado.
- **Hoja:** sin sesión guardada, bajo el botón «Para escribirle necesita verificar su WhatsApp con un código. Lo que escribió se guarda.» (además de la línea de consentimiento).
- **Vuelta:** la ruta `/casa/$publicId` valida `contacto=1`; `CasaScreen` decide una vez (`shouldReopenContact` con sessionStorage) y quita el parámetro con `replace`; `ListingScreen` → `ListingPage` → `ContactButton` reciben `openContact` (estado inicial de la hoja). Borrador caducado → la hoja empieza de cero (lo hace `restoreContactDraft`).
- **Cuenta:** `ReturnCard` en Código e Ingresar cuando `next` es una ficha (foto 56 px con `Picture` y `listingQuery`, «Después de verificar vuelve a <casa> con su consulta tal como la dejó.», como el diseño 07); otros `next` conservan «Después de verificar vuelve adonde estaba.» en Código. «Volver» en Ingresar va a la ficha. `/cuenta/lista`: «Ahora no · continuar» y el salto con correo navegan con `href` (con `to` un `next` con búsqueda se rompía). Selector de país sin cambios.
- **Pruebas:** unitarias **514/514** (nueva `contact-return.test.ts`, 6). Base **143/143**. Playwright **66/66 + 2 omitidas** (nuevo `contacto-cuenta.spec.ts`, 4: ficha SSR sin sesión → Ingresar con 8888 1234 → código → de vuelta con fechas, personas y texto, sin descargar supabase-js antes de salir; SPA → Crear cuenta con 8888 9999 recién borrado → «¡Listo!» → continuar; +1 415 555 0100 con el borrador envejecido 31 min → mensaje por defecto; sin borrador y cuenta con correo → solo la ficha). `contacto.spec.ts` inyecta sesión donde espera «Disponible muy pronto». Sin números nuevos en `config.toml`. Capturas revisadas en Pixel 7: `contacto-sin-sesion.png`, `contacto-ingresar.png`, `contacto-codigo.png`, `contacto-vuelta.png`.
- **Tamaños (gz, comparados con un build de `30cf6f2`):** zona privada **134,36 → 134,75 KB**; hoja **3,81 → 4,22 / 5 KB**; grafo estático de la ficha SSR **90,60 → 90,72 KB (+0,12)**; pestañas 14,90 / 18 KB.
- **Lighthouse (mediana de 3):** ficha en frío LCP **1,61 s** (100 puntos, TBT 0, CLS 0); shell instalado **0,51 s**. Sin cambio.
- **Para el ticket 04:** en la ficha SSR una sesión guardada pero revocada cuenta como «sin sesión» solo si supabase-js no la puede leer; si la RPC responde «Ingrese con su WhatsApp…», conviene llevar a Ingresar igual (`signInToContact`).
- Sin migraciones. **Para Daniel:** nada (desplegable junto con 02 y 04).
