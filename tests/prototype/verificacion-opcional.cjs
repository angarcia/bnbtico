// WhatsApp obligatorio, Veriff opcional: nada se bloquea por identidad, se sugiere y se puede saltar, y cada parte ve los sellos de la otra.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../design/prototype'),noop=()=>{},storage=new Map();
const ctx=vm.createContext({console,setTimeout:()=>1,clearTimeout:noop,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{addEventListener:noop,querySelector:()=>({scrollTop:0}),querySelectorAll:()=>[],getElementById:()=>({})}});
const run=s=>vm.runInContext(s,ctx),html=fs.readFileSync(path.join(root,'casatica-prototipo.html'),'utf8');
for(const s of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g))run(s[1]?fs.readFileSync(path.join(root,s[1].split('?')[0]),'utf8'):s[2]);
// Requisito: solo WhatsApp.
run("var client=adminUsers.items.find(u=>u.name==='Andrea Castro');client.identity='pending';client.whatsappVerified=true;");
assert.equal(run("houseVerified('Andrea Castro')"),true);
run("client.whatsappVerified=false;");
assert.equal(run("houseVerified('Andrea Castro')"),false);
run("client.whatsappVerified=true;");
// Sugerencia al contactar, con salto.
run("S.role='guest';S.params={id:'CT-1042'};accountAccess.start('register','Ana','+506 80000001');accountAccess.verify('123456');");
assert.equal(run("relayOpenHouse('CT-1042')"),false,'first contact attempt shows the optional Veriff suggestion');
assert.equal(run('S.screen'),'account-identity');
const suggestion=run("SCREENS['account-identity']()");
assert.match(suggestion,/opcional/i);
assert.match(suggestion,/data-identity-skip/);
assert.match(suggestion,/data-account="identity"/);
run("accountAccess.state.identitySkipped=true;accountAccess.state.returnTo=null;go('detail',{id:'CT-1042'});");
assert.equal(run("relayOpenHouse('CT-1042')"),true,'after skipping, contact proceeds without Veriff');
assert.equal(run("adminUsers.items.find(u=>u.name==='Andrea Castro').identity"),'pending','skipping never grants the identity badge');
assert.equal(run("accountAccess.user().identity"),false);
// Sellos visibles.
const detail=run('SCREENS.detail()');
assert.match(detail,/WhatsApp verificado/);
assert.match(detail,/Identidad verificada|Identidad sin verificar/);
assert.doesNotMatch(detail,/verificado con cédula|identidad verificada con Veriff y WhatsApp verificado/);
run("S.role='owner';accountAccess.start('register','Marcela','+506 80000002');accountAccess.verify('123456');");
const leads=run("SCREENS['o-leads']()");
assert.match(leads,/Andrea Castro<\/b><span class="row"[^>]*><span class="badge badge-ok xs"[^>]*>✓ WhatsApp verificado<\/span><span class="badge badge-mute xs"[^>]*>Identidad sin verificar/);
assert.doesNotMatch(leads,/data-relay-lead="\d+" disabled/,'owner without Veriff can still open WhatsApp');
// Publicar sin Veriff.
run("publication.account.identityVerified=false;S.role='owner';publication.sent=false;");
const before=run('S.queue.length');
run("Object.assign(publication.draft,{kind:'apartment',acceptsLongTerm:'no',province:'Limón',canton:'Talamanca',zone:'Cahuita',people:'2',bedrooms:'0',bathrooms:'1',title:'Estudio sin Veriff',description:'Un estudio privado cerca del mar.',pets:'no',pool:'no',wifi:'yes',ac:'no',parking:'no',currency:'CRC',nightlyPrice:'45000',minNights:'1',photoCount:5});");
const sent=run('publicationSubmit()');run('S.role="admin";adminReviewSync();');
assert.equal(sent,true,'publishing without Veriff is allowed: '+run('publication.error'));
assert.equal(run('S.queue.length'),before+1);
assert.equal(run('S.queue[S.queue.length-1].identityStatus'),'pending','the review keeps the real identity state');
// Admin aprueba sin identidad.
run("S.role='admin';adminOpenReview(S.queue.length-1);");
assert.doesNotMatch(run("SCREENS['a-review']()"),/data-admin-decision="ok" disabled/);
assert.equal(run("adminDecide('ok','')"),true);
assert.equal(run('S.queue[S.queue.length-1].identityStatus'),'pending');
// Catálogo: identidad verificada primero, orden estable dentro de cada grupo.
run("S.role='guest';S.mode='vac';S.filters={prov:'Todas',ppl:0,beds:0,pool:false,pets:false,ac:false,wifi:false,ev:false};");
const order=run("filtered().map(h=>userVerification(h.owner).identity?1:0).join('')");
assert.match(order,/^1+0*$/,'verified owners first: '+order);
assert.ok(order.includes('0'),'demo fixture must contain at least one owner without Veriff');
assert.match(run('SCREENS.home()'),/Primero, las de propietarios con identidad verificada/);
// Landing intacta.
assert.equal(run('SCREENS.landing()'),run('landing()'));
console.log('verificacion-opcional ok');
