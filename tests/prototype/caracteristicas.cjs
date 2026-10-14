// Misma lista de características al publicar y al filtrar; niños gratis y parqueo filtran de verdad.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../design/prototype'),noop=()=>{},storage=new Map();
const ctx=vm.createContext({console,setTimeout:()=>1,clearTimeout:noop,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{addEventListener:noop,querySelector:()=>({scrollTop:0}),querySelectorAll:()=>[],getElementById:()=>({})}});
const run=s=>vm.runInContext(s,ctx),html=fs.readFileSync(path.join(root,'casatica-prototipo.html'),'utf8');
for(const s of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g))run(s[1]?fs.readFileSync(path.join(root,s[1].split('?')[0]),'utf8'):s[2]);
const keys=h=>[...h.matchAll(/data-tog="([a-zA-Z]+)"/g)].map(m=>m[1]);
run("S.role='guest';S.filters.prov='Todas';S.dev='web';");
const expected=['pool','pets','wifi','ac','parking','ev','kidsFree','beachfront','bbq'];
assert.deepEqual(keys(run('SCREENS.home()')),expected,'home chips = form features');
const filters=run('SCREENS.filters()');
assert.deepEqual(keys(filters),expected,'filters screen = form features');
assert.doesNotMatch(filters,/Amueblado|Sin depósito|Accesible|Cochera/);
// Filtran de verdad.
run("S.filters.kidsFree=true;");
assert.ok(run('filtered().length')>0&&run('filtered().every(h=>h.kidsFree)'),'kidsFree filter applies');
run("S.filters.kidsFree=false;S.filters.parking=true;");
assert.ok(run('filtered().every(h=>h.parking!==false)'),'parking filter applies');
assert.equal(run("filtered().some(h=>h.id==='CT-1172')"),false,'house without parking is excluded');
run("S.filters.parking=false;S.filters.beachfront=true;");
assert.ok(run('filtered().length')>0&&run('filtered().every(h=>h.beachfront)'),'beachfront filter applies');
run("S.filters.beachfront=false;S.filters.bbq=true;");
assert.ok(run('filtered().length')>0&&run('filtered().every(h=>h.bbq)'),'bbq filter applies');
run("S.filters.bbq=false;");
// Ficha.
run("S.params={id:'CT-1171'};");
const detail=run('SCREENS.detail()');
assert.match(detail,/Niños pequeños gratis/);assert.match(detail,/Frente al mar/);assert.match(detail,/Rancho \/ BBQ/);
assert.match(detail,/Piscina|Mascotas/,'rest of the amenities list survives');
// Formulario del propietario: mismas casillas.
run("S.role='owner';accountAccess.start('register','Marcela','+506 80000002');accountAccess.verify('123456');publicationReset();S.wizStep=3;");
const form=run("SCREENS['o-new']()");
for(const k of ['pets','pool','wifi','ac','parking','ev','kidsFree','beachfront','bbq'])assert.match(form,new RegExp(`data-publication-check="${k}"`),'form checkbox '+k);
run("publicationSet('kidsFree','yes');publicationSet('ev','yes');publicationSet('bbq','yes');");
assert.equal(run('publication.draft.kidsFree'),'yes');
// Aprobada → catálogo con esas características.
run("Object.assign(publication.draft,{kind:'house',acceptsLongTerm:'no',province:'Limón',canton:'Talamanca',zone:'Cocles',people:'6',bedrooms:'3',bathrooms:'2',title:'Casa Cocles niños gratis',description:'Casa grande para familias.',pets:'no',pool:'no',wifi:'yes',ac:'yes',parking:'yes',parkingType:'free',photoCount:5,currency:'CRC',nightlyPrice:'70000',minNights:'1'});publication.sent=false;");
assert.equal(run('publicationSubmit()'),true,run('publication.error'));
run("S.role='admin';adminReviewSync();adminOpenReview(S.queue.length-1);");
assert.match(run("SCREENS['a-review']()"),/Niños pequeños gratis<\/dt><dd[^>]*>Sí/);
assert.equal(run("adminDecide('ok','')"),true);
const added=run("JSON.stringify(HOUSES.find(h=>h.t==='Casa Cocles niños gratis'))");
assert.match(added,/"kidsFree":true/);assert.match(added,/"bbq":true/);assert.match(added,/"beachfront":false/);assert.match(added,/"ev":true/);assert.match(added,/"parking":true/);
// Precio por noche: visible en Explorar y funcional.
run("S.role='guest';S.filters.prov='Todas';S.filters.min=0;S.filters.max=50000;");
assert.match(run('SCREENS.home()'),/id="h-min"[\s\S]*id="h-max"/,'price inputs on the home page');
assert.ok(run('filtered().length')>0&&run('filtered().every(h=>h.price<=50000)'),'max price applies');
run("S.filters.min=90000;S.filters.max=0;");
assert.ok(run('filtered().every(h=>h.price>=90000)'),'min price applies');
assert.match(run('SCREENS.filters()'),/id="f-min"[^>]*value="90000"/,'filters screen shows the same value');
run("S.filters.min=0;");
console.log('caracteristicas ok');
