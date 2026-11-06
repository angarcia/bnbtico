// Comparación exploratoria; conserva los glifos aprobados de B y T.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const {initials,glyph,glyphs,width,height,dots,cream,terra}=require('./probar-sistema-adaptativo.cjs');
const dest=path.resolve(__dirname,'../propuestas/marco-solido-2026-11-05');
const styles=[['01-puntos-bt','Puntos + BT'],['02-contorno-bt','Contorno + BT'],['03-relleno-bt','Relleno + BT'],['04-relleno-b','Relleno + B']];
const text=(x,y,t,size=23,fill='#1C2B2A')=>`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="${fill}">${t}</text>`;
const canvas=(w,h,body,bg=cream)=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${bg}"/>${body}</svg>`);
function icon(name,size,dark=false,transparent=false){
  const ink=dark?cream:terra,negative=dark?'#1C2B2A':cream,bg=dark?'#000000':cream;
  const margin=Math.round(size*.125),span=size-2*margin;
  const filled=name.includes('relleno'),single=name==='04-relleno-b';
  let frame;
  if(name==='01-puntos-bt'){
    if(size<=96)frame=dots(size,ink);
    else{
      frame='';for(let row=0;row<6;row++)for(let col=0;col<6;col++)if(row===0||row===5||col===0||col===5)frame+=`<circle cx="${margin+col*span/5}" cy="${margin+row*span/5}" r="${size*.028}" fill="${ink}"/>`;
    }
  }else if(filled)frame=`<rect x="${margin}" y="${margin}" width="${span}" height="${span}" fill="${ink}"/>`;
  else{
    const stroke=Math.max(1,Math.round(size*.025));
    frame=`<rect x="${margin+stroke/2}" y="${margin+stroke/2}" width="${span-stroke}" height="${span-stroke}" fill="none" stroke="${ink}" stroke-width="${stroke}"/>`;
  }
  let letters;
  const stroke=size<=24?8:5,fill=filled?negative:ink;
  if(single){const g=glyphs.B,scale=310/height(g);letters=glyph('B',(512-width(g)*scale)/2,101,scale,stroke,fill);}
  else letters=initials(288,stroke,fill);
  const body=frame+`<g transform="scale(${size/512})">${letters}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">${transparent?'':`<rect width="100%" height="100%" fill="${bg}"/>`}${body}</svg>`;
}
async function main(){
  fs.mkdirSync(dest,{recursive:true});
  for(const [name] of styles){
    for(const size of [16,24,32,48,64,96,256]){
      const svg=icon(name,size);fs.writeFileSync(path.join(dest,`${name}-${size}.svg`),svg);await sharp(Buffer.from(svg)).png().toFile(path.join(dest,`${name}-${size}.png`));
    }
    for(const [suffix,dark,transparent] of [['crema',false,false],['oscuro',true,false],['transparente',false,true],['crema-transparente',true,true]]){
      const svg=icon(name,512,dark,transparent);fs.writeFileSync(path.join(dest,`${name}-${suffix}.svg`),svg);await sharp(Buffer.from(svg)).png().toFile(path.join(dest,`${name}-${suffix}.png`));
    }
  }
  const parts=[];let labels=text(30,43,'¿Cómo simplificar el cuadrado al reducir?',31);
  for(let i=0;i<styles.length;i++){
    const [name,label]=styles[i],x=30+i*295;
    labels+=text(x,92,label,23);
    parts.push({input:fs.readFileSync(path.join(dest,`${name}-256.png`)),left:x,top:115});
    for(const [size,delta] of [[16,0],[24,45],[32,100],[48,160],[64,220]]){
      parts.push({input:fs.readFileSync(path.join(dest,`${name}-${size}.png`)),left:x+delta,top:405+Math.round((64-size)/2)});labels+=text(x+delta,505,`${size}`,16);
    }
    parts.push({input:await sharp(Buffer.from(icon(name,96,true))).png().toBuffer(),left:x+80,top:545});
  }
  labels+=text(30,532,'Muestras a tamaño real: 16 / 24 / 32 / 48 / 64 px',18);
  labels+=text(30,680,'El contorno conserva la idea del marco; el relleno da más presencia. La B libera espacio al reducir.',20);
  labels+=text(30,712,'Letras originales con ajuste de grosor para cada tamaño. Alternativas pendientes de elección.',20);
  parts.push({input:canvas(1220,750,labels,'transparent'),left:0,top:0});
  await sharp(canvas(1220,750,'')).composite(parts).png().toFile(path.join(dest,'comparativa.png'));
  console.log(dest);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1)});
module.exports={icon};
