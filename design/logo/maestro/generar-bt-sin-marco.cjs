const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

(async () => {
  const root = path.resolve(__dirname, '../../..');
  const source = path.join(root, 'design/logo/biblioteca-completa-2026-11-05/00-maestros-svg/predeterminado/simbolo-bt.svg');
  const out = path.join(root, 'design/logo/redes-sociales/perfil-bt-sin-marco');
  fs.mkdirSync(out, { recursive: true });
  const original = fs.readFileSync(source, 'utf8');
  const frames = original.match(/<rect\b[^>]*\/>/g) || [];
  if (frames.length !== 1) throw new Error('Se esperaba un solo recuadro en el maestro BT.');
  const content = original.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '').replace(frames[0], '');
  const art = `<g transform="translate(256 256) scale(1.18) translate(-256 -256)">${content}</g>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1080" height="1080" viewBox="0 0 512 512">${art}</svg>`;
  fs.writeFileSync(path.join(out, 'bt-sin-marco-transparente.svg'), svg);
  await sharp(Buffer.from(svg)).png().toFile(path.join(out, 'bt-sin-marco-transparente-1080.png'));
  await sharp(Buffer.from(svg)).flatten({ background: '#FFFBF2' }).png().toFile(path.join(out, 'instagram-bt-terracota-crema-1080.png'));
  const { data, info } = await sharp(Buffer.from(svg)).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  let radius = 0;
  for (let y = 0; y < info.height; y++) for (let x = 0; x < info.width; x++) {
    if (data[(y * info.width + x) * 4 + 3] > 16) radius = Math.max(radius, Math.hypot(x + .5 - 540, y + .5 - 540) / 1080);
  }
  if (radius > .45) throw new Error(`El BT invade el margen circular: ${radius}`);
  const circular = `<svg width="540" height="540"><circle cx="270" cy="270" r="270" fill="white"/></svg>`;
  await sharp(path.join(out, 'instagram-bt-terracota-crema-1080.png')).resize(540, 540).composite([{ input: Buffer.from(circular), blend: 'dest-in' }]).png().toFile('/private/tmp/bnbtico-bt-instagram-circular.png');
  fs.writeFileSync(path.join(out, 'LEAME.md'), '# BT sin marco para perfil circular\n\nSubir instagram-bt-terracota-crema-1080.png a Instagram: BT terracota #B44C30 sobre crema #FFFBF2, 1080 × 1080 px. Mantener el encuadre completo y centrado, sin ampliar en el recorte.\n\nSe reutilizan exactamente los trazados del símbolo BT aprobado, eliminando el recuadro y ampliando ambas letras juntas un 18 %. No se modifica la tipografía. Se adjuntan SVG y PNG transparentes para otros usos.\n');
  fs.writeFileSync(path.join(out, 'verificacion.json'), JSON.stringify({ size: 1080, maximumInkRadius: radius, allowedRadius: .45, originalFrameCount: frames.length, exportedFrameCount: (svg.match(/<rect\b/g) || []).length, source: path.relative(root, source) }, null, 2));
  console.log(JSON.stringify({ out, size: info.width, maximumInkRadius: radius }));
})().catch(e => { console.error(e); process.exit(1); });
