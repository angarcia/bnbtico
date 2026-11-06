const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');const {out,themes,names,fit,symbol}=require('./generar-biblioteca.cjs');
function write(p,b){p=path.join(out,p);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,b)}
function copy(a,b){write(b,fs.readFileSync(path.join(out,a)))}
async function main(){
// ICNS nativo: bloques PNG de los tamaños estándar y sus perfiles ópticos.
for(const theme of Object.keys(themes).filter(t=>themes[t][1])){const folder=`06-escritorio/${theme}/bnbtico.iconset/`,entries=[['icp4','icon_16x16.png'],['icp5','icon_32x32.png'],['icp6','icon_32x32@2x.png'],['ic07','icon_128x128.png'],['ic08','icon_256x256.png'],['ic09','icon_512x512.png'],['ic10','icon_512x512@2x.png'],['ic11','icon_16x16@2x.png'],['ic12','icon_32x32@2x.png'],['ic13','icon_128x128@2x.png'],['ic14','icon_256x256@2x.png']];const chunks=entries.map(([type,f])=>{const p=fs.readFileSync(path.join(out,folder,f)),h=Buffer.alloc(8);h.write(type);h.writeUInt32BE(p.length+8,4);return Buffer.concat([h,p])});const h=Buffer.alloc(8);h.write('icns');h.writeUInt32BE(chunks.reduce((s,b)=>s+b.length,8),4);write(`06-escritorio/${theme}/bnbtico.icns`,Buffer.concat([h,...chunks]));}
for(const t of Object.keys(themes))for(const n of [16,24,32,48,64,96])write(`08-vistas/iconos-por-fondo/${t}/icono-${n}.svg`,fit(symbol(t,n<=32?n:n),n,n,themes[t][1]));
// Variantes automáticas para navegador; fotos siguen siendo blancas y transparentes.
function adaptive(svg){return svg.replace(/<svg([^>]*)>/,`<svg$1><style>:root{--brand-ink:#B44C30;--brand-bg:#FFFBF2}@media(prefers-color-scheme:dark){:root{--brand-ink:#FFFBF2;--brand-bg:#B44C30}}</style>`).replaceAll('fill="#B44C30"','fill="var(--brand-ink)"').replaceAll('stroke="#B44C30"','stroke="var(--brand-ink)"').replaceAll('fill="#FFFBF2"','fill="var(--brand-bg)"');}
for(const name of names)write(`03-web/adaptativo/${name}.svg`,adaptive(fs.readFileSync(path.join(out,`01-logos/terracota-transparente/${name}.svg`),'utf8')));
write('03-web/adaptativo/favicon.svg',adaptive(fs.readFileSync(path.join(out,'02-iconos-pequenos/favicon.svg'),'utf8')));
// Muestra fotográfica ya presente en el repositorio.
const photo=path.resolve(__dirname,'../../../apps/app/public/portada/playa-negra-1592.jpg');write('08-vistas/foto-ejemplo.jpg',await sharp(photo).resize(1200).jpeg({quality:85}).toBuffer());
for(const name of names)copy(`01-logos/terracota-transparente/${name}.svg`,`EMPEZAR-AQUI/${name}.svg`);
copy('04-apps/predeterminado/tiendas/app-store-1024.png','EMPEZAR-AQUI/icono-app-1024.png');copy('04-apps/crema-sobre-terracota/tiendas/app-store-1024.png','EMPEZAR-AQUI/icono-oscuro-1024.png');copy('02-iconos-pequenos/favicon.ico','EMPEZAR-AQUI/favicon.ico');copy('01-logos/para-fotos/bnbtico.svg','EMPEZAR-AQUI/bnbtico-fotos-transparente.svg');
for(const theme of ['terracota-transparente','negro-transparente','crema-transparente'])for(const name of names)for(const ext of ['svg','png'])copy(`01-logos/${theme}/${name}.${ext}`,`LOGOS-TRANSPARENTES/${theme.split('-')[0]}/${name}.${ext}`);
for(const ext of ['svg','png'])copy(`01-logos/terracota-transparente/bnbtico.${ext}`,`logo-predeterminado.${ext}`);
const readme=`# bnbtico · biblioteca completa · 5 noviembre 2026

Regla general: los logos y sus maestros son transparentes por defecto. Los fondos sólidos están separados para perfiles de redes, iconos de instalación y otros usos que los necesiten. En los logos con puntos, el interior también es transparente.

**Logo predeterminado: BNBTICO en terracota #B44C30, sin marco y con fondo completamente transparente. Se ve el fondo de la pantalla por detrás.** Las versiones con marco de puntos también tienen el interior transparente. Los fondos sólidos se reservan para perfiles e iconos.

**Abra VISTA-GENERAL.html para revisar. EMPEZAR-AQUI contiene los archivos de uso habitual. Los cuatro SVG principales son terracota transparente; LOGOS-TRANSPARENTES reúne las cuatro composiciones en terracota, negro y crema, en SVG y PNG sin fondo.** Los numerosos archivos de las otras carpetas son tamaños, colores y formatos del mismo sistema aprobado; no son propuestas nuevas.

Se reutilizan los maestros y 350 archivos ya creados. Cuatro composiciones: BNBTICO, BNBTICO.COM, cuadrado de puntos con BNBTICO y cuadrado de puntos con BNBTICO.COM. Símbolos: contorno continuo + BT, y B original ensanchada y reforzada. Sin rana; solo la T sobresale en altura. Los puntos son círculos geométricos, sin sombras ni desenfoque.

| Carpeta | Contenido y tamaños |
|---|---|
| 00-maestros-svg | Símbolos BT y B en SVG y PNG; diez acabados |
| 01-logos | Cuatro logos SVG/PNG en diez acabados; PNG de 4096 px en los tres principales |
| 02-iconos-pequenos | Selección ya aprobada: 16,24,32,48,64,96 px, SVG y PNG 1×/2×/3×, favicon e ICO |
| 03-web | Horizontales 160×70,200×80,240×96,320×128,400×160; cuadrados 70,96,160,240,320,400. PNG 1×/2×/3× y SVG siempre transparentes (terracota, negro, crema y blanco). Variante automática claro/oscuro también transparente |
| 04-apps | App Store 1024; Google Play 512; PWA 192/512 normal y maskable; apple-touch 180; catálogo iOS; capas para Icon Composer; Android adaptativo, monocromo y launcher en cinco densidades; notificaciones |
| 05-redes | Cada composición y símbolo en 320,400,800 px; Instagram, Facebook, LinkedIn, X y YouTube; mismos colores |
| 06-escritorio | ICO 16–256; ICNS y fuentes iconset 16–1024; seis acabados opacos |
| 07-impresion | 60 EPS CMYK, PDF vectorial de 60 páginas y perfil ICC; PNG RGB a 300 ppp de 50/100/200 mm de ancho |
| 08-vistas | Comparativas aprobadas y muestras de revisión |

## Web sin fondo / perfiles con fondo

Para web, usar 03-web/ o LOGOS-TRANSPARENTES/: letras y marco de puntos sin ninguna placa crema ni fondo. El crema es el color de la página, no un rectángulo incluido en el logo. Los cuatro SVG de EMPEZAR-AQUI también son transparentes. Los acabados con fondo de 01-logos/ y los iconos de 04-apps/05-redes/ son para perfiles (Instagram, Facebook y otras redes), instalación y usos con fondo deliberado.

## Colores y fondos

- **Predeterminado:** terracota #B44C30 sobre crema #FFFBF2.
- **Alternativa:** crema sobre terracota. También crema sobre negro, tinta #1C2B2A o verde #2F5D45.
- **Fondos claros:** terracota transparente o sobre blanco.
- **Fotos:** blanco transparente, sin placa. Colocarlo en una parte de la foto suficientemente oscura; ninguna tinta fija puede contrastar con todas las fotos.
- **Merchandising:** carbón cálido #2B2926 transparente. El crema sobre soporte oscuro precisa tinta clara o base blanca según material.

## Tamaño visible y nitidez

B hasta 32 px; contorno + BT desde 48 px. El favicon usa siempre el dibujo de B de 16 px, incluso en pantallas de mayor densidad. Elegir por tamaño visible: 16@2x mide 32 píxeles físicos, pero sigue siendo el dibujo de 16 px. En los catálogos iOS se respeta el tamaño en puntos; Android launcher conserva BT a 48 dp aunque cambie la densidad.

Para mantener detalle, usar SVG en la web. Las cuatro composiciones completas se conservan sin engordarlas. En cabeceras estrechas, preferir BNBTICO sin marco; para un icono pequeño, usar los símbolos adaptados. Los cuadrados con muchos puntos y texto son para usos amplios: las exportaciones de 70/96 px están disponibles, pero los iconos BT/B son más legibles a esos tamaños. No ampliar una captura o miniatura para valorar nitidez: abrir el SVG o el PNG nativo.

## Instalación y recortes

Los iconos de tienda no tienen máscara ni sombra incorporada. App Store: PNG sRGB sin canal alfa. Google Play: PNG RGBA de 512 px, fondo opaco y menos de 1024 KB. PWA y avatares mantienen el contorno dentro del círculo seguro; Android incluye capas de 108 dp a cinco densidades, fondo de color y monocromo Android 13+. No usar el PNG de Google Play como capa adaptativa.

Los recursos para Icon Composer son capas PNG/SVG separadas; **no constituyen un proyecto .icon compilado**. El catálogo AppIcon.appiconset ofrece los PNG clásicos para Xcode. El montaje final y la validación en Xcode/Android Studio se hacen al integrar la app. Los fragmentos webmanifest y res son recursos para la integración nativa posterior. Por petición final de Ana, los PNG/ICO de las rutas existentes de las dos apps y las maquetas ya se sustituyen localmente por la marca nueva; también portada, imagen de compartir y prototipo. Los originales están en ../logos-obsoletos/2026-11-05/. No se ha desplegado.

## Imprenta

SVG digital en sRGB; escala sin pérdida. EPS y PDF contienen geometría vectorial y colores CMYK convertidos con el perfil **Generic CMYK Profile.icc**, incluido. PDF con OutputIntent ICC; no se declara PDF/X certificado. El carbón cálido #2B2926 tiene su conversión CMYK ICC; para una sola tinta, el proveedor debe igualar el tono aprobado. Se incluye un índice de páginas y equivalencias de color en paginas-y-colores.json. Cada página mide 100 mm de ancho y puede escalarse.

El perfil definitivo de impresión depende del papel, tinta y proceso: la imprenta puede reconvertir los vectores con su perfil. PNG **no admite CMYK**: todos los PNG de imprenta siguen siendo RGB con etiqueta 300 ppp; para CMYK use EPS/PDF. No se entregan JPG. En digital el tamaño en píxeles manda; 72 ppp es metadato, no un límite de calidad.

## Referencias oficiales consultadas

- [Apple: App icons](https://developer.apple.com/design/human-interface-guidelines/app-icons/)
- [Google Play: icon design specifications](https://developer.android.com/distribute/google-play/resources/icon-design-specifications)
- [Android: adaptive icons](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive)
- [MDN: PWA icons y zona segura](https://developer.mozilla.org/en-US/docs/Web/Progressive_web_apps/How_to/Define_app_icons)
- [YouTube: imagen de perfil](https://support.google.com/youtube/answer/10456525)

inventario.json recoge dimensiones, hashes y procedencia; verificacion.json recoge las comprobaciones finales. Las fuentes de generación están en design/logo/maestro/.
`;
write('LEAME.md',readme);write('EMPEZAR-AQUI/LEAME.txt','Abra ../VISTA-GENERAL.html para revisar el sistema completo.\nLos cuatro logos SVG principales son terracota transparente, sin rectángulo de fondo. LOGOS-TRANSPARENTES contiene además negro y crema.\nLos archivos para otros fondos y plataformas están en las carpetas numeradas.\n');
const opts=['terracota-transparente','tinta-transparente','carbon-calido-transparente','crema-transparente',...Object.keys(themes).filter(t=>!['terracota-transparente','tinta-transparente','carbon-calido-transparente','negro-transparente','crema-transparente'].includes(t))].map(t=>`<option value="${t}">${t==='predeterminado'?'Terracota sobre crema · para perfiles':t}</option>`).join('');
write('VISTA-GENERAL.html',`<!doctype html><html lang="es"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>bnbtico · biblioteca de logos</title><style>*{box-sizing:border-box}body{margin:0;background:#f0eee8;color:#1c2b2a;font:16px/1.5 system-ui}main{max-width:1180px;margin:auto;padding:40px 24px}h1{font-size:30px;margin:0}h2{font-size:23px;margin:40px 0 16px}p{max-width:840px}nav{display:flex;gap:20px;flex-wrap:wrap}a{color:#963e27}select{padding:10px;font:inherit;border:1px solid #bbb;border-radius:8px}.grid{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:20px}.card{background:#fff;border-radius:12px;padding:20px}.stage{display:flex;align-items:center;justify-content:center;min-height:230px;border-radius:8px;background:#fffbf2}.stage img{max-width:95%;max-height:280px}.square img{width:280px;height:280px}.row{display:flex;align-items:center;gap:28px;flex-wrap:wrap}.mini{display:flex;align-items:center;justify-content:center;height:110px;min-width:100px}.caption{font-size:14px;color:#58605d}.photo{background:url('08-vistas/foto-ejemplo.jpg') center/cover;min-height:290px}.photo img{width:80%;max-height:160px}.circle img{border-radius:50%;width:200px}.files{margin-top:12px;display:flex;gap:15px}.tag{font-size:13px;letter-spacing:.04em;text-transform:uppercase}footer{margin-top:50px;font-size:14px}@media(max-width:650px){.grid{grid-template-columns:1fr}main{padding:24px 16px}}</style><main><div class="tag">Identidad aprobada · 05.11.2026</div><h1>bnbtico · logos y símbolos</h1><p>Cuatro composiciones, dos símbolos y los tamaños necesarios para cada uso. Empiece por esta vista; las carpetas numeradas reúnen las exportaciones técnicas.</p><nav><a href="EMPEZAR-AQUI/">EMPEZAR-AQUI</a><a href="LOGOS-TRANSPARENTES/">Logos sin fondo</a><a href="09-guia-de-marca/bnbtico-guia-de-marca.pdf">Guía de marca · PDF</a><a href="LEAME.md">Guía de archivos</a><a href="07-impresion/maestros-cmyk.pdf">PDF CMYK</a></nav><h2>Logo predeterminado · transparente</h2><img src="logo-predeterminado.svg" alt="BNBTICO terracota sin fondo" style="display:block;width:min(100%,480px);height:auto;margin:24px 0"><p class="caption">Se ve el fondo de esta pantalla por detrás. El archivo no incluye ninguna placa; también el interior de las versiones con puntos es transparente.</p><h2>Composiciones y colores disponibles</h2><label>Acabado <select id="theme">${opts}</select></label><div class="grid" id="logos" style="margin-top:20px"></div><h2>Iconos · tamaño real</h2><p class="caption">B reforzada hasta 32 px; contorno + BT desde 48 px. Aquí se muestran a su tamaño de uso, sin ampliarlos.</p><div class="card row" id="small"></div><h2>Apps y perfiles</h2><div class="grid"><div class="card"><div class="stage" id="app"></div><p>App Store 1024 · Google Play 512</p><a id="appfile">Abrir PNG 1024</a></div><div class="card"><div class="stage circle" id="avatar"></div><p>Recorte circular de perfil · 320 / 400 / 800</p></div></div><h2>Sobre fotografía</h2><div class="card"><div class="stage photo"><img src="01-logos/para-fotos/bnbtico.svg" alt="Logo blanco sin fondo sobre foto"></div><p class="caption">Blanco transparente, sin placa. Foto existente del proyecto, usada solo para esta muestra.</p></div><h2>Impresión</h2><p>EPS y PDF vectoriales CMYK; PNG RGB de 50, 100 y 200 mm a 300 ppp. El perfil CMYK incluido es genérico y puede ajustarlo la imprenta al soporte.</p><footer>Reutiliza los maestros aprobados. Terracota #B44C30 · crema #FFFBF2. Sin sombras ni desenfoques.</footer></main><script>const colors=${JSON.stringify(themes)},names=${JSON.stringify(names)};const label=['BNBTICO','BNBTICO.COM','Cuadrado con BNBTICO','Cuadrado con BNBTICO.COM'];function update(){const t=theme.value;logos.innerHTML=names.map((n,i)=>'<article class="card"><div class="stage '+(i>1?'square':'')+'" style="background:'+(colors[t][1]||(t==='para-fotos'||t==='crema-transparente'?'#1c2b2a':'transparent'))+'"><img src="01-logos/'+t+'/'+n+'.svg" alt="'+label[i]+'"></div><p>'+label[i]+'</p><div class="files"><a href="01-logos/'+t+'/'+n+'.svg">SVG</a><a href="01-logos/'+t+'/'+n+'.png">PNG</a></div></article>').join('');const it=t==='crema-sobre-terracota'?t:t==='sobre-negro'?'negro':t==='sobre-oscuro'?'oscuro':t==='para-fotos'?'blanco-transparente':t==='crema-transparente'?t:t==='terracota-transparente'?'transparente':t==='sobre-blanco'?'blanco':'crema';small.innerHTML=[96,64,48,32,24,16].map(n=>'<div><div class="mini" style="background:'+(colors[t][1]||(colors[t][0]==='#FFFFFF'||colors[t][0]==='#FFFBF2'?'#1c2b2a':'#fffbf2'))+'"><img width="'+n+'" height="'+n+'" src="08-vistas/iconos-por-fondo/'+t+'/icono-'+n+'.svg" alt="Icono '+n+'"></div><p class="caption">'+n+' px</p></div>').join('');const solid=colors[t][1]?t:'predeterminado';app.innerHTML='<img width="220" height="220" src="04-apps/'+solid+'/tiendas/app-store-1024.png" alt="Icono de app">';appfile.href='04-apps/'+solid+'/tiendas/app-store-1024.png';avatar.innerHTML='<img src="05-redes/'+solid+'/simbolo-bt-400.png" alt="Recorte circular">'}theme.addEventListener('change',update);update()</script></html>`);
console.log('Guía, vista general, accesos rápidos, SVG adaptativos e ICNS preparados');}
main().catch(e=>{console.error(e);process.exit(1)});
