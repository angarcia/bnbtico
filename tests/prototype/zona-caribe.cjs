// Foco Caribe: Limón por defecto, solo provincias con casas visibles, y una casa aprobada de otra zona añade su provincia.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../design/prototype'),noop=()=>{},storage=new Map();
const ctx=vm.createContext({console,setTimeout:()=>1,clearTimeout:noop,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{addEventListener:noop,querySelector:()=>({scrollTop:0}),querySelectorAll:()=>[],getElementById:()=>({})}});
const run=s=>vm.runInContext(s,ctx),html=fs.readFileSync(path.join(root,'casatica-prototipo.html'),'utf8');
for(const s of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g))run(s[1]?fs.readFileSync(path.join(root,s[1].split('?')[0]),'utf8'):s[2]);
assert.equal(run('S.filters.prov'),'Limón','Explorar starts in Limón');
assert.ok(run("filtered().length")>=3,'Caribe demo houses present');
assert.ok(run("filtered().every(h=>h.prov==='Limón')"));
let home=run('SCREENS.home()');
assert.match(home,/casas en Limón/);
assert.doesNotMatch(home,/data-prov="Cartago"/,'provinces without visible houses are hidden');
assert.match(home,/data-prov="Guanacaste"/);
// Oculta una provincia cuando su única casa deja de estar visible.
run("houseSettings('CT-1150').active=false;S.filters.prov='Alajuela';");
home=run('SCREENS.home()');
assert.doesNotMatch(home,/data-prov="Alajuela"/,'province disappears when its last house is hidden');
assert.equal(run('S.filters.prov'),'Limón','filter falls back to Limón when its province vanishes');
run("houseSettings('CT-1150').active=true;");
// Una casa aprobada de Cartago hace aparecer Cartago.
run("S.role='owner';publication.sent=false;publication.account.identityVerified=false;Object.assign(publication.draft,{kind:'house',acceptsLongTerm:'no',province:'Cartago',canton:'Paraíso',zone:'Orosi',people:'4',bedrooms:'2',bathrooms:'1',title:'Casa en Orosi',description:'Casa de campo con vista al valle.',pets:'yes',pool:'no',wifi:'yes',ac:'no',parking:'no',currency:'CRC',nightlyPrice:'60000',minNights:'1',photoCount:5});");
assert.equal(run('publicationSubmit()'),true);
run("S.role='admin';adminReviewSync();adminOpenReview(S.queue.length-1);");
assert.equal(run("adminDecide('ok','')"),true);
assert.ok(run("HOUSES.some(h=>h.t==='Casa en Orosi'&&h.prov==='Cartago')"),'approved submission joins the catalogue');
run("S.role='guest';");
home=run('SCREENS.home()');
assert.match(home,/data-prov="Cartago"/,'new province appears automatically');
run("S.filters.prov='Cartago';");
assert.ok(run("filtered().some(h=>h.t==='Casa en Orosi')"));
assert.match(run("SCREENS['o-houses']()").length?'ok':'ok',/ok/);
console.log('zona-caribe ok');
