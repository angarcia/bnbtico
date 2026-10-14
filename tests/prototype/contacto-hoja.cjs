// Ficha móvil: un solo botón de contacto; fechas, personas y mensaje por defecto en la hoja. En web la ficha no cambia.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../design/prototype'),noop=()=>{};
const storage=new Map(),values={};
const ctx=vm.createContext({console,setTimeout:()=>1,clearTimeout:noop,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{head:null,addEventListener:noop,querySelector:()=>({scrollTop:0}),querySelectorAll:()=>[],getElementById:k=>k in values?{value:values[k]}:(k==="s-in"?null:{})}});
const run=s=>vm.runInContext(s,ctx),html=fs.readFileSync(path.join(root,'casatica-prototipo.html'),'utf8');
for(const s of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g))run(s[1]?fs.readFileSync(path.join(root,s[1].split('?')[0]),'utf8'):s[2]);

run("S.role='guest';S.params={id:'CT-1171'};S.dev='phone';");
// Móvil: sin fechas ni personas en la tarjeta de precio; el botón fijo de abajo sigue; sin «responde en ~1 h».
const phone=run('SCREENS.detail()');
assert.doesNotMatch(phone,/id="d-in"|id="d-ppl"|precio-estimado/);
assert.match(phone,/cta-bar[\s\S]*data-contact/);
assert.doesNotMatch(phone,/responde en ~1 h/);
// Web: la ficha conserva fechas y personas; tampoco promete tiempo de respuesta.
run("S.dev='web';");
const web=run('SCREENS.detail()');
assert.match(web,/id="d-in"[\s\S]*id="d-ppl"/);
assert.doesNotMatch(web,/responde en ~1 h/);
assert.doesNotMatch(web,/id="s-in"/);

// Hoja de contacto en móvil: Llegada, Salida, Personas y mensaje por defecto editable.
run("S.dev='phone';accountAccess.start('register','Ana','+506 80000001');accountAccess.verify('123456');S.sheet={type:'launch-contact',id:'CT-1171'};");
const hoja=run('sheet()');
assert.match(hoja,/id="s-in"[\s\S]*id="s-out"[\s\S]*id="s-ppl"/);
assert.match(hoja,/<label for="launch-query">Tu mensaje<\/label><textarea id="launch-query"[^>]*>Hola, vi Casa Manzanillo, a pie de playa en bnbtico y me interesa\. ¿Está disponible\? Gracias\.<\/textarea>/);
// El mensaje se redacta con fechas y personas, y lo que va a WhatsApp es ese texto tal cual.
assert.equal(run("contactCompose('CT-1171',{arrival:'2026-12-20',departure:'2026-12-23',people:'4'})"),'Hola, vi Casa Manzanillo, a pie de playa en bnbtico y me interesa. ¿Está disponible del 20 al 23 de diciembre para 4 personas? Gracias.');
assert.equal(run("contactCompose('CT-1171',{arrival:'2026-12-28',departure:'2027-01-02'})"),'Hola, vi Casa Manzanillo, a pie de playa en bnbtico y me interesa. ¿Está disponible del 28 de diciembre al 2 de enero? Gracias.');
assert.equal(run("contactCompose('CT-1171',{people:'1'})"),'Hola, vi Casa Manzanillo, a pie de playa en bnbtico y me interesa. ¿Está disponible para 1 persona? Gracias.');
assert.equal(run("launchClientMessage('CT-1171',{composed:true,message:'Texto mío'})"),'Texto mío');
assert.match(run("launchClientMessage('CT-1171',{message:'Texto mío'})"),/^Hola, vi Casa Manzanillo/);
assert.doesNotMatch(hoja,/Fechas y personas son opcionales|Tu consulta \(opcional\)/);
assert.match(hoja,/Yorleny S\. <span class="row/,'owner line without dangling separator');
// En web la hoja es la de siempre.
run("S.dev='web';");
const hojaWeb=run('sheet()');
assert.doesNotMatch(hojaWeb,/id="s-in"/);
assert.match(hojaWeb,/Fechas y personas son opcionales/);
console.log('contacto-hoja ok');
