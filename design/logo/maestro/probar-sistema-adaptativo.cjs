// Propuesta para revisar: no sustituye los iconos de la app ni el maestro.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.resolve(__dirname,'../../..');
const base=path.join(root,'design/logo/propuestas/iconos-compactos-2026-11-05');
const dest=path.join(root,'design/logo/propuestas/sistema-adaptativo-2026-11-05');
const geometry=JSON.parse(fs.readFileSync(path.join(__dirname,'geometria.json')));
const source=fs.readFileSync(path.join(base,'02-bt.svg'),'utf8');
const paths=[...source.matchAll(/<path\b[^>]*\sd="([^"]+)"/g)].map(m=>m[1]);
if(paths.length!==2)throw new Error('Se esperaban los glifos originales B y T');
const glyphs={B:{...geometry.glyphs.B,d:paths[0]},T:{...geometry.glyphs.T,d:paths[1]}};
const cream='#FFFBF2',terra='#B44C30';
const width=g=>g.bounds[2]-g.bounds[0],height=g=>g.bounds[3]-g.bounds[1];
const glyph=(name,x,y,scale,stroke,fill)=>{const g=glyphs[name];return `<g transform="translate(${x} ${y}) scale(${scale}) translate(${-g.bounds[0]} ${-g.bounds[1]})"><path fill="${fill}" fill-rule="evenodd" stroke="${fill}" stroke-width="${stroke}" stroke-linejoin="round" d="${g.d}"/></g>`;};
function initials(targetHeight,stroke,fill){
  const h=height(glyphs.T),scale=targetHeight/h,gap=20,total=(width(glyphs.B)+gap+width(glyphs.T))*scale;
  const x=(512-total)/2,y=(512-targetHeight)/2;
  return glyph('B',x,y+(height(glyphs.T)-height(glyphs.B))*scale,scale,stroke,fill)+glyph('T',x+(width(glyphs.B)+gap)*scale,y,scale,stroke,fill);
}
function dots(size,fill){
  const count=size<=24?4:6,margin=size*.125+.5,step=(size-2*margin)/(count-1),r=size<=16?.65:size<=24?.85:size<=32?1.2:size<=48?1.5:size<=64?2:2.5;
  let body='';for(let row=0;row<count;row++)for(let col=0;col<count;col++)if(row===0||row===count-1||col===0||col===count-1){const x=Math.round(margin+col*step-.5)+.5,y=Math.round(margin+row*step-.5)+.5;body+=`<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}"/>`;}
  return body;
}
function icon(name,size,fill=terra,bg=cream){
  let body;
  if(name==='cuadrado-bt')body=dots(size,fill)+`<g transform="scale(${size/512})">${initials(244,size<=24?8:6,fill)}</g>`;
  else if(name==='bt')body=`<g transform="scale(${size/512})">${initials(340,size<=24?7:5,fill)}</g>`;
  else{const g=glyphs.B,scale=350/height(g);body=`<g transform="scale(${size/512})">${glyph('B',(512-width(g)*scale)/2,81,scale,size<=24?8:5,fill)}</g>`;}
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${bg?`<rect width="100%" height="100%" fill="${bg}"/>`:''}${body}</svg>`;
}
const text=(x,y,t,size=22,fill='#1C2B2A')=>`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="${fill}">${t}</text>`;
async function main(){
  fs.mkdirSync(dest,{recursive:true});
  const sizes=[16,24,32,48,64,96];
  for(const name of ['cuadrado-bt','bt','b']){
    for(const size of sizes){const svg=icon(name,size);fs.writeFileSync(path.join(dest,`${name}-${size}.svg`),svg);await sharp(Buffer.from(svg)).png().toFile(path.join(dest,`${name}-${size}.png`));}
    for(const [suffix,fill,bg] of [['crema',terra,cream],['oscuro',cream,'#000000'],['transparente',terra,null],['blanco-transparente','#FFFFFF',null]]){
      const svg=icon(name,512,fill,bg);fs.writeFileSync(path.join(dest,`${name}-${suffix}.svg`),svg);await sharp(Buffer.from(svg)).png().toFile(path.join(dest,`${name}-${suffix}.png`));
    }
  }
  const columns=[360,470,580,700,830,990],parts=[];
  let labels=text(30,42,'Prueba de reducción · mismo carácter, menos elementos',29);
  sizes.forEach((s,i)=>labels+=text(columns[i]-10,96,s+' px',19));
  for(const [row,name,label] of [[0,'cuadrado-bt','Cuadrado con BT'],[1,'bt','BT sin marco'],[2,'b','Solo B']]){
    const y=130+row*150;labels+=text(30,y+45,label,23);
    for(let i=0;i<sizes.length;i++)parts.push({input:fs.readFileSync(path.join(dest,`${name}-${sizes[i]}.png`)),left:columns[i],top:y+Math.round((96-sizes[i])/2)});
  }
  labels+=text(30,620,'Secuencia propuesta para revisar: 64 px o más → cuadrado + BT; 32–48 px → BT; 16–24 px → B.',20);
  labels+=text(30,656,'Misma B y misma T del logo; refuerzo óptico del trazo al reducir. Propuesta pendiente de elección.',20);
  const board=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1150" height="690"><rect width="100%" height="100%" fill="${cream}"/>${labels}</svg>`);
  await sharp(board).composite(parts).png().toFile(path.join(dest,'comparativa.png'));
  console.log(dest);
}
module.exports={initials,glyph,glyphs,width,height,dots,cream,terra};
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1)});
