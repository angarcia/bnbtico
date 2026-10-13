/* Búsquedas compartidas: estado privado por solicitud y casa, sin reservas ni envíos reales. */
const calendarSearches={visibleHouses:new Set(),states:new Map()};
const calendarSearchState=(house,id)=>calendarSearches.states.get(JSON.stringify([house,id]))||{dismissed:false,stayAgreed:false};
function calendarSaveSearchState(house,id,changes){
  calendarSearches.states.set(JSON.stringify([house,id]),{...calendarSearchState(house,id),...changes});
}
function calendarSearchEligible(r,house){
  return !!r&&houseManageable(house)&&Array.isArray(r.recipients)&&r.recipients.includes(house)&&r.status==='open'&&r.contactConsent===true&&houseContactAvailable(house,r.client)&&matches(r).some(h=>h.id===house);
}
function calendarSearchItems(house){
  if(!houseManageable(house))return [];
  return S.requests.flatMap((r,index)=>{
    const state=calendarSearchState(house,r.id),range=calendarConsultationRange(r);
    if(!range||range.arrival>='2027-01-01'||range.departure<='2026-12-01'||state.dismissed||(!state.stayAgreed&&!calendarSearchEligible(r,house)))return [];
    return [{kind:'search',requestId:r.id,index:S.leads.length+index,request:r,lead:{n:r.client,h:house,arrival:r.arrival,departure:r.departure,people:r.ppl,msg:r.text,stayAgreed:state.stayAgreed}}];
  });
}
function calendarSetSearches(show){
  if(S.screen!=='o-cal'||!houseManageable(calendarEditor.house)||typeof show!=='boolean')return false;
  if(show)calendarSearches.visibleHouses.add(calendarEditor.house);else calendarSearches.visibleHouses.delete(calendarEditor.house);
  return true;
}
function calendarSearchTarget(id){
  if(S.screen!=='o-cal')return null;
  return calendarSearchItems(calendarEditor.house).find(item=>item.requestId===id)||null;
}
function calendarOpenSearch(id){
  const item=calendarSearchTarget(id);
  if(!item||!calendarSearches.visibleHouses.has(calendarEditor.house))return false;
  S.sheet={type:'calendar-search',id,house:calendarEditor.house};return true;
}
function calendarDismissSearch(id){
  const item=calendarSearchTarget(id);if(!item||item.lead.stayAgreed)return false;
  calendarSaveSearchState(item.lead.h,id,{dismissed:true});S.sheet=null;return true;
}
function calendarPrepareSearchStay(id){
  const item=calendarSearchTarget(id);
  if(!item||item.lead.stayAgreed||!calendarEditable(item.lead.h)||!calendarStayDays(item.lead).length)return false;
  S.sheet={type:'calendar-search-confirm',id,house:item.lead.h};return true;
}
function calendarConfirmSearchStay(id,confirmed){
  const item=calendarSearchTarget(id),s=S.sheet;
  if(confirmed!==true||!item||item.lead.stayAgreed||s?.type!=='calendar-search-confirm'||s.id!==id||s.house!==item.lead.h)return false;
  const days=calendarStayDays(item.lead);
  if(!days.length||!calendarApply(item.lead.h,days,'occupied'))return false;
  calendarSaveSearchState(item.lead.h,id,{stayAgreed:true});calendarRefreshSelection();
  S.sheet={type:'calendar-search',id,house:item.lead.h};return true;
}
function calendarOpenSearchContact(id){
  const item=calendarSearchTarget(id);
  if(!item||!calendarSearchEligible(item.request,item.lead.h))return false;
  S.sheet={type:'reply',i:S.requests.indexOf(item.request),calendarHouse:item.lead.h,calendarSearchId:id};return true;
}
const calendarDirectLayout=calendarConsultationLayout;
calendarConsultationLayout=house=>{
  const direct=calendarConsultations.visibleHouses.has(house)?[...new Map(calendarDirectLayout(house).map(s=>[s.index,s])).values()]:[];
  const shared=calendarSearches.visibleHouses.has(house)?calendarSearchItems(house):[];
  return calendarLayoutEntries([...direct,...shared]);
};
const calendarSearchScreen=SCREENS['o-cal'];
SCREENS['o-cal']=()=>{
  const body=calendarSearchScreen();if(!houseManageable(calendarEditor.house))return body;
  const checked=calendarSearches.visibleHouses.has(calendarEditor.house);
  const controls=`<label class="row small"><input type="checkbox" id="calendar-show-searches" ${checked?'checked':''}>Mostrar personas que buscan casa</label>${checked?'<p class="xs muted">Amarillo: búsquedas compartidas compatibles enviadas a esta casa. Mostaza oscuro: estancia acordada. Sin fechas exactas: Buscan casa.</p>':''}`;
  return '<style>.cal .consultation-color-0,.cal .consultation-color-1,.cal .consultation-color-2,.cal .consultation-color-3{background:#e5edff;color:#183c83;border-color:#8da9da}.cal .consultation-search{background:#fff0ab;color:#614500;border-color:#d6b43c}.cal .consultation-search-agreed{background:#8a5900;color:#fff;border-color:#684100}</style>'+body.replace('<h3>Seleccioná los días</h3>',controls+'<h3>Seleccioná los días</h3>');
};
function calendarSearchDetails(item){
  const r=item.request;
  return calendarConsultationDetails(item.lead)+`<p class="small"><b>Zona:</b> ${safe(r.zone)}<br><b>Imprescindibles:</b> ${safe([...(r.needs||[])].join(', ')||'Ninguno')}<br><b>Presupuesto:</b> ${safe(r.budget||'Por confirmar')}</p>`;
}
const calendarSearchSheet=sheet;
sheet=()=>{
  const s=S.sheet;
  if(['calendar-search','calendar-search-confirm'].includes(s?.type)){
    const item=s.house===calendarEditor.house?calendarSearchTarget(s.id):null;
    if(!item)return '<div class="sheet" data-close><div class="sheet-body stack" data-stop><p>Esta búsqueda ya no está disponible para esta casa.</p><button class="chip" data-close-btn>Cerrar</button></div></div>';
    const details=`<b>${safe(item.lead.n)}</b>${calendarSearchDetails(item)}`;
    if(s.type==='calendar-search-confirm')return `<div class="sheet" data-close><div class="sheet-body stack" data-stop><h3>¿Ya acordaste esta estancia por WhatsApp?</h3>${details}<p class="small">Se ocuparán sus noches en esta casa, sin incluir la salida. Los precios, otras consultas y la búsqueda del cliente se conservan.</p><p class="xs muted">bnbtico no gestiona reservas ni pagos. Registrás un acuerdo externo.</p><button class="btn btn-primary" data-calendar-search-confirm="${safe(s.id)}">Sí, marcar como ocupado</button><button class="btn btn-ghost" data-calendar-search-back="${safe(s.id)}">Volver sin cambios</button></div></div>`;
    const canContact=calendarSearchEligible(item.request,item.lead.h);
    return `<div class="sheet" data-close><div class="sheet-body stack" data-stop><div class="row between"><h3>Búsqueda compartida</h3><button class="chip" data-close-btn>Cerrar</button></div><p class="small">No eligió esta casa: busca alojamiento y podés ofrecerle la tuya. Otros propietarios también reciben esta búsqueda.</p>${details}${item.lead.stayAgreed?'<span class="badge badge-sun">Estancia acordada</span>':''}${canContact?`<button class="btn btn-wa" data-calendar-search-contact="${safe(s.id)}">${I.wa} Ofrecer mi casa por WhatsApp</button>`:'<p class="small">La búsqueda ya no admite nuevas propuestas. Conservamos el acuerdo registrado.</p>'}${!item.lead.stayAgreed?`<button class="btn btn-ghost" data-calendar-search-dismiss="${safe(s.id)}">No me interesa</button>${calendarEditable(item.lead.h)&&calendarStayDays(item.lead).length?`<button class="btn btn-primary" data-calendar-search-stay="${safe(s.id)}">Marcar como ocupado</button>`:'<p class="xs muted">La demo solo marca estancias completas de diciembre de 2026.</p>'}<p class="xs muted">Descartar solo la oculta en el calendario de esta casa; no elimina la búsqueda.</p>`:'<p class="xs muted">Noches marcadas como ocupadas. Podés ajustar la disponibilidad desde el calendario.</p>'}</div></div>`;
  }
  let body=calendarSearchSheet();
  if(s?.type==='reply'&&s.calendarSearchId){
    const r=S.requests[s.i];
    if(!r||r.id!==s.calendarSearchId||!calendarSearchEligible(r,s.calendarHouse))return '<div class="sheet"><div class="sheet-body stack"><p>Esta búsqueda ya no admite contacto para esta casa.</p><button class="chip" data-close-btn>Cerrar</button></div></div>';
    const item=calendarSearchItems(s.calendarHouse).find(x=>x.requestId===r.id);
    if(item)body=body.replace('<label for="relay-first">',calendarSearchDetails(item)+'<label for="relay-first">');
  }
  return body;
};
// Optional exact dates; free-text dates remain valid but never guessed onto a calendar.
const calendarSearchForm=SCREENS.request;
SCREENS.request=()=>calendarSearchForm().replace('<div class="field"><label for="r-zone">',`<fieldset class="stack"><legend>Fechas exactas (opcional)</legend><label for="r-arrival">Entrada</label><input type="date" id="r-arrival" value="${safe(S.req.arrival||'')}"><label for="r-departure">Salida</label><input type="date" id="r-departure" value="${safe(S.req.departure||'')}"><p class="xs muted">Permiten mostrar tu búsqueda en los calendarios de los propietarios. Sin fechas exactas también podés enviar la solicitud.</p></fieldset><div class="field"><label for="r-zone">`);
const calendarSubmitHouseRequest=submitHouseRequest;
submitHouseRequest=consent=>{
  if(S.req.arrival||S.req.departure){
    if(!calendarConsultationRange(S.req)){toast('Indicá entrada y salida válidas; la salida debe ser posterior.');return false;}
    S.req.nights=Math.round((Date.parse(S.req.departure)-Date.parse(S.req.arrival))/86400000);
    S.req.dates=calendarConsultationDates(S.req);
  }
  return calendarSubmitHouseRequest(consent);
};
document.addEventListener('change',e=>{
  if(e.target.id==='calendar-show-searches'&&calendarSetSearches(e.target.checked))calendarRender();
  if(['r-arrival','r-departure'].includes(e.target.id)){
    S.req[e.target.id==='r-arrival'?'arrival':'departure']=e.target.value;
    const consent=document.getElementById('r-consent');if(consent)consent.checked=false;
    if(calendarConsultationRange(S.req)){
      S.req.nights=Math.round((Date.parse(S.req.departure)-Date.parse(S.req.arrival))/86400000);
      S.req.dates=calendarConsultationDates(S.req);
    }
    render();
  }
});
document.addEventListener('input',e=>{
  if(!['r-arrival','r-departure'].includes(e.target.id))return;
  S.req[e.target.id==='r-arrival'?'arrival':'departure']=e.target.value;
  const consent=document.getElementById('r-consent');if(consent)consent.checked=false;
});
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-calendar-search-id],[data-calendar-search-contact],[data-calendar-search-dismiss],[data-calendar-search-stay],[data-calendar-search-confirm],[data-calendar-search-back]');if(!el)return;
  e.stopImmediatePropagation();const d=el.dataset;let ok=false;
  if(d.calendarSearchId)ok=calendarOpenSearch(d.calendarSearchId);
  else if(d.calendarSearchContact)ok=calendarOpenSearchContact(d.calendarSearchContact);
  else if(d.calendarSearchDismiss)ok=calendarDismissSearch(d.calendarSearchDismiss);
  else if(d.calendarSearchStay)ok=calendarPrepareSearchStay(d.calendarSearchStay);
  else if(d.calendarSearchConfirm)ok=calendarConfirmSearchStay(d.calendarSearchConfirm,true);
  else ok=calendarOpenSearch(d.calendarSearchBack);
  if(ok)calendarRender();else toast('La búsqueda ya no está disponible o no permite esta acción.');
},true);
render();
