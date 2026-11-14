// Temporal, no se versiona: capturas de escritorio para la revisión de diseño (.scratch/revision-web-portatil).
// E2E_PORT=5173 OUT=... pnpm exec playwright test --config tests/capturas/config.ts revision-escritorio
import { test, type Page, type Browser } from "@playwright/test";
import { anonClient, serviceClient, stepUp } from "../db/local";

const OUT = process.env.OUT ?? "/tmp/rev";
const SIZES = (process.env.SIZES ?? "1440x900,1280x800").split(",").map((s) => s.split("x").map(Number) as [number, number]);
const ONLY = process.env.ONLY ?? "";

async function session(phone: string, admin = false) {
  const c = anonClient();
  for (let i = 0; i < 6; i++) {
    const r = await c.auth.signInWithOtp({ phone, options: { shouldCreateUser: true } });
    if (!r.error) break;
    await new Promise((res) => setTimeout(res, 1300));
  }
  const v = await c.auth.verifyOtp({ phone, token: "123456", type: "sms" });
  if (v.error) throw v.error;
  if (admin) {
    await serviceClient().rpc("seed_admin", { p_phone: phone });
    await stepUp(c);
  }
  return (await c.auth.getSession()).data.session;
}

async function ctxFor(browser: Browser, [w, h]: [number, number], sess: unknown, dark = false) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1, serviceWorkers: "block", colorScheme: dark ? "dark" : "light", locale: "es-CR" });
  const p = await ctx.newPage();
  p.setDefaultTimeout(5000);
  p.setDefaultNavigationTimeout(20000);
  await p.goto("/robots.txt");
  await p.evaluate((s) => {
    localStorage.setItem("3bstays-correo-omitido", "1");
    if (s) localStorage.setItem("3bstays-auth", JSON.stringify(s));
  }, sess);
  return p;
}

function shooter(p: Page, tag: string) {
  return async (name: string, fn?: () => Promise<unknown>, opts: { full?: boolean; wait?: number } = {}) => {
    if (ONLY && !name.includes(ONLY)) return;
    try {
      if (fn) await fn();
      await p.waitForTimeout(opts.wait ?? 1400);
      await p.screenshot({ path: `${OUT}/${tag}-${name}.png`, fullPage: !!opts.full });
      console.log("ok", tag, name);
    } catch (e) {
      console.log("FALLO", tag, name, String(e).split("\n")[0]);
      await p.screenshot({ path: `${OUT}/${tag}-${name}-FALLO.png` }).catch(() => {});
    }
  };
}

const go = (p: Page, url: string) => p.goto(url, { waitUntil: "load" });


test("anonimo", async ({ browser }) => {
  test.setTimeout(600_000);
  for (const size of SIZES) {
    for (const dark of [false, true]) {
      if (dark && size[0] !== 1440) continue;
      const p = await ctxFor(browser, size, null, dark);
      const tag = `${size[0]}${dark ? "-oscuro" : ""}`;
      const s = shooter(p, tag);
      await s("01-explorar", () => go(p, "/explorar"), { wait: 2500 });
      if (dark) {
        await s("05-ficha", () => go(p, "/casa/CT-12013"), { wait: 2500 });
        await s("12-que-es", () => go(p, "/que-es-3bstays"));
        await p.context().close();
        continue;
      }
      await s("01b-explorar-scroll", () => p.mouse.wheel(0, 900).then(() => p.mouse.move(1000, 500)), { wait: 800 });
      await s("02-explorar-lugar", async () => { await go(p, "/explorar"); await p.waitForTimeout(1500); await p.getByRole("button", { name: /Lugar/ }).first().click(); });
      await s("02b-explorar-lugar-escrito", async () => { await p.keyboard.type("Cocl"); }, { wait: 1500 });
      await s("02c-explorar-zona", async () => { await p.getByRole("option").first().click(); }, { wait: 2500 });
      await s("03-explorar-fechas", async () => { await p.getByRole("button", { name: /Fechas/ }).first().click(); });
      await s("03b-explorar-fechas-rango", async () => {
        const days = p.locator(".range-calendar button:not([disabled]), [role=gridcell] button:not([disabled])");
        await days.nth(8).click(); await days.nth(12).click();
      });
      await s("03c-explorar-con-fechas", async () => {
        const apply = p.getByRole("button", { name: /Aplicar|Ver casas|Listo/ }).first();
        if (await apply.isVisible()) await apply.click(); else await p.keyboard.press("Escape");
      }, { wait: 2500 });
      await s("04-explorar-filtros", async () => { await p.getByRole("button", { name: /Filtros/ }).first().click(); });
      await s("04b-explorar-mapa-precio", async () => {
        await p.keyboard.press("Escape");
        await p.locator(".leaflet-marker-icon").first().click();
      });
      await s("04c-explorar-dolares", async () => { await p.keyboard.press("Escape"); await p.getByRole("button", { name: "$" }).first().click().catch(() => p.getByText("$", { exact: true }).first().click()); });
      await p.getByRole("button", { name: "₡" }).first().click().catch(() => {});
      await s("05-ficha", () => go(p, "/casa/CT-12013"), { wait: 2500 });
      await s("05b-ficha-completa", undefined, { full: true });
      await s("05c-ficha-media", () => p.mouse.wheel(0, 700), { wait: 800 });
      await s("05d-ficha-abajo", () => p.mouse.wheel(0, 1400), { wait: 800 });
      await s("05e-ficha-galeria", async () => { await p.mouse.wheel(0, -5000); await p.waitForTimeout(500); await p.locator("main img").first().click(); });
      await s("06-ficha-contactar", async () => {
        await go(p, "/casa/CT-12015"); await p.waitForTimeout(2000);
        await p.getByRole("button", { name: /Contactar por WhatsApp/ }).first().click();
      });
      await s("06b-ficha-habitacion", () => go(p, "/casa/CT-12018"), { wait: 2500 });
      await s("06c-ficha-mensual", () => go(p, "/casa/CT-11998"), { wait: 2500 });
      await s("06d-ficha-no-disponible", () => go(p, "/casa/CT-12016"), { wait: 2500 });
      await s("07-favoritos-vacio", () => go(p, "/favoritos"));
      await s("08-ingresar", async () => { await go(p, "/explorar"); await p.waitForTimeout(1500); await p.getByRole("button", { name: "Ingresar" }).or(p.getByRole("link", { name: "Ingresar" })).first().click(); });
      await s("08b-ingresar-numero", async () => { await p.getByRole("textbox").first().fill("88889999"); });
      await s("08c-ingresar-codigo", async () => { await p.getByRole("button", { name: /código|Continuar|Enviar/i }).first().click(); }, { wait: 2500 });
      await s("09-ayuda", () => go(p, "/ayuda"));
      await s("10-publicar-sin-sesion", () => go(p, "/publicar"), { wait: 2500 });
      await s("10b-publicar-sin-sesion-completo", undefined, { full: true });
      await s("11-buscar", () => go(p, "/explorar/buscar"));
      await s("12-que-es", () => go(p, "/que-es-3bstays"));
      await s("12b-que-es-completo", undefined, { full: true });
      await s("13-no-encontrado", () => go(p, "/casa/CT-99999"));
      await s("14-ruta-inexistente", () => go(p, "/no-existe"));
      await s("15-portada", () => go(p, "/?pronto=1"));
      await s("15b-portada-completa", undefined, { full: true });
      await p.context().close();
    }
  }
});

test("cliente", async ({ browser }) => {
  test.setTimeout(300_000);
  const sess = await session("+50688000004");
  for (const size of SIZES) {
    const p = await ctxFor(browser, size, sess);
    const s = shooter(p, `${size[0]}-cliente`);
    await s("20-explorar", () => go(p, "/explorar"), { wait: 2500 });
    await s("21-favoritos", () => go(p, "/favoritos"), { wait: 2500 });
    await s("22-cuenta", () => go(p, "/cuenta"), { wait: 2000 });
    await s("22b-cuenta-completa", undefined, { full: true });
    await s("23-cerrar-sesion", async () => { await p.getByRole("button", { name: "Cerrar sesión" }).first().click(); });
    await p.context().close();
  }
});

test("anfitrion", async ({ browser }) => {
  test.setTimeout(900_000);
  const sess = await session("+50688000001");
  const sess2 = await session("+50688000002");
  for (const size of SIZES) {
    const p = await ctxFor(browser, size, sess);
    const s = shooter(p, `${size[0]}-anfitrion`);
    await s("30-mis-casas", () => go(p, "/propietario/casas"), { wait: 2500 });
    await s("30b-mis-casas-completo", undefined, { full: true });
    const id = await p.evaluate(() => { const a = [...document.querySelectorAll("a[href*='/propietario/casas/']")] as HTMLAnchorElement[]; return a.map((x) => x.getAttribute("href")); });
    console.log("enlaces casas", id);
    const first = id.find((h) => h && /casas\/[^/]+$/.test(h)) ?? "";
    const review = id.reverse().find((h) => h && /casas\/[^/]+$/.test(h)) ?? first;
    await s("31-casa-detalle", () => go(p, first), { wait: 2500 });
    await s("31b-casa-detalle-completo", undefined, { full: true });
    await s("31c-casa-editar-precio", async () => { await p.getByRole("button", { name: /Editar/ }).nth(1).click(); });
    await s("31d-casa-editar-nombre", async () => { await go(p, first); await p.waitForTimeout(2000); await p.getByRole("button", { name: /Editar/ }).first().click(); });
    await s("31e-casa-fotos", async () => { await go(p, first); await p.waitForTimeout(2000); await p.getByRole("button", { name: /fotos/i }).first().click(); }, { wait: 2000 });
    await s("31f-casa-pausar", async () => { await go(p, first); await p.waitForTimeout(2000); await p.getByRole("button", { name: /Pausar/ }).first().click(); });
    await s("31g-casa-suscripcion", () => go(p, `${first}?panel=suscripcion`), { wait: 2500 });
    await s("32-casa-en-revision", () => go(p, review), { wait: 2500 });
    await s("33-calendario", () => go(p, "/propietario/calendario"), { wait: 2500 });
    await s("33b-calendario-seleccion", async () => {
      const days = p.locator(".month-grid button:not([disabled]), [role=gridcell]:not([aria-disabled=true]) button");
      await days.nth(10).click(); await days.nth(13).click({ modifiers: ["Shift"] }).catch(() => days.nth(13).click());
    });
    await s("33c-calendario-selector-casa", async () => { await p.keyboard.press("Escape"); await p.locator("[aria-haspopup=listbox]").first().click(); });
    await s("33d-calendario-airbnb", async () => { await p.keyboard.press("Escape"); await p.getByRole("button", { name: /Conectar con Airbnb/ }).first().click(); }, { wait: 2000 });
    await s("33e-calendario-marcar-reserva", async () => { await p.keyboard.press("Escape"); await p.getByRole("button", { name: /Marcar|reserva/i }).first().click(); });
    await s("34-consultas", async () => { await go(p, "/propietario/calendario"); await p.waitForTimeout(2000); await p.getByRole("link", { name: /Consultas/ }).or(p.getByRole("button", { name: /Consultas/ })).first().click(); }, { wait: 2000 });
    await s("34b-actividad-ruta", () => go(p, "/propietario/actividad"), { wait: 2500 });
    await s("35-cuenta", () => go(p, "/cuenta"), { wait: 2500 });
    await s("35b-cuenta-completa", undefined, { full: true });
    await s("35c-cuenta-editar-perfil", async () => { await p.getByRole("button", { name: /^Editar/ }).first().click(); });
    await s("35d-cuenta-cobro", async () => { await go(p, "/cuenta"); await p.waitForTimeout(2000); await p.getByRole("button", { name: /Cómo funciona el cobro/ }).or(p.getByRole("link", { name: /Cómo funciona el cobro/ })).first().click(); });
    await s("35e-parar-suscripcion", async () => { await go(p, "/cuenta"); await p.waitForTimeout(2000); await p.getByRole("button", { name: /Parar suscripción/ }).first().click(); });
    await s("36-suscripcion", () => go(p, "/propietario/suscripcion"), { wait: 2500 });
    await s("37-favoritos", () => go(p, "/favoritos"), { wait: 2000 });
    await s("38-explorar", () => go(p, "/explorar"), { wait: 2500 });
    await s("39-ayuda", () => go(p, "/ayuda"));
    await s("40-publicar-paso1", () => go(p, "/propietario/publicar"), { wait: 3000 });
    await s("40b-publicar-paso1-completo", undefined, { full: true });
    await s("40c-publicar-que-es-ayuda", async () => { await p.getByRole("button", { name: /\?|Qué es|Más información/ }).first().click(); });
    await s("40d-publicar-habitacion", async () => { await p.getByText("Habitación", { exact: true }).first().click(); });
    await p.context().close();

    const q = await ctxFor(browser, size, sess2);
    const s2 = shooter(q, `${size[0]}-anfitrion2`);
    await s2("41-mis-casas", () => go(q, "/propietario/casas"), { wait: 2500 });
    const links = await q.evaluate(() => [...document.querySelectorAll("a[href*='/propietario/casas/'], a[href*='/publicar/']")].map((x) => x.getAttribute("href")));
    console.log("enlaces anfitrion2", links);
    let i = 0;
    for (const h of links) {
      if (!h || i > 4) continue;
      i++;
      await s2(`42-casa-${i}`, () => go(q, h), { wait: 2500 });
      await s2(`42-casa-${i}-completa`, undefined, { full: true });
    }
    await s2("43-cuenta", () => go(q, "/cuenta"), { wait: 2500 });
    await q.context().close();
  }
});

test("admin", async ({ browser }) => {
  test.setTimeout(300_000);
  const sess = await session("+50688990001", true);
  for (const size of SIZES) {
    const p = await ctxFor(browser, size, sess);
    const s = shooter(p, `${size[0]}-admin`);
    await s("50-anuncios", () => go(p, "/admin"), { wait: 2500 });
    await s("51-casas", () => go(p, "/admin/casas"), { wait: 2500 });
    await s("52-borradores", () => go(p, "/admin/borradores"), { wait: 2500 });
    const links = await p.evaluate(() => [...document.querySelectorAll("a[href*='/admin/']")].map((x) => x.getAttribute("href")));
    console.log("enlaces admin", links);
    await s("53-revisar", async () => { await go(p, "/admin"); await p.waitForTimeout(2000); await p.locator("a[href*='/admin/anuncios/']").first().click(); }, { wait: 2500 });
    await s("53b-revisar-completo", undefined, { full: true });
    await s("54-casa-admin", async () => { await go(p, "/admin/casas"); await p.waitForTimeout(2000); await p.locator("a[href*='/admin/casas/']").first().click(); }, { wait: 2500 });
    await p.context().close();
  }
});

test("extra", async ({ browser }) => {
  test.setTimeout(900_000);
  const owner = await session("+50688000001");
  const client = await session("+50688000004");
  const casa = "/propietario/casas/" + (process.env.CASA ?? "");
  for (const [size, dark] of [[[1440, 900], true], [[1280, 800], false]] as const) {
    const tag = `${size[0]}${dark ? "-oscuro" : ""}`;
    const a = await ctxFor(browser, size as [number, number], null, dark);
    const s = shooter(a, tag);
    await s("01-explorar", () => go(a, "/explorar"), { wait: 2500 });
    await s("01b-explorar-zona", async () => { await a.getByRole("button", { name: /Lugar/ }).first().click(); await a.keyboard.type("Cocl"); await a.waitForTimeout(1200); await a.getByRole("option").first().click(); }, { wait: 2500 });
    await s("04-explorar-filtros", async () => { await a.getByRole("button", { name: /Filtros/ }).first().click(); });
    await s("05-ficha", () => go(a, "/casa/CT-12013"), { wait: 2500 });
    await s("05c-ficha-media", () => a.mouse.wheel(0, 700), { wait: 800 });
    await s("08-ingresar", async () => { await go(a, "/explorar"); await a.waitForTimeout(1500); await a.getByRole("button", { name: "Ingresar" }).or(a.getByRole("link", { name: "Ingresar" })).first().click(); });
    await s("10-publicar-sin-sesion", () => go(a, "/publicar"), { wait: 2500 });
    await s("12-que-es", () => go(a, "/que-es-3bstays"));
    await a.context().close();
    const c = await ctxFor(browser, size as [number, number], client, dark);
    const sc = shooter(c, `${tag}-cliente`);
    await sc("21-favoritos", () => go(c, "/favoritos"), { wait: 2500 });
    await sc("22-cuenta", () => go(c, "/cuenta"), { wait: 2000 });
    await c.context().close();
    const p = await ctxFor(browser, size as [number, number], owner, dark);
    const so = shooter(p, `${tag}-anfitrion`);
    await so("30-mis-casas", () => go(p, "/propietario/casas"), { wait: 2500 });
    await so("31-casa-detalle", () => go(p, casa), { wait: 2500 });
    await so("31c-casa-editar-precio", async () => { await p.getByRole("button", { name: /Editar/ }).nth(5).click(); });
    await so("33-calendario", () => go(p, "/propietario/calendario"), { wait: 2500 });
    await so("33d-calendario-airbnb", async () => { await p.getByText("Conectar con Airbnb").first().click(); }, { wait: 2000 });
    await so("33f-calendario-pausar", async () => { await go(p, "/propietario/calendario"); await p.waitForTimeout(2000); await p.getByText("Pausar la casa").first().click(); }, { wait: 1500 });
    await so("34-consultas", async () => { await go(p, "/propietario/calendario"); await p.waitForTimeout(2000); await p.getByRole("link", { name: /Consultas/ }).or(p.getByRole("button", { name: /Consultas/ })).first().click(); }, { wait: 2000 });
    await so("35-cuenta", () => go(p, "/cuenta"), { wait: 2500 });
    await so("35d-cuenta-cobro", async () => { await p.getByText("¿Cómo funciona el cobro?").first().click(); await p.getByText("¿Cómo funciona el cobro?").first().scrollIntoViewIfNeeded(); });
    await so("40-publicar-paso1", () => go(p, "/propietario/publicar"), { wait: 3000 });
    await so("40c-publicar-que-es-ayuda", async () => { await p.locator(".publish button[aria-expanded], button[aria-controls]").first().click(); });
    await p.context().close();
  }
});
