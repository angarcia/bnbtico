/* Calendario de diciembre 2026: demo por casa, en memoria, sin reservas ni sincronización. */
const calendarData=new Map();
const calendarEditor={house:null,mode:'available',selected:new Set(),price:'',priceEdited:false,mixedPrice:false,availability:null,restore:false,error:'',notice:'',config:null,configOpen:false};
const calendarModes={available:'Disponible',occupied:'Ocupado',base:'Tarifa habitual',high:'Temporada alta',low:'Temporada baja',special:'Precio especial',restore:'Restaurar precio de tarifa'};
const calendarActions={available:'Disponible',occupied:'Ocupado',special:'Cambiar precio'};
function calendarState(id){
  if(!calendarData.has(id)){
    const h=HOUSES.find(h=>h.id===id);if(!h)return null;
    const rates={base:h.price,high:null,low:null};
    const days={};
    for(let d=1;d<=31;d++){
      days[d]={available:![5,6,12,13,14,19,20,21,27].includes(d),tariff:'base',specialPrice:null};
    }
    calendarData.set(id,{rates,days,highStart:'',highEnd:'',lowStart:'',lowEnd:'',weekend:{base:null,high:null,low:null}});
  }
  return calendarData.get(id);
}
function calendarConfiguredTariff(s,day){
  const date=`2026-12-${String(day).padStart(2,'0')}`;
  return ['high','low'].find(key=>s.rates[key]!==null&&s[key+'Start']&&date>=s[key+'Start']&&date<=s[key+'End'])||'base';
}
function calendarConfiguredPrice(s,day){
  const tariff=calendarConfiguredTariff(s,day),weekend=[5,6].includes(new Date(Date.UTC(2026,11,day)).getUTCDay());
  return weekend&&s.weekend[tariff]!==null?s.weekend[tariff]:s.rates[tariff];
}
function calendarDay(id,day){
  const s=calendarState(id),d=s?.days[day];if(!d)return undefined;
  const nightly=d.tariff==='special'?d.specialPrice:s.rates[d.tariff];
  const weekday=new Date(Date.UTC(2026,11,day)).getUTCDay();
  const weekendApplied=d.tariff!=='special'&&[5,6].includes(weekday)&&s.weekend[d.tariff]!==null;
  return {...d,nightly,weekendApplied,price:weekendApplied?s.weekend[d.tariff]:nightly};
}
function calendarEditable(id){return houseManageable(id)&&houseSettings(id).available&&houseSettings(id).active;}
function calendarValidPrice(value){return publicationMoney(value)&&Number(value)<=100000000;}
function calendarSeasonConfigured(config,key){return [config[key],config[key+'Weekend']].some(v=>v!==''&&v!==null&&v!==undefined);}
function calendarConfigure(id,config){
  if(!calendarEditable(id)||!config||!calendarValidPrice(config.base))return false;
  const optional=value=>value===''||value===null||value===undefined;
  for(const key of ['high','low'])if(!optional(config[key])&&!calendarValidPrice(config[key]))return false;
  for(const key of ['base','high','low'])if(!optional(config[key+'Weekend'])&&(!calendarValidPrice(config[key+'Weekend'])||optional(config[key])))return false;
  // This prototype has one fixed month; do not silently accept dates it cannot display.
  const validDate=value=>/^2026-12-(0[1-9]|[12][0-9]|3[01])$/.test(value);
  const ranges=['high','low'].map(key=>({key,start:config[key+'Start']||'',end:config[key+'End']||''}));
  for(const r of ranges)if((calendarSeasonConfigured(config,r.key)||r.start||r.end)&&(optional(config[r.key])||!validDate(r.start)||!validDate(r.end)||r.start>r.end))return false;
  if(ranges.every(r=>r.start)&&ranges[0].start<=ranges[1].end&&ranges[1].start<=ranges[0].end)return false;
  const s=calendarState(id);if(!s)return false;
  s.rates={base:Number(config.base),high:optional(config.high)?null:Number(config.high),low:optional(config.low)?null:Number(config.low)};
  s.weekend=Object.fromEntries(['base','high','low'].map(key=>[key,optional(config[key+'Weekend'])?null:Number(config[key+'Weekend'])]));
  for(const r of ranges){
    s[r.key+'Start']=r.start;s[r.key+'End']=r.end;
  }
  for(const [day,d] of Object.entries(s.days))if(d.tariff!=='special')d.tariff=calendarConfiguredTariff(s,Number(day));
  if(calendarEditor.house===id&&['high','low'].includes(calendarEditor.mode)&&s.rates[calendarEditor.mode]===null)calendarEditor.mode='base';
  // The catalogue's orientative base follows the house's shared base rate.
  for(const h of [...HOUSES,...MY])if(h.id===id)h.price=s.rates.base;
  return true;
}
function calendarConfigValues(id){const s=calendarState(id);return {...s.rates,high:s.rates.high??'',low:s.rates.low??'',highStart:s.highStart,highEnd:s.highEnd,lowStart:s.lowStart,lowEnd:s.lowEnd,baseWeekend:s.weekend.base??'',highWeekend:s.weekend.high??'',lowWeekend:s.weekend.low??''};}
function calendarApply(id,days,mode,price){
  if(!calendarEditable(id)||!Array.isArray(days)||!days.length||days.some(d=>!Number.isInteger(d)||d<1||d>31)||!Object.hasOwn(calendarModes,mode))return false;
  const monetary=['base','high','low','special'].includes(mode);
  if(mode==='special'&&!calendarValidPrice(price))return false;
  const s=calendarState(id);if(!s)return false;
  if(['high','low'].includes(mode)&&s.rates[mode]===null)return false;
  for(const day of new Set(days)){
    if(mode==='restore'||(mode==='special'&&Number(price)===calendarConfiguredPrice(s,day)))Object.assign(s.days[day],{tariff:calendarConfiguredTariff(s,day),specialPrice:null});
    else if(monetary)Object.assign(s.days[day],{tariff:mode,specialPrice:mode==='special'?Number(price):null});
    else s.days[day].available=mode==='available';
  }
  return true;
}
function calendarOpenEditor(id){
  if(calendarEditor.house!==id){calendarClearSelection();Object.assign(calendarEditor,{house:id,mode:'available',config:calendarConfigValues(id),configOpen:false});}
}
function calendarClearSelection(){Object.assign(calendarEditor,{selected:new Set(),price:'',priceEdited:false,mixedPrice:false,availability:null,restore:false,error:'',notice:''});}
function calendarRefreshSelection(){
  const e=calendarEditor;
  if(!e.selected.size){calendarClearSelection();return;}
  if(!e.priceEdited){
    const prices=[...e.selected].map(day=>e.restore?calendarConfiguredPrice(calendarState(e.house),day):calendarDay(e.house,day).price);
    e.mixedPrice=prices.some(price=>price!==prices[0]);e.price=e.mixedPrice?'':prices[0];
  }
}
function calendarRestoreSelection(){
  const e=calendarEditor;if(!calendarEditable(e.house)||!e.selected.size)return false;
  Object.assign(e,{restore:true,priceEdited:false,error:'',notice:''});calendarRefreshSelection();return true;
}
function calendarSaveSelection(){
  const e=calendarEditor,days=[...e.selected];
  if(!calendarEditable(e.house)||!days.length||days.some(d=>!Number.isInteger(d)||d<1||d>31)||![null,'available','occupied'].includes(e.availability))return false;
  if(e.priceEdited&&!e.restore&&!calendarValidPrice(e.price))return false;
  if(!e.availability&&!e.priceEdited&&!e.restore)return false;
  // Validate the entire draft before either price or availability is mutated.
  if(e.restore||e.priceEdited)calendarApply(e.house,days,e.restore?'restore':'special',e.price);
  if(e.availability)calendarApply(e.house,days,e.availability);
  calendarClearSelection();e.notice=`Cambios guardados en ${days.length} día${days.length===1?'':'s'}.`;return true;
}
function calendarRender(){const view=document.querySelector('.view'),top=view?.scrollTop||0;render();const next=document.querySelector('.view');if(next)next.scrollTop=top;}
function calendarSetMode(mode){
  if(!houseManageable(calendarEditor.house)||!Object.hasOwn(calendarModes,mode))return false;
  calendarEditor.mode=mode;calendarEditor.price='';calendarEditor.restore=false;calendarEditor.error='';calendarEditor.notice='';
  return true;
}
function calendarSelect(day){
  if(!houseManageable(calendarEditor.house)||!Number.isInteger(day)||day<1||day>31)return false;
  if(calendarEditor.selected.has(day))calendarEditor.selected.delete(day);else{
    calendarEditor.selected.add(day);
  }
  calendarRefreshSelection();
  calendarEditor.error='';calendarEditor.notice='';return true;
}
const calendarStyle=`<style>
.cal-legend{display:flex;gap:10px;flex-wrap:wrap;font-size:11px;align-items:center}.cal-legend span{display:inline-flex;gap:4px;align-items:center}.cal-swatch{display:inline-block;width:18px;height:18px;border:1px solid #65766b;border-radius:4px;flex:none}
.cal .d.cal-free,.cal-swatch.cal-free{background-color:#b8dfc7;color:#143f29}.cal .d.cal-busy,.cal-swatch.cal-busy{background-color:#efbbc1;color:#631b2b}
.cal .d.cal-free.cal-high,.cal-swatch.cal-free.cal-high{background-color:#63bf8d}.cal .d.cal-busy.cal-high,.cal-swatch.cal-busy.cal-high{background-color:#e7798c}
.cal .d.cal-free.cal-low,.cal-swatch.cal-free.cal-low{background-color:#e8f3ec}.cal .d.cal-busy.cal-low,.cal-swatch.cal-busy.cal-low{background-color:#faebee}
.calendar-rate-section{border:1px solid var(--line,#ddd);border-radius:14px;padding:16px;min-width:0}.calendar-rate-section h3{margin:0}.calendar-rate-section input[type=date]{width:100%;min-width:0;box-sizing:border-box;padding:10px;border:1px solid var(--line,#ddd);border-radius:10px}.calendar-rates{margin:16px 0}.calendar-rates summary{cursor:pointer;font-weight:700}.calendar-rates label{display:block}.calendar-rates input[type=number]{width:100%;box-sizing:border-box;padding:10px;border:1px solid var(--line,#ddd);border-radius:10px}.calendar-rates input[type=checkbox]{width:auto}.calendar-rates .stack{margin-top:14px}
.cal .d.calendar-day{border:2px solid transparent;min-width:0;min-height:60px;position:relative;cursor:default}.cal button.d.calendar-day{cursor:pointer}.cal .calendar-day small{color:inherit;font-size:10px}.cal .calendar-day[aria-pressed="true"]{border-color:#18382a;box-shadow:inset 0 0 0 1px white}.cal .calendar-day:focus-visible{outline:3px solid #193eaa;outline-offset:2px}.cal .day-mark{font-size:9px;line-height:1}.calendar-selection{position:sticky;bottom:0;z-index:5;flex-shrink:0;border:2px solid var(--primary);box-shadow:0 -4px 18px #0002;gap:8px;padding:12px}.calendar-selection p{margin:0}.calendar-selection input{min-width:0;width:100%;flex:1;padding:10px;border:1px solid var(--line);border-radius:10px}.calendar-selection .btn{padding:9px 12px}.calendar-selection .calendar-selected-dates{max-height:32px;overflow:auto}.calendar-modes{display:flex;flex-wrap:wrap;gap:8px}.calendar-modes button{white-space:normal}.calendar-summary{overflow-wrap:anywhere}.calendar-summary ul{margin:0;padding-left:20px;max-height:140px;overflow:auto}
</style>`;
function calendarMoney(h,price){return h.cur+new Intl.NumberFormat('es-CR',{maximumFractionDigits:2}).format(price);}
calendar=function(editable,h){
  if(!houseSettings(h.id).available||!houseSettings(h.id).active)return '<div class="card stack"><h3>Calendario cerrado temporalmente</h3><p>Esta casa no está disponible para nuevas consultas.</p>'+(editable?'<p>Las fechas, disponibilidad, temporadas y precios están conservados. Volvé a poner la casa Disponible para reabrirlo; si el anuncio está desactivado, activalo desde Editar.</p>':'<p>El propietario puede reabrirlo más adelante.</p>')+'</div>';
  if(editable)calendarOpenEditor(h.id);
  const cells=['<div class="d empty" aria-hidden="true"></div>'];
  for(let d=1;d<=31;d++){
    const state=calendarDay(h.id,d),label=`${d} de diciembre: ${state.available?'Disponible':'Ocupado'}, ${calendarModes[state.tariff]}, ${calendarMoney(h,state.price)} por noche${state.weekendApplied?', precio de fin de semana':''}`;
    const cls=`d num calendar-day ${state.available?'cal-free':'cal-busy'} cal-${state.tariff}`;
    const content=`<span>${d}</span><small>${h.cur==='₡'?'₡'+Math.round(state.price/1000)+'k':calendarMoney(h,state.price)}</small>${state.tariff==='special'?'<span class="day-mark" aria-hidden="true">★</span>':''}`;
    const cell=editable?`<button class="${cls}" data-calendar-day="${d}" aria-pressed="${calendarEditor.selected.has(d)}" aria-label="${safe(label)}" title="${safe(label)}">${content}</button>`:`<div class="${cls}" aria-label="${safe(label)}" title="${safe(label)}">${content}</div>`;
    cells.push(cell);
  }
  const grid=editable&&typeof calendarConsultationGrid==='function'?calendarConsultationGrid(h.id,cells):`<div class="cal">${['L','K','M','J','V','S','D'].map(d=>`<div class="dow">${d}</div>`).join('')}${cells.join('')}</div>`;
  return calendarStyle+`<div class="card stack"><b>Diciembre 2026</b><div class="cal-legend" aria-label="Leyenda del calendario"><span><i class="cal-swatch cal-free"></i>✓ Disponible</span><span><i class="cal-swatch cal-busy"></i>× Ocupado</span><span>★ Especial</span></div>${grid}<p class="xs muted">Precios orientativos.</p></div>`;
};
SCREENS['o-cal']=()=>{
  if(S.role!=='owner')return '<p>Calendario de edición disponible para propietarios.</p>';
  const h=MY.find(h=>h.id===S.params.id)||MY[0];calendarOpenEditor(h.id);
  if(!houseSettings(h.id).available||!houseSettings(h.id).active)return header('Calendario y precios','o-houses')+`<b>${safe(h.t)}</b>`+calendar(true,h)+'<button class="btn btn-ghost" data-go="o-houses">Ir a Mis casas</button>';
  const e=calendarEditor,days=[...e.selected].sort((a,b)=>a-b),c=e.config,state=calendarState(h.id);
  const priceField=(key,label)=>`<label for="calendar-rate-${key}">${label} (${h.cur})</label><input id="calendar-rate-${key}" data-calendar-rate="${key}" type="number" min="0.01" max="100000000" step="0.01" value="${safe(c[key])}" placeholder="${key==='base'?'':'Sin configurar'}">`;
  const weekendField=key=>priceField(key+'Weekend','Precio por noche fin de semana (opcional)')+'<p class="xs muted">Viernes y sábado. Si lo dejás vacío, se usa el precio por noche todos los días.</p>';
  const baseSection=`<section id="calendar-base-section" class="calendar-rate-section stack" aria-labelledby="calendar-base-heading"><h3 id="calendar-base-heading">Tarifa habitual</h3>${priceField('base','Precio por noche')}${weekendField('base')}</section>`;
  const seasonSections=[['high','alta'],['low','baja']].map(([key,name])=>`<section id="calendar-${key}-section" class="calendar-rate-section stack" aria-labelledby="calendar-${key}-heading"><h3 id="calendar-${key}-heading">Temporada ${name}</h3>${priceField(key,'Precio por noche (opcional)')}${weekendField(key)}<label for="calendar-${key}-start">Inicio de temporada ${name}<span data-calendar-required="${key}">${calendarSeasonConfigured(c,key)?' *':''}</span></label><input id="calendar-${key}-start" type="date" ${calendarSeasonConfigured(c,key)?'required':''} min="2026-12-01" max="2026-12-31" value="${safe(c[key+'Start'])}"><label for="calendar-${key}-end">Fin de temporada ${name}<span data-calendar-required="${key}">${calendarSeasonConfigured(c,key)?' *':''}</span></label><input id="calendar-${key}-end" type="date" ${calendarSeasonConfigured(c,key)?'required':''} min="2026-12-01" max="2026-12-31" value="${safe(c[key+'End'])}"></section>`).join('');
  const ratesPanel=`<details class="card calendar-rates" id="calendar-rates" ${e.configOpen?'open':''}><summary>Configurar tarifas · Habitual ${calendarMoney(h,state.rates.base)}</summary><div class="stack"><p class="small">La tarifa habitual viene del precio orientativo al crear la casa. Alta y baja son opcionales: al cambiar su tarifa se actualizan todos sus días, sin volver a seleccionarlos.</p>${baseSection}${seasonSections}<p class="xs muted">Si definís cualquiera de los precios de una temporada, inicio y fin son obligatorios. Ambas fechas están incluidas y los períodos no pueden solaparse. Sin configurar la temporada, no se piden fechas. Conserva precios especiales y disponibilidad. Demo: diciembre de 2026.</p><p class="xs muted">Vaciar alta o baja devuelve sus días a tarifa habitual. Los precios especiales se conservan.</p><button class="btn btn-primary" data-calendar-save-rates>Guardar tarifas</button>${e.error?`<p role="alert">${safe(e.error)}</p>`:''}${e.notice?`<p role="status">${safe(e.notice)}</p>`:''}</div></details>`;
  const currentAvailability=days.length?(days.every(day=>calendarDay(h.id,day).available)?'Disponibles':days.every(day=>!calendarDay(h.id,day).available)?'Ocupados':'Disponibilidad variada'):'';
  const selectionPanel=days.length?`<section class="card calendar-selection stack" aria-label="Editar días seleccionados"><div class="row between"><b>${days.length} día${days.length===1?'':'s'} seleccionado${days.length===1?'':'s'}</b><button class="link" data-calendar-clear>Cancelar</button></div><p class="xs muted calendar-selected-dates">${days.join(', ')} de diciembre · ${currentAvailability}</p><div class="row" style="flex-wrap:wrap"><span class="small">Disponibilidad</span>${[['available','Disponible'],['occupied','Ocupado']].map(([key,label])=>`<button class="chip" data-calendar-availability="${key}" aria-pressed="${e.availability===key}">${label}</button>`).join('')}</div><label for="calendar-price">Precio por noche (${h.cur})</label><div class="row"><input id="calendar-price" type="number" min="0.01" max="100000000" step="0.01" value="${safe(e.price)}" placeholder="${e.mixedPrice?'Varios precios':'Precio por noche'}"><button class="btn btn-ghost" data-calendar-restore aria-pressed="${e.restore}">Restaurar tarifa</button></div><p id="calendar-price-help" class="xs muted">${e.restore?'Al guardar se recupera la tarifa de cada fecha y se quita ★.':e.priceEdited?'Este precio se aplicará a todos los días seleccionados. Solo se marca ★ si difiere de su tarifa.':'Si no cambiás el precio, se conserva el de cada día.'}</p>${e.error?`<p role="alert" class="xs">${safe(e.error)}</p>`:''}<button class="btn btn-primary" data-calendar-save-selection>Guardar cambios</button></section>`:'';
  return header('Calendario y precios','o-houses')+`<label for="c-house">Casa</label><select id="c-house">${MY.map(m=>`<option value="${m.id}" ${m.id===h.id?'selected':''}>${safe(m.t)}</option>`).join('')}</select>${ratesPanel}<h3>Seleccioná los días</h3><p class="small">Tocá uno o varios días para editar su disponibilidad o precio. Volvé a tocar un día para desmarcarlo.</p>${calendar(true,h)}${e.notice?`<p role="status">${safe(e.notice)}</p>`:''}<p class="xs muted">★ Precio diferente a la tarifa configurada. Demo en memoria: recargar borra los cambios.</p>${selectionPanel}`;
};
document.addEventListener('input',e=>{
  if(!houseManageable(calendarEditor.house))return;
  if(e.target.id==='calendar-price'){
    Object.assign(calendarEditor,{price:e.target.value,priceEdited:true,restore:false,error:''});
    const help=document.getElementById('calendar-price-help');if(help)help.textContent='Este precio se aplicará a todos los días seleccionados. Solo se marca ★ si difiere de su tarifa.';
    document.querySelector('[data-calendar-restore]')?.setAttribute('aria-pressed','false');
  }
  if(['base','high','low','baseWeekend','highWeekend','lowWeekend'].includes(e.target.dataset?.calendarRate)){
    calendarEditor.config[e.target.dataset.calendarRate]=e.target.value;
    for(const key of ['high','low']){
      const required=calendarSeasonConfigured(calendarEditor.config,key);
      for(const edge of ['start','end'])document.getElementById(`calendar-${key}-${edge}`).required=required;
      document.querySelectorAll(`[data-calendar-required="${key}"]`).forEach(mark=>{mark.textContent=required?' *':'';});
    }
  }
  if(e.target.id==='calendar-high-start')calendarEditor.config.highStart=e.target.value;
  if(e.target.id==='calendar-high-end')calendarEditor.config.highEnd=e.target.value;
  if(e.target.id==='calendar-low-start')calendarEditor.config.lowStart=e.target.value;
  if(e.target.id==='calendar-low-end')calendarEditor.config.lowEnd=e.target.value;
});
document.addEventListener('toggle',e=>{if(e.target.id==='calendar-rates')calendarEditor.configOpen=e.target.open;},true);
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-calendar-day],[data-calendar-availability],[data-calendar-restore],[data-calendar-save-selection],[data-calendar-clear],[data-calendar-save-rates]');if(!el)return;
  e.stopImmediatePropagation();if(S.screen!=='o-cal'||!houseManageable(calendarEditor.house))return;
  const d=el.dataset,ed=calendarEditor;
  if(d.calendarAvailability)ed.availability=ed.availability===d.calendarAvailability?null:d.calendarAvailability;
  if(d.calendarRestore!==undefined)calendarRestoreSelection();
  if(d.calendarSaveSelection!==undefined&&!calendarSaveSelection())ed.error='Elegí un cambio de disponibilidad o indicá un precio positivo; también podés restaurar la tarifa.';
  if(d.calendarDay)calendarSelect(Number(d.calendarDay));
  if(d.calendarClear!==undefined)calendarClearSelection();
  if(d.calendarSaveRates!==undefined){
    const ok=calendarConfigure(ed.house,ed.config);ed.configOpen=!ok;
    ed.error=ok?'':'Indicá precios positivos (máximo 100 millones). El precio de fin de semana requiere un precio por noche en esa misma sección. Si definís un precio de temporada alta o baja, completá su inicio y fin de diciembre de 2026 en orden y sin solapamientos.';
    ed.notice=ok?'Tarifas guardadas: todos los días asociados se actualizaron. Disponibilidad y precios especiales conservados.':'';
    if(ok){ed.config=calendarConfigValues(ed.house);calendarRefreshSelection();}
  }
  calendarRender();
},true);
render();
