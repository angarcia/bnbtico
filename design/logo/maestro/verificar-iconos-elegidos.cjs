const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),sharp=require('sharp');
const root=path.resolve(__dirname,'../../..'),out=path.join(root,'design/logo/iconos-elegidos-2026-11-05');
async function main(){
  const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json')));assert.equal(manifest.defaultTheme,'crema');assert.equal(manifest.darkOption,'crema-sobre-terracota');
  const themes=fs.readdirSync(out).filter(p=>fs.statSync(path.join(out,p)).isDirectory());let native=0,rasters=0,icoCount=0;
  for(const theme of themes){
    for(const size of [16,24,32,48,64,96]){
      const name=`icono-${size}`,svg=fs.readFileSync(path.join(out,theme,name+'.svg'),'utf8');
      assert(!/<(?:text|image|filter)\b|feGaussianBlur|feDropShadow/.test(svg));assert.equal((svg.match(/<path\b/g)||[]).length,size<=32?1:2);
      if(size<=32)assert(!/fill="none"/.test(svg));else assert(/fill="none"/.test(svg));
      for(const dpr of [1,2,3]){
        const file=path.join(out,theme,name+(dpr===1?'':`@${dpr}x`)+'.png'),m=await sharp(file).metadata();assert.equal(m.width,size*dpr);assert.equal(m.height,size*dpr);rasters++;
      }
      if(theme==='crema')for(const ext of ['svg','png'])assert(fs.readFileSync(path.join(out,name+'.'+ext)).equals(fs.readFileSync(path.join(out,theme,name+'.'+ext))));
      const symbol=manifest.sizes[size].symbol;assert.equal(symbol.startsWith('B original'),size<=32);native++;
    }
    const favicon=fs.readFileSync(path.join(out,theme,'favicon.svg'),'utf8');assert.equal((favicon.match(/<path\b/g)||[]).length,1);assert(!/fill="none"/.test(favicon));
    for(const file of ['iconos-por-tamano.ico','favicon.ico']){
      const data=fs.readFileSync(path.join(out,theme,file));assert.equal(data.readUInt16LE(2),1);assert.equal(data.readUInt16LE(4),6);
      for(let i=0;i<6;i++){
        const p=6+i*16,size=data[p],length=data.readUInt32LE(p+8),offset=data.readUInt32LE(p+12),png=data.subarray(offset,offset+length);
        const expected=file==='favicon.ico'?await sharp(Buffer.from(favicon),{density:72*size/16}).resize(size,size).png().toBuffer():fs.readFileSync(path.join(out,theme,`icono-${size}.png`));
        assert(png.equals(expected));
      }
      icoCount++;
    }
  }
  for(const name of ['bnbtico','bnbtico-com','bnbtico-cuadrado','bnbtico-com-cuadrado'])for(const ext of ['svg','png']){
    const dir=path.join(root,'design/logo/unificado-2026-11-05');assert(fs.readFileSync(path.join(dir,`${name}.${ext}`)).equals(fs.readFileSync(path.join(dir,`${name}-terracota-crema.${ext}`))));
  }
  const report={date:'2026-11-05',nativeIcons:native,pngDensityVariants:rasters,icoFiles:icoCount,B:[16,24,32],BT:[48,64,96],default:'Terracota #B44C30 sobre crema #FFFBF2',darkOption:'Crema #FFFBF2 sobre terracota #B44C30',faviconAlwaysB:true,defaultLogoAliases:true};
  fs.writeFileSync(path.join(out,'verificacion.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify(report,null,2));
}
if(require.main===module)main().catch(e=>{console.error(e);process.exit(1)});
