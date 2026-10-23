# 12: Lighthouse gate and parity run

**What to build:** the pipeline refuses performance regressions, and the new app is shown to match the old one on every flow before the DNS moves: the full ported Playwright suite is green in CI, Lighthouse CI gates the listing page and the installed shell, the manual plan is executed from a phone against `nueva.bnbtico.com`, and a WhatsApp preview is checked.

**Blocked by:** 07 (Publish wizard), 08 (Photos), 09 (Admin with MFA), 10 (Service worker), 11 (Hardening and telemetry).

**Status:** ready-for-human

**Manual step (Daniel):** run `docs/pruebas-manuales-fase-r.md` (replaces the phase-2 plan for the new app) from your phone against `nueva.bnbtico.com` and share one listing link to yourself on WhatsApp; report what fails.

- [x] Lighthouse CI in the pipeline with the mobile profile, 4x CPU slowdown and 150 ms RTT; gates LCP under 2.0 s on a listing page and under 2.5 s on the installed shell; results posted on the pull request.
- [x] Full Playwright suite (account, wizard with photos, admin, public listing, Explorar and filters, owner detail) green in CI against local Supabase, one worker.
- [x] The 20 database tests plus the new ones green; the contract suite green on both adapters.
- [ ] Findings from the manual plan fixed or ticketed; the WhatsApp preview shows cover and title.
- [x] Measured values recorded: bundle size, Lighthouse numbers, DevTools-throttled timings for the six budgets.

## Cierre (2026-10-23)

- **Puerta de Lighthouse** (`pnpm lighthouse` = `playwright test -c playwright.lighthouse.config.ts`, `tests/lighthouse/lighthouse.spec.ts`; devDependency `lighthouse` 13.5.0 con su API de Node). Mismo build local y `vite preview` que la e2e, Supabase local sembrado: una casa activa con 5 fotos y 7 más, todas con las tres variantes subidas de verdad a Storage local (`tests/e2e/helpers/real-photos.ts`). Perfil móvil por defecto de Lighthouse (RTT 150 ms, 1,6 Mbit/s, CPU 4×), **throttling devtools** (elegido: el simulado modela como red lo que sirve el service worker; con él el shell daba 0,65 s y la ficha 2,06 s), teselas de OSM bloqueadas, mediana de 3. Ficha en frío (Lighthouse borra caché y almacenamiento) → calentamiento con Playwright en el mismo perfil (contexto persistente = contexto por defecto, que es el que ve Lighthouse por el puerto de depuración): SW activo y caché de Query en IndexedDB → shell `/explorar` sin borrar nada (documento y JS servidos por el SW, `transferSize` 0). Delante del preview, un proxy gzip (`tests/lighthouse/gzip-proxy.ts`): miniflare no comprime y el JS pesaba 279 KB en vez de 88 KB.
- **CI** (`.github/workflows/app.yml`): paso tras la e2e con el Google Chrome del runner; tabla en el resumen del job, informes HTML en el artefacto «lighthouse» y comentario en el pull request (con marca propia; el de la vista previa también pasa a marca, porque `--edit-last` habría pisado uno con otro). La puerta va antes del despliegue: si falla en el runner, no se despliega. **Sin ejecutar todavía en GitHub** (no hay push): la primera vuelta dirá cuánto se aleja el runner del Mac.
- **Arreglo para pasar la puerta:** fuera la precarga de las dos fuentes en `index.html` (font-display swap con respaldo de métricas ajustadas, CLS 0): competían con la portada. Ficha 2,44 s → 1,92 s. Probé también diferir las fotos 2–5 de la tira y `fetchpriority="low"` en el script: sin efecto medible, descartados.
- **`admin.spec.ts:109` intermitente — causa:** GoTrue admite un reto MFA por factor y segundo (`max_frequency`). La primera prueba de admin puede terminar en menos de un segundo desde su reto, y el reto de la segunda recibía 429 `over_sms_send_rate_limit` «after 0 seconds» (visto en los logs de `supabase_auth_bnbtico` y en la captura: «Espere un momento antes de pedir otro código.» con el botón «Enviando el código…» deshabilitado para siempre). Era un fallo de la app: la pantalla quedaba atascada. Arreglo: `DomainError.retryAfterSeconds` (lo rellena `toDomainError` con el «after N seconds» de GoTrue) y `sendSecondCode` espera lo que pide el servidor y reintenta una vez si son ≤ 5 s; el botón ya no dice «Enviando…» tras un error. Prueba nueva determinista en `admin.spec.ts` (el primer reto responde 429 con `page.route`) y unitaria en `errors-rows.test.ts`. Antes del arreglo la suite completa falló así en la primera pasada de hoy.
- **Workflows:** `vars.X || secrets.X` también para `WA_OWNERS`, `WA_GUESTS`, `TURNSTILE_SITE_KEY` (app.yml) y `R2_BUCKET`, `BACKUP_PREFIX` (backup.yml, con su valor por defecto detrás). YAML válido (`ruby -ryaml`); revisado a mano (sin actionlint).
- **Baterías:** `typecheck` y `build` en verde; unitarias **387/387**; base **115/115** (contrato de los cinco módulos contra PostgREST; contra el fake en las unitarias); Playwright **45/45 + 2 omitidas (medición)** en **tres pasadas completas seguidas** (1,4 min cada una); Lighthouse 1/1.
- **Tamaños (size-limit, gz):** zona privada JS inicial **141,69 KB** / 150; asistente 9,89 / 15; admin 6,59 / 12; Web Vitals 3,15 / 5; `/sw.js` 1,83 / 4.
- **Lighthouse en local** (Mac, Chrome, mediana de 3): ficha `/casa/CT-…` en frío **LCP 1,92 s** (1,94 · 1,90 · 1,92; FCP 1,37 s, TBT 0, CLS 0, SI 1,73 s, 99 puntos); shell instalado `/explorar` **LCP 0,24 s** (FCP 0,17 s, 100 puntos).
- **Presupuestos con DevTools «Slow 4G» + CPU 4× por CDP** (`MEDIR=1 pnpm test:e2e tests/e2e/medicion.spec.ts`, ahora con un segundo test; mismo proxy gzip). **Son locales (Mac + vite preview), no un teléfono en Costa Rica;** los reales saldrán de `web_vitals`.
  | Presupuesto (CLAUDE.md) | Medido | Cómo |
  |---|---|---|
  | Toque < 50 ms | 48 ms el primero, luego 16 ms (umbral mínimo de Event Timing) | «Ver en dólares» en la ficha hidratada, Event Timing |
  | Pantalla visitada < 100 ms sin red | mediana 22 ms, p75 25 ms | Explorar → Filtros sin red, del toque al fotograma |
  | Pantalla nueva con sesión < 300 ms | mediana 57 ms, p75 64 ms | Inicio → Mis casas (primera visita; los datos ya los trajo Inicio, misma consulta) |
  | Ficha LCP < 1,5 s | mediana 1,97 s, p75 2,00 s | 5 cargas en frío; Slow 4G (562 ms por petición) es más duro que el 4G real |
  | PWA instalada < 500 ms | mediana 191 ms, p75 197 ms | apertura con SW hasta Explorar interactivo, 7 aperturas |
  | JS privado < 150 KB gz | 141,69 KB | size-limit |
- **Plan de pruebas manual único:** `docs/pruebas-manuales-fase-r.md` (A: acciones previas en orden con qué bloquea cada una y efectos sobre `pruebas.bnbtico.com`; B: 24 recorridos con casilla; C: qué reportar). No se añadió a CLAUDE.md (no se toca). **Hallazgo al redactarlo:** el segundo código del admin no puede probarse con `8899 0001` en el alojado: los códigos fijos solo valen para ingresar y Twilio enviaría el reto de verdad a ese número ajeno. El plan usa la cuenta real de Daniel marcada con `seed_admin`.
- **Sin migraciones.** Dependencia nueva: `lighthouse` (devDependency, permitida por el ticket).
- **Pendiente de Daniel (sin [x]):** ejecutar `docs/pruebas-manuales-fase-r.md` en `nueva.bnbtico.com` tras las acciones de su parte A (migraciones 07–11, MFA, Vault, bypass de Access, Turnstile, etc.) y comprobar la vista previa de WhatsApp de CT-1015 (B2); reportar fallos.
