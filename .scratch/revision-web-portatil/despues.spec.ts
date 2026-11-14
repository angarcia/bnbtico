// Temporal, no se versiona: maqueta del «después» de la revisión de escritorio (.scratch/revision-web-portatil).
// Inyecta CSS y retoques de DOM solo en la captura; el código de la app no cambia.
// E2E_PORT=5173 OUT=... pnpm exec playwright test --config tests/capturas/config.ts despues
import { test, type Page, type Browser } from "@playwright/test";
import { anonClient, serviceClient, stepUp } from "../db/local";

const OUT = process.env.OUT ?? "/tmp/despues";
const CASA = process.env.CASA ?? "";

async function session(phone: string, admin = false) {
  const c = anonClient();
  for (let i = 0; i < 6; i++) { const r = await c.auth.signInWithOtp({ phone }); if (!r.error) break; await new Promise((res) => setTimeout(res, 1300)); }
  const v = await c.auth.verifyOtp({ phone, token: "123456", type: "sms" });
  if (v.error) throw v.error;
  if (admin) { await serviceClient().rpc("seed_admin", { p_phone: phone }); await stepUp(c); }
  return (await c.auth.getSession()).data.session;
}

async function ctx(browser: Browser, [w, h]: [number, number], sess: unknown, dark = false) {
  const c = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, isMobile: false, hasTouch: false, serviceWorkers: "block", colorScheme: dark ? "dark" : "light", locale: "es-CR" });
  const p = await c.newPage();
  p.setDefaultTimeout(6000);
  await p.goto("/robots.txt");
  await p.evaluate((s) => { localStorage.setItem("3bstays-correo-omitido", "1"); if (s) localStorage.setItem("3bstays-auth", JSON.stringify(s)); }, sess);
  return p;
}

/* Sistema común propuesto: marco, contenedor, barra, botones, superficies, pie. */
const SISTEMA = `
@media (min-width:1024px){
  :root{ --page-max:1232px; --measure:68ch; }
  .desktop-app > .desktop-nav{ padding-inline:max(var(--gutter), calc((100% - var(--page-max)) / 2)); }
  .desktop-app:not(:has(.explore-layout)) > main.view{ width:100%; max-width:var(--page-max); margin-inline:auto; padding-inline:0; }
  .desktop-nav .desktop-brand img{ height:34px !important; width:auto !important; }
  .desktop-nav .desktop-brand{ margin-right:28px; }
  .desktop-nav .nav{ color:var(--fg); }
  .desktop-nav .nav[aria-current="page"]{ background:var(--surface-2); color:var(--brand-ink); }
  .desktop-nav .currency-switch{ background:var(--surface-2); padding:3px; border-radius:10px; }
  .desktop-nav .currency-switch button{ min-height:36px; min-width:40px; border-radius:8px; color:var(--muted); background:transparent; }
  .desktop-nav .currency-switch button[aria-pressed="true"]{ background:var(--surface); color:var(--fg); font-weight:600; box-shadow:0 1px 2px rgb(0 0 0 / 12%); }
  .desktop-nav .desktop-inquiries{ display:inline-flex; gap:8px; padding:0 12px !important; }
  .desktop-nav .desktop-inquiries .mk-label{ font-weight:500; font-size:16px; }
  .btn-ghost{ background:transparent; box-shadow:none; border:1px solid color-mix(in srgb, var(--muted) 45%, transparent); color:var(--fg); }
  .btn:disabled, .btn[aria-disabled="true"]{ background:var(--surface-2) !important; color:var(--muted) !important; }
  .card, .listing-card, .house-card, .feature-tiles > div, .list{ box-shadow:none !important; }
  .card, .house-card, .list{ border:1px solid var(--line); }
  .mk-ph{ display:flex; align-items:flex-end; justify-content:space-between; gap:16px; margin:28px 0 20px; grid-column:1 / -1; }
  .mk-ph h1{ font-size:30px; line-height:1.15; margin:0; font-weight:600; letter-spacing:-.01em; color:var(--fg); }
  .mk-ph p{ margin:6px 0 0; color:var(--muted); font-size:15px; }
  .mk-ph .mk-actions{ display:flex; gap:10px; }
  .mk-ph .mk-actions .btn{ width:auto; min-height:44px; padding-inline:18px; }
  .mk-foot{ width:100%; align-self:stretch; box-sizing:border-box; max-width:var(--page-max); margin:56px auto 0; padding:20px 0 32px; border-top:1px solid var(--line); display:flex; flex-wrap:wrap; gap:8px 28px; align-items:center; color:var(--muted); font-size:14px; }
  .mk-foot img{ height:22px; width:auto; margin-right:8px; }
  .mk-foot span:last-child{ margin-left:auto; font-size:13px; }
}`;
const RELLENO = `.btn-primary{ background:var(--primary) !important; color:#fff !important; box-shadow:none !important; }`;

async function base(p: Page, opts: { foot?: boolean; relleno?: boolean } = {}) {
  await p.addStyleTag({ content: SISTEMA + (opts.relleno ? RELLENO : "") });
  await p.evaluate((foot) => {
    const inq = document.querySelector(".desktop-inquiries");
    if (inq && !inq.querySelector(".mk-label")) { const s = document.createElement("span"); s.className = "mk-label"; s.textContent = "Consultas"; inq.append(s); }
    if (foot && !document.querySelector(".mk-foot")) {
      const logo = document.querySelector<HTMLImageElement>(".desktop-brand img")?.src ?? "";
      const f = document.createElement("footer"); f.className = "mk-foot";
      f.innerHTML = `<img alt="3bstays" src="${logo}"><span>Qué es 3bstays</span><span>Términos y privacidad</span><span>Ayuda por WhatsApp</span><span>Mapas © colaboradores de OpenStreetMap</span>`;
      (document.querySelector(".app") ?? document.body).append(f);
    }
  }, !!opts.foot);
}

/** Cabecera de página: H1 + subtítulo + acciones (HTML). */
async function header(p: Page, sel: string, h1: string, sub: string, actions = "", where: "before" | "prepend" = "prepend") {
  await p.evaluate(({ sel, h1, sub, actions, where }) => {
    const host = document.querySelector(sel); if (!host) return;
    const h = document.createElement("header"); h.className = "mk-ph";
    h.innerHTML = `<div><h1>${h1}</h1>${sub ? `<p>${sub}</p>` : ""}</div><div class="mk-actions">${actions}</div>`;
    if (where === "before") host.before(h); else host.prepend(h);
  }, { sel, h1, sub, actions, where });
}

const shot = async (p: Page, name: string, full = false) => {
  await p.waitForTimeout(900);
  await p.screenshot({ path: `${OUT}/${name}.png`, fullPage: full });
  console.log("ok", name);
};
const go = async (p: Page, url: string) => { await p.goto(url); await p.waitForTimeout(2500); };

let NAV_ANON = "";

async function explorar(p: Page) {
  await base(p);
  await p.addStyleTag({ content: `
    .desktop-app .explore-results{ grid-auto-rows:auto; align-items:start; }
    .desktop-search-people .people-stepper b{ font:500 16px var(--body) !important; min-width:6ch; text-align:center; }
    .desktop-search-people .people-stepper button:disabled{ visibility:hidden; width:0; padding:0; }
    .explore-list-pane > .stack:first-child{ padding-top:6px; }
    .explore-list-pane > .stack:first-child b{ font-size:24px; font-weight:600; letter-spacing:-.01em; color:var(--fg); }
    .card-wa{ border:0 !important; background:transparent !important; box-shadow:none !important; }
    .listing-card .card-capacity{ display:block; }
  `});
  await p.evaluate(() => {
    const b = document.querySelector(".desktop-search-people .people-stepper b"); if (b && b.textContent?.trim() === "–") b.textContent = "Personas";
    const n = document.querySelector(".explore-list-pane > .stack:first-child b"); if (n) n.textContent = `${n.textContent} en Costa Rica`;
  });
}

async function ficha(p: Page) {
  await base(p, { foot: true });
  await p.addStyleTag({ content: `
    .mk-nav-wrap{ position:sticky; top:0; z-index:30; background:var(--bg); }
    .mk-nav-wrap .desktop-nav{ display:flex !important; position:static !important; height:72px; align-items:center; gap:8px; padding-inline:max(var(--gutter), calc((100% - var(--page-max)) / 2)); border-bottom:1px solid var(--line-nav); }
    .listing-view{ max-width:var(--page-max); margin-inline:auto; padding-top:20px; }
    .listing-view > .cta-bar{ top:92px !important; }
    .listing-view .hero .top a[aria-label="Volver a Explorar"]{ display:none; }
    .listing-head{ text-align:left !important; align-items:flex-start !important; }
    .listing-head > *{ justify-content:flex-start !important; text-align:left !important; }
    .listing-description{ max-width:var(--measure); }
    .feature-tiles{ display:grid !important; grid-template-columns:repeat(3, minmax(0,1fr)); gap:4px 24px !important; }
    .feature-tiles > div{ background:transparent !important; border:0 !important; min-height:0 !important; padding:8px 0 !important; flex-direction:row !important; justify-content:flex-start !important; gap:10px !important; text-align:left !important; }
    .feature-tiles > .tile-wide{ display:none !important; }
    .listing-calendar{ max-width:640px; }
    .listing-contact-inline .hint{ display:none; }
    .listing-contact-inline .consent + .consent{ display:none; }
    .listing-contact-inline .safety{ color:var(--fg) !important; }
    .mk-monthly{ display:block; margin-top:2px; font-size:15px; color:var(--muted); }
  `});
  await p.evaluate((nav) => {
    const app = document.querySelector(".app"); if (!app) return;
    const w = document.createElement("div"); w.className = "mk-nav-wrap desktop-app"; w.innerHTML = nav; app.before(w);
    for (const a of w.querySelectorAll(".nav[aria-current]")) a.removeAttribute("aria-current");
    const btn = document.querySelector(".listing-contact-inline .btn-wa"); const host = document.querySelector(".host-name")?.textContent ?? "el anfitrión";
    if (btn) { const t = [...btn.childNodes].reverse().find((n) => n.nodeType === 3); if (t) t.textContent = ` Escribir a ${host} por WhatsApp`; }
    const c = document.querySelector(".listing-contact-inline .consent"); if (c) c.textContent = `Primero confirmamos su número con un código. ${host} verá su nombre y su número.`;
    const s = document.querySelector(".listing-contact-inline .safety"); if (s) s.textContent = "3bstays no cobra ni procesa pagos: no envíe dinero antes de confirmar la casa.";
    for (const el of document.querySelectorAll(".listing-contact-inline .people-stepper *")) if (el.children.length === 0 && el.textContent?.trim() === "–" && el.tagName !== "BUTTON") el.textContent = "Opcional";
    const m = document.querySelector(".tile-wide .listing-monthly-crc")?.textContent;
    const prices = document.querySelector(".cta-prices"); if (m && prices) { const e = document.createElement("span"); e.className = "mk-monthly"; e.textContent = `Mensual: ${m}`; prices.append(e); }
  }, NAV_ANON);
}

async function ingresar(p: Page) {
  await p.addStyleTag({ content: `
    .whatsapp-dialog .publish-promo-row{ display:none !important; }
    .whatsapp-dialog .note{ border:0 !important; background:transparent !important; padding:0 !important; color:var(--muted); font-size:14px; }
    .whatsapp-dialog .note svg{ display:none; }
    .whatsapp-dialog .mk-logo{ height:30px !important; width:auto !important; max-width:none !important; object-fit:contain; display:block; margin-bottom:8px; }
  `});
  await p.evaluate(() => {
    const d = document.querySelector("dialog[open]"); if (!d) return;
    const hint = d.querySelector(".field .xs.muted"); if (hint) hint.textContent = "¿Su número no es de Costa Rica? Elija otro país en +506.";
    const n = d.querySelector(".note span"); if (n) n.textContent = "Su número solo se comparte con el anfitrión al que usted decida escribir. Explorar y guardar favoritos no necesita cuenta.";
    const logo = document.querySelector<HTMLImageElement>(".desktop-brand img");
    const title = d.querySelector(".flow-title"); if (logo && title && !d.querySelector(".mk-logo")) { const i = logo.cloneNode() as HTMLImageElement; i.className = "mk-logo"; i.removeAttribute("width"); i.removeAttribute("height"); title.before(i); }
    const btn = d.querySelector(".btn-primary") as HTMLElement | null; if (btn) btn.blur();
  });
}

async function misCasas(p: Page, relleno = false) {
  await base(p, { foot: true, relleno });
  await p.addStyleTag({ content: `
    .my-houses-summary{ display:none !important; }
    .desktop-app .house-list{ grid-template-columns:repeat(3, minmax(0,1fr)) !important; align-items:stretch !important; gap:20px !important; }
    .house-card{ display:flex !important; flex-direction:column; }
    .house-card .house-photo{ aspect-ratio:4 / 3 !important; height:auto !important; }
    .house-card .house-actions, .house-card > .row.gap-8{ margin-top:auto; }
    .house-tool{ width:auto !important; display:inline-flex !important; gap:6px; align-items:center; padding:0 6px; font-size:15px; color:var(--primary); }
    .house-tools{ gap:12px !important; }
    .house-card .house-actions{ display:flex !important; flex-wrap:nowrap !important; align-items:center; justify-content:space-between; gap:8px; }
    .house-card .house-actions .house-share{ width:auto !important; flex:none; }
  `});
  await p.evaluate(() => {
    for (const t of document.querySelectorAll(".house-tool")) { const s = document.createElement("span"); s.textContent = t.getAttribute("aria-label") ?? ""; t.append(s); }
  });
  const sub = await p.evaluate(() => [...document.querySelectorAll(".my-houses-summary .tile")].map((t) => t.textContent?.replace(/(\d+)/, "$1 ").replace(/\s+/g, " ").trim()).join(" · "));
  const href = await p.evaluate(() => document.querySelector(".new-house")?.getAttribute("href") ?? "#");
  await header(p, "main.view", "Mis casas", sub, `<a class="btn btn-primary" href="${href}">+ Añadir casa</a>`);
}

async function detalle(p: Page) {
  await base(p, { foot: true });
  await p.addStyleTag({ content: `
    .owner-house-detail > .float-btn{ display:none !important; }
    .owner-house-detail > .header-flow{ margin:20px 0 16px !important; }
    .owner-house-detail > .header-flow h1{ font-size:30px; font-weight:600; }
    .owner-house-detail > .header-flow .mk-actions{ margin-left:auto; display:flex; gap:10px; }
    .owner-house-detail > .header-flow .mk-actions .btn{ width:auto; min-height:44px; padding-inline:16px; }
    .owner-detail-summary > .stack.gap-8:has(.btn-block){ display:none; }
    .listing-stats{ background:transparent !important; border:1px solid var(--line); }
    .house-field .account-profile-toggle{ color:var(--primary); font-weight:500; }
  `});
  await p.evaluate(() => {
    const h = document.querySelector(".owner-house-detail > .header-flow"); if (!h) return;
    const ver = document.querySelector(".owner-house-detail > .float-btn") as HTMLAnchorElement | null;
    const box = document.createElement("div"); box.className = "mk-actions";
    box.innerHTML = `<a class="btn btn-ghost" href="${ver?.getAttribute("href") ?? "#"}">Ver ficha</a><button class="btn btn-primary">Compartir ficha</button>`;
    h.append(box);
    for (const s of document.querySelectorAll(".activity-figures span")) if (s.textContent === "toques en WhatsApp") s.textContent = "clics en WhatsApp";
  });
}

async function calendario(p: Page) {
  await base(p, { foot: true });
  await p.addStyleTag({ content: `
    .owner-calendar .cal-hint-row p{ display:none; }
    .owner-calendar-days > .cal-weekdays{ display:none !important; }
    .owner-calendar .cal-month-title{ position:static !important; font-size:21px; font-weight:600; margin:8px 0 6px; }
    .owner-calendar .mk-wd{ position:static !important; margin-bottom:6px; }
    .owner-calendar .month-grid .day{ min-height:64px !important; height:64px !important; }
    .owner-calendar .month-grid .day.is-past{ opacity:1 !important; background:transparent !important; color:var(--muted); }
    .owner-calendar .month-grid .day.is-past .day-sub, .owner-calendar .month-grid .day .day-sub.mk-base{ display:none; }
    .owner-calendar .cal-months{ display:grid; gap:24px; }
    .owner-calendar .month-legend{ gap:18px; }
    .owner-calendar .month-legend .swatch{ width:16px !important; height:16px !important; border:1.5px solid color-mix(in srgb, var(--primary) 45%, var(--bg)); }
    .owner-calendar .month-legend .swatch.is-busy{ border-color:var(--cal-busy-ink, #9A4B2A); }
    .mk-base-line{ font-size:15px; color:var(--muted); margin:0; }
  `});
  await p.evaluate(() => {
    const wd = document.querySelector(".owner-calendar-days > .cal-weekdays");
    for (const t of document.querySelectorAll(".cal-month-title")) { if (wd) { const c = wd.cloneNode(true) as HTMLElement; c.classList.add("mk-wd"); c.classList.remove("cal-weekdays"); t.after(c); } }
    const subs = [...document.querySelectorAll(".month-grid .day:not(.is-past) .day-sub")];
    const freq = new Map<string, number>(); for (const s of subs) freq.set(s.textContent ?? "", (freq.get(s.textContent ?? "") ?? 0) + 1);
    const baseP = [...freq.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? "";
    for (const s of subs) if (s.textContent === baseP) s.classList.add("mk-base");
    const legend = document.querySelector(".owner-calendar .month-legend");
    if (legend && baseP) { const l = document.createElement("p"); l.className = "mk-base-line"; l.textContent = `Precio base ${baseP} por noche. En el día solo se muestra si cambia.`; legend.after(l); }
  });
  await header(p, "main.view", "Calendario", "Elija una o varias noches para marcarlas ocupadas o cambiar su precio.");
}

async function cuenta(p: Page) {
  await base(p, { foot: true });
  await p.addStyleTag({ content: `
    .owner-account-layout h2, .owner-account-layout .card > .row.between h3, .owner-account-layout .card-title{ font-size:21px !important; font-weight:600; margin:0; }
    .sub-price b{ font-size:17px !important; }
    .sub-stop{ color:var(--brand-ink) !important; text-decoration:none !important; align-self:flex-start; padding-inline:0 !important; }
    .account-foot span:nth-child(2){ display:none; }
    .account-foot{ align-items:flex-start !important; text-align:left !important; }
    .logout-link{ border:1px solid color-mix(in srgb, var(--muted) 45%, transparent) !important; border-radius:var(--r-input); padding:10px 16px !important; color:var(--fg) !important; }
  `});
  await p.evaluate(() => { const h = document.querySelector(".owner-account-layout > div:nth-child(2) > h2"); if (h) h.textContent = "Suscripción"; });
  await header(p, ".owner-account-layout", "Cuenta", "Su perfil y la suscripción de cada casa.", "", "before");
}

async function adminNav(p: Page, current: string) {
  await p.evaluate(({ nav, current }) => {
    const app = document.querySelector(".app"); if (!app) return;
    app.classList.add("desktop-app");
    const w = document.createElement("div"); w.innerHTML = nav; const n = w.firstElementChild as HTMLElement;
    const brand = n.querySelector(".desktop-brand")!; const keep = brand.cloneNode(true) as HTMLElement;
    n.innerHTML = ""; n.append(keep);
    for (const label of ["Anuncios", "Casas", "Borradores", "Usuarios", "Cuenta"]) {
      const a = document.createElement("a"); a.className = "nav"; a.innerHTML = `<span>${label}</span>`; if (label === current) a.setAttribute("aria-current", "page"); n.append(a);
    }
    const site = document.createElement("a"); site.className = "nav desktop-help"; site.style.marginLeft = "auto"; site.innerHTML = "<span>Ver el sitio</span>"; n.append(site);
    app.prepend(n);
    for (const t of document.querySelectorAll(".app > nav.tabbar:not(.desktop-nav), nav.tabbar:not(.desktop-nav)")) (t as HTMLElement).style.display = "none";
  }, { nav: NAV_ANON, current });
  await p.addStyleTag({ content: `.app.desktop-app{ --desktop-nav-height:72px; } .desktop-app > .desktop-nav{ display:flex !important; align-items:center; } .app > .view.no-nav, .app > .view{ padding-bottom:24px !important; }` });
}

async function revisar(p: Page) {
  await adminNav(p, "Anuncios");
  await base(p);
  await p.addStyleTag({ content: `
    .app > main.view.no-nav{ display:grid !important; grid-template-columns:minmax(0,1fr) 400px; column-gap:32px; align-items:start; max-width:var(--page-max); margin-inline:auto; width:100%; }
    .app > main.view > *{ grid-column:1; }
    .app > main.view > .header-flow{ grid-column:1 / -1; margin:20px 0 12px !important; }
    .app > main.view > .header-flow h1{ font-size:30px; font-weight:600; }
    .app > main.view > form{ grid-column:2; grid-row:2 / span 8; position:sticky; top:92px; background:var(--surface); border:1px solid var(--line); border-radius:var(--r-sheet); padding:20px; }
    .app > main.view > form::before{ content:"Decisión"; font-weight:600; font-size:21px; }
    .review-spacer{ display:none !important; }
    .review-actions{ position:static !important; transform:none !important; max-width:none !important; padding:0 !important; display:grid !important; gap:8px; background:transparent !important; }
    .review-actions .row{ display:grid !important; grid-template-columns:1fr 1fr; }
    .btn-outline-bad{ background:transparent !important; border:0 !important; color:var(--brand-ink) !important; box-shadow:none !important; }
    .photo-strip{ display:grid !important; grid-template-columns:2fr 1fr; gap:8px; }
    .photo-strip .photo{ width:100% !important; height:auto !important; aspect-ratio:4 / 3; }
    .review-owner{ border:1px solid var(--line); }
  `});
}

async function anuncios(p: Page) {
  await adminNav(p, "Anuncios");
  await base(p);
  await p.addStyleTag({ content: `.app > main.view{ max-width:var(--page-max); margin-inline:auto; width:100%; } .app > main.view header h1{ font-size:30px; font-weight:600; } .app > main.view > header .badge, .app > main.view > header img{ display:none; } .mk-hidden{ display:none !important; } .mk-sub{ margin:6px 0 20px; color:var(--muted); font-size:15px; }` });
  await p.evaluate(() => {
    const tile = document.querySelector("main.view .tile"); if (!tile) return;
    let row = tile.parentElement!; while (row.parentElement && !row.parentElement.matches("main.view")) row = row.parentElement;
    const txt = [...row.querySelectorAll(".tile")].map((t) => t.textContent?.replace(/(\d+)/, "$1 ").replace(/\s+/g, " ").trim()).join(" · ");
    row.classList.add("mk-hidden");
    const sub = document.createElement("p"); sub.className = "mk-sub"; sub.textContent = txt; row.before(sub);
  });
}

test("despues", async ({ browser }) => {
  test.setTimeout(900_000);
  const owner = await session("+50688000001");
  const admin = await session("+50688990001", true);
  const only = process.env.ONLY ?? "";
  const run = (n: string) => !only || only.split(",").includes(n);

  for (const [size, tag] of [[[1440, 900], "1440"], [[1280, 800], "1280"]] as const) {
    const sz = size as unknown as [number, number];
    if (process.env.SIZE && process.env.SIZE !== tag) continue;
    const a = await ctx(browser, sz, null);
    await go(a, "/explorar");
    NAV_ANON = await a.evaluate(() => document.querySelector(".desktop-nav")!.outerHTML);
    if (run("explorar")) { await shot(a, `${tag}-explorar-antes`); await explorar(a); await shot(a, `${tag}-explorar-despues`); }
    if (run("ingresar")) {
      await go(a, "/explorar"); await a.getByRole("button", { name: "Ingresar" }).first().click(); await shot(a, `${tag}-ingresar-antes`);
      await base(a); await ingresar(a); await shot(a, `${tag}-ingresar-despues`);
      await a.addStyleTag({ content: RELLENO }); await shot(a, `${tag}-ingresar-despues-relleno`);
    }
    if (run("ficha")) { await go(a, "/casa/CT-12013"); await shot(a, `${tag}-ficha-antes`); await ficha(a); await a.evaluate(() => scrollTo(0, 0)); await shot(a, `${tag}-ficha-despues`); await shot(a, `${tag}-ficha-despues-completa`, true); }
    await a.context().close();

    const o = await ctx(browser, sz, owner);
    if (run("casas")) {
      await go(o, "/propietario/casas"); await shot(o, `${tag}-mis-casas-antes`); await misCasas(o); await shot(o, `${tag}-mis-casas-despues`);
      if (tag === "1440") { await go(o, "/propietario/casas"); await misCasas(o, true); await shot(o, `${tag}-mis-casas-despues-relleno`); }
    }
    if (run("detalle")) { await go(o, `/propietario/casas/${CASA}`); await shot(o, `${tag}-detalle-antes`); await detalle(o); await shot(o, `${tag}-detalle-despues`); }
    if (run("calendario")) { await go(o, "/propietario/calendario"); await shot(o, `${tag}-calendario-antes`); await calendario(o); await o.evaluate(() => scrollTo(0, 0)); await shot(o, `${tag}-calendario-despues`); }
    if (run("cuenta")) { await go(o, "/cuenta"); await shot(o, `${tag}-cuenta-antes`); await cuenta(o); await shot(o, `${tag}-cuenta-despues`); }
    await o.context().close();

    const ad = await ctx(browser, sz, admin);
    if (run("admin")) {
      await go(ad, "/admin"); await shot(ad, `${tag}-admin-anuncios-antes`); await anuncios(ad); await shot(ad, `${tag}-admin-anuncios-despues`);
      await go(ad, "/admin"); await ad.locator("a[href*='/admin/anuncios/']").first().click(); await ad.waitForTimeout(2500);
      await shot(ad, `${tag}-admin-revisar-antes`); await revisar(ad); await shot(ad, `${tag}-admin-revisar-despues`);
    }
    await ad.context().close();
  }

  if (run("oscuro")) {
    const a = await ctx(browser, [1440, 900], null, true);
    await go(a, "/casa/CT-12013"); await shot(a, `1440-oscuro-ficha-antes`); await ficha(a); await a.evaluate(() => scrollTo(0, 0)); await shot(a, `1440-oscuro-ficha-despues`);
    await a.context().close();
    const o = await ctx(browser, [1440, 900], owner, true);
    await go(o, "/propietario/casas"); await shot(o, `1440-oscuro-mis-casas-antes`); await misCasas(o); await shot(o, `1440-oscuro-mis-casas-despues`);
    await go(o, "/propietario/calendario"); await shot(o, `1440-oscuro-calendario-antes`); await calendario(o); await o.evaluate(() => scrollTo(0, 0)); await shot(o, `1440-oscuro-calendario-despues`);
    await o.context().close();
  }
});
