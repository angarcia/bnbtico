const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'design/logo/unificado-2026-11-05'),compact=path.join(root,'design/logo/propuestas/iconos-compactos-2026-11-05');
const pack=path.join(root,'design/logo/negro-y-fotos-2026-11-05');
const text=(x,y,t,size=24,fill='#1C2B2A')=>`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="${fill}">${t}</text>`;
const canvas=(w,h,body,bg='#FFFBF2')=>Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}"><rect width="100%" height="100%" fill="${bg}"/>${body}</svg>`);
async function main(){
  const choices=[['06-bt-12-puntos','F · 12 puntos'],['07-bt-20-puntos','G · 20 puntos'],['08-bt-28-puntos','H · 28 puntos']];
  let labels=text(30,45,'BT dentro del cuadrado · círculos geométricos',31),layers=[];
  for(let i=0;i<choices.length;i++){
    const [name,label]=choices[i],x=30+i*400;labels+=text(x,92,label,25);
    layers.push({input:await sharp(path.join(compact,name+'.svg')).resize(250,250).png().toBuffer(),left:x+50,top:110});
    for(const [size,delta] of [[16,10],[32,80],[48,160],[64,250]]){
      layers.push({input:fs.readFileSync(path.join(compact,`${name}-${size}.png`)),left:x+delta,top:400});labels+=text(x+delta,505,`${size} px`,17);
    }
  }
  labels+=text(30,555,'16 px: marco reducido a 12 puntos en las tres opciones; BT mantiene el refuerzo óptico.',20);
  labels+=text(30,588,'Los SVG de 16/32/48/64 px se dibujan a su tamaño, con centros ajustados a la cuadrícula.',20);
  layers.push({input:canvas(1230,620,labels,'transparent'),left:0,top:0});
  await sharp(canvas(1230,620,'')).composite(layers).png().toFile(path.join(compact,'comparativa-bt-puntos.png'));

  const forms=[['bnbtico','BNBTICO'],['bnbtico-com','BNBTICO.COM'],['bnbtico-cuadrado','Cuadrado con BNBTICO'],['bnbtico-com-cuadrado','Cuadrado con BNBTICO.COM']];
  for(const [folder,suffix] of [['fondo-negro','crema-sobre-negro'],['fondo-oscuro','crema-sobre-oscuro'],['fondo-verde','crema-sobre-verde'],['fondo-terracota','crema-sobre-terracota'],['fotos-transparente','sobre-fotos'],['tinta-negra','negro-transparente']]){
    fs.mkdirSync(path.join(pack,folder),{recursive:true});
    for(const [name] of forms)for(const ext of ['svg','png'])fs.copyFileSync(path.join(out,`${name}-${suffix}.${ext}`),path.join(pack,folder,`${name}.${ext}`));
  }
  for(const mode of ['negro','fotos','terracota']){
    const solid=mode!=='fotos';
    let label=text(30,42,solid?`Cuatro versiones · crema #FFFBF2 sobre ${mode}`:'Cuatro versiones sobre foto · logo blanco transparente',29,solid?'#FFFBF2':'#1C2B2A');
    const parts=[];
    for(let i=0;i<forms.length;i++){
      const [name,title]=forms[i],x=i%2===0?30:625,y=i<2?105:475;
      label+=text(x,y-20,title,23,solid?'#FFFBF2':'#1C2B2A');
      if(mode==='fotos')parts.push({input:await sharp(path.join(root,`design/pantallas/fotos/${i<2?'bedroom':'bistro'}.jpg`)).resize(545,i<2?280:520,{fit:'cover',position:'north'}).png().toBuffer(),left:x,top:y});
      const width=i<2?460:430;
      const png=await sharp(path.join(out,`${name}-${solid?'crema':'blanco'}-transparente.svg`)).resize({width}).png().toBuffer();
      const {height}=await sharp(png).metadata();
      parts.push({input:png,left:x+Math.round((545-width)/2),top:y+Math.round(((i<2?280:520)-height)/2)});
    }
    parts.push({input:canvas(1200,1020,label,'transparent'),left:0,top:0});
    const file=`cuatro-versiones-${mode}.png`;
    await sharp(canvas(1200,1020,'',mode==='negro'?'#000000':mode==='terracota'?'#B44C30':'#FFFBF2')).composite(parts).png().toFile(path.join(pack,file));
    fs.copyFileSync(path.join(pack,file),path.join(out,file));
  }
  console.log('Comparativa BT:',path.join(compact,'comparativa-bt-puntos.png'));console.log('Paquete negro/fotos:',pack);
}
main().catch(e=>{console.error(e);process.exit(1)});
