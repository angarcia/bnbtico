const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../../design/prototype'),noop=()=>{};
class FixedDate extends Date{static now(){return Date.parse('2026-10-13T12:00:00Z');}}
const ctx=vm.createContext({console,Date:FixedDate,setTimeout:()=>1,clearTimeout:noop,document:{addEventListener:noop,querySelector:()=>({scrollTop:0}),querySelectorAll:()=>[],getElementById:()=>({})}});
const run=s=>vm.runInContext(s,ctx),html=fs.readFileSync(path.join(root,'casatica-prototipo.html'),'utf8');
// Preserve tests of deferred routing; launch-scope.cjs verifies it is disabled initially.
for(const s of html.matchAll(/<script(?: src="([^"]+)")?>([\s\S]*?)<\/script>/g)){if(s[1]?.startsWith('launch-scope.js'))continue;run(s[1]?fs.readFileSync(path.join(root,s[1].split('?')[0]),'utf8'):s[2]);}
assert.equal(run('typeof requestDispatchCandidates'),'function');
run(`S.role='guest';S.loggedIn=true;relay.clockOffset=Date.parse('2026-12-01T12:00:00Z')-Date.now();S.requests=[];S.leads=[];relay.threads=[];
var draft={mode:'vac',ppl:2,zone:'Cualquier lugar',needs:new Set(),arrival:'2026-12-22',departure:'2026-12-25',dates:'22–25 dic',text:'Prueba',clientId:requestDispatchClientId};
HOUSES.forEach(h=>{const state=calendarState(h.id);Object.values(state.days).forEach(d=>d.available=true);});
var busy=HOUSES.find(h=>h.id==='CT-1042'), otherClient=adminUsers.items.find(u=>u.name==='Melissa P.').id;
S.leads.push({h:busy.id,clientId:otherClient,n:'Melissa P.',arrival:'2026-12-23',departure:'2026-12-24',threadId:'busy'});relay.threads.push({id:'busy',source:'direct',house:busy.id,clientId:otherClient});
S.req={...draft};`);
assert.equal(run('submitHouseRequest(true)'),true);
assert.equal(run('S.requests[0].recipients.includes("CT-1042")'),false,'busy owner waits');
assert.equal(run('S.requests[0].deliveries.length'),7,'quiet distinct owners receive first (4 + 3 casas de ejemplo del Caribe, 2026-10-13)');
assert.equal(run('S.requests[0].nextWaveAt-S.requests[0].createdAt'),86400000);
assert.equal(run("receivedRequestHouses(S.requests[0]).some(h=>h.id==='CT-1042')"),false,'not visible to unsent owner');
run('relay.clockOffset+=86400000-1;requestProcessDue();');
assert.equal(run('S.requests[0].deliveries.length'),7);
run('relay.clockOffset+=1;requestProcessDue();requestProcessDue();');
assert.equal(run('S.requests[0].deliveries.length'),8,'second wave once only');
assert.equal(run('S.requests[0].recipients.includes("CT-1042")'),true);
assert.equal(run('new Set(S.requests[0].deliveries.map(d=>d.ownerId)).size'),8);
run("relay.threads[0].expiresAt=relayNow()-1;");
assert.equal(run("requestDispatchCandidates({...draft,clientId:'different-client'}).find(c=>c.ownerId===busy.ownerId).busy"),false,'expired inquiry does not lower priority');
run("relay.threads[0].expiresAt=relayNow()+30*DAY_MS;");
// Duplicate client/owner overlaps even if discarded; names do not determine identity.
run("S.leads[0].clientId=requestDispatchClientId;S.leads[0].dismissed=true;");
assert.equal(run('requestHasDirectDuplicate(draft,busy.ownerId)'),true);
assert.equal(run("requestHasDirectDuplicate({...draft,arrival:'2026-12-24',departure:'2026-12-26'},busy.ownerId)"),false,'checkout boundary does not overlap');
assert.equal(run("requestHasDirectDuplicate({...draft,clientId:otherClient,client:'Andrea Castro'},busy.ownerId)"),false,'same name different account is not duplicate');
run("S.role='owner';S.screen='o-cal';calendarOpenEditor('CT-1042');");
assert.equal(run("calendarSearchItems('CT-1042').length"),0,'sent yellow search is hidden behind later overlapping direct inquiry');
// Occupied dates and multi-house owners: any available compatible house may represent owner.
run("S.role='guest';S.requests=[];S.leads=[];var clone={...busy,id:'CT-9999'};HOUSES.push(clone);listingPhones.set(clone.id,listingPhoneSeed('+506 80000001',true));calendarState(clone.id);Object.values(calendarState(clone.id).days).forEach(d=>d.available=true);calendarState(busy.id).days[22].available=false;");
assert.equal(run('requestDispatchCandidates(draft).filter(c=>c.ownerId===busy.ownerId).length'),1);
assert.equal(run('requestDispatchCandidates(draft).find(c=>c.ownerId===busy.ownerId).house.id'),'CT-9999');
// Urgent <=48h sends to all compatible owners immediately, including busy ones.
run("relay.clockOffset=Date.parse('2026-12-20T06:00:00Z')-Date.now();S.leads.push({h:busy.id,clientId:otherClient,arrival:'2026-12-23',departure:'2026-12-24',threadId:'busy'});S.req={...draft};");
assert.equal(run('submitHouseRequest(true)'),true);
assert.equal(run('S.requests[0].deliveries.length'),8);
assert.equal(run('S.requests[0].nextWaveAt'),null);
// Recheck availability, new duplicate, consent and closure at second wave.
run("S.requests=[];S.leads=[];relay.clockOffset=Date.parse('2026-12-01T12:00:00Z')-Date.now();S.leads.push({h:busy.id,clientId:otherClient,arrival:'2026-12-23',departure:'2026-12-24',threadId:'busy'});S.req={...draft};submitHouseRequest(true);calendarState(clone.id).days[22].available=false;relay.clockOffset+=86400000;requestProcessDue();");
assert.equal(run('S.requests[0].deliveries.length'),7,'now-occupied owner is not sent');
run("S.requests=[];calendarState(clone.id).days[22].available=true;S.req={...draft};submitHouseRequest(true);closeMyRequest(0);relay.clockOffset+=86400000;requestProcessDue();");
assert.equal(run('S.requests[0].deliveries.length'),7);
assert.equal(run('S.requests[0].nextWaveAt'),null);
run("S.requests=[];S.req={...draft};submitHouseRequest(true);S.requests[0].contactConsent=false;relay.clockOffset+=86400000;requestProcessDue();");
assert.equal(run('S.requests[0].deliveries.length'),7);
// Cap and fairness at owner level.
run("S.requests=[];S.req={...draft};submitHouseRequest(true);S.leads[0].clientId=requestDispatchClientId;S.leads[0].dismissed=true;relay.clockOffset+=86400000;requestProcessDue();");
assert.equal(run('S.requests[0].deliveries.length'),7,'new same-client direct inquiry prevents second-wave delivery even if dismissed');
run("S.requests=[];S.leads=[];HOUSES.filter(h=>h.type==='vac'&&h.ownerV).forEach(h=>{const id='thread-'+h.id;relay.threads.push({id,source:'direct',expiresAt:relayNow()+30*DAY_MS});S.leads.push({h:h.id,clientId:otherClient,arrival:'2026-12-23',departure:'2026-12-24',threadId:id});});S.req={...draft};submitHouseRequest(true);");
assert.equal(run('S.requests[0].deliveries.length'),8,'no quiet owners: do not delay everyone');
assert.equal(run('S.requests[0].nextWaveAt'),null);
assert.equal(run("requestDispatchCandidates({...draft,arrival:'2027-01-02',departure:'2027-01-04'}).length"),0,'do not invent availability outside prototype month');
run("S.requests=[];S.req={...draft,arrival:'',departure:'',dates:'Fechas flexibles'};submitHouseRequest(true);");
assert.equal(run('S.requests[0].deliveries.length'),8,'no exact dates: no date-based priority');
assert.equal(run('S.requests[0].nextWaveAt'),null);
run(`S.requests=[];S.leads=[];for(let i=0;i<12;i++){const u=adminUserSeed('Owner '+i,'owner');u.whatsappVerified=true;const h={...busy,id:'CT-X'+i,owner:u.name,ownerId:u.id};HOUSES.push(h);listingPhones.set(h.id,listingPhoneSeed('+506 80000001',true));Object.values(calendarState(h.id).days).forEach(d=>d.available=true);}
requestDispatchLog.push({ownerId:HOUSES.find(h=>h.id==='CT-1088').ownerId,at:requestDispatchNow()});S.req={...draft};submitHouseRequest(true);`);
assert.equal(run('S.requests[0].deliveries.length'),10);
assert.equal(run('new Set(S.requests[0].deliveries.map(d=>d.ownerId)).size'),10);
assert.equal(run('S.requests[0].recipients.includes("CT-1088")'),false,'recent recipients are ranked after owners with less traffic');
console.log('PASS: owner-level phased routing, stable identity overlap exclusion, availability, urgency, fairness, cap, cancellation and delivery visibility.');
