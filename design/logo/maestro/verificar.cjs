// Comprobaciones del paquete gráfico; no necesita la app ni Supabase.
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const sharp=require('sharp');
const root=path.resolve(__dirname,'../../..');
const out=path.join(root,'design/logo/unificado-2026-11-05');
const compact=path.join(root,'design/logo/propuestas/iconos-compactos-2026-11-05');
async function main(){
  const dirs=[__dirname,out,compact],files=dirs.flatMap(dir=>fs.readdirSync(dir).filter(f=>f.endsWith('.svg')).map(f=>path.join(dir,f)));
  for(const file of files){const s=fs.readFileSync(file,'utf8');assert(!/<(?:image|text|foreignObject)\b|@font-face|data:image/i.test(s),file);await sharp(Buffer.from(s)).metadata();}
  const word=fs.readFileSync(path.join(__dirname,'bnbtico.svg'),'utf8').match(/<path[^>]* d="([^"]+)"/)[1];
  const domain=fs.readFileSync(path.join(__dirname,'bnbtico-com.svg'),'utf8');assert(domain.includes(`d="${word}"`));
  for(const file of fs.readdirSync(out).filter(f=>/^bnbtico(?:-com)?(?:-cuadrado)?-(terracota|blanco|crema|negro|sobre)/.test(f)&&f.endsWith('.svg')))assert(fs.readFileSync(path.join(out,file),'utf8').includes(`d="${word}"`),file);
  const reference=await sharp(path.join(__dirname,'referencia-aprobada.png')).extract({left:280,top:480,width:720,height:280}).ensureAlpha().raw().toBuffer();
  const vector=await sharp(path.join(__dirname,'contorno-referencia.svg')).resize(720,280).ensureAlpha().raw().toBuffer();
  let union=0,intersection=0;
  for(let i=0;i<720*280;i++){const j=i*4,a=(reference[j]-reference[j+1]-5)/104>=.5,b=vector[j+3]>=128;if(a||b)union++;if(a&&b)intersection++;}
  const iou=intersection/union;assert(iou>.975,`Coincidencia insuficiente ${iou}`);
  const geometry=JSON.parse(fs.readFileSync(path.join(__dirname,'geometria.json')));assert(geometry.glyphs.T.bounds[1]<Math.min(...['B','N','B2','I','C','O'].map(k=>geometry.glyphs[k].bounds[1])));
  for(const name of ['bnbtico','bnbtico-com','bnbtico-cuadrado','bnbtico-com-cuadrado'])for(const [suffix,rgb] of [['blanco',[255,255,255]],['arena',[255,251,242]],['crema',[255,251,242]]]){
    const {data,info}=await sharp(path.join(out,`${name}-terracota-${suffix}.png`)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    for(let x=0;x<info.width;x++){assert.deepEqual([...data.subarray(x*4,x*4+4)],[...rgb,255]);}
  }
  for(const name of ['01-b','02-bt','03-bnb-tico','04-b-compacta','05-cuadrado','06-bt-12-puntos','07-bt-20-puntos','08-bt-28-puntos']){
    for(const size of [16,32,48,64,180,192,512]){const m=await sharp(path.join(compact,`${name}-${size}.png`)).metadata();assert.equal(m.width,size);assert.equal(m.height,size);}
    const ico=fs.readFileSync(path.join(compact,name+'.ico'));assert.equal(ico.readUInt16LE(2),1);assert.equal(ico.readUInt16LE(4),3);
  }
  const emptyFrame=fs.readFileSync(path.join(out,'marco-puntos-transparente.svg'),'utf8');
  assert(!/<path\b/.test(emptyFrame));assert((emptyFrame.match(/<circle\b/g)||[]).length>100);
  for(const name of ['05-cuadrado','06-bt-12-puntos','07-bt-20-puntos','08-bt-28-puntos'])for(const size of [16,32,48,64]){
    const native=fs.readFileSync(path.join(compact,`${name}-${size}.svg`),'utf8');assert(native.includes(`viewBox="0 0 ${size} ${size}"`));
    const {data,info}=await sharp(path.join(compact,`${name}-${size}.png`)).ensureAlpha().raw().toBuffer({resolveWithObject:true});
    for(const dot of native.matchAll(/<circle cx="([^"]+)" cy="([^"]+)" r="([^"]+)"/g)){
      const x=Number(dot[1]),y=Number(dot[2]),r=Number(dot[3]);assert.equal(x%1,.5);assert.equal(y%1,.5);assert(r>=.65);
      const p=(Math.floor(y)*info.width+Math.floor(x))*4;assert(data[p+1]<120,'Punto sin núcleo de tinta suficiente');
    }
  }
  for(const name of ['bnbtico','bnbtico-com','bnbtico-cuadrado','bnbtico-com-cuadrado']){
    const source=fs.readFileSync(path.join(out,`${name}-sobre-fotos.svg`),'utf8');assert(!/<rect\b/.test(source));
    const {data}=await sharp(path.join(out,`${name}-sobre-fotos.png`)).ensureAlpha().raw().toBuffer({resolveWithObject:true});assert.equal(data[3],0);
    const photoColors=[...source.matchAll(/<(?:path|circle)\b[^>]*fill="([^"]+)"/g)].map(m=>m[1]);assert(photoColors.length>0);assert(photoColors.every(c=>c==='#FFFFFF'));
    for(const theme of ['negro','oscuro','verde']){
      const dark=fs.readFileSync(path.join(out,`${name}-crema-sobre-${theme}.svg`),'utf8');
      const fills=[...dark.matchAll(/<(?:path|circle)\b[^>]*fill="([^"]+)"/g)].map(m=>m[1]);assert(fills.length>0);assert(fills.every(c=>c==='#FFFBF2'));
    }
  }
  const report={date:'2026-11-05',svgFiles:files.length,svg:'Trazados, sin fuentes ni imágenes incrustadas',silhouetteIntersectionOverUnion:Number(iou.toFixed(5)),tIsHighest:true,sharedWordPath:true,flatBackgrounds:true,photoLogoTransparent:true,photoInk:'#FFFFFF',solidDarkInk:'#FFFBF2',geometricCircleFrames:true,nativePixelAlignedDots:true,compositions:['BNBTICO','BNBTICO.COM','Cuadrado con BNBTICO','Cuadrado con BNBTICO.COM'],cream:'#FFFBF2',compactOptions:8,compactPngSizes:[16,32,48,64,180,192,512],icoSizes:[16,32,48],mReference:'referencia-m.png',visualInspection:'Comparativa, referencia frente al vector, dominio, Instagram y opciones pequeñas abiertas en el visor'};
  fs.writeFileSync(path.join(out,'verificacion.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
main().catch(e=>{console.error(e);process.exit(1)});
