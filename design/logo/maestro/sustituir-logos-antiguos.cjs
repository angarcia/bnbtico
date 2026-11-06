// Archivo recuperable del juego anterior y alias nuevos para las rutas existentes.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),sharp=require('sharp');
const root=path.resolve(__dirname,'../../..'),base=path.join(root,'design/logo'),library=path.join(base,'biblioteca-completa-2026-11-05'),archive=path.join(base,'logos-obsoletos/2026-11-05'),replacements=[];
const digest=b=>crypto.createHash('sha256').update(b).digest('hex');
function backup(rel){const f=path.join(root,rel),target=path.join(archive,rel);if(fs.existsSync(f)&&!fs.existsSync(target)){fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(f,target);}return target;}
function replace(rel,b,source){const archived=backup(rel),target=path.join(root,rel);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,b);replacements.push({path:rel,archived:fs.existsSync(archived)?path.relative(root,archived):null,oldSha256:fs.existsSync(archived)?digest(fs.readFileSync(archived)):null,newSha256:digest(b),source});}
function copy(rel,source){replace(rel,fs.readFileSync(path.join(library,source)),source);}
async function word(rel,theme,width){const source=`01-logos/${theme}/bnbtico.svg`;replace(rel,await sharp(path.join(library,source),{density:144}).resize({width}).withIccProfile('srgb').withMetadata({density:72}).png().toBuffer(),source);}
async function main(){
// Alias de diseño consumidos por pantallas, maquetas y generadores de tarjetas.
for(const color of ['terracota','crema','tinta','blanco']){const theme={terracota:'terracota-transparente',crema:'crema-transparente',tinta:'negro-transparente',blanco:'para-fotos'}[color];for(const type of ['horizontal','nombre'])await word(`design/logo/bnbtico-${type}-${color}.png`,theme,2048);const source=`00-maestros-svg/${theme}/simbolo-bt.svg`;replace(`design/logo/bnbtico-simbolo-${color}.png`,await sharp(path.join(library,source),{density:144}).resize(1024).withIccProfile('srgb').withMetadata({density:72}).png().toBuffer(),source);}
for(const [old,theme] of [['crema','predeterminado'],['oscuro','sobre-oscuro'],['verde','sobre-verde']])await word(`design/logo/bnbtico-horizontal-sobre-${old}.png`,theme,2048);
for(const [old,theme] of [['crema','predeterminado'],['terracota','crema-sobre-terracota']])for(const n of [180,192,512,1024])copy(`design/logo/icono-${old}-${n}.png`,`04-apps/${theme}/${n===180?'pwa/apple-touch-icon-180':`genericos/icono-${n}`}.png`);
for(const n of [192,512]){
 copy(`design/logo/icono-maskable-${n}.png`,`04-apps/predeterminado/pwa/maskable-${n}.png`);
 const source=`04-apps/crema-sobre-terracota/genericos/icono-${n}.png`;const mask=Buffer.from(`<svg width="${n}" height="${n}"><rect width="${n}" height="${n}" rx="${n*.2}" fill="white"/></svg>`);replace(`design/logo/icono-terracota-redondeado-${n}.png`,await sharp(path.join(library,source)).ensureAlpha().composite([{input:mask,blend:'dest-in'}]).png().toBuffer(),source+'; máscara de vista previa');
}
copy('design/logo/favicon.ico','02-iconos-pequenos/favicon.ico');for(const n of [16,32,48])replace(`design/logo/favicon-${n}.png`,await sharp(path.join(library,'02-iconos-pequenos/favicon.svg'),{density:72*n/16}).resize(n,n).png().toBuffer(),'02-iconos-pequenos/favicon.svg');
// Rutas de las dos apps: las referencias no cambian y las imágenes de cabecera son transparentes.
await word('apps/app/public/logo-horizontal.png','terracota-transparente',600);
await word('apps/app/public/portada/logo-crema.png','para-fotos',840);
await word('apps/web/public/logo-horizontal.png','terracota-transparente',2048);
await word('apps/web/public/logo-horizontal-crema.png','para-fotos',2048);
await word('apps/web/public/bnbtico-logo.png','terracota-transparente',1371);
await word('apps/web/public/bnbtico-original.png','terracota-transparente',1716);
copy('apps/web/public/logo-simbolo.png','00-maestros-svg/terracota-transparente/simbolo-bt.png');
for(const [dir,prefix] of [['apps/app/public/icons','icono'],['apps/web/public','icon']]){for(const n of [192,512]){copy(`${dir}/${prefix}-${n}.png`,`04-apps/predeterminado/pwa/icon-${n}.png`);copy(`${dir}/${prefix}-maskable-${n}.png`,`04-apps/predeterminado/pwa/maskable-${n}.png`);}copy(`${dir}/apple-touch-icon.png`,'04-apps/predeterminado/pwa/apple-touch-icon-180.png');}
copy('apps/app/public/favicon.ico','02-iconos-pequenos/favicon.ico');copy('apps/web/app/favicon.ico','02-iconos-pequenos/favicon.ico');
// Imagen de compartir enlaces: misma fotografía existente, nuevo wordmark blanco vectorial.
const photo=await sharp(path.join(root,'apps/app/public/portada/playa-negra-1592.jpg')).resize(1200,630,{fit:'cover'}).toBuffer();const shade=Buffer.from('<svg width="1200" height="630"><defs><linearGradient id="s" x2="0" y2="1"><stop offset="0%" stop-color="#1C2B2A" stop-opacity=".08"/><stop offset="100%" stop-color="#1C2B2A" stop-opacity=".85"/></linearGradient></defs><rect width="1200" height="630" fill="url(#s)"/></svg>');const brand=await sharp(path.join(library,'01-logos/para-fotos/bnbtico.svg'),{density:144}).resize({width:480}).png().toBuffer();const og=await sharp(photo).composite([{input:shade,left:0,top:0},{input:brand,left:48,top:385}]).jpeg({quality:93}).toBuffer();for(const rel of ['apps/app/public/og.jpg','apps/web/public/og.jpg'])replace(rel,og,'fotografía existente + 01-logos/para-fotos/bnbtico.svg');
// Se conserva intacto el original del prototipo en el archivo; la interfaz pasa al SVG nuevo.
const original='design/prototype/assets/bnbtico-original.png';backup(original);if(fs.existsSync(path.join(root,original)))fs.unlinkSync(path.join(root,original));copy('design/prototype/assets/bnbtico.svg','01-logos/terracota-transparente/bnbtico.svg');
// Versiones personalizadas anteriores: solo histórico; no hay referencias activas.
const personalized=path.join(base,'personalizado');if(fs.existsSync(personalized))for(const file of fs.readdirSync(personalized)){if(file==='README.md')continue;const rel=`design/logo/personalizado/${file}`;backup(rel);fs.unlinkSync(path.join(root,rel));}
fs.writeFileSync(path.join(personalized,'README.md'),'# Versiones anteriores\n\nEste juego quedó obsoleto. Originales conservados en ../logos-obsoletos/2026-11-05/design/logo/personalizado/.\nUse ../biblioteca-completa-2026-11-05/ para los logos vigentes.\n');
fs.writeFileSync(path.join(archive,'sustituciones.json'),JSON.stringify({date:'2026-11-05',replacements},null,2)+'\n');fs.writeFileSync(path.join(archive,'LEAME.md'),'# Logos obsoletos · rana y tipografías anteriores\n\nOriginales conservados con su ruta del repositorio. No usar en entregas nuevas. sustituciones.json relaciona cada archivo sustituido con su origen aprobado y los hashes anterior/nuevo. El PNG original del prototipo se conserva intacto aquí; el prototipo usa ahora assets/bnbtico.svg. Las carpetas de design/logo/historico/ conservan otras referencias anteriores y no se usan como recursos activos.\n');
console.log(JSON.stringify({archive,replacements:replacements.length}));}
main().catch(e=>{console.error(e);process.exit(1)});
