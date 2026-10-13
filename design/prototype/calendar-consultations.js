/* Consultas directas. Solo confirmar una estancia acordada fuera de la app ocupa sus noches. */
const calendarConsultations={visibleHouses:new Set()};
const calendarContactDrafts=new Map();
function calendarConsultationRange(lead){
  const valid=value=>typeof value==='string'&&/^\d{4}-\d{2}-\d{2}$/.test(value)&&Number.isFinite(Date.parse(value+'T00:00:00Z'))&&new Date(value+'T00:00:00Z').toISOString().slice(0,10)===value;
  return valid(lead.arrival)&&valid(lead.departure)&&lead.arrival<lead.departure?{arrival:lead.arrival,departure:lead.departure}:null;
}
function calendarDirectConsultations(house,day){
  if(!houseManageable(house)||!Number.isInteger(day)||day<1||day>31)return [];
  const date=`2026-12-${String(day).padStart(2,'0')}`;
  return S.leads.map((lead,index)=>({lead,index,thread:relay.threads.find(t=>t.id===lead.threadId)})).filter(({lead,thread})=>{
    const range=calendarConsultationRange(lead);
    return !lead.dismissed&&lead.h===house&&thread?.house===house&&thread.client===lead.n&&thread.source==='direct'&&range&&range.arrival<=date&&date<range.departure;
  });
}
function calendarSetConsultations(show){
  if(S.screen!=='o-cal'||!houseManageable(calendarEditor.house)||typeof show!=='boolean')return false;
  if(show)calendarConsultations.visibleHouses.add(calendarEditor.house);
  else calendarConsultations.visibleHouses.delete(calendarEditor.house);
  return true;
}
function calendarOpenConsultations(day,index=null){
  const list=calendarDirectConsultations(calendarEditor.house,day);
  if(!calendarConsultations.visibleHouses.has(calendarEditor.house)||S.screen!=='o-cal'||!list.length||(index!==null&&!list.some(x=>x.index===index)))return false;
  S.sheet={type:'calendar-consultations',house:calendarEditor.house,day,index};return true;
}
function calendarConsultationTarget(index){
  if(!Number.isInteger(index)||S.screen!=='o-cal')return null;
  const lead=S.leads[index],thread=relay.threads.find(t=>t.id===lead?.threadId);
  return lead&&lead.h===calendarEditor.house&&houseManageable(lead.h)&&thread?.house===lead.h&&thread.client===lead.n&&thread.source==='direct'?{lead,thread,index}:null;
}
function calendarDismissConsultation(index){
  const item=calendarConsultationTarget(index);if(!item||item.lead.stayAgreed)return false;
  item.lead.dismissed=true;S.sheet=null;return true;
}
function calendarStayDays(lead){
  const range=calendarConsultationRange(lead);
  if(!range||range.arrival<'2026-12-01'||range.departure>'2027-01-01')return [];
  const start=Number(range.arrival.slice(8)),end=range.departure==='2027-01-01'?32:Number(range.departure.slice(8));
  return Array.from({length:end-start},(_,i)=>start+i);
}
function calendarPrepareStay(index){
  const item=calendarConsultationTarget(index);
  if(!item||item.lead.dismissed||item.lead.stayAgreed||!calendarEditable(item.lead.h)||!calendarStayDays(item.lead).length)return false;
  S.sheet={type:'calendar-confirm-stay',house:item.lead.h,index,thread:item.thread.id};return true;
}
function calendarConfirmStay(index,confirmed){
  const item=calendarConsultationTarget(index),s=S.sheet;
  if(confirmed!==true||!item||s?.type!=='calendar-confirm-stay'||s.index!==index||s.thread!==item.thread.id||s.house!==item.lead.h||item.lead.dismissed||item.lead.stayAgreed)return false;
  const days=calendarStayDays(item.lead);
  if(!days.length||!calendarApply(item.lead.h,days,'occupied'))return false;
  item.lead.stayAgreed=true;calendarRefreshSelection();
  S.sheet={type:'calendar-consultations',house:item.lead.h,day:days[0],index};return true;
}
function calendarConsultationLayout(house){
  const entries=new Map();
  for(let day=1;day<=31;day++)for(const item of calendarDirectConsultations(house,day))entries.set(item.index,item);
  return calendarLayoutEntries([...entries.values()]);
}
function calendarLayoutEntries(entries){
  const lanes=[],segments=[];
  for(const item of [...entries].sort((a,b)=>a.lead.arrival.localeCompare(b.lead.arrival)||a.index-b.index)){
    const start=Math.max(1,Math.round((Date.parse(item.lead.arrival)-Date.parse('2026-12-01'))/86400000)+1);
    const end=Math.min(32,Math.round((Date.parse(item.lead.departure)-Date.parse('2026-12-01'))/86400000)+1);
    let lane=lanes.findIndex(last=>last<=start);if(lane<0)lane=lanes.length;lanes[lane]=end;
    // December starts on Tuesday: day 1 occupies grid slot 1 (zero-based).
    for(let day=start;day<end;){
      const week=Math.floor(day/7),column=day%7+1,span=Math.min(end-day,8-column);
      segments.push({...item,week,column,span,lane,day,before:day>start,after:day+span<end});day+=span;
    }
  }
  return segments;
}
function calendarConsultationGrid(house,cells){
  const headings=['L','K','M','J','V','S','D'].map(d=>`<div class="dow">${d}</div>`).join('');
  if((!calendarConsultations.visibleHouses.has(house)&&!(typeof calendarSearches!=='undefined'&&calendarSearches.visibleHouses.has(house)))||!houseManageable(house))return `<div class="cal">${headings}${cells.join('')}</div>`;
  const segments=calendarConsultationLayout(house);
  return `<div class="calendar-consultation-weeks"><div class="cal">${headings}</div>${Array.from({length:Math.ceil(cells.length/7)},(_,week)=>{
    const weekSegments=segments.filter(s=>s.week===week),rows=1+Math.max(0,...weekSegments.map(s=>s.lane+1));
    return `<div class="cal calendar-consultation-week" style="grid-template-rows:60px${rows>1?` repeat(${rows-1},auto)`:''}">${cells.slice(week*7,week*7+7).map((cell,column)=>`<div class="calendar-consultation-date" style="grid-column:${column+1};grid-row:1 / span ${rows}">${cell}</div>`).join('')}${weekSegments.map(s=>{
    const label=`${s.lead.n} · ${calendarConsultationDates(s.lead)}${s.lead.stayAgreed?' · Estancia acordada':''}`;
    const color=s.kind==='search'?(s.lead.stayAgreed?'consultation-search-agreed':'consultation-search'):(s.lead.stayAgreed?'consultation-agreed':'consultation-color-'+s.index%4);
    const action=s.kind==='search'?`data-calendar-search-id="${safe(s.requestId)}"`:`data-calendar-consultations-day="${s.day}" data-calendar-consultation-index="${s.index}"`;
    return `<button class="calendar-consultation-bar ${color} ${s.before?'continues-before':''} ${s.after?'continues-after':''}" style="grid-column:${s.column} / span ${s.span};grid-row:${s.lane+2}" ${action} aria-label="${s.kind==='search'?'Ver búsqueda de':'Ver consulta de'} ${safe(label)}" title="${safe(label)}"><b>${safe(s.lead.n.split(' ')[0])}</b></button>`;
  }).join('')}</div>`;}).join('')}</div>`;
}
function calendarConsultationDates(lead){
  const range=calendarConsultationRange(lead);if(!range)return 'Fechas por concretar';
  const format=value=>new Intl.DateTimeFormat('es-CR',{day:'numeric',month:'short',year:'numeric',timeZone:'UTC'}).format(new Date(value+'T00:00:00Z'));
  const nights=Math.round((Date.parse(range.departure)-Date.parse(range.arrival))/86400000);
  return `Entrada: ${format(range.arrival)} · Salida: ${format(range.departure)} · ${nights} noche${nights===1?'':'s'}`;
}
function calendarConsultationDetails(lead){
  return `<div class="note small"><div><b>${safe(HOUSES.find(h=>h.id===lead.h)?.t||'Casa')}</b><p>${safe(calendarConsultationDates(lead))} · ${Number.isInteger(lead.people)&&lead.people>0?lead.people+' personas':'Personas por confirmar'}</p><p style="white-space:pre-wrap">${safe(lead.msg||'Sin mensaje adicional.')}</p></div></div>`;
}
const calendarConsultationScreen=SCREENS['o-cal'];
SCREENS['o-cal']=()=>{
  const body=calendarConsultationScreen();if(!houseManageable(calendarEditor.house))return body;
  const show=calendarConsultations.visibleHouses.has(calendarEditor.house);
  const controls=`<style>.cal .calendar-consultation-date .calendar-day{justify-content:flex-start;padding-top:10px}.cal .calendar-consultation-bar{position:relative;z-index:1;margin:0 2px 4px;padding:3px 1px;min-height:24px;height:24px}.cal .consultation-agreed{background:#354a80;color:#fff;border-color:#243559}.calendar-agreed-key{display:inline-block;width:12px;height:12px;background:#354a80;border-radius:3px}</style><div class="stack" style="flex-shrink:0;gap:6px"><label class="row small"><input type="checkbox" id="calendar-show-consultations" ${show?'checked':''}>Mostrar consultas</label>${show?'<p class="xs muted">Tocá una barra para ver la consulta. Solo «Marcar como ocupado» ocupa sus noches tras confirmar el acuerdo por WhatsApp. Sin fechas concretas: Mis consultas.</p><span class="xs"><i class="calendar-agreed-key" aria-hidden="true"></i> Azul oscuro: estancia acordada</span>':''}</div>`;
  return '<style>.calendar-consultation-weeks{display:grid;gap:8px}.calendar-consultation-week{align-items:stretch}.calendar-consultation-date{min-width:0}.calendar-consultation-date .calendar-day{width:100%;height:100%}.calendar-consultation-bar{min-width:0;display:flex;flex-direction:column;justify-content:center;gap:2px;border:1px solid #8da9da;border-radius:8px;padding:5px 2px;font-size:9px;line-height:1.3;cursor:pointer;background:#e5edff;color:#183c83;overflow-wrap:normal}.calendar-consultation-bar b{font-size:9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}.consultation-nights{white-space:nowrap}.consultation-color-1{background:#f2e7ff;color:#58367a;border-color:#b797d4}.consultation-color-2{background:#fff0d9;color:#6b470d;border-color:#d6b075}.consultation-color-3{background:#e1f1f6;color:#175064;border-color:#80afbf}.calendar-consultation-bar.continues-before{border-top-left-radius:0;border-bottom-left-radius:0}.calendar-consultation-bar.continues-after{border-top-right-radius:0;border-bottom-right-radius:0}.calendar-consultation-bar:focus-visible{outline:3px solid #183c83;outline-offset:1px}</style>'+body.replace('<h3>Seleccioná los días</h3>',controls+'<h3>Seleccioná los días</h3>');
};
const calendarConsultationSheet=sheet;
sheet=()=>{
  const s=S.sheet;
  if(s?.type==='calendar-confirm-stay'){
    const item=calendarConsultationTarget(s.index);
    if(!item||item.lead.h!==s.house||item.thread.id!==s.thread)return '<div class="sheet"><div class="sheet-body stack"><p>Esta consulta ya no está disponible.</p><button class="chip" data-close-btn>Cerrar</button></div></div>';
    return `<div class="sheet" data-close><div class="sheet-body stack" data-stop><h3>¿Ya acordaste esta estancia por WhatsApp?</h3><b>${safe(item.lead.n)}</b>${calendarConsultationDetails(item.lead)}<p class="small">Se marcarán como ocupadas las noches de esta estancia, sin incluir el día de salida. Los precios y las demás consultas se conservan.</p><p class="xs muted">bnbtico no confirma reservas ni gestiona pagos: registrás un acuerdo que hiciste fuera de la app.</p><button class="btn btn-primary" data-calendar-stay-confirm="${s.index}">Sí, marcar como ocupado</button><button class="btn btn-ghost" data-calendar-stay-cancel="${s.index}">Volver sin cambios</button></div></div>`;
  }
  if(s?.type==='calendar-consultations'){
    const list=s.house===calendarEditor.house?calendarDirectConsultations(s.house,s.day).filter(x=>s.index==null||x.index===s.index):[];
    return `<div class="sheet" data-close><div class="sheet-body stack" data-stop><div class="row between"><h3>Consultas · ${Number(s.day)} de diciembre</h3><button class="chip" data-close-btn>Cerrar</button></div><p class="small">Contactar no bloquea fechas. Marcá como ocupado solo si ya acordaste la estancia.</p>${list.length?list.map(({lead,index,thread})=>`<article class="stack" style="border-top:1px solid var(--line);padding-top:12px"><b>${safe(lead.n)}</b>${calendarConsultationDetails(lead)}<span class="${lead.stayAgreed?'badge badge-ok':'xs muted'}">${lead.stayAgreed?'Estancia acordada':thread.ownerConsent?'Contacto aceptado':relayExpired(thread)?'Consulta expirada':'Pendiente de contacto'}</span>${!thread.ownerConsent&&relayExpired(thread)?'<p class="small">El cliente debe enviar otra consulta para iniciar un nuevo contacto.</p>':`<button class="btn btn-wa" data-relay-lead="${index}">${I.wa} ${thread.ownerConsent?'Continuar por WhatsApp':'Contactar por WhatsApp'}</button>`}${!lead.stayAgreed?`<button class="btn btn-ghost" data-calendar-dismiss="${index}">No me interesa</button>${calendarEditable(lead.h)&&calendarStayDays(lead).length?`<button class="btn btn-primary" data-calendar-stay="${index}">Marcar como ocupado</button>`:'<p class="xs muted">La demo solo permite marcar estancias completas dentro de diciembre de 2026, con la casa activa y disponible.</p>'}`:'<p class="xs muted">Registraste el acuerdo y marcaste sus noches como ocupadas. Podés ajustar la disponibilidad desde el calendario.</p>'}</article>`).join(''):'<p>No hay consultas disponibles.</p>'}</div></div>`;
  }
  let body=calendarConsultationSheet();
  if(s?.type==='direct'&&S.role==='owner'){
    const thread=relay.threads.find(t=>t.id===s.thread),lead=S.leads.find(l=>l.threadId===s.thread);
    if(lead&&thread?.source==='direct'&&relayActor(thread)==='owner')body=body.replace('<label for="relay-first">',calendarConsultationDetails(lead)+'<label for="relay-first">');
  }
  if(S.role==='guest'&&['contact','house-direct-contact'].includes(s?.type)){
    const draft=calendarContactDrafts.get(s.id);
    if(draft)body=body.replace('<p class="small muted">En WhatsApp',`<label for="calendar-contact-message">Tu consulta (opcional)</label><textarea id="calendar-contact-message" data-contact-house="${safe(s.id)}" rows="3" maxlength="2000">${safe(draft.message||'')}</textarea><p class="small muted">En WhatsApp`);
  }
  return body;
};
// Capture explicit dates, never guess calendar dates from a free-text message.
const calendarContactOpen=relayOpenHouse;
relayOpenHouse=house=>{
  if(S.role==='guest'&&S.screen==='detail'&&S.params.id===house){
    const arrival=document.getElementById('d-in')?.value,departure=document.getElementById('d-out')?.value;
    if(typeof arrival==='string'&&typeof departure==='string'){
      const draft={arrival,departure,people:parseInt(document.getElementById('d-ppl')?.value,10),message:calendarContactDrafts.get(house)?.message||''};
      if((arrival||departure)&&!calendarConsultationRange(draft)){toast('Indicá llegada y salida válidas; la salida debe ser posterior.');return false;}
      calendarContactDrafts.set(house,draft);
    }
  }
  return calendarContactOpen(house);
};
const calendarContactCreate=relayCreate;
relayCreate=(house,client='Andrea Castro',existingLead=null,source='direct')=>{
  const before=relayActive(house,client),thread=calendarContactCreate(house,client,existingLead,source);
  if(thread&&!before&&!existingLead&&source==='direct'&&S.role==='guest'&&client==='Andrea Castro'){
    const draft=calendarContactDrafts.get(house),lead=S.leads.find(l=>l.threadId===thread.id);
    if(draft&&lead){Object.assign(lead,{arrival:draft.arrival,departure:draft.departure,people:draft.people});if(draft.message.trim())lead.msg=draft.message.trim();}
  }
  return thread;
};
document.addEventListener('change',e=>{if(e.target.id==='calendar-show-consultations'&&calendarSetConsultations(e.target.checked))calendarRender();});
document.addEventListener('input',e=>{if(e.target.id==='calendar-contact-message'&&S.role==='guest'){const draft=calendarContactDrafts.get(e.target.dataset.contactHouse);if(draft)draft.message=e.target.value;}});
document.addEventListener('click',e=>{
  const action=e.target.closest('[data-calendar-dismiss],[data-calendar-stay],[data-calendar-stay-confirm],[data-calendar-stay-cancel]');
  if(action){
    e.stopImmediatePropagation();const d=action.dataset;let ok=false;
    if(d.calendarDismiss!==undefined)ok=calendarDismissConsultation(Number(d.calendarDismiss));
    else if(d.calendarStay!==undefined)ok=calendarPrepareStay(Number(d.calendarStay));
    else if(d.calendarStayConfirm!==undefined)ok=calendarConfirmStay(Number(d.calendarStayConfirm),true);
    else {const index=Number(d.calendarStayCancel),item=calendarConsultationTarget(index);if(item)ok=calendarOpenConsultations(calendarStayDays(item.lead)[0],index);}
    if(ok)calendarRender();else toast('No se pudo actualizar esta consulta. Revisá su estado y las fechas.');return;
  }
  const button=e.target.closest('[data-calendar-consultations-day]');if(!button)return;
  e.stopImmediatePropagation();if(calendarOpenConsultations(Number(button.dataset.calendarConsultationsDay),Number(button.dataset.calendarConsultationIndex)))calendarRender();
},true);
render();
