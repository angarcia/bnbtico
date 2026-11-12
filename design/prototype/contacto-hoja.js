// Ficha móvil: un solo botón de contacto; fechas, personas y mensaje por defecto viven en la hoja de WhatsApp · 2026-10-13
// Solo en móvil (S.dev==='phone'): la tarjeta de precio queda con el precio y la nota y el único botón es la barra fija. En web la ficha no cambia.
// Además se retira «responde en ~1 h» de la tarjeta del owner: no es un dato que conozcamos.
const CONTACT_DEFAULT_MESSAGE='Me gustaría saber si está disponible. Gracias.';
// El mensaje completo se redacta solo y se actualiza al cambiar fechas o personas, mientras el usuario no lo haya editado a mano.
const CONTACT_MONTHS=['enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function contactDates(d){
  if(!calendarConsultationRange(d))return '';
  const [ay,am,ad]=d.arrival.split('-').map(Number),[dy,dm,dd]=d.departure.split('-').map(Number);
  return am===dm&&ay===dy?`del ${ad} al ${dd} de ${CONTACT_MONTHS[am-1]}`:`del ${ad} de ${CONTACT_MONTHS[am-1]} al ${dd} de ${CONTACT_MONTHS[dm-1]}`;
}
function contactCompose(id,d={}){
  const h=HOUSES.find(x=>x.id===id);if(!h)return CONTACT_DEFAULT_MESSAGE;
  const dates=contactDates(d),people=Number(d.people)>0?`${Number(d.people)} persona${Number(d.people)===1?'':'s'}`:'';
  const ask=dates&&people?`¿Está disponible ${dates} para ${people}?`:dates?`¿Está disponible ${dates}?`:people?`¿Está disponible para ${people}?`:'¿Está disponible?';
  return `Hola, vi ${h.t} en 3bstays y me interesa. ${ask} Gracias.`;
}
if(typeof document!=='undefined'&&document.head){const st=document.createElement('style');st.textContent='@container (max-width:799px){.detail-side [data-contact]{display:none}}';document.head.appendChild(st);}
{const previous=SCREENS.detail;SCREENS.detail=()=>{
  if(S.role!=='guest'||S.dev!=='phone')return previous().replace(' · responde en ~1 h','');
  return previous().replace(' · responde en ~1 h','')
    .replace(/<div class="grid" style="grid-template-columns:1fr 1fr;gap:8px"><div class="field"><label class="xs" for="d-in">[\s\S]*?<\/div><\/div>\s*<div class="field"><label class="xs" for="d-ppl">[\s\S]*?<\/div>(?:<div class="field"><label class="xs" for="d-kids">[\s\S]*?<\/div>)?/,'')
    .replace(/<p class="small muted" id="precio-estimado">[\s\S]*?<\/p>/,'');
};}
// Hoja de contacto: fechas y personas arriba, mensaje por defecto editable.
{const previous=sheet;sheet=()=>{
  const s=S.sheet,html=previous();
  if(!(s?.type==='launch-contact'&&S.role==='guest'&&S.dev==='phone'))return html;
  const d=(typeof calendarContactDrafts!=='undefined'&&calendarContactDrafts.get(s.id))||{};
  const fields=`<div class="grid" style="grid-template-columns:1fr 1fr;gap:8px"><div class="field"><label class="xs" for="s-in">Llegada (opcional)</label><input type="date" id="s-in" value="${safe(d.arrival||'')}" style="min-width:0;width:100%"></div><div class="field"><label class="xs" for="s-out">Salida (opcional)</label><input type="date" id="s-out" value="${safe(d.departure||'')}" style="min-width:0;width:100%"></div></div><div class="field"><label class="xs" for="s-ppl">Personas (opcional)</label><input id="s-ppl" type="number" min="1" step="1" value="${d.people||''}" placeholder="¿Cuántos son?"></div>`;
  return html
    .replace('<p class="small">Fechas y personas son opcionales. Si las indicaste en la ficha, se añadirán al mensaje.</p>',fields)
    .replace(/(<p class="small">)(?:[^<]*)(<\/p><label for="launch-query">)/,`$1$2`)
    .replace(/<label for="launch-query">Tu consulta \(opcional\)<\/label><textarea id="launch-query" rows="3" maxlength="2000" placeholder="[^"]*">([\s\S]*?)<\/textarea>/,(m,val)=>{const auto=contactCompose(s.id,d);S.contactAuto=auto;return `<label for="launch-query">Tu mensaje</label><textarea id="launch-query" rows="4" maxlength="2000">${d.composed&&val.trim()?val:safe(auto)}</textarea>`;})
    .replace('<p class="small muted">Se prepara un saludo con el nombre de la casa y tu consulta, si la escribís. Podés editarlo en WhatsApp antes de pulsar Enviar. Los números quedan visibles para ambas partes.</p>','<p class="small muted">El mensaje se redacta solo con tus fechas y personas. Podés editarlo aquí o en WhatsApp antes de enviar. Los números quedan visibles para ambas partes.</p>');
};}
// Al cambiar fechas o personas, el mensaje se vuelve a redactar si el usuario no lo tocó.
if(typeof document!=='undefined')document.addEventListener('input',event=>{
  const el=event.target;if(!el||!['s-in','s-out','s-ppl'].includes(el.id))return;
  const ta=document.getElementById('launch-query'),button=document.querySelector('[data-launch-contact]');if(!ta||!button)return;
  if(ta.value.trim()!==String(S.contactAuto||'').trim())return;
  const g=k=>document.getElementById(k)?.value||'';
  S.contactAuto=contactCompose(button.dataset.launchContact,{arrival:g('s-in'),departure:g('s-out'),people:g('s-ppl')});ta.value=S.contactAuto;
});
// El texto de la hoja es el mensaje completo: no se le antepone otro saludo.
if(typeof launchClientMessage==='function'){const previous=launchClientMessage;launchClientMessage=(id,data={})=>data.composed?String(data.message||'').trim()||previous(id,data):previous(id,data);}
// Al pulsar Contactar en la hoja, se toman fechas, personas y mensaje de la propia hoja.
(typeof window!=='undefined'?window:document).addEventListener('click',event=>{
  const button=event.target.closest('[data-launch-contact]');if(!button||typeof calendarContactDrafts==='undefined'||!document.getElementById('s-in'))return;
  const id=button.dataset.launchContact,g=k=>document.getElementById(k)?.value||'';
  const draft={...(calendarContactDrafts.get(id)||{}),arrival:g('s-in'),departure:g('s-out'),people:g('s-ppl'),message:g('launch-query'),composed:true};
  if((draft.arrival||draft.departure)&&!calendarConsultationRange(draft)){event.stopImmediatePropagation();event.stopPropagation();toast('Indicá llegada y salida válidas; la salida debe ser posterior.');return;}
  calendarContactDrafts.set(id,draft);
},true);
render();
