// Maestro vectorial del logo aprobado por Ana el 2026-11-05.
// Uso: NODE_PATH=<módulos con sharp> node design/logo/maestro/generar.cjs
// No usa fuentes ni generación de imágenes: traza la referencia aprobada.
const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');

const here = __dirname;
const root = path.resolve(here, '../../..');
const out = path.join(root, 'design/logo/unificado-2026-11-05');
const compact = path.join(root, 'design/logo/propuestas/iconos-compactos-2026-11-05');
const colors = { terra: '#B44C30', cream: '#FFFBF2', sand: '#FFFBF2', white: '#FFFFFF', dark: '#1C2B2A' };
const fmt = n => Number(n.toFixed(3));

async function field(file, crop, transparent = false) {
  const { data, info } = await sharp(file).extract(crop).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const values = new Float64Array(info.width * info.height);
  for (let i = 0; i < values.length; i++) {
    const j = i * 4;
    values[i] = transparent ? data[j + 3] / 255 : Math.max(0, Math.min(1, (data[j] - data[j + 1] - 5) / 104));
  }
  return { values, width: info.width, height: info.height };
}

// Marching squares con interpolación: contornos subpíxel de la tinta.
function contours({ values, width, height }) {
  const segments = [];
  const pairs = [[], [[3,0]], [[0,1]], [[3,1]], [[1,2]], [[3,0],[1,2]], [[0,2]], [[3,2]], [[2,3]], [[0,2]], [[0,1],[2,3]], [[1,2]], [[1,3]], [[0,1]], [[0,3]], []];
  for (let y = 0; y < height - 1; y++) for (let x = 0; x < width - 1; x++) {
    const v = [values[y*width+x], values[y*width+x+1], values[(y+1)*width+x+1], values[(y+1)*width+x]];
    const code = v.reduce((acc,n,i) => acc | (n >= .5 ? 1 << i : 0), 0);
    if (!pairs[code].length) continue;
    const corners = [[x+.5,y+.5],[x+1.5,y+.5],[x+1.5,y+1.5],[x+.5,y+1.5]];
    const edge = e => {
      const a=e, b=(e+1)%4, t=(.5-v[a])/(v[b]-v[a]);
      return [corners[a][0]+t*(corners[b][0]-corners[a][0]), corners[a][1]+t*(corners[b][1]-corners[a][1])];
    };
    for (const [a,b] of pairs[code]) segments.push([edge(a),edge(b)]);
  }
  const key = p => `${p[0].toFixed(5)},${p[1].toFixed(5)}`;
  const links = new Map();
  segments.forEach((s,i) => s.forEach(p => { const k=key(p); if(!links.has(k)) links.set(k,[]); links.get(k).push(i); }));
  const used = new Set(), loops=[];
  for(let i=0;i<segments.length;i++) {
    if(used.has(i)) continue;
    const loop=[segments[i][0]], start=key(loop[0]); let end=segments[i][1]; used.add(i);
    while(key(end)!==start) {
      loop.push(end);
      const next=links.get(key(end))?.find(n=>!used.has(n));
      if(next===undefined) throw new Error('Contorno abierto en la referencia');
      used.add(next); const seg=segments[next]; end=key(seg[0])===key(end)?seg[1]:seg[0];
    }
    if(loop.length>=12) loops.push(loop);
  }
  return loops;
}

function lineDistance(p,a,b) {
  const dx=b[0]-a[0],dy=b[1]-a[1],t=Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1)));
  return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);
}
function simplify(points, tolerance=.3) {
  if(points.length<3) return points;
  let max=0,index=0;
  for(let i=1;i<points.length-1;i++){const d=lineDistance(points[i],points[0],points.at(-1));if(d>max){max=d;index=i;}}
  return max>tolerance ? [...simplify(points.slice(0,index+1),tolerance).slice(0,-1),...simplify(points.slice(index),tolerance)] : [points[0],points.at(-1)];
}
function curve(loop) {
  let far=0;
  for(let i=1;i<loop.length;i++) if(Math.hypot(loop[i][0]-loop[0][0],loop[i][1]-loop[0][1])>Math.hypot(loop[far][0]-loop[0][0],loop[far][1]-loop[0][1])) far=i;
  const p=[...simplify(loop.slice(0,far+1)).slice(0,-1),...simplify([...loop.slice(far),loop[0]]).slice(0,-1)];
  // Curvas suaves que siguen los puntos trazados; no regularizan las letras.
  let d=`M${fmt(p[0][0])} ${fmt(p[0][1])}`;
  for(let i=0;i<p.length;i++) {
    const a=p[(i+p.length-1)%p.length],b=p[i],c=p[(i+1)%p.length],e=p[(i+2)%p.length];
    const ab=Math.hypot(b[0]-a[0],b[1]-a[1]),bc=Math.hypot(c[0]-b[0],c[1]-b[1]),ce=Math.hypot(e[0]-c[0],e[1]-c[1]);
    const ac=Math.hypot(c[0]-a[0],c[1]-a[1])||1,be=Math.hypot(e[0]-b[0],e[1]-b[1])||1;
    const k1=Math.min(ab,bc)/(3*ac),k2=Math.min(bc,ce)/(3*be);
    d+=`C${fmt(b[0]+(c[0]-a[0])*k1)} ${fmt(b[1]+(c[1]-a[1])*k1)} ${fmt(c[0]-(e[0]-b[0])*k2)} ${fmt(c[1]-(e[1]-b[1])*k2)} ${fmt(c[0])} ${fmt(c[1])}`;
  }
  return d+'Z';
}
function trace(f) {
  const loops=contours(f);
  const pts=loops.flat();
  return {d:loops.map(curve).join(''), bounds:[Math.min(...pts.map(p=>p[0])),Math.min(...pts.map(p=>p[1])),Math.max(...pts.map(p=>p[0])),Math.max(...pts.map(p=>p[1]))], loops:loops.length};
}
function circleFrame(f,fill=colors.terra){
  const boxes=contours(f).map(loop=>{
    const xs=loop.map(p=>p[0]),ys=loop.map(p=>p[1]);
    return [Math.min(...xs),Math.min(...ys),Math.max(...xs),Math.max(...ys)];
  });
  const radii=boxes.map(b=>(b[2]-b[0]+b[3]-b[1])/4).sort((a,b)=>a-b);
  const radius=radii[Math.floor(radii.length/2)];
  return boxes.map(b=>`<circle cx="${fmt((b[0]+b[2])/2)}" cy="${fmt((b[1]+b[3])/2)}" r="${fmt(radius)}" fill="${fill}"/>`).join('');
}
function dottedSquare(size,count=4,fill=colors.terra,pixelAligned=false){
  const margin=size*.125+(pixelAligned?.5:0),step=(size-2*margin)/(count-1);
  const radius=pixelAligned?(size===16?.65:size===32?(count>=8?.85:1.2):size===48?(count>=8?1.25:1.5):2):size*(count>=8?.019:count>=6?.023:.03);
  const dots=[];
  for(let row=0;row<count;row++)for(let col=0;col<count;col++)if(row===0||row===count-1||col===0||col===count-1){
    let x=margin+col*step,y=margin+row*step;
    if(pixelAligned){x=Math.round(x-.5)+.5;y=Math.round(y-.5)+.5;}
    dots.push(`<circle cx="${fmt(x)}" cy="${fmt(y)}" r="${fmt(radius)}" fill="${fill}"/>`);
  }
  return dots.join('');
}
function mark(d,fill=colors.terra,stroke=0) { return `<path fill="${fill}" fill-rule="evenodd"${stroke?` stroke="${fill}" stroke-width="${stroke}" stroke-linejoin="round"`:''} d="${d}"/>`; }
function svg(w,h,body,bg=null,title='bnbtico') {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${fmt(w)}" height="${fmt(h)}" viewBox="0 0 ${fmt(w)} ${fmt(h)}" role="img" aria-label="${title}"><title>${title}</title>${bg?`<rect width="100%" height="100%" fill="${bg}"/>`:''}${body}</svg>`;
}
async function save(base,source,width=2400) {
  fs.mkdirSync(path.dirname(base),{recursive:true});
  fs.writeFileSync(base+'.svg',source);
  const background=source.match(/<rect width="100%" height="100%" fill="([^"]+)"\/>/);
  if(background){
    const foreground=await sharp(Buffer.from(source.replace(background[0],''))).resize({width}).png().toBuffer();
    const {height}=await sharp(foreground).metadata();
    await sharp({create:{width,height,channels:4,background:background[1]}}).composite([{input:foreground,left:0,top:0}]).png().toFile(base+'.png');
  }else await sharp(Buffer.from(source)).resize({width}).png().toFile(base+'.png');
}

async function main() {
  fs.mkdirSync(out,{recursive:true});fs.mkdirSync(compact,{recursive:true});
  const wordField=await field(path.join(here,'referencia-aprobada.png'),{left:280,top:480,width:720,height:280});
  const word=trace(wordField);
  const [left,top,right,bottom]=word.bounds;
  const W=right-left,H=bottom-top;
  const letterRanges={ B:[10,95],N:[108,205],B2:[225,315],T:[310,420],I:[425,477],C:[490,585],O:[592,702] };
  const glyphs={};
  for(const [name,[x1,x2]] of Object.entries(letterRanges)) {
    const values=new Float64Array(wordField.values.length);
    for(let y=0;y<wordField.height;y++) for(let x=x1;x<x2;x++)values[y*wordField.width+x]=wordField.values[y*wordField.width+x];
    glyphs[name]=trace({...wordField,values});
  }
  const m=trace(await field(path.join(here,'referencia-m.png'),{left:45,top:90,width:205,height:410}));
  const original=mark(word.d);
  const wordBody=(fill=colors.terra)=>`<g transform="translate(${-left} ${-top})">${mark(word.d,fill)}</g>`;
  const glyph=(name,x,y,scale=1,fill=colors.terra,stroke=0)=>{
    const g=glyphs[name];return `<g transform="translate(${fmt(x)} ${fmt(y)}) scale(${fmt(scale)}) translate(${fmt(-g.bounds[0])} ${fmt(-g.bounds[1])})">${mark(g.d,fill,stroke)}</g>`;
  };
  const baseY=glyphs.O.bounds[3]-top;
  const width=g=>g.bounds[2]-g.bounds[0],height=g=>g.bounds[3]-g.bounds[1];
  const normalHeight=height(glyphs.C), gap=29, pointR=8;
  const dotX=W+23, cx=dotX+pointR*2+gap, ox=cx+width(glyphs.C)+gap, mx=ox+width(glyphs.O)+gap;
  const ms=normalHeight/height(m),CW=mx+width(m)*ms;
  const comBody=(fill=colors.terra)=> wordBody(fill)+`<circle cx="${fmt(dotX+pointR)}" cy="${fmt(baseY-pointR)}" r="${pointR}" fill="${fill}"/>`+glyph('C',cx,glyphs.C.bounds[1]-top,1,fill)+glyph('O',ox,glyphs.O.bounds[1]-top,1,fill)+`<g transform="translate(${fmt(mx)} ${fmt(baseY-normalHeight)}) scale(${fmt(ms)}) translate(${fmt(-m.bounds[0])} ${fmt(-m.bounds[1])})">${mark(m.d,fill)}</g>`;
  const variants=[['terracota-transparente',colors.terra,null],['terracota-blanco',colors.terra,colors.white],['terracota-arena',colors.terra,colors.sand],['terracota-crema',colors.terra,colors.cream],['crema-sobre-terracota',colors.cream,colors.terra],['blanco-transparente',colors.white,null],['crema-transparente',colors.cream,null],['negro-transparente','#1C2B2A',null],['tinta-transparente','#1C2B2A',null],['carbon-calido-transparente','#2B2926',null],['crema-sobre-negro',colors.cream,'#000000'],['crema-sobre-oscuro',colors.cream,colors.dark],['crema-sobre-verde',colors.cream,'#2F5D45']];
  for(const [name,w,body] of [['bnbtico',W,wordBody],['bnbtico-com',CW,comBody]]) {
    await save(path.join(here,name),svg(w,H,body(),null,name==='bnbtico'?'BNBTICO':'BNBTICO.COM'));
    for(const [variant,fill,bg] of variants) {
      const pad=bg?32:0;
      await save(path.join(out,`${name}-${variant}`),svg(w+pad*2,H+pad*2,`<g transform="translate(${pad} ${pad})">${body(fill)}</g>`,bg));
    }
    await save(path.join(out,`${name}-sobre-fotos`),svg(w,H,body(colors.white)));
  }

  // Marco vectorial del mismo cuadrado aprobado, sin la palabra central.
  const frameField=await field(path.join(here,'referencia-aprobada.png'),{left:0,top:0,width:1254,height:1254});
  for(let y=450;y<800;y++)for(let x=260;x<1000;x++)frameField.values[y*1254+x]=0;
  const frame=fill=>circleFrame(frameField,fill);
  await save(path.join(out,'marco-puntos-transparente'),svg(1254,1254,frame()),1254);
  for(const [name,w,body] of [['bnbtico',W,wordBody],['bnbtico-com',CW,comBody]]) {
    const scale=(name==='bnbtico'?W:670)/w;
    const x=(1254-w*scale)/2,y=(1254-H*scale)/2;
    const squareBody=fill=>frame(fill)+`<g transform="translate(${fmt(x)} ${fmt(y)}) scale(${fmt(scale)})">${body(fill)}</g>`;
    for(const [variant,fill,bg] of variants)await save(path.join(out,`${name}-cuadrado-${variant}`),svg(1254,1254,squareBody(fill),bg),1254);
    await save(path.join(out,`${name}-cuadrado-sobre-fotos`),svg(1254,1254,squareBody(colors.white)),1254);
    const s=svg(1254,1254,frame()+`<g transform="translate(${fmt(x)} ${fmt(y)}) scale(${fmt(scale)})">${body()}</g>`,colors.cream);
    await save(path.join(out,`${name}-instagram-puntos`),s,1254);
    const black=svg(1254,1254,frame('#2B2926')+`<g transform="translate(${fmt(x)} ${fmt(y)}) scale(${fmt(scale)})">${body('#2B2926')}</g>`);
    await save(path.join(out,`${name}-merchandising-puntos-negro`),black,3000);
    if(name==='bnbtico-com')await sharp(Buffer.from(black)).resize(3000,3000).flatten({background:'#FFFFFF'}).png().toFile(path.join(out,'bnbtico-com-merchandising-puntos-vista-blanca.png'));
  }

  // Los nombres sin sufijo ofrecen el acabado predeterminado transparente.
  for(const name of ['bnbtico','bnbtico-com','bnbtico-cuadrado','bnbtico-com-cuadrado'])for(const ext of ['svg','png'])fs.copyFileSync(path.join(out,`${name}-terracota-transparente.${ext}`),path.join(out,`${name}.${ext}`));

  // Propuestas compactas; el cuadrado no lleva letras.
  const size=512,optical=3;
  const bscale=310/height(glyphs.B);
  const b= glyph('B',(size-width(glyphs.B)*bscale)/2,101,bscale,colors.terra,optical);
  const btScale=290/H,btW=(width(glyphs.B)+20+width(glyphs.T))*btScale;
  const btX=(size-btW)/2;
  const bt=glyph('B',btX,111+(H-height(glyphs.B))*btScale,btScale,colors.terra,optical)+glyph('T',btX+(width(glyphs.B)+20)*btScale,111,btScale,colors.terra,optical);
  const row1Width=width(glyphs.B)+width(glyphs.N)+width(glyphs.B2)+36;
  const row2Width=width(glyphs.T)+width(glyphs.I)+width(glyphs.C)+width(glyphs.O)+45;
  const stackedScale=350/Math.max(row1Width,row2Width);
  function row(names,rowWidth,y){let x=(size-rowWidth*stackedScale)/2;return names.map(name=>{const s=glyph(name,x,y+(H-height(glyphs[name]))*stackedScale,stackedScale,colors.terra,2);x+=(width(glyphs[name])+(names.length===3?18:15))*stackedScale;return s;}).join('');}
  const stacked=row(['B','N','B2'],row1Width,32)+row(['T','I','C','O'],row2Width,268);
  const solidB=mark('M155 88H250C314 88 353 121 353 175C353 211 336 235 307 247C346 260 368 290 368 332C368 390 325 424 254 424H155ZM207 135V226H247C283 226 301 210 301 179C301 149 281 135 247 135ZM207 273V377H252C294 377 315 360 315 326C315 291 291 273 250 273Z');
  const squareField=await field(path.join(here,'referencia-cuadrado-puntos.png'),{left:0,top:0,width:1254,height:1254});
  const square=`<g transform="scale(${fmt(size/1254)})">${circleFrame(squareField)}</g>`;
  const smallDots=[];
  for(let row=0;row<4;row++)for(let col=0;col<4;col++)if(row===0||row===3||col===0||col===3)smallDots.push(`<circle cx="${fmt(96+col*320/3)}" cy="${fmt(96+row*320/3)}" r="28" fill="${colors.terra}"/>`);
  const simpleSquare=smallDots.join('');
  const simpleSource=svg(size,size,simpleSquare,colors.cream,'Cuadrado de puntos simplificado, sin letras');
  await save(path.join(compact,'05-cuadrado-favicon'),simpleSource,512);
  await save(path.join(compact,'05-cuadrado-favicon-oscuro'),svg(size,size,simpleSquare.replaceAll(colors.terra,colors.cream),colors.dark),512);
  await save(path.join(compact,'05-cuadrado-transparente'),svg(size,size,square),1024);
  await save(path.join(compact,'05-cuadrado-blanco-transparente'),svg(size,size,square.replaceAll(colors.terra,colors.white)),1024);
  const miniBtScale=244/H,miniBtWidth=(width(glyphs.B)+20+width(glyphs.T))*miniBtScale,miniBtX=(size-miniBtWidth)/2;
  const miniBt=glyph('B',miniBtX,134+(H-height(glyphs.B))*miniBtScale,miniBtScale,colors.terra,6)+glyph('T',miniBtX+(width(glyphs.B)+20)*miniBtScale,134,miniBtScale,colors.terra,6);
  const framedBt=[['06-bt-12-puntos',4],['07-bt-20-puntos',6],['08-bt-28-puntos',8]];
  const choices=[['01-b',b],['02-bt',bt],['03-bnb-tico',stacked],['04-b-compacta',solidB],['05-cuadrado',square],...framedBt.map(([name,count])=>[name,dottedSquare(size,count)+miniBt])];
  for(const [name,body] of choices) {
    const source=svg(size,size,body,colors.cream,`Propuesta ${name}`);
    await save(path.join(compact,name),source,1024);
    const icoParts=[];
    for(const s of [16,32,48,64,180,192,512]) {
      const framed=framedBt.find(([n])=>n===name);
      const useNative=s<=64&&(framed||name==='05-cuadrado');
      const native=useNative?svg(s,s,dottedSquare(s,s===16?4:(framed?framed[1]:(s<=32?4:6)),colors.terra,true)+(framed?`<g transform="scale(${s/size})">${miniBt}</g>`:''),colors.cream):source;
      if(useNative)fs.writeFileSync(path.join(compact,`${name}-${s}.svg`),native);
      const png=await sharp(Buffer.from(native)).resize(s,s).png().toBuffer();
      fs.writeFileSync(path.join(compact,`${name}-${s}.png`),png);
      if(s<=48)icoParts.push({size:s,png});
    }
    const icoHeader=Buffer.alloc(6+icoParts.length*16);icoHeader.writeUInt16LE(1,2);icoHeader.writeUInt16LE(icoParts.length,4);
    let offset=icoHeader.length;
    icoParts.forEach(({size,png},i)=>{const p=6+i*16;icoHeader[p]=size;icoHeader[p+1]=size;icoHeader.writeUInt16LE(1,p+4);icoHeader.writeUInt16LE(32,p+6);icoHeader.writeUInt32LE(png.length,p+8);icoHeader.writeUInt32LE(offset,p+12);offset+=png.length;});
    fs.writeFileSync(path.join(compact,`${name}.ico`),Buffer.concat([icoHeader,...icoParts.map(p=>p.png)]));
    await save(path.join(compact,`${name}-oscuro`),svg(size,size,body.replaceAll(colors.terra,colors.cream),'#1C2B2A'),512);
  }
  fs.writeFileSync(path.join(here,'geometria.json'),JSON.stringify({reference:'referencia-aprobada.png',word:{bounds:word.bounds,loops:word.loops,width:W,height:H},glyphs:Object.fromEntries(Object.entries(glyphs).map(([k,g])=>[k,{bounds:g.bounds,loops:g.loops}])),domainWidth:CW,sourceM:m.bounds,opticalStroke:optical},null,2)+'\n');
  fs.writeFileSync(path.join(here,'contorno-referencia.svg'),svg(720,280,original));
  console.log(JSON.stringify({wordWidth:W,wordHeight:H,domainWidth:CW,glyphs:Object.keys(glyphs),out,compact},null,2));
}
main().catch(error=>{console.error(error);process.exit(1);});
