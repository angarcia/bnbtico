const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../../design/prototype');
const handlers = [];
let now = Date.UTC(2026, 9, 2, 12);
class Clock extends Date { static now() { return now; } }
const noop = () => {};
const ctx = vm.createContext({console, Date:Clock, setTimeout:()=>1, clearTimeout:noop,
  document:{addEventListener:(type,fn,capture)=>{if(type==='click'&&capture)handlers.push(fn);},
    querySelector:()=>({appendChild:noop,scrollTop:0}),querySelectorAll:()=>[],
    getElementById:()=>({value:'Consulta de prueba'}),createElement:()=>({addEventListener:noop})}});
vm.runInContext(fs.readFileSync(path.join(root,'casatica-prototipo.html'),'utf8').match(/<script>([\s\S]*?)<\/script>/)[1],ctx);
vm.runInContext(fs.readFileSync(path.join(root,'relay.js'),'utf8'),ctx);
const run = code => vm.runInContext(code,ctx);
const click = dataset => handlers[0]({target:{closest:()=>({dataset})},stopImmediatePropagation:noop});
run("relay.threads=[];S.leads=[];S.loggedIn=true; relayOpenHouse('CT-1042');");
assert.match(run('sheet()'),/Solicitar contacto/);
run("const first=relayCreate('CT-1042'); const originalExpiry=first.expiresAt; S.role='owner';");
assert.equal(run('first.expiresAt-first.createdAt'),7*24*60*60*1000);
const count=run('relay.threads.length');
run("S.role='guest';relayOpenHouse('CT-1042');S.role='owner'");
assert.equal(run('relay.threads.length'),count);
assert.equal(run('S.sheet.type'),'direct');
const index=()=>String(run('S.leads.findIndex(l=>l.threadId===first.id)'));
click({relayDismiss:index()});
assert.equal(run('relayCreate("CT-1042").id===first.id'),true);
assert.equal(run('first.expiresAt'),run('originalExpiry'));
click({relayRestore:index()});
assert.equal(run('first.expiresAt'),run('originalExpiry'));
assert.notEqual(run('relayCreate("CT-1150").id'),run('first.id')); // Mismo owner, otra casa.
assert.notEqual(run('relayCreate("CT-1042","Otro cliente").id'),run('first.id'));
now=run('originalExpiry')-1;
assert.equal(run('relayExpired(first)'),false);
assert.equal(run('relayCreate("CT-1042").id'),run('first.id'));
click({relayDismiss:index()});
now++;
assert.equal(run('relayExpired(first)'),true);
assert.match(run('oLeads()'),/Expirada · no pendiente/);
click({relayLead:index()});
assert.equal(run('relayCurrent().id'),run('first.id')); // Historial no crea un aviso nuevo.
assert.match(run('sheet()'),/Solicitud expirada/);
run("const renewed=relayCreate('CT-1042');");
assert.notEqual(run('renewed.id'),run('first.id'));
assert.equal(run('S.leads.find(l=>l.threadId===renewed.id).dismissed'),undefined);
assert.equal(run('relay.threads.includes(first)'),true);
assert.equal(run('renewed.expiresAt-renewed.createdAt'),7*24*60*60*1000);
assert.equal(run('relayCreate("CT-1042").id'),run('renewed.id'));
now+=90*24*60*60*1000;
assert.notEqual(run('relayCreate("CT-1042").id'),run('renewed.id'));
console.log('PASS: WhatsApp directo, duplicados, descarte, reactivación, límite exacto de 7 días, nueva solicitud, historial y consultas a 3 meses.');
