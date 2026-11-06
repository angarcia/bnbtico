// Renderiza el vector a 4096 px; no amplía los PNG de las comparativas.
const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const root=path.resolve(__dirname,'../../..');
const source=path.join(root,'design/logo/unificado-2026-11-05');
const out=path.join(root,'design/logo/negro-y-fotos-2026-11-05/alta-resolucion');
async function main(){
  fs.mkdirSync(out,{recursive:true});
  for(const name of ['bnbtico','bnbtico-com','bnbtico-cuadrado','bnbtico-com-cuadrado']){
    const svg=fs.readFileSync(path.join(source,`${name}-crema-sobre-negro.svg`));
    const width=Number(svg.toString().match(/<svg[^>]* width="([^"]+)"/)[1]);
    const density=72*4096/width;
    const target=path.join(out,`${name}-crema-sobre-negro-4096.png`);
    await sharp(svg,{density}).resize({width:4096}).png().toFile(target);
    const m=await sharp(target).metadata();if(m.width!==4096)throw new Error('Exportación incorrecta');
    console.log(name,m.width,m.height);
  }
  const factor=4096/1254;
  await sharp(path.join(out,'bnbtico-cuadrado-crema-sobre-negro-4096.png')).extract({left:Math.round(200*factor),top:Math.round(190*factor),width:Math.round(180*factor),height:Math.round(70*factor)}).png().toFile(path.join(out,'detalle-puntos-sin-ampliar.png'));
  for(const [folder,suffix] of [['predeterminado','terracota-transparente'],['crema-sobre-terracota','crema-sobre-terracota'],['para-fotos','sobre-fotos']]){
    const dir=path.join(source,'alta-resolucion',folder);fs.mkdirSync(dir,{recursive:true});
    for(const name of ['bnbtico','bnbtico-com','bnbtico-cuadrado','bnbtico-com-cuadrado']){
      const svg=fs.readFileSync(path.join(source,`${name}-${suffix}.svg`)),width=Number(svg.toString().match(/<svg[^>]* width="([^"]+)"/)[1]);
      await sharp(svg,{density:72*4096/width}).resize({width:4096}).png().toFile(path.join(dir,`${name}-4096.png`));
    }
  }
}
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1)});
