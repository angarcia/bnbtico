// Estados de la casa: Pendiente de revisión → Pendiente de pago (saltado con oferta) → Activa → Inactiva; avisos simulados por WhatsApp.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../design/prototype'),noop=()=>{},storage=new Map();
const ctx=vm.createContext({console,setTimeout:()=>1,clearTimeout:noop,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{addEventListener:noop,querySelector:()=>({scrollTop:0}),querySelectorAll:()=>[],getElementById:()=>({})}});
const run=s=>vm.runInContext(s,ctx),html=fs.readFileSync(path.join(root,'casatica-prototipo.html'),'utf8');
for(const s of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g))run(s[1]?fs.readFileSync(path.join(root,s[1].split('?')[0]),'utf8'):s[2]);
run("S.role='owner';accountAccess.start('register','Marcela','+506 80000002');accountAccess.verify('123456');");
assert.equal(run("houseState('CT-1042').label"),'Activa');
assert.ok(run("houseState('CT-1042').reminder")&&run("houseState('CT-1042').reminder.daysLeft")<=90,'house inside the 90-day reminder window');
assert.equal(run("houseState('CT-1150').reminder"),null,'no reminder when the offer is far away');
const houses=run("SCREENS['o-houses']()");
assert.match(houses,/Pendiente de revisión/);
assert.doesNotMatch(houses,/badge-warn">En revisión</);
assert.match(houses,/Tu oferta gratuita termina en \d+ días/);assert.match(houses,/También te lo recordamos por WhatsApp/);
assert.doesNotMatch(houses,/somos 3bstays\. La oferta gratuita de/,'the raw WhatsApp text stays out of the card');
// Fin de oferta sin método de pago → Pendiente de pago, oculta.
assert.equal(run("billingExpireDemo('CT-1042')"),true);
assert.equal(run("houseState('CT-1042').label"),'Pendiente de pago');
assert.equal(run("houseAvailable('CT-1042')"),false,'unpaid house leaves the catalogue');
assert.equal(run("S.role='guest';S.mode='vac';S.filters={prov:'Todas',ppl:0,beds:0,pool:false,pets:false,ac:false,wifi:false,ev:false};filtered().some(h=>h.id==='CT-1042')"),false);
run("S.role='owner';");
// Método de pago → Activa con suscripción.
assert.equal(run("billingAddPaymentMethod('CT-1042')"),true);
assert.equal(run("houseState('CT-1042').label"),'Activa');
assert.match(run("houseState('CT-1042').detail"),/Suscripción activa/);
assert.equal(run("houseAvailable('CT-1042')"),true);
// Oferta con método guardado → pasa sola a suscripción.
assert.equal(run("billingAddPaymentMethod('CT-1150')"),true);
assert.equal(run("billingExpireDemo('CT-1150')"),true);
assert.equal(run("billingFor('CT-1150').plan"),'paid');
// Parar e Inactiva; reactivar sin Veriff.
assert.equal(run("houseSetActive('CT-1042',false)"),true);
assert.equal(run("houseState('CT-1042').label"),'Inactiva');
assert.equal(run("houseAvailable('CT-1042')"),false);
assert.equal(run("publication.account.identityVerified=false;houseSetActive('CT-1042',true)"),true,'reactivating does not require Veriff');
assert.equal(run("houseState('CT-1042').label"),'Activa');
// Pantalla de suscripción.
const sub=run("SCREENS['o-sub']()");
assert.match(sub,/Método de pago: guardado/);
assert.match(sub,/Suscripción iniciada con el método de pago guardado/);
run("billingSeed('CT-1150',relayNow()+200*86400000);");
assert.match(run("SCREENS['o-sub']()"),/avisos por WhatsApp a los 90, 30 y 7 días/);
// Enlace de ficha de una casa Inactiva o Pendiente de pago.
run("houseSetActive('CT-1042',false);S.role='guest';S.params={id:'CT-1042'};");
let d=run('SCREENS.detail()');
assert.match(d,/Este enlace ya no está activo/);
assert.match(d,/paró la suscripción/);
assert.doesNotMatch(d,/data-contact=|Contactar por WhatsApp/,'no contact button on a stopped listing');
run("S.role='owner';houseSetActive('CT-1042',true);billingExpireDemo('CT-1150');S.role='guest';S.params={id:'CT-1150'};");
assert.match(run("billingFor('CT-1150').paymentMethod?'paid-ok':SCREENS.detail()"),/paid-ok|regularice su suscripción/);
run("S.params={id:'CT-1042'};");
assert.match(run('SCREENS.detail()'),/data-contact=/,'reactivated listing shows the normal page again');
// Persistencia: el estado sobrevive a una recarga (nuevo contexto con el mismo localStorage).
run("S.role='owner';houseSetActive('CT-1042',false);");
assert.ok(JSON.parse(storage.get('3bstays-demo-houses'))['CT-1042'].active===false,'stop is persisted');
const ctx2=vm.createContext({console,setTimeout:()=>1,clearTimeout:noop,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{addEventListener:noop,querySelector:()=>({scrollTop:0}),querySelectorAll:()=>[],getElementById:()=>({})}});
const run2=s=>vm.runInContext(s,ctx2);
for(const s of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g))run2(s[1]?fs.readFileSync(path.join(root,s[1].split('?')[0]),'utf8'):s[2]);
assert.equal(run2("houseState('CT-1042').label"),'Inactiva','after reload the house is still stopped');
assert.match(run2("S.role='guest';S.params={id:'CT-1042'};SCREENS.detail()"),/Este enlace ya no está activo/);
// Aviso: sin cobro hasta la fecha y enlace directo a la pantalla de pago.
const wa=run("billingWhatsappText('CT-1150')");
assert.match(wa,/no se te cobrará nada hasta esa fecha/);
assert.match(wa,/#pago=CT-1150/,'deep link to the payment screen');
assert.doesNotMatch(wa,/Cuenta → Promoción/,'no navigation instructions');
run("S.role='owner';S.params={id:'CT-1150'};");
const subScreen=run("SCREENS['o-sub']()");
assert.match(subScreen,/data-billing-pay="CT-1150"/,'the linked screen offers the payment button');
console.log('estados-casa ok');
