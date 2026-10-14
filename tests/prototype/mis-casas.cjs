// Mis casas en móvil: tarjeta ligera, gestión en el detalle; «Añadir método de pago» solo cuando toca avisar.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../design/prototype'),noop=()=>{};
const storage=new Map();
const ctx=vm.createContext({console,setTimeout:()=>1,clearTimeout:noop,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{head:null,addEventListener:noop,querySelector:()=>({scrollTop:0}),querySelectorAll:()=>[],getElementById:()=>({})}});
const run=s=>vm.runInContext(s,ctx),html=fs.readFileSync(path.join(root,'casatica-prototipo.html'),'utf8');
for(const s of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g))run(s[1]?fs.readFileSync(path.join(root,s[1].split('?')[0]),'utf8'):s[2]);

run("S.role='owner';S.dev='phone';accountAccess.start('register','Marcela','+506 80000002');accountAccess.verify('123456');");
// Regla de producto: el botón de pago solo dentro de la ventana de aviso y sin método de pago (en cualquier vista).
assert.equal(run("casaPayButtonDue('CT-1042')"),true,'CT-1042: oferta termina en <90 días');
assert.equal(run("casaPayButtonDue('CT-1150')"),false,'CT-1150: la oferta termina en un año, todavía no toca');
let houses=run("SCREENS['o-houses']()");
assert.match(houses,/data-billing-pay="CT-1042"/);
assert.doesNotMatch(houses,/data-billing-pay="CT-1150"/);
run("billingAddPaymentMethod('CT-1042')");
assert.doesNotMatch(run("SCREENS['o-houses']()"),/data-billing-pay="CT-1042"/,'desaparece al añadir el método de pago');
run("S.dev='web';");
assert.doesNotMatch(run("SCREENS['o-houses']()"),/data-billing-pay="CT-1150"/,'también en web');
run("S.dev='phone';");

// Tarjeta móvil: Compartir ficha + Calendario; sin Editar, Disponible, Parar ni simulador; sin consejo ni promoción.
houses=run("SCREENS['o-houses']()");
assert.match(houses,/data-launch-share="CT-1042"[^>]*>Compartir ficha<\/button><button class="btn btn-ghost" data-go="o-cal" data-id="CT-1042">Calendario<\/button>/);
assert.doesNotMatch(houses,/class="house-actions"|data-house-edit|data-house-availability|data-billing-stop|data-billing-expire|Controles no disponibles/);
assert.doesNotMatch(houses,/Compartí tu ficha con tus clientes|Promoción de lanzamiento/);
assert.match(houses,/<b data-go="o-house" data-id="CT-1042"/,'el título abre el detalle');
// Inicio conserva el consejo y recibe la promoción.
const dash=run("SCREENS['o-dash']()");
assert.match(dash,/Compartí tu ficha con tus clientes/);
assert.match(dash,/Promoción de lanzamiento/);

// Detalle de la casa: estado, suscripción y controles.
run("S.params={id:'CT-1150'};");
const house=run("SCREENS['o-house']()");
assert.match(house,/Casa|Quinta/);
assert.match(house,/data-launch-share="CT-1150"/);
assert.match(house,/data-house-edit="CT-1150"/);
assert.match(house,/data-house-availability="CT-1150"/);
assert.match(house,/data-billing-stop="CT-1150"/);
assert.doesNotMatch(house,/data-contact=|Guardar/,'no es la ficha pública');

// Web: Mis casas y el detalle como antes.
run("S.dev='web';");
const web=run("SCREENS['o-houses']()");
assert.match(web,/class="house-actions"/);
assert.match(web,/Compartí tu ficha con tus clientes/);
assert.match(run("SCREENS['o-house']()"),/data-contact=/);
console.log('mis-casas ok');
