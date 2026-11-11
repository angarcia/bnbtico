// Contacto con 3bstays solo por WhatsApp: un canal por rol, sin flujo de reclamaciones visible.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../design/prototype'),noop=()=>{};
const storage=new Map();
const ctx=vm.createContext({console,setTimeout:()=>1,clearTimeout:noop,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{addEventListener:noop,querySelector:()=>({scrollTop:0}),querySelectorAll:()=>[],getElementById:()=>({})}});
const run=s=>vm.runInContext(s,ctx),html=fs.readFileSync(path.join(root,'casatica-prototipo.html'),'utf8');
for(const s of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g))run(s[1]?fs.readFileSync(path.join(root,s[1].split('?')[0]),'utf8'):s[2]);

// Admin sin pestaña de reclamaciones; la pantalla sigue existiendo pero sin acceso desde la UI.
assert.equal(run("NAV.admin.some(([k])=>k==='claims')"),false,'admin nav must not expose claims');
assert.equal(run('typeof SCREENS.claims'),'function','claims code is kept, only hidden');

// Cliente: Mi cuenta con un único botón de contacto con 3bstays.
run("S.role='guest';S.params={id:'CT-1042'};accountAccess.start('register','Ana','+506 80000001');accountAccess.verify('123456');");
assert.equal(run('S.loggedIn'),true);
const profile=run('SCREENS.profile()');
assert.match(profile,/data-go="support-info">(?:<svg[\s\S]*?<\/svg> )?Escribile a 3bstays por WhatsApp</);
assert.doesNotMatch(profile,/Reclamaciones|data-go="claims"/);
assert.equal((profile.match(/data-go="support-info"/g)||[]).length,1,'exactly one support button');

// Ficha pública sin «Reportar un problema».
assert.doesNotMatch(run('SCREENS.detail()'),/Reportar un problema|data-claim-new/);

// Canal del cliente.
const guestHelp=run("SCREENS['support-info']()");
assert.match(guestHelp,/buscadores de alojamiento/);
assert.match(guestHelp,/data-support-open="guest"/);
assert.doesNotMatch(guestHelp,/Reclamaciones|data-go="claims"/);

// Owner: Cuenta y canal de propietarios.
run("S.role='owner';accountAccess.start('register','Marcela','+506 80000002');accountAccess.verify('123456');");
const ownerProfile=run("SCREENS['o-profile']()");
assert.match(ownerProfile,/Escribile a 3bstays por WhatsApp/);
assert.doesNotMatch(ownerProfile,/Reclamaciones|data-go="claims"/);
const ownerHelp=run("SCREENS['support-info']()");
assert.match(ownerHelp,/atención a propietarios/);
assert.match(ownerHelp,/data-support-open="owner"/);
assert.notEqual(run("SUPPORT_WHATSAPP.owner.number"),run("SUPPORT_WHATSAPP.guest.number"),'two distinct numbers');

// Admin: cola y ficha de usuario sin accesos a reclamaciones.
run("S.role='admin';");
assert.doesNotMatch(run("SCREENS['a-queue']()"),/data-go="claims"/);
run("S.params={id:adminUsers.items[0].id};");
const userDetail=run("SCREENS['a-user']?SCREENS['a-user']():''");
assert.doesNotMatch(userDetail,/Reportes relacionados|acceder a ayuda y reclamaciones/);
console.log('support-whatsapp ok');
