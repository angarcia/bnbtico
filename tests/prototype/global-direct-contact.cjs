// Catch partial bulk updates, leaked defaults to other owners and lost per-house exceptions.
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../design/prototype'),noop=()=>{};
const ctx=vm.createContext({console,setTimeout:()=>1,clearTimeout:noop,document:{addEventListener:noop,querySelector:()=>({scrollTop:0}),querySelectorAll:()=>[],getElementById:()=>({})}});
const run=s=>vm.runInContext(s,ctx),html=fs.readFileSync(path.join(root,'casatica-prototipo.html'),'utf8');
// Historical channel preference exploration; launch-scope.cjs covers direct-only launch.
for(const s of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g)){if(s[1]?.startsWith('launch-scope.js'))continue;run(s[1]?fs.readFileSync(path.join(root,s[1].split('?')[0]),'utf8'):s[2]);}
run("S.role='owner';var ids=MY.map(h=>h.id);var external=HOUSES.find(h=>!ids.includes(h.id)).id;");
assert.equal(run('typeof houseSetAllDirect'),'function');
assert.equal(run('houseSetAllDirect(true)'),true);
assert.equal(run('MY.every(h=>houseSettings(h.id).direct)'),true);
assert.equal(run('houseSettings(external).direct'),false);
run('houseSetDirect(ids[0],false);');
assert.equal(run('houseSettings(ids[0]).direct'),false);
assert.equal(run('houseSettings(ids[1]).direct'),true);
run("var newHouse={...MY[0],id:'CT-NEW'};HOUSES.push(newHouse);MY.push(newHouse);listingPhones.set(newHouse.id,listingPhoneSeed(publication.account.whatsapp,true));");
assert.equal(run('houseSettings(newHouse.id).direct'),true,'new houses inherit account default');
assert.equal(run('houseSetDirect(newHouse.id,false)'),true);
assert.equal(run('houseSettings(newHouse.id).direct'),false,'new house can opt out');
assert.equal(run('houseSetAllDirect(false)'),true);
assert.equal(run('MY.every(h=>!houseSettings(h.id).direct)'),true);
run('publication.account.identityVerified=false;');
assert.equal(run('houseSetAllDirect(true)'),false);
assert.equal(run('MY.every(h=>!houseSettings(h.id).direct)'),true,'failed bulk update is atomic');
run("publication.account.identityVerified=true;S.role='guest';");
assert.equal(run('houseSetAllDirect(true)'),false);
run("S.role='owner';var nextHouse={...MY[0],id:'CT-NEXT'};HOUSES.push(nextHouse);MY.push(nextHouse);listingPhones.set(nextHouse.id,listingPhoneSeed(publication.account.whatsapp,true));");
assert.equal(run('houseSettings(nextHouse.id).direct'),false,'failed change did not update future default');
assert.equal(run('houseSetAllDirect(true)'),true);
assert.equal(run('MY.every(h=>houseSettings(h.id).direct)'),true,'explicit bulk apply replaces old exceptions');
console.log('PASS: all current/future houses, per-house opt-out, owner isolation and atomic verification gates.');
