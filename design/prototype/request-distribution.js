/* Reparto por propietarios · demo en memoria, reloj simulado, sin notificaciones reales. */
const requestDispatchAccountId=name=>adminUsers.items.find(u=>u.name===name)?.id||null;
const requestDispatchClientId=requestDispatchAccountId('Andrea Castro');
const requestDispatchLog=[];
const requestDispatchNow=()=>relayNow();
HOUSES.forEach(h=>h.ownerId=requestDispatchAccountId(h.owner));
S.leads.forEach(l=>l.clientId=requestDispatchAccountId(l.n));
S.requests.forEach(r=>r.clientId=requestDispatchAccountId(r.client));
relay.threads.forEach(t=>t.clientId=requestDispatchAccountId(t.client));
const requestDispatchCreate=relayCreate;
relayCreate=(house,client='Andrea Castro',lead=null,source='direct')=>{
  const t=requestDispatchCreate(house,client,lead,source);
  if(t){t.clientId=t.clientId||requestDispatchAccountId(client);const l=S.leads.find(x=>x.threadId===t.id);if(l)l.clientId=l.clientId||t.clientId;}
  return t;
};
function requestDatesOverlap(a,b){
  return !!calendarConsultationRange(a)&&!!calendarConsultationRange(b)&&a.arrival<b.departure&&b.arrival<a.departure;
}
function requestOwnerDirectLeads(ownerId){
  return S.leads.filter(l=>HOUSES.find(h=>h.id===l.h)?.ownerId===ownerId&&relay.threads.some(t=>t.id===l.threadId&&t.source==='direct'));
}
function requestHasDirectDuplicate(r,ownerId){
  return !!r.clientId&&requestOwnerDirectLeads(ownerId).some(l=>l.clientId===r.clientId&&requestDatesOverlap(l,r));
}
function requestHasSearchDuplicate(r,ownerId){
  return !!r.clientId&&S.requests.some(other=>other!==r&&other.id!==r.id&&other.clientId===r.clientId&&requestDatesOverlap(other,r)&&(other.deliveries||[]).some(d=>d.ownerId===ownerId));
}
function requestHouseDatesAvailable(h,r){
  if(!r.arrival&&!r.departure)return true;
  const days=calendarStayDays(r),today=new Date(requestDispatchNow()-6*3600000).toISOString().slice(0,10);
  return days.length>0&&r.arrival>=today&&days.every(day=>calendarDay(h.id,day)?.available===true);
}
function requestDispatchCandidates(r){
  if((r.arrival||r.departure)&&!calendarConsultationRange(r))return [];
  const sent=new Set((r.deliveries||[]).map(d=>d.ownerId)),byOwner=new Map();
  for(const house of matches(r)){
    const ownerId=house.ownerId;
    if(!ownerId||sent.has(ownerId)||!requestHouseDatesAvailable(house,r)||requestHasDirectDuplicate(r,ownerId)||requestHasSearchDuplicate(r,ownerId))continue;
    const busy=requestOwnerDirectLeads(ownerId).some(l=>!l.dismissed&&!l.stayAgreed&&!relayLeadExpired(l)&&requestDatesOverlap(l,r));
    const recent=requestDispatchLog.filter(d=>d.ownerId===ownerId&&d.at>=requestDispatchNow()-30*DAY_MS).length;
    const candidate={house,ownerId,busy,recent};
    if(!byOwner.has(ownerId)||house.id<byOwner.get(ownerId).house.id)byOwner.set(ownerId,candidate);
  }
  return [...byOwner.values()].sort((a,b)=>Number(a.busy)-Number(b.busy)||a.recent-b.recent||a.ownerId.localeCompare(b.ownerId));
}
function requestIsUrgent(r){
  if(!calendarConsultationRange(r))return false;
  // Date-only arrival: midnight in Costa Rica; today's arrival is also urgent.
  const today=new Date(requestDispatchNow()-6*3600000).toISOString().slice(0,10);
  return r.arrival>=today&&Date.parse(r.arrival+'T00:00:00-06:00')-requestDispatchNow()<=2*DAY_MS;
}
function requestDeliver(r,candidates,wave){
  const sent=new Set(r.deliveries.map(d=>d.ownerId));
  for(const c of candidates){
    if(sent.size>=10)break;if(sent.has(c.ownerId))continue;
    const delivery={ownerId:c.ownerId,houseId:c.house.id,at:requestDispatchNow(),wave};
    r.deliveries.push(delivery);r.recipients.push(c.house.id);requestDispatchLog.push({ownerId:c.ownerId,at:delivery.at});sent.add(c.ownerId);
  }
}
function requestStartDistribution(r){
  r.createdAt=requestDispatchNow();r.deliveries=[];r.recipients=[];r.nextWaveAt=null;
  const candidates=requestDispatchCandidates(r),quiet=candidates.filter(c=>!c.busy);
  const immediate=requestIsUrgent(r)||!calendarConsultationRange(r)||!quiet.length;
  requestDeliver(r,immediate?candidates:quiet,1);
  if(!immediate&&r.deliveries.length<10){r.nextWaveAt=r.createdAt+DAY_MS;r.distributionStatus='waiting';}
  else r.distributionStatus='complete';
}
function requestProcessDue(){
  for(const r of S.requests){
    if(!r.nextWaveAt)continue;
    if(r.status!=='open'||!r.contactConsent){r.nextWaveAt=null;r.distributionStatus='cancelled';continue;}
    if(requestDispatchNow()<r.nextWaveAt)continue;
    const client=adminUsers.items.find(u=>u.id===r.clientId);
    if(client?.active&&client.identity==='approved'&&client.whatsappVerified)requestDeliver(r,requestDispatchCandidates(r),2);
    r.nextWaveAt=null;r.distributionStatus='complete';
  }
}
// Keep pre-existing demo deliveries as history; never resend them on loading.
S.requests.forEach(r=>{
  if(!Array.isArray(r.recipients))r.recipients=matches(r).slice(0,10).map(h=>h.id);
  const owners=new Set();r.deliveries=r.recipients.flatMap(id=>{const h=HOUSES.find(x=>x.id===id);if(!h?.ownerId||owners.has(h.ownerId))return [];owners.add(h.ownerId);return [{ownerId:h.ownerId,houseId:id,at:requestDispatchNow(),wave:1}];});
  r.recipients=r.deliveries.map(d=>d.houseId);r.createdAt=requestDispatchNow();r.nextWaveAt=null;r.distributionStatus='legacy';
  r.deliveries.forEach(d=>requestDispatchLog.push({ownerId:d.ownerId,at:d.at}));
});
const distributionSubmit=submitHouseRequest;
submitHouseRequest=consent=>{
  const client=adminUsers.items.find(u=>u.id===requestDispatchClientId);
  if(S.role!=='guest'||!S.loggedIn||consent!==true||!client?.active||client.identity!=='approved'||!client.whatsappVerified)return false;
  const draft={...S.req,clientId:requestDispatchClientId};
  if(calendarConsultationRange(draft))draft.nights=Math.round((Date.parse(draft.departure)-Date.parse(draft.arrival))/DAY_MS);
  if(!requestDispatchCandidates(draft).length){toast('No hay propietarios elegibles: revisá disponibilidad, fechas y contactos anteriores. La demo comprueba fechas de diciembre de 2026.');return false;}
  if(!distributionSubmit(consent))return false;
  const r=S.requests[0];r.clientId=requestDispatchClientId;requestStartDistribution(r);requestScheduleDistribution();return true;
};
const distributionClose=closeMyRequest;
closeMyRequest=index=>{
  if(!distributionClose(index))return false;
  const r=S.requests[index];r.nextWaveAt=null;r.distributionStatus='cancelled';requestScheduleDistribution();return true;
};
// Delivery membership governs every owner surface, not merely the calendar.
const distributionReceived=receivedRequestHouses;
receivedRequestHouses=r=>distributionReceived(r).filter(h=>!requestHasDirectDuplicate(r,h.ownerId));
const distributionSearchItems=calendarSearchItems;
calendarSearchItems=house=>distributionSearchItems(house).filter(item=>!requestHasDirectDuplicate(item.request,HOUSES.find(h=>h.id===house)?.ownerId));
const distributionSearchEligible=calendarSearchEligible;
calendarSearchEligible=(r,house)=>distributionSearchEligible(r,house)&&!requestHasDirectDuplicate(r,HOUSES.find(h=>h.id===house)?.ownerId);
function requestDeliverySummary(r){
  const n=new Set((r.deliveries||[]).map(d=>d.ownerId)).size;
  const state=r.status!=='open'||!r.contactConsent?'Búsqueda cerrada. No habrá más envíos.':r.nextWaveAt?`Próxima tanda: ${relayDate(r.nextWaveAt)} (Costa Rica), si la búsqueda sigue abierta. Volvemos a comprobar disponibilidad y duplicados.`:'No hay tandas pendientes.';
  return `<div class="note small"><div><b>Enviada a ${n} propietario${n===1?'':'s'}</b><p>${safe(state)}</p><p class="xs">Máximo 10 propietarios distintos en total. Abrir WhatsApp no cancela el reparto.</p></div></div>`;
}
const distributionForm=SCREENS.request;
SCREENS.request=()=>{
  const draft={...S.req,clientId:requestDispatchClientId};if(calendarConsultationRange(draft))draft.nights=Math.round((Date.parse(draft.departure)-Date.parse(draft.arrival))/DAY_MS);
  const candidates=requestDispatchCandidates(draft),quiet=candidates.filter(c=>!c.busy),immediate=requestIsUrgent(draft)||!calendarConsultationRange(draft)||!quiet.length;
  const count=Math.min(10,immediate?candidates.length:quiet.length);
  const summary=`<div class="note small"><div><b>${count} propietario${count===1?'':'s'} en la primera tanda</b><p>${immediate?'Envío inmediato a compatibles, sin repetir propietarios.':'Prioridad a quienes no tienen consultas en esas fechas. En 24 horas ampliaremos hasta 10 en total si la búsqueda sigue abierta.'}</p>${!count?'<p>Sin destinatarios elegibles. La demo solo comprueba disponibilidad de diciembre de 2026.</p>':''}<p class="xs">Sin fechas exactas: envío inmediato, sin prioridad por fechas. Llegadas en 48 horas: envío inmediato a todos los elegibles, hasta 10.</p></div></div>`;
  return distributionForm().replace('<button class="btn btn-primary" data-send-request',summary+'<button class="btn btn-primary" data-send-request');
};
const distributionMine=SCREENS['my-requests'];
SCREENS['my-requests']=()=>distributionMine()+(S.loggedIn?'<details class="card"><summary>Probar segunda tanda · demo</summary><p class="small">Avanzá 24 horas para comprobar el reparto. No se envían avisos reales y recargar borra los cambios.</p><button class="btn btn-ghost" data-distribution-advance>Avanzar 24 horas</button></details>':'');
let requestDistributionTimer=null;
function requestScheduleDistribution(){
  if(requestDistributionTimer!==null)clearTimeout(requestDistributionTimer);requestDistributionTimer=null;
  const dates=S.requests.filter(r=>r.status==='open'&&r.contactConsent&&r.nextWaveAt).map(r=>r.nextWaveAt);
  if(dates.length)requestDistributionTimer=setTimeout(()=>render(),Math.min(2147483647,Math.max(1,Math.min(...dates)-requestDispatchNow())));
}
const distributionRender=render;
render=()=>{requestProcessDue();distributionRender();requestScheduleDistribution();};
document.addEventListener('click',e=>{
  if(!e.target.closest('[data-distribution-advance]'))return;
  e.stopImmediatePropagation();if(S.role!=='guest'||!S.loggedIn)return;
  relay.clockOffset+=DAY_MS;render();toast('Demo: avanzamos 24 horas y revisamos las tandas pendientes.');
},true);
render();
