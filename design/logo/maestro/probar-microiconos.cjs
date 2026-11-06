// Exploración óptica para iconos mínimos; no cambia el nombre del logo.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const {glyph,glyphs,width,height,cream,terra}=require('./probar-sistema-adaptativo.cjs');
const out=path.resolve(__dirname,'../propuestas/microiconos-2026-11-05');
const bCompact='M4 2H7.25C9.75 2 11.25 3.35 11.25 5.25C11.25 6.5 10.65 7.4 9.65 7.85C11.1 8.35 12 9.45 12 10.9C12 13 10.2 14.25 7.6 14.25H4ZM6 4V7H7.25C8.55 7 9.25 6.4 9.25 5.5C9.25 4.55 8.55 4 7.25 4ZM6 9V12.25H7.55C9.15 12.25 10 11.65 10 10.65C10 9.6 9.15 9 7.55 9Z';
const paint=(d,color)=>`<path d="${d}" fill="${color}" fill-rule="evenodd"/>`;
const styles=[['01-b-original','1 · B fina original'],['02-b-mas-ancha','2 · B original más ancha'],['03-b-negativo','3 · B ancha en negativo'],['04-bt-compacta','4 · BT más compacta'],['05-cuadrado-solo','5 · Solo cuadrado, 8 puntos'],['06-cuatro-esquinas','6 · Cuadrado, cuatro esquinas']];
function wideB(size,fill){
  const g=glyphs.B,sy=350/height(g),sx=sy*1.8,x=(512-width(g)*sx)/2;
  return `<g transform="scale(${size/512})"><g transform="translate(${x} 81) scale(${sx} ${sy}) translate(${-g.bounds[0]} ${-g.bounds[1]})"><path d="${g.d}" fill="${fill}" stroke="${fill}" stroke-width="${size<=24?8:5}" stroke-linejoin="round" fill-rule="evenodd"/></g></g>`;
}
function icon(name,size=16,dark=false,transparent=false){
  const ink=dark?cream:terra,bg=dark?'#000000':cream,negative=dark?'#1C2B2A':cream;
  let body='';
  if(name==='01-b-original'){
    const g=glyphs.B,scale=350/height(g);body=`<g transform="scale(${size/512})">${glyph('B',(512-width(g)*scale)/2,81,scale,size<=24?8:5,ink)}</g>`;
  }else if(name==='02-b-mas-ancha')body=wideB(size,ink);
  else if(name==='03-b-negativo')body=`<g transform="scale(${size/16})"><rect x="1" y="1" width="14" height="14" fill="${ink}"/></g>`+wideB(size,negative);
  else if(name==='04-bt-compacta'){
    const t='M18 2L30 3.7V7L25.2 6.4V24H27.2V27H19.5V24H21.5V5.9L18 5.4Z';
    body=`<g transform="scale(${size/32})"><g transform="translate(-4.6 1) scale(1.65 1.8)">${paint(bCompact,ink)}</g>${paint(t,ink)}</g>`;
  }else if(name==='05-cuadrado-solo'){
    const m=Math.max(2,Math.round(size*.15625))+.5,max=size-m,mid=size/2+.5,r=size===16?1.1:size===24?1.5:size===32?2:size*.0625;
    for(const [x,y] of [[m,m],[mid,m],[max,m],[m,mid],[max,mid],[m,max],[mid,max],[max,max]])body+=`<circle cx="${x}" cy="${y}" r="${r}" fill="${ink}"/>`;
  }else{
    const m=Math.max(2,Math.round(size*.125)),w=Math.max(1,Math.round(size*.125)),arm=Math.round(size*.3125),end=size-m;
    for(const [x,y] of [[m,m],[end-arm,m],[m,end-w],[end-arm,end-w]])body+=`<rect x="${x}" y="${y}" width="${arm}" height="${w}" fill="${ink}"/>`;
    for(const [x,y] of [[m,m],[end-w,m],[m,end-arm],[end-w,end-arm]])body+=`<rect x="${x}" y="${y}" width="${w}" height="${arm}" fill="${ink}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${transparent?'':`<rect width="100%" height="100%" fill="${bg}"/>`}${body}</svg>`;
}
const text=(x,y,t,size=23)=>`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="#1C2B2A">${t}</text>`;
async function main(){
  fs.mkdirSync(out,{recursive:true});
  for(const [name] of styles){
    for(const size of [16,24,32,48,64,128,512]){
      const svg=icon(name,size);fs.writeFileSync(path.join(out,`${name}-${size}.svg`),svg);await sharp(Buffer.from(svg)).png().toFile(path.join(out,`${name}-${size}.png`));
    }
    for(const [suffix,dark,transparent] of [['oscuro',true,false],['transparente',false,true],['crema-transparente',true,true]]){
      const svg=icon(name,512,dark,transparent);fs.writeFileSync(path.join(out,`${name}-${suffix}.svg`),svg);await sharp(Buffer.from(svg)).png().toFile(path.join(out,`${name}-${suffix}.png`));
    }
  }
  const parts=[];let labels=text(30,43,'Opciones para tamaños mínimos · conservar lectura e identidad',29);
  let panels='';
  for(let i=0;i<styles.length;i++){
    const [name,label]=styles[i],x=30+(i%3)*400,y=80+Math.floor(i/3)*380;
    panels+=`<rect x="${x}" y="${y}" width="370" height="355" rx="12" fill="#FFFFFF"/>`;
    labels+=text(x+18,y+34,label,21);
    parts.push({input:fs.readFileSync(path.join(out,`${name}-128.png`)),left:x+120,top:y+55});
    for(const [size,delta] of [[16,25],[24,105],[32,185],[48,275]]){
      parts.push({input:fs.readFileSync(path.join(out,`${name}-${size}.png`)),left:x+delta,top:y+215+Math.round((48-size)/2)});labels+=text(x+delta,y+293,`${size} px`,16);
    }
    parts.push({input:await sharp(Buffer.from(icon(name,32,true))).png().toBuffer(),left:x+305,top:y+310});labels+=text(x+18,y+334,'Crema sobre oscuro →',16);
  }
  labels+=text(30,870,'1 conserva la B aprobada; 2 y 3 ensanchan esa misma letra. 4 redibuja BT para ganar lectura.',20);
  labels+=text(30,905,'5 y 6 conservan la idea del cuadrado sin letras. Son propuestas para comparar, no una elección final.',20);
  const base=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1230" height="940"><rect width="100%" height="100%" fill="#EEEAE2"/>${panels}</svg>`);
  parts.push({input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1230" height="940">${labels}</svg>`),left:0,top:0});
  await sharp(base).composite(parts).png().toFile(path.join(out,'comparativa.png'));
  console.log(out);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1)});
module.exports={icon};
