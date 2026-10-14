// El formulario de publicación no pregunta por el uso de los baños.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../design/prototype'),noop=()=>{},storage=new Map();
const ctx=vm.createContext({console,setTimeout:()=>1,clearTimeout:noop,localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v)},document:{addEventListener:noop,querySelector:()=>({scrollTop:0}),querySelectorAll:()=>[],getElementById:()=>({})}});
const run=s=>vm.runInContext(s,ctx),html=fs.readFileSync(path.join(root,'casatica-prototipo.html'),'utf8');
for(const s of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g))run(s[1]?fs.readFileSync(path.join(root,s[1].split('?')[0]),'utf8'):s[2]);
run("S.role='owner';accountAccess.start('register','Marcela','+506 80000002');accountAccess.verify('123456');publicationReset();S.wizStep=3;");
const step3=run("SCREENS['o-new']()");
assert.doesNotMatch(step3,/pub-bathroomUse|Uso de los baños|Compartidos: con otros/);
assert.match(step3,/pub-bathrooms/,'number of bathrooms stays');
run("publicationSet('bathroomUse','shared');");
assert.equal(run('publication.draft.bathroomUse'),'private','value is pinned to private');
assert.equal(run("publicationError(3)")?.includes('baños son privados'),false);
run("S.role='admin';adminOpenReview(0);");
assert.doesNotMatch(run("SCREENS['a-review']()"),/Uso de baños/);
console.log('formulario-simple ok');
