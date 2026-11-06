// Selección vigente: contorno+BT 48/64/96; B ancha reforzada 16/24/32.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp'),assert=require('node:assert/strict');
const {icon:frame}=require('./probar-marco-solido.cjs');
const {icon:micro}=require('./probar-microiconos.cjs');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'design/logo/iconos-elegidos-2026-11-05');
const sizes=[16,24,32,48,64,96];
const themes=['crema','crema-sobre-terracota','blanco','transparente','oscuro','negro','crema-transparente','blanco-transparente'];
function render(size,theme){
  const dark=['oscuro','negro','crema-sobre-terracota','crema-transparente','blanco-transparente'].includes(theme);
  const transparent=theme.includes('transparente');
  let svg=size<=32?micro('02-b-mas-ancha',size,dark,transparent):frame('02-contorno-bt',size,dark,transparent);
  if(theme==='blanco')svg=svg.replace('<rect width="100%" height="100%" fill="#FFFBF2"/>','<rect width="100%" height="100%" fill="#FFFFFF"/>');
  if(theme==='oscuro')svg=svg.replace('<rect width="100%" height="100%" fill="#000000"/>','<rect width="100%" height="100%" fill="#1C2B2A"/>');
  if(theme==='crema-sobre-terracota')svg=svg.replace('<rect width="100%" height="100%" fill="#000000"/>','<rect width="100%" height="100%" fill="#B44C30"/>');
  if(theme==='blanco-transparente')svg=svg.replaceAll('#FFFBF2','#FFFFFF');
  return svg;
}
function ico(parts){
  const header=Buffer.alloc(6+parts.length*16);header.writeUInt16LE(1,2);header.writeUInt16LE(parts.length,4);let offset=header.length;
  parts.forEach(({size,png},i)=>{const p=6+i*16;header[p]=size;header[p+1]=size;header.writeUInt16LE(1,p+4);header.writeUInt16LE(32,p+6);header.writeUInt32LE(png.length,p+8);header.writeUInt32LE(offset,p+12);offset+=png.length;});
  return Buffer.concat([header,...parts.map(p=>p.png)]);
}
const text=(x,y,t,size=22,fill='#1C2B2A')=>`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="${fill}">${t}</text>`;
async function main(){
  fs.mkdirSync(out,{recursive:true});const manifest={date:'2026-11-05',status:'elegido por Ana',defaultTheme:'crema',darkOption:'crema-sobre-terracota',sizes:{},favicon:'B reforzada de 16 px conservada en todas las densidades',colors:{terra:'#B44C30',cream:'#FFFBF2',photo:'#FFFFFF'},density:[1,2,3],application:'Recursos de diseño elegidos; sin despliegue ni sustitución de archivos de la app en esta revisión'};
  let count=0;
  for(const theme of themes){
    fs.mkdirSync(path.join(out,theme),{recursive:true});const parts=[];
    for(const size of sizes){
      const source=render(size,theme),base=path.join(out,theme,`icono-${size}`);
      fs.writeFileSync(base+'.svg',source);
      const png=await sharp(Buffer.from(source)).png().toBuffer();fs.writeFileSync(base+'.png',png);parts.push({size,png});
      const meta=await sharp(png).metadata();assert.equal(meta.width,size);assert.equal(meta.height,size);assert(!/<(?:text|image)\b/.test(source));
      for(const dpr of [2,3]){
        const higher=await sharp(Buffer.from(source),{density:72*dpr}).resize(size*dpr,size*dpr).png().toBuffer();
        fs.writeFileSync(base+`@${dpr}x.png`,higher);const m=await sharp(higher).metadata();assert.equal(m.width,size*dpr);
      }
      if(theme==='crema'){
        const ref=size<=32?`design/logo/propuestas/microiconos-2026-11-05/02-b-mas-ancha-${size}`:`design/logo/propuestas/marco-solido-2026-11-05/02-contorno-bt-${size}`;
        assert.equal(source,fs.readFileSync(path.join(root,ref+'.svg'),'utf8'));assert(png.equals(fs.readFileSync(path.join(root,ref+'.png'))));
        manifest.sizes[size]={symbol:size<=32?'B original más ancha y reforzada':'Contorno continuo con BT',source:ref+'.svg'};
      }
      count++;
    }
    fs.writeFileSync(path.join(out,theme,'iconos-por-tamano.ico'),ico(parts));
    const favicon=render(16,theme),favParts=[];
    fs.writeFileSync(path.join(out,theme,'favicon.svg'),favicon);
    for(const physicalSize of sizes){const png=await sharp(Buffer.from(favicon),{density:72*physicalSize/16}).resize(physicalSize,physicalSize).png().toBuffer();favParts.push({size:physicalSize,png});}
    fs.writeFileSync(path.join(out,theme,'favicon.ico'),ico(favParts));
  }
  // La raíz ofrece el acabado predeterminado, sin elegir una carpeta de color.
  for(const file of fs.readdirSync(path.join(out,'crema')))fs.copyFileSync(path.join(out,'crema',file),path.join(out,file));
  fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2)+'\n');
  const boardWidth=1100,boardHeight=390,positions=[35,215,395,575,755,935],display=[96,64,48,32,24,16],layers=[];
  let labels=text(30,40,'Iconos elegidos · contorno + BT → B reforzada',29);
  for(let i=0;i<display.length;i++){
    const size=display[i],x=positions[i];labels+=text(x,80,size+' px',22);
    layers.push({input:fs.readFileSync(path.join(out,'crema',`icono-${size}.png`)),left:x+Math.round((96-size)/2),top:100+Math.round((96-size)/2)});
    layers.push({input:fs.readFileSync(path.join(out,'crema-sobre-terracota',`icono-${size}.png`)),left:x+Math.round((96-size)/2),top:220+Math.round((96-size)/2)});
  }
  labels+=text(30,365,'Arriba: predeterminado, terracota sobre crema. Abajo: alternativa crema sobre terracota.',20);
  layers.push({input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${boardWidth}" height="${boardHeight}">${labels}</svg>`),left:0,top:0});
  const board=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${boardWidth}" height="${boardHeight}"><rect width="100%" height="100%" fill="#FFFBF2"/></svg>`);
  await sharp(board).composite(layers).png().toFile(path.join(out,'seleccion.png'));
  console.log(`${count} SVG nativos + PNG 1×/2×/3×, 8 ICO por tamaño y 8 favicon ICO; las 6 versiones crema coinciden con las referencias elegidas. B hasta 32 px.`);
}
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1)});
