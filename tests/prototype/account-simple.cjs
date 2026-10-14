// Cuenta simplificada: pocas acciones en portada, sin «Cerrar otras sesiones» ni «Mis contactos».
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../design/prototype'),noop=()=>{},storage=new Map();
const ctx=vm.createContext({console,setTimeout:()=>1,clearTimeout:noop,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{addEventListener:noop,querySelector:()=>({scrollTop:0}),querySelectorAll:()=>[],getElementById:()=>({})}});
const run=s=>vm.runInContext(s,ctx),html=fs.readFileSync(path.join(root,'casatica-prototipo.html'),'utf8');
for(const s of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g))run(s[1]?fs.readFileSync(path.join(root,s[1].split('?')[0]),'utf8'):s[2]);
const buttons=h=>(h.match(/<button[^>]*>/g)||[]).length;
// Cliente sin sesión → login.
run("S.role='guest';S.params={id:'CT-1042'};");
assert.match(run('SCREENS.profile()'),/data-account="start"/);
run("accountAccess.start('register','Ana','+506 80000001');accountAccess.verify('123456');");
let p=run('SCREENS.profile()');
assert.match(p,/Identidad sin verificar/);
assert.match(p,/data-go="account-identity"/,'pending identity shows the verify button');
assert.doesNotMatch(p,/Cerrar otras sesiones|data-account="revoke"|Mis contactos|data-go="contacts"|Reclamaciones/);
assert.match(p,/class="btn btn-wa" data-go="support-info"/,'support is the primary action');
assert.doesNotMatch(p,/id="account-email"/,'profile form is collapsed by default');
run('accountAccess.verifyIdentity()');
p=run('SCREENS.profile()');
assert.match(p,/Identidad verificada/);
assert.doesNotMatch(p,/data-go="account-identity"/);
assert.ok(buttons(p)<=6,'front page stays short: '+buttons(p)+' buttons');
run('accountEditOpen=true');
p=run('SCREENS.profile()');
assert.match(p,/id="account-email"|data-account="save-profile"|data-account="phone"/);
assert.doesNotMatch(p,/data-account="revoke"/);
run('accountEditOpen=false');
// Owner.
run("S.role='owner';accountAccess.start('register','Marcela','+506 80000002');accountAccess.verify('123456');");
const o=run("SCREENS['o-profile']()");
assert.match(o,/data-go="o-sub"/);
assert.match(o,/data-go="support-info"/);
assert.doesNotMatch(o,/data-go="o-whatsapp"|Cerrar otras sesiones|Reclamaciones/);
assert.ok(buttons(o)<=6,'owner front page stays short');
console.log('support-account ok');
