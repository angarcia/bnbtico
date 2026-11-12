// La marca visible no recorta la tipografía ni incluye una placa de fondo o la rana antigua.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../design/prototype'),html=fs.readFileSync(path.join(root,'casatica-prototipo.html'),'utf8'),noop=()=>{},storage=new Map();
assert(!html.includes('assets/bnbtico-original.png'),'el prototipo debe dejar de pedir el original con rana');
const svg=fs.readFileSync(path.join(root,'assets/3bstays.svg'),'utf8');assert(svg.includes('viewBox='));assert(!/<(?:image|text|filter)\b/.test(svg));assert(!/<rect[^>]*width="100%"/.test(svg),'logo web sin placa');
const ctx=vm.createContext({console,setTimeout:()=>1,clearTimeout:noop,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{addEventListener:noop,querySelector:()=>({scrollTop:0}),querySelectorAll:()=>[],getElementById:()=>({})}});
for(const s of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g))vm.runInContext(s[1]?fs.readFileSync(path.join(root,s[1].split('?')[0]),'utf8'):s[2],ctx);
for(const dev of ['phone','web']){vm.runInContext(`S.dev='${dev}';S.role='guest';S.screen='home'`,ctx);const output=vm.runInContext("chrome(SCREENS.home())",ctx);assert(output.includes('assets/3bstays.svg'));assert(!/rana|bnbtico-original/.test(output));assert(output.includes('background:transparent'));assert(output.includes('position:static'));}
console.log('logo vigente ok: SVG transparente, sin recorte ni referencias a rana, móvil y escritorio');
