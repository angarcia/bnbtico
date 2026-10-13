/* Matching/formulario v1 + simulador histórico de IA, oculto y pendiente de evaluación. */
const searchNormalize = value => String(value).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().trim();
const SEARCH_AMENITIES = {...AMEN_KEY,'Frente al mar':'beachfront','Cochera':'garage','Amueblado':'furnished','Rancho / BBQ':'bbq','Accesible':'accessible'};
const SEARCH_ZONES = {
  'jaco / pacifico central':['jaco'], 'caribe sur':['puerto viejo'],
  'monteverde / la fortuna':['monteverde','la fortuna'],
  'san jose y alrededores':['san jose'], 'heredia / san jose oeste':['heredia','escazu']
};
function searchMatches(criteria) {
  if(criteria.budgetAmount!=null&&(!Number.isSafeInteger(criteria.budgetAmount)||criteria.budgetAmount<1))return [];
  if(criteria.budgetAmount&&criteria.mode==='vac'&&(!Number.isSafeInteger(criteria.nights)||criteria.nights<1))return [];
  const zone=searchNormalize(criteria.zone||'Cualquier lugar');
  const places=SEARCH_ZONES[zone]||zone.split(',').map(s=>s.trim()).filter(Boolean);
  return HOUSES.filter(h=>h.ownerV&&(!criteria.mode||h.type===criteria.mode)&&h.ppl>=(criteria.ppl||1)
    &&(zone==='cualquier lugar'||places.some(p=>searchNormalize(h.loc).includes(p)))
    &&[...(criteria.needs||[])].every(n=>h[SEARCH_AMENITIES[n]]===true)
    &&(!criteria.budgetAmount||(h.cur===criteria.currency&&h.price*(h.type==='vac'?criteria.nights:1)<=criteria.budgetAmount)));
}
// Both paths use the same mandatory filters; no inferred amenity is treated as confirmed.
matches=searchMatches;
S.req.currency='₡';
function submitHouseRequest(consent){
  const r=S.req,recipients=matches(r).slice(0,10);
  if(!S.loggedIn||S.role!=='guest'||!consent||!r.dates?.trim()||!recipients.length)return false;
  if(S.requests.filter(item=>item.client==='Andrea Castro'&&item.status==='open').length>=3)return false;
  S.requests.unshift({...r,id:'S-'+Date.now(),client:'Andrea Castro',score:4.8,count:6,needs:[...r.needs],
    budget:r.budgetAmount?`${r.currency}${r.budgetAmount.toLocaleString('es-CR')} ${r.mode==='vac'?'en total':'por mes'}`:'',
    status:'open',offers:[],contactConsent:true,recipients:recipients.map(h=>h.id),sentNow:true});
  S.mySent=true;return true;
}
document.addEventListener('change',e=>{
  const t=e.target,keys={'r-dates':'dates','r-zone':'zone','r-text':'text','r-budget':'budgetAmount','r-currency':'currency','r-nights':'nights'};
  if(!keys[t.id])return;
  e.stopImmediatePropagation();
  const numeric=['r-budget','r-nights'].includes(t.id);
  if(numeric&&t.value!==''&&(!Number.isSafeInteger(Number(t.value))||Number(t.value)<1)){t.value=S.req[keys[t.id]]||'';toast('Usá un número entero mayor que cero.');return;}
  S.req[keys[t.id]]=numeric?(t.value?Number(t.value):null):t.value;
  render();
},true);
// Keep drafts before blur: a toast, navigation or device toggle can re-render the page.
document.addEventListener('input',e=>{
  const t=e.target,keys={'r-dates':'dates','r-text':'text','r-budget':'budgetAmount','r-nights':'nights'};
  if(!keys[t.id])return;
  const numeric=['r-budget','r-nights'].includes(t.id);
  S.req[keys[t.id]]=numeric?(t.value?Number(t.value):null):t.value;
  const consent=document.getElementById('r-consent');if(consent)consent.checked=false;
});
document.addEventListener('focusout',e=>{
  if(['r-budget','r-nights','r-dates','r-text'].includes(e.target.id)&&e.target.isConnected)render();
});
const assisted={criteria:{needs:[]},messages:[],refined:[],showResults:false,error:'',draft:''};
function assistedReset(){Object.assign(assisted,{criteria:{needs:[]},messages:[],refined:[],showResults:false,error:'',draft:''});}
function assistedResults(){
  const c=assisted.criteria;
  return searchMatches({...c,budgetAmount:c.budget,currency:c.currency,nights:c.nights})
    .sort((a,b)=>(c.preferred&&b[SEARCH_AMENITIES[c.preferred]]?1:0)-(c.preferred&&a[SEARCH_AMENITIES[c.preferred]]?1:0));
}
function assistedQuestion(){
  const c=assisted.criteria;
  if(!c.mode)return {key:'mode',text:'¿Buscás para vacaciones o para vivir?',options:['Vacaciones','Para vivir']};
  if(!c.zone)return {key:'zone',text:'¿En qué zona? Podés escribir varias separadas por comas.',options:['Guanacaste','Puntarenas','Heredia','Cualquier lugar']};
  if(!c.dates)return {key:'dates',text:c.mode==='vac'?'¿Para cuándo y cuántas noches? También podés dejar las fechas flexibles.':'¿Desde cuándo y por cuánto tiempo querés alquilar?',options:c.mode==='vac'?['3 noches en noviembre','Fechas flexibles']:['Desde febrero, un año','Fecha flexible']};
  if(!c.ppl)return {key:'ppl',text:'¿Cuántas personas se van a alojar?',options:['2','4','6','8']};
  if(c.budget===undefined)return {key:'budget',text:`¿Cuál es tu presupuesto máximo ${c.mode==='vac'?'para toda la estadía':'por mes'}? Indicá moneda y monto sin separadores, por ejemplo CRC 300000 o USD 600.`,options:['Sin definir',c.mode==='vac'?'CRC 300000':'CRC 400000']};
  if(c.budget&&c.mode==='vac'&&!c.nights)return {key:'nights',text:'Para comparar el presupuesto total, ¿cuántas noches serían?',options:['2','3','7']};
  if(!c.needsSet)return {key:'needs',text:'¿Qué no puede faltar? Lo que elijás acá será obligatorio. En esta demo podés indicar piscina, mascotas, wifi, aire acondicionado o cargador eléctrico, separados por comas.',options:['Piscina','Mascotas','Ninguno']};
  const results=assistedResults();
  if(!results.length)return {key:'none',text:'No hay casas confirmadas con todos esos requisitos. No cambié tus filtros. Podés editar una respuesta o ver el catálogo completo.',options:[]};
  const amenity=['Piscina','Mascotas','Aire acondicionado','Cargador eléctrico'].find(n=>!c.needs.includes(n)&&!assisted.refined.includes(n)&&results.some(h=>h[SEARCH_AMENITIES[n]])&&results.some(h=>!h[SEARCH_AMENITIES[n]]));
  if(results.length>3&&amenity)return {key:'refine',amenity,text:`Encontré ${results.length} opciones. ¿${amenity} es imprescindible o solo una preferencia? También podés verlas ya.`,options:[`${amenity} imprescindible`,`${amenity} preferible`,'Me da igual']};
  return {key:'done',text:`Hay ${results.length} ${results.length===1?'casa compatible':'casas compatibles'} con los datos del catálogo. ¡Podés verlas!`,options:[]};
}
function assistedAnswer(raw){
  const answer=String(raw).trim();if(!answer)return false;
  const q=assistedQuestion(),c=assisted.criteria,n=searchNormalize(answer);let error='';
  if(['done','none'].includes(q.key))return false;
  if(q.key==='mode'){if(['vacaciones','vacacional'].includes(n))c.mode='vac';else if(['para vivir','largo plazo'].includes(n))c.mode='largo';else error='Elegí Vacaciones o Para vivir para empezar.';}
  if(q.key==='zone'){
    const known=['cualquier lugar',...PROVS.slice(1).map(searchNormalize),...HOUSES.map(h=>searchNormalize(h.loc.split(',')[0]))];
    if(n.split(',').every(p=>known.includes(p.trim())))c.zone=answer;else error='No reconozco esa zona en esta demo. Probá una provincia o localidad del catálogo.';
  }
  if(q.key==='dates'){c.dates=answer;const nights=n.match(/\b([1-9]\d*)\s+noches?\b/);if(nights)c.nights=Number(nights[1]);}
  if(q.key==='ppl'||q.key==='nights'){const value=Number(answer);if(!/^\d+$/.test(answer)||value<1||value>365)error='Escribí un número entero entre 1 y 365.';else c[q.key]=value;}
  if(q.key==='budget'){
    const amount=n.match(/^(crc|usd|₡|\$)\s*([1-9]\d*)$/);
    if(n==='sin definir')c.budget=null;
    else if(amount){c.budget=Number(amount[2]);c.currency=['crc','₡'].includes(amount[1])?'₡':'$';}
    else error='Necesito monto y moneda: por ejemplo CRC 300000, sin puntos ni comas, o «Sin definir».';
  }
  if(q.key==='needs'){
    const parts=n.split(',').map(s=>s.trim());const selected=parts.map(p=>Object.keys(SEARCH_AMENITIES).find(a=>searchNormalize(a)===p));
    if(n==='ninguno'){c.needs=[];c.needsSet=true;}
    else if(selected.every(Boolean)){c.needs=selected;c.needsSet=true;}
    else error='No pude interpretar todos los requisitos. Usá los nombres de las opciones separados por comas; no voy a ignorar ninguno.';
  }
  if(q.key==='refine'){
    if(n===searchNormalize(q.amenity+' imprescindible'))c.needs.push(q.amenity);
    else if(n===searchNormalize(q.amenity+' preferible'))c.preferred=q.amenity;
    else if(n!=='me da igual')error='Elegí si es imprescindible, preferible o te da igual.';
    if(!error)assisted.refined.push(q.amenity);
  }
  assisted.error=error;if(error)return false;
  assisted.messages.push({question:q.text,answer});assisted.draft='';return true;
}
function assistedEdit(key){
  const c=assisted.criteria;
  if(key==='needs'){c.needs=[];delete c.needsSet;}
  else {delete c[key];if(key==='mode'){delete c.budget;delete c.dates;delete c.nights;}if(key==='dates')delete c.nights;}
  assisted.refined=[];delete c.preferred;assisted.error='';assisted.showResults=false;
}
function searchChoices(){return `<div class="search-paths" style="grid-template-columns:1fr"><a class="card search-path" href="#" data-go="request"><b>Pedir casa</b><span class="small muted">Completá tus requisitos. Los owners compatibles pueden responderte.</span><span class="xs">Formulario gratuito →</span></a></div>`;}
const searchHome=SCREENS.home;
SCREENS.home=()=>searchChoices()+searchHome();
function assistedScreen(){
  const q=assistedQuestion(),c=assisted.criteria,ready=!!(c.mode&&c.zone&&c.dates&&c.ppl&&c.budget!==undefined&&c.needsSet&&(!c.budget||c.mode!=='vac'||c.nights)),results=ready?assistedResults():[];
  const summary=[['mode',c.mode==='vac'?'Vacaciones':c.mode==='largo'?'Para vivir':null],['zone',c.zone],['dates',c.dates],['ppl',c.ppl?`${c.ppl} personas`:null],['budget',c.budget===null?'Presupuesto sin definir':c.budget?`${c.currency}${c.budget.toLocaleString('es-CR')} ${c.mode==='vac'?'total':'/ mes'}`:null],['needs',c.needsSet?c.needs.join(', ')||'Sin imprescindibles':null]];
  return header('Búsqueda asistida','home')+`<div class="assisted-layout"><div class="stack">
    <div class="card small"><b>✦ Encontrá tu casa, paso a paso</b><p>Esto es una simulación guiada, no una IA conectada. No consume búsquedas ni avisa a owners.</p><a href="#" data-go="request">¿Ya sabés lo que querés? Pedí casa con el formulario gratuito.</a></div>
    <div class="assist-history" aria-label="Conversación con el asistente">${assisted.messages.map(m=>`<div class="assist-bubble">${safe(m.question)}</div><div class="assist-bubble assist-user">${safe(m.answer)}</div>`).join('')}</div>
    <section class="card stack" aria-live="polite"><b>bnbtico · asistente de prueba</b><p>${safe(q.text)}</p>
    <div class="chiprow">${q.options.map(o=>`<button class="chip" data-assist-answer="${safe(o)}">${safe(o)}</button>`).join('')}</div>
    ${!['none','done'].includes(q.key)?`<form id="assist-form" class="stack"><label for="assist-input" class="small">Tu respuesta</label><div class="row"><input id="assist-input" maxlength="240" value="${safe(assisted.draft)}" autocomplete="off" placeholder="Escribí acá…" style="min-width:0;flex:1"><button class="btn btn-primary" type="submit">Enviar</button></div></form>`:''}
    ${assisted.error?`<p class="small" role="alert">${safe(assisted.error)}</p>`:''}
    ${ready?`<button class="btn btn-primary" data-assist-results>Ver ${results.length} ${results.length===1?'resultado':'resultados'}</button>`:''}
    ${q.key==='none'?'<button class="btn btn-ghost" data-go="home">Explorar sin estos filtros</button>':''}</section>
    </div><aside class="card stack assist-summary"><b>Tu búsqueda</b><span class="small muted">Tocá una respuesta para cambiarla. Los imprescindibles nunca se relajan solos.</span>
    ${summary.filter(([,v])=>v).map(([k,v])=>`<button class="chip" data-assist-edit="${k}" style="white-space:normal;text-align:left">${safe(v)} · Editar</button>`).join('')||'<p class="small muted">Vamos a completarla juntos.</p>'}
    ${c.preferred?`<span class="small">Preferencia, no obligatoria: ${safe(c.preferred)}</span>`:''}
    <p class="xs muted">Fechas y disponibilidad por confirmar con el owner. Precios orientativos. Comparamos solo anuncios en la moneda elegida; no convertimos divisas.</p>
    <button class="btn btn-ghost btn-sm" data-assist-reset>Empezar otra búsqueda</button></aside></div>
    ${assisted.showResults&&ready?`<section class="stack" id="assist-results"><h2>${results.length} ${results.length===1?'casa compatible':'casas compatibles'}</h2><p class="small muted">Elegí una casa y solicitá contacto desde su ficha. Nadie recibe tu teléfono por usar este asistente.</p><div class="listings">${results.map(listingCard).join('')||'<div class="card">No hay coincidencias. Editá tus requisitos para intentarlo de nuevo.</div>'}</div></section>`:''}`;
}
// No registrar la pantalla asistida: no está aprobada para v1 ni comprometida para v2.
function assistedRender(){render();const history=document.querySelector('.assist-history');if(history)history.scrollTop=history.scrollHeight;}
document.addEventListener('submit',e=>{if(e.target.id!=='assist-form')return;e.preventDefault();assistedAnswer(document.getElementById('assist-input').value);assistedRender();});
document.addEventListener('input',e=>{if(e.target.id==='assist-input')assisted.draft=e.target.value;});
document.addEventListener('click',e=>{
  const t=e.target.closest('[data-assist-answer],[data-assist-edit],[data-assist-reset],[data-assist-results],.search-path,[data-go="assisted"]');if(!t)return;
  e.preventDefault();const d=t.dataset;
  if(d.go)return;
  e.stopImmediatePropagation();
  if(d.assistAnswer!==undefined)assistedAnswer(d.assistAnswer);
  if(d.assistEdit)assistedEdit(d.assistEdit);
  if(d.assistReset!==undefined)assistedReset();
  if(d.assistResults!==undefined)assisted.showResults=true;
  assistedRender();if(d.assistResults!==undefined)document.getElementById('assist-results')?.scrollIntoView({block:'nearest',behavior:'smooth'});
},true);
render();
