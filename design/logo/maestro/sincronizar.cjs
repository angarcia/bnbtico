// Actualiza únicamente las cuatro carpetas de diseño indicadas en la revisión.
// Conserva una copia inmutable de lo que había antes de esta unificación.
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'../../..');
const set=path.join(root,'design/logo/unificado-2026-11-05');
const archive=path.join(root,'design/logo/historico/2026-11-05-antes-unificacion');
const dirs=['design/logo/bnbtico-actualizado','design/logo/redes-sociales','design/logo/propuestas/icono-puntos','design/merchandising/imagenes-actualizadas'];
for(const dir of dirs){const dest=path.join(archive,dir);if(!fs.existsSync(dest)){fs.mkdirSync(path.dirname(dest),{recursive:true});fs.cpSync(path.join(root,dir),dest,{recursive:true});}}
// La tinta de las composiciones sobre fondos sólidos oscuros pasa a crema.
for(const folder of [set,path.join(root,'design/logo/bnbtico-actualizado')])for(const file of fs.readdirSync(folder).filter(f=>/-blanco-sobre-(?:negro|oscuro)\.(?:svg|png)$/.test(f))){
  const source=path.join(folder,file),old=path.join(root,'design/logo/historico/2026-11-05-oscuro-blanco-superado',path.relative(root,source));
  fs.mkdirSync(path.dirname(old),{recursive:true});if(!fs.existsSync(old))fs.copyFileSync(source,old);fs.unlinkSync(source);
}
const copy=(from,to)=>fs.copyFileSync(path.join(set,from),path.join(root,to));
const updated='design/logo/bnbtico-actualizado';
for(const file of fs.readdirSync(set).filter(f=>/\.(png|svg)$/.test(f)&&!f.includes('comparativa')&&!f.includes('referencia-vs')))copy(file,`${updated}/${file}`);
for(const [name,base] of [['bnbtico','bnbtico-sin-rana'],['bnbtico-com','bnbtico-com-sin-rana']])for(const ext of ['png','svg'])copy(`${name}-terracota-transparente.${ext}`,`${updated}/${base}.${ext}`);
for(const ext of ['png','svg']){
  copy(`bnbtico-instagram-puntos.${ext}`,`${updated}/bnbtico-instagram-cuadrado-puntos.${ext}`);
  copy(`marco-puntos-transparente.${ext}`,`${updated}/simbolo-cuadrado-puntos-terracota.${ext}`);
  copy(`bnbtico-instagram-puntos.${ext}`,`design/logo/redes-sociales/bnbtico-instagram-cuadrado-puntos.${ext}`);
  copy(`bnbtico-instagram-puntos.${ext}`,`design/logo/redes-sociales/bnbtico-instagram.${ext}`);
  copy(`bnbtico-com-instagram-puntos.${ext}`,`design/logo/redes-sociales/bnbtico-com-instagram-cuadrado-puntos.${ext}`);
  for(const name of ['bnbtico','bnbtico-com'])copy(`${name}-terracota-transparente.${ext}`,`design/merchandising/imagenes-actualizadas/${name}-sin-rana.${ext}`);
  copy(`bnbtico-com-merchandising-puntos-negro.${ext}`,`design/merchandising/imagenes-actualizadas/bnbtico-com-marco-puntos-negro.${ext}`);
}
copy('bnbtico-com-merchandising-puntos-vista-blanca.png','design/merchandising/imagenes-actualizadas/bnbtico-com-marco-puntos-vista-blanca.png');
// Las cuatro composiciones comparten opciones transparentes para cada soporte.
for(const name of ['bnbtico','bnbtico-com','bnbtico-cuadrado','bnbtico-com-cuadrado'])for(const variant of ['terracota-transparente','blanco-transparente','crema-transparente','negro-transparente'])for(const ext of ['svg','png']){
  copy(`${name}-${variant==='negro-transparente'?'carbon-calido-transparente':variant}.${ext}`,`design/merchandising/imagenes-actualizadas/${name}-${variant}.${ext}`);
  copy(`${name}-${variant}.${ext}`,`design/logo/redes-sociales/${name}-${variant}.${ext}`);
}
const compact=path.join(root,'design/logo/propuestas/iconos-compactos-2026-11-05');
for(const [from,to] of [['05-cuadrado.svg','bnbtico-icono-doble-fila.svg'],['05-cuadrado.png','bnbtico-icono-doble-fila.png'],['05-cuadrado-favicon.svg','bnbtico-icono-favicon.svg'],['05-cuadrado-32.png','bnbtico-icono-favicon-32.png'],['05-cuadrado.ico','bnbtico-icono-favicon.ico']])fs.copyFileSync(path.join(compact,from),path.join(root,'design/logo/propuestas/icono-puntos',to));
for(const name of ['06-bt-12-puntos','07-bt-20-puntos','08-bt-28-puntos'])for(const ext of ['svg','png','ico'])fs.copyFileSync(path.join(compact,`${name}.${ext}`),path.join(root,'design/logo/propuestas/icono-puntos',`${name}.${ext}`));
// Estas variantes se retiran de las carpetas vigentes; están en el histórico.
for(const dir of [updated,'design/merchandising/imagenes-actualizadas'])for(const file of ['bnbtico-con-rana.png','bnbtico-com-con-rana.png','bnbtico-com-solo-corte-b.png']){const p=path.join(root,dir,file);if(fs.existsSync(p))fs.unlinkSync(p);}
console.log('Cuatro carpetas conservadas en:',archive);
