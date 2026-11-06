const fs=require('node:fs');
const path=require('node:path');
const sharp=require('sharp');
const root=path.resolve(__dirname,'../../..');
const out=path.join(root,'design/logo/unificado-2026-11-05');
const compact=path.join(root,'design/logo/propuestas/iconos-compactos-2026-11-05');
const text=(x,y,s,size=24,fill='#1C2B2A')=>`<text x="${x}" y="${y}" font-family="Arial,sans-serif" font-size="${size}" fill="${fill}">${s}</text>`;
async function main(){
  const layers=[];
  const add=async(file,left,top,width,height)=>layers.push({input:await sharp(file).resize({width,height,fit:'inside'}).png().toBuffer(),left,top});
  let labels=text(50,65,'bnbtico · logo sin rana',38)+text(50,105,'Mismas letras · solo T elevada · SVG de trazados',22);
  let panels='';
  const panel=(x,y,w,h,fill)=>panels+=`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="14" fill="${fill}"/>`;
  for(const [x,bg,name] of [[50,'blanco','Blanco'],[770,'arena','Crema habitual · #FFFBF2']]){
    panel(x,145,680,310,bg==='blanco'?'#FFFFFF':'#FFFBF2');labels+=text(x+24,185,name,23);
    await add(path.join(out,`bnbtico-terracota-${bg}.png`),x+30,205,610,120);
    await add(path.join(out,`bnbtico-com-terracota-${bg}.png`),x+30,340,610,100);
  }
  panel(50,480,680,270,'#1C2B2A'); labels+=text(74,520,'Fondos oscuros sólidos · crema #FFFBF2',23,'#FFFBF2');
  await add(path.join(out,'bnbtico-crema-transparente.png'),85,548,600,90);
  await add(path.join(out,'bnbtico-com-crema-transparente.png'),85,658,600,60);
  layers.push({input:await sharp(path.join(root,'design/pantallas/fotos/bedroom.jpg')).resize(680,270,{fit:'cover',position:'north'}).png().toBuffer(),left:770,top:480});
  labels+=text(796,518,'Sobre fotos · blanco transparente',23,'#FFFFFF');
  await add(path.join(out,'bnbtico-sobre-fotos.png'),810,570,600,105);
  labels+=text(50,815,'Opciones para tamaños pequeños · pendientes de elegir',30);
  const choices=[['01-b','A · B original reforzada'],['02-bt','B · Iniciales BT'],['03-bnb-tico','C · Nombre en dos líneas'],['04-b-compacta','D · B compacta sólida'],['05-cuadrado','E · Solo cuadrado de puntos']];
  for(let i=0;i<choices.length;i++){
    const [name,label]=choices[i],x=50+i*285;
    panel(x,850,270,440,'#FFFFFF');labels+=text(x+12,886,label,17);
    await add(path.join(compact,name+'.png'),x+35,912,200,200);
    for(const [size,delta] of [[16,10],[32,56],[48,114],[64,182]]){const cursor=x+delta;await add(path.join(compact,`${name}-${size}.png`),cursor,1150,size,size);labels+=text(cursor,1242,String(size)+' px',14);}
  }
  labels+=text(50,1340,'E conserva el cuadrado vacío: doble marco en grande; una fila con menos puntos a 16–32 px.',21);
  labels+=text(50,1375,'A y B conservan las letras originales; C necesita más tamaño; D prioriza la lectura del símbolo.',21);
  const base=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1420"><rect width="100%" height="100%" fill="#EEEAE2"/>${panels}</svg>`);
  layers.push({input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1500" height="1420">${labels}</svg>`),left:0,top:0});
  const board=path.join(out,'comparativa.png');
  await sharp(base).composite(layers).png().toFile(board);
  await sharp(board).extract({left:30,top:785,width:1440,height:625}).png().toFile(path.join(compact,'comparativa-iconos.png'));
  const detailBase=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1050" height="420"><rect width="100%" height="100%" fill="#FFFBF2"/>${text(30,40,'E · Solo el cuadrado de puntos',28)}${text(30,390,'Marco doble',20)}${text(360,390,'Simplificado para favicon',20)}</svg>`);
  await sharp(detailBase).composite([
    {input:await sharp(path.join(compact,'05-cuadrado.png')).resize(280,280).toBuffer(),left:30,top:70},
    {input:await sharp(path.join(compact,'05-cuadrado-favicon.png')).resize(280,280).toBuffer(),left:360,top:70},
    {input:await sharp(path.join(compact,'05-cuadrado-16.png')).toBuffer(),left:750,top:150},
    {input:await sharp(path.join(compact,'05-cuadrado-32.png')).toBuffer(),left:820,top:140},
    {input:Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1050" height="420">${text(730,215,'16 px',17)}${text(810,215,'32 px',17)}</svg>`),left:0,top:0},
  ]).png().toFile(path.join(compact,'cuadrado-puntos-detalle.png'));
  const reference=await sharp(path.join(__dirname,'referencia-aprobada.png')).extract({left:280,top:480,width:720,height:280}).png().toBuffer();
  const vector=await sharp(path.join(__dirname,'contorno-referencia.svg')).resize(720,280).flatten({background:'#FFFBF2'}).png().toBuffer();
  const compareBase=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="800" height="700"><rect width="100%" height="100%" fill="#FFFBF2"/>${text(30,40,'Referencia aprobada',22)}${text(30,380,'Vector desde sus contornos · #B44C30',22)}</svg>`);
  await sharp(compareBase).composite([{input:reference,left:40,top:60},{input:vector,left:40,top:400}]).png().toFile(path.join(out,'referencia-vs-vector.png'));
  const fourBase=Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="830"><rect width="100%" height="100%" fill="#FFFBF2"/>${text(35,42,'Cuatro composiciones · mismo maestro · crema #FFFBF2',27)}${text(35,102,'1 · BNBTICO',23)}${text(630,102,'2 · BNBTICO.COM',23)}${text(35,342,'3 · Cuadrado con BNBTICO',23)}${text(630,342,'4 · Cuadrado con BNBTICO.COM',23)}</svg>`);
  await sharp(fourBase).composite([
    {input:await sharp(path.join(out,'bnbtico-terracota-transparente.png')).resize({width:500}).toBuffer(),left:35,top:135},
    {input:await sharp(path.join(out,'bnbtico-com-terracota-transparente.png')).resize({width:530}).toBuffer(),left:630,top:155},
    {input:await sharp(path.join(out,'bnbtico-cuadrado-terracota-transparente.png')).resize(460,460).toBuffer(),left:70,top:355},
    {input:await sharp(path.join(out,'bnbtico-com-cuadrado-terracota-transparente.png')).resize(460,460).toBuffer(),left:665,top:355},
  ]).png().toFile(path.join(out,'cuatro-versiones.png'));
  console.log(board);
}
main().catch(e=>{console.error(e);process.exit(1)});
