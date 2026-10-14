// Ficha móvil más corta: precio una vez, calendario sin cifras repetidas, solo lo que ofrece, un único aviso. Web intacta.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../design/prototype'),noop=()=>{};
const storage=new Map();
const ctx=vm.createContext({console,setTimeout:()=>1,clearTimeout:noop,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{head:null,addEventListener:noop,querySelector:()=>({scrollTop:0}),querySelectorAll:()=>[],getElementById:()=>({})}});
const run=s=>vm.runInContext(s,ctx),html=fs.readFileSync(path.join(root,'casatica-prototipo.html'),'utf8');
for(const s of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g))run(s[1]?fs.readFileSync(path.join(root,s[1].split('?')[0]),'utf8'):s[2]);

run("S.role='guest';S.params={id:'CT-1171'};S.dev='phone';");
const phone=run('SCREENS.detail()');
// Precio una sola vez (barra fija): sin panel lateral ni «¿Cómo funciona?».
assert.doesNotMatch(phone,/detail-side|¿Cómo funciona\?/);
assert.match(phone,/<div class="cta-bar">[\s\S]*data-contact="CT-1171"/);
const visible=phone.replace(/(aria-label|title)="[^"]*"/g,'');
assert.equal((visible.match(/₡85[\s\u00a0]000/g)||[]).length,2,'precio en la barra y en la nota del calendario, nada más');
// Calendario: ningún día repite el precio base.
assert.doesNotMatch(phone,/<small>₡85k<\/small>/);
assert.match(phone,/₡85[\s\u00a0]000 por noche, salvo los días marcados con otro precio/);
// Un día con precio especial sí lleva cifra.
run("calendarState('CT-1171').days[10]={available:true,tariff:'special',specialPrice:120000};");
assert.match(run('SCREENS.detail()'),/<small>₡120k<\/small>/);
// «Lo que ofrece» solo con lo que hay.
assert.doesNotMatch(phone,/line-through/);
assert.match(phone,/Frente al mar/);
assert.doesNotMatch(phone,/<\/span>Piscina<\/div>/);
// Un único aviso, con lo esencial de los anteriores.
assert.equal((phone.match(/class="note/g)||[]).length,1);
assert.match(phone,/bnbtico no procesa pagos/);
assert.match(phone,/WhatsApp verificado \(la identidad con Veriff es opcional\)/);
// Selector de moneda junto al calendario (una sola vez).
assert.equal((phone.match(/aria-label="Moneda"/g)||[]).length,1);
assert.match(phone,/Disponibilidad y precio orientativo<\/div><div class="seg" aria-label="Moneda">/);

// Web: la ficha de siempre.
run("S.dev='web';");
const web=run('SCREENS.detail()');
assert.match(web,/detail-side[\s\S]*¿Cómo funciona\?/);
assert.match(web,/line-through/);
assert.match(web,/<small>₡85k<\/small>/);

// Ficha bloqueada (suscripción parada) no se toca.
run("S.dev='phone';S.role='owner';houseSetActive('CT-1042',false);S.role='guest';S.params={id:'CT-1042'};");
assert.match(run('SCREENS.detail()'),/Este enlace ya no está activo/);
console.log('ficha-movil ok');
