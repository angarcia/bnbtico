const fs = require('node:fs');
const path = require('node:path');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '../../..');
const library = path.join(root, 'design/logo/biblioteca-completa-2026-11-05');
const out = path.join(root, 'design/logo/redes-sociales/portadas-2026-11-05');
const data = (file, type) => `data:${type};base64,${fs.readFileSync(file).toString('base64')}`;
const photo = data(path.join(root, 'apps/app/public/portada/playa-negra-1592.jpg'), 'image/jpeg');
const logo = data(path.join(library, '01-logos/para-fotos/bnbtico-com.svg'), 'image/svg+xml');
const framedLogo = data(path.join(library, '01-logos/para-fotos/bnbtico-com-cuadrado.svg'), 'image/svg+xml');
const font = data(path.join(library, '09-guia-de-marca/recursos/fuentes/Figtree-400.ttf'), 'font/ttf');
const formats = [
  { name: 'facebook-portada', width: 1702, height: 630, logoWidth: 660, top: 155, gap: 28, size: 29, subSize: 26 },
  { name: 'whatsapp-business-portada', width: 1211, height: 681, logoWidth: 620, top: 210, gap: 28, size: 27, subSize: 25 },
];

(async () => {
  fs.mkdirSync(out, { recursive: true });
  const browser = await chromium.launch({ executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', headless: true });
  const results = [];
  try {
    for (const f of formats) {
      let html = `<!doctype html><html lang="es"><meta charset="utf-8"><title>bnbtico · ${f.name}</title>
<style>@font-face{font-family:Figtree;src:url('${font}')}*{box-sizing:border-box}html,body{margin:0;width:${f.width}px;height:${f.height}px;overflow:hidden}body{background:#1C2B2A;color:white;font-family:Figtree,Arial,sans-serif}.cover{width:100%;height:100%;position:relative;background-image:linear-gradient(180deg,rgba(28,43,42,.25),rgba(28,43,42,.48)),url('${photo}');background-size:cover;background-position:center}.identity{position:absolute;top:${f.top}px;left:50%;transform:translateX(-50%);width:800px;text-align:center}.logo{display:block;width:${f.logoWidth}px;height:auto;margin:auto}.message{margin:${f.gap}px 0 0;font-size:${f.size}px;line-height:1.25;font-weight:400}.sub{margin:9px 0 0;font-size:${f.subSize}px;line-height:1.3;font-weight:400}</style>
<main class="cover"><div class="identity"><img class="logo" src="${logo}" alt="bnbtico.com"><p class="message">Plataforma de alojamientos en Costa Rica</p><p class="sub">Reservas directas, sin comisión de plataforma</p></div></main></html>`;
      if (f.name === 'whatsapp-business-portada') {
        html = html.replace('</style>', `.cover{background-image:linear-gradient(90deg,rgba(28,43,42,.48),rgba(28,43,42,.30)),url('${photo}')}.identity{top:0;left:0;transform:none;width:100%;height:540px}.logo{position:absolute;left:20px;top:30px;width:540px;margin:0}.message,.sub{position:absolute;left:465px;width:670px;margin:0;text-align:center}.message{top:188px;font-size:27px}.sub{top:240px;font-size:25px}</style>`);
        html = html.replace(`src="${logo}" alt="bnbtico.com"`, `src="${framedLogo}" alt="bnbtico.com dentro del cuadrado de puntos"`);
        html = html.replace(/<p class="(?:message|sub)">[^<]*<\/p>/g, '');
      }
      const htmlPath = path.join(out, `${f.name}.html`);
      fs.writeFileSync(htmlPath, html);
      const page = await browser.newPage({ viewport: { width: f.width, height: f.height }, deviceScaleFactor: 1 });
      const errors = [];
      page.on('pageerror', e => errors.push(e.message));
      await page.goto(`file://${htmlPath}`);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => [...document.images].every(i => i.complete && i.naturalWidth));
      await page.screenshot({ path: path.join(out, `${f.name}.png`) });
      const bounds = await page.locator('.identity').boundingBox();
      if (errors.length || bounds.x < 0 || bounds.y < 0 || bounds.x + bounds.width > f.width || bounds.y + bounds.height > f.height) throw new Error(JSON.stringify({ errors, bounds, f }));
      results.push({ file: `${f.name}.png`, width: f.width, height: f.height, errors, contentBounds: bounds });
      await page.close();
    }
    fs.writeFileSync(path.join(out, 'verificacion.json'), JSON.stringify(results, null, 2));
    fs.writeFileSync(path.join(out, 'LEAME.md'), `# Portadas bnbtico\n\n- Facebook: facebook-portada.png, 1702 × 630 px.\n- WhatsApp Business: whatsapp-business-portada.png, 1211 × 681 px.\n\nArchivos PNG listos para subir como portada, separados de la foto circular de perfil. Facebook: BNBTICO.COM con descripción y reservas directas sin comisión de plataforma. WhatsApp: BNBTICO.COM dentro del marco de puntos a la izquierda, sin texto adicional; marco reducido un 10 % y más espacio arriba. Fuentes HTML autónomas editables incluidas.\n\nFoto original de Ana reutilizada de la portada web (Playa Negra). Logotipo blanco original en curvas, sin placa, filtros ni sombras. Texto en Figtree. Capa oscura suave sobre toda la foto para facilitar la lectura.\n\nEstos son los tamaños de exportación elegidos, no una garantía de recorte idéntico en todos los dispositivos. Al subir, mantenga el encuadre centrado y revise la vista móvil: la interfaz puede recortar o superponer la foto de perfil. WhatsApp no publica medidas universales de portada en su ayuda consultada.\n\nRegenerar desde el proyecto con NODE_PATH apuntando a las dependencias de Node y node design/logo/maestro/generar-portadas-sociales.cjs.\n`);
    console.log(JSON.stringify({ directory: out, exports: results }, null, 2));
  } finally { await browser.close(); }
})().catch(e => { console.error(e); process.exit(1); });
