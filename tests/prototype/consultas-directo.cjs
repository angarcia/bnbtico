// Mis consultas: el propietario abre WhatsApp directamente, sin hoja ni plantilla.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../design/prototype'),noop=()=>{},storage=new Map();
const captured=[];
const ctx=vm.createContext({console,setTimeout:()=>1,clearTimeout:noop,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},window:{location:{hash:''},addEventListener:(type,fn,capture)=>captured.push({type,fn,capture})},document:{addEventListener:noop,querySelector:()=>({scrollTop:0}),querySelectorAll:()=>[],getElementById:()=>({})}});
const run=s=>vm.runInContext(s,ctx),html=fs.readFileSync(path.join(root,'casatica-prototipo.html'),'utf8');
for(const s of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g))run(s[1]?fs.readFileSync(path.join(root,s[1].split('?')[0]),'utf8'):s[2]);
run("S.role='owner';accountAccess.start('register','Marcela','+506 80000002');accountAccess.verify('123456');accountAccess.verifyIdentity();");
const leads=run("SCREENS['o-leads']()");
assert.match(leads,/Abrir WhatsApp/);
assert.doesNotMatch(leads,/Contactar por WhatsApp|aceptar ni rechazar consultas aquí/);
assert.match(leads,/seguir la conversación en WhatsApp/);
// El manejador va en window en captura, para adelantarse a relay.js.
const h=captured.find(c=>c.type==='click'&&c.capture===true);
assert.ok(h,'window capture click handler registered');
const button={disabled:false,dataset:{relayLead:'0'}};
let stopped=0;
const event={target:{closest:sel=>sel==='[data-relay-lead]'?button:null},stopImmediatePropagation:()=>stopped++,stopPropagation:()=>stopped++};
run('S.sheet=null;S.toast=null;');
h.fn(event);
assert.equal(stopped,2,'relay sheet handler must not run');
assert.equal(run('S.sheet'),null,'no intermediate sheet');
assert.match(run('S.toast'),/se abriría WhatsApp con Andrea Castro/);
assert.ok(run('S.leads[0].openedByOwnerAt')>0);
// Botón desactivado (propietario sin verificar) no abre nada.
run('S.toast=null;');
h.fn({...event,target:{closest:()=>({disabled:true,dataset:{relayLead:'0'}})}});
assert.equal(run('S.toast'),null);
console.log('consultas-directo ok');
