// Estados de la casa y suscripción · 2026-10-13
// Pendiente de revisión → Pendiente de pago (se salta mientras dura la oferta gratuita) → Activa → Inactiva (el propietario para la suscripción).
// Avisos por WhatsApp (simulados) desde 3 meses antes del fin de la oferta para que añada un método de pago.
const BILLING_DAY=86400000,BILLING_REMINDER_DAYS=[90,30,7,0];
const houseBilling=new Map();
function billingSeed(id,endsAt,method=false){houseBilling.set(id,{plan:'promo',tier:'12 meses gratis',promoEndsAt:typeof endsAt==='number'?endsAt:Date.parse(endsAt),paymentMethod:method,paidSince:null,log:[]});}
// Fechas absolutas: la demo vive en diciembre de 2026 y algunas pruebas mueven el reloj; así CT-1042 queda dentro de la ventana de avisos y CT-1150 lejos de vencer.
billingSeed('CT-1042','2027-01-10T06:00:00Z');
billingSeed('CT-1150','2027-10-01T06:00:00Z');
function billingFor(id){if(!houseBilling.has(id))billingSeed(id,relayNow()+365*BILLING_DAY);return houseBilling.get(id);}
const billingDate=ts=>new Date(ts).toLocaleDateString('es-CR',{day:'numeric',month:'short',year:'numeric',timeZone:'America/Costa_Rica'});
function billingTick(id){
  const b=billingFor(id);
  if(b.plan==='promo'&&relayNow()>=b.promoEndsAt){
    if(b.paymentMethod){b.plan='paid';b.paidSince=b.promoEndsAt;billingLog(id,'Suscripción iniciada con el método de pago guardado. Tu casa sigue visible.');}
    else{b.plan='due';billingLog(id,'Tu oferta gratuita terminó y no hay un método de pago. La casa dejó de mostrarse en bnbtico hasta que lo añadás.');}
  }
  return b;
}
function billingLog(id,text){const b=billingFor(id);if(!b.log.some(e=>e.text===text))b.log.push({at:relayNow(),text});}
function billingReminderDue(id){
  const b=billingTick(id);if(b.plan!=='promo'||b.paymentMethod)return null;
  const daysLeft=Math.ceil((b.promoEndsAt-relayNow())/BILLING_DAY);
  const step=BILLING_REMINDER_DAYS.find(d=>daysLeft<=d);
  return step===undefined?null:{daysLeft,step};
}
function billingPayLink(id){const base=typeof location!=='undefined'&&location.origin?location.origin+location.pathname:'https://bnbtico.app/';return base+'#pago='+id;}
function billingWhatsappText(id){
  const h=HOUSES.find(h=>h.id===id)||MY.find(h=>h.id===id),b=billingFor(id);
  return `Hola, somos bnbtico. «${h?h.t:id}» está gratis hasta el ${billingDate(b.promoEndsAt)}: no se te cobrará nada hasta esa fecha. Para que siga saliendo en la app después, añadí un método de pago aquí: ${billingPayLink(id)} · Desde entonces, ₡9.900 al mes por casa, sin permanencia.`;
}
// Estado visible de cada casa.
function houseState(id){
  const b=billingTick(id),settings=houseSettings(id);
  if(!settings.active)return {key:'inactive',label:'Inactiva',badge:'badge-mute',detail:'Paraste la suscripción. La casa no se muestra ni se cobra. Podés reactivarla cuando quieras.'};
  if(b.plan==='due')return {key:'payment_due',label:'Pendiente de pago',badge:'badge-warn',detail:'La oferta gratuita terminó. Añadí un método de pago para que la casa vuelva a mostrarse.'};
  if(b.plan==='promo'){const r=billingReminderDue(id);return {key:'active',label:'Activa',badge:'badge-ok',detail:`Gratis hasta el ${billingDate(b.promoEndsAt)} (${b.tier}).${b.paymentMethod?' Método de pago guardado: la suscripción empezará sola al terminar la oferta.':''}`,reminder:r};}
  return {key:'active',label:'Activa',badge:'badge-ok',detail:`Suscripción activa desde el ${billingDate(b.paidSince)} · ₡9.900/mes, sin permanencia.`};
}
// Visibilidad: una casa pendiente de pago o inactiva no sale en el catálogo ni se puede compartir.
{const previous=houseAvailable;houseAvailable=id=>previous(id)&&houseState(id).key==='active';}
// Reactivar no exige Veriff (es opcional desde 2026-10-13); sí WhatsApp verificado del propietario y de la casa.
houseSetActive=(id,value)=>{
  if(!houseManageable(id)||typeof value!=='boolean')return false;
  const h=MY.find(h=>h.id===id);
  if(value&&(!h.ownerV||!houseVerified(h.owner)||!(typeof listingPhoneVerified==='function'?listingPhoneVerified(id):publication.account.whatsappVerified)))return false;
  houseSettings(id).active=value;return true;
};
function billingAddPaymentMethod(id){const b=billingFor(id);if(!houseManageable(id)||b.paymentMethod)return false;b.paymentMethod=true;if(b.plan==='due'){b.plan='paid';b.paidSince=relayNow();billingLog(id,'Método de pago añadido. Suscripción activa y casa visible de nuevo.');}else billingLog(id,'Método de pago guardado. No se cobra nada hasta que termine la oferta.');return true;}
function billingExpireDemo(id){const b=billingFor(id);if(!houseManageable(id)||b.plan!=='promo')return false;b.promoEndsAt=relayNow()-1;billingTick(id);return true;}
// Tarjeta de Mis casas: estado, detalle y acciones.
function houseStateBlock(id){
  const s=houseState(id),b=billingFor(id);
  const reminder=s.reminder?`<div class="note small"><div><b>Tu oferta gratuita termina en ${s.reminder.daysLeft} día${s.reminder.daysLeft===1?'':'s'}</b><p>No se te cobrará nada hasta entonces. Añadí un método de pago antes de esa fecha para que tu casa siga saliendo en bnbtico; después, ₡9.900 al mes por casa, sin permanencia. También te lo recordamos por WhatsApp.</p></div></div>`:'';
  const actions=[];
  if(s.key==='payment_due'||(s.key==='active'&&b.plan==='promo'&&!b.paymentMethod))actions.push(`<button class="btn btn-primary btn-sm" data-billing-pay="${id}">Añadir método de pago</button>`);
  if(s.key==='active')actions.push(`<button class="btn btn-ghost btn-sm" data-billing-stop="${id}">Parar suscripción</button>`);
  if(s.key==='inactive')actions.push(`<button class="btn btn-primary btn-sm" data-billing-resume="${id}">Reactivar</button>`);
  if(s.key==='active'&&b.plan==='promo')actions.push(`<button class="btn-link xs" data-billing-expire="${id}">Simular fin de oferta · demo</button>`);
  return `<p class="small muted" style="margin-top:4px">${s.detail}</p>${reminder}<div class="row" style="gap:8px;flex-wrap:wrap;margin-top:6px">${actions.join('')}</div>`;
}
{const previous=ownerCard;ownerCard=h=>{const s=houseState(h.id);return previous(h)
  .replace('<span class="badge badge-ok">Activa</span>',`<span class="badge ${s.badge}">${s.label}</span>`)
  .replace('<div class="house-actions">',`${houseStateBlock(h.id)}<div class="house-actions">`);};}
{const previous=SCREENS['o-houses'];SCREENS['o-houses']=()=>previous()
  .replace('<span class="badge badge-warn">En revisión</span>','<span class="badge badge-warn">Pendiente de revisión</span>')
  .replace(/'review':'En revisión'|>En revisión · demo</g,m=>m.replace('En revisión','Pendiente de revisión'))
  .replace(/<span class="badge badge-sun">En revisión · demo<\/span>/g,'<span class="badge badge-sun">Pendiente de revisión · demo</span>')
  .replace(/<span class="badge badge-sun">Aprobado · demo<\/span>/g,'<span class="badge badge-sun">Aprobada · entra en la oferta gratuita (simulado)</span>');}
// Promoción y suscripción: resumen por casa y mensajes simulados.
SCREENS['o-sub']=()=>header('Promoción y suscripción','o-profile')+`<section class="card stack"><h3>Tus casas</h3>${MY.map(h=>{const s=houseState(h.id),b=billingFor(h.id);return `<div class="stack" style="gap:4px;padding:8px 0;border-top:1px solid var(--line)${(S.params?.pago||S.params?.id)===h.id?';background:var(--primary-soft,#fff0f3);border-radius:12px;padding:10px':''}"><div class="row between"><b>${safe(h.t)}</b><span class="badge ${s.badge}">${s.label}</span></div><span class="small">${s.detail}</span>${!b.paymentMethod&&s.key!=='inactive'?`<button class="btn btn-primary btn-sm" data-billing-pay="${h.id}" style="align-self:flex-start">Añadir método de pago</button>`:''}<span class="xs muted">Método de pago: ${b.paymentMethod?'guardado':'ninguno'}${b.plan==='promo'?` · avisos por WhatsApp a los 90, 30 y 7 días y el último día (${billingDate(b.promoEndsAt-90*BILLING_DAY)}, ${billingDate(b.promoEndsAt-30*BILLING_DAY)}, ${billingDate(b.promoEndsAt-7*BILLING_DAY)}, ${billingDate(b.promoEndsAt)})`:''}</span>${b.plan==='promo'?`<details class="small"><summary>Ver el aviso que enviamos por WhatsApp</summary><p style="white-space:pre-wrap">«${safe(billingWhatsappText(h.id))}»</p><p class="xs muted">Simulado: no se envía ningún mensaje en la demo.</p></details>`:''}${b.log.length?`<details class="small"><summary>Mensajes y cambios (simulados)</summary>${b.log.map(e=>`<p>${billingDate(e.at)} · ${safe(e.text)}</p>`).join('')}</details>`:''}</div>`;}).join('')}<p class="xs muted">Cómo funciona: tras la revisión, la casa pasa a Pendiente de pago, salvo que entre en la oferta gratuita, que la salta. Al terminar la oferta se cobra ₡9.900/mes por casa si hay método de pago; si no, vuelve a Pendiente de pago y deja de mostrarse. Podés parar la suscripción cuando quieras (Inactiva) y reactivarla después. Todo simulado: sin cobros ni mensajes reales.</p></section>`+launchPromotion();
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-billing-pay],[data-billing-stop],[data-billing-resume],[data-billing-expire]');if(!button)return;
  event.stopImmediatePropagation();const d=button.dataset;
  if(d.billingPay){toast(billingAddPaymentMethod(d.billingPay)?'Método de pago guardado · demo sin cobro real':'No se pudo guardar el método de pago.');return;}
  if(d.billingStop){if(houseSetActive(d.billingStop,false)){billingLog(d.billingStop,'Suscripción parada por el propietario. La casa pasa a Inactiva.');toast('Suscripción parada. La casa queda Inactiva y no se cobra.');}return;}
  if(d.billingResume){const b=billingTick(d.billingResume);if(houseSetActive(d.billingResume,true))toast(b.plan==='due'?'Casa reactivada: falta añadir un método de pago para que se muestre.':'Casa reactivada.');else toast('No se pudo reactivar. Revisá el WhatsApp verificado de la casa.');return;}
  if(d.billingExpire){if(billingExpireDemo(d.billingExpire))toast('Demo: la oferta terminó. '+(billingFor(d.billingExpire).plan==='paid'?'La suscripción empezó con el método de pago guardado.':'Sin método de pago, la casa queda Pendiente de pago y oculta.'));return;}
});
render();
// Ficha compartida de una casa Inactiva o Pendiente de pago: el enlace deja de mostrar el anuncio.
function houseLinkBlocked(id){const h=HOUSES.find(x=>x.id===id);if(!h)return null;const s=houseState(id);return s.key==='active'&&houseAvailable(id)?null:s;}
{const previous=SCREENS.detail;SCREENS.detail=()=>{
  if(S.role!=='guest')return previous();
  const id=S.params.id,blocked=houseLinkBlocked(id);if(!blocked)return previous();
  const why=blocked.key==='inactive'?'El propietario paró la suscripción de este anuncio, así que el enlace ya no muestra la ficha ni permite contactarlo desde bnbtico.':blocked.key==='payment_due'?'Este anuncio está fuera del catálogo hasta que el propietario regularice su suscripción.':'Este anuncio no está disponible en este momento.';
  return header('Ficha no disponible','home')+`<section class="card stack"><h3>Este enlace ya no está activo</h3><p>${why}</p><p class="small muted">Si ya hablaste con el propietario por WhatsApp, podés seguir esa conversación por tu cuenta.</p><button class="btn btn-primary" data-go="home">Explorar otras casas</button></section>`;
};}
// Enlace del aviso: #pago=CT-xxxx abre Promoción y suscripción del propietario (tras iniciar sesión si hace falta).
if(typeof window!=='undefined'&&window.location){
  const openPay=()=>{const id=String(window.location.hash).match(/^#pago=(CT-\d+)$/)?.[1];if(!id)return;S.role='owner';if(typeof accountAccess==='object'&&accountAccess&&!accountAccess.session()){accountAccess.state.returnTo={screen:'o-sub',id,pago:id};go('login');return;}go('o-sub',{pago:id});};
  window.addEventListener('hashchange',openPay);openPay();
}
if(typeof window!=='undefined'&&window.location){
  const openBlocked=()=>{const id=String(window.location.hash).match(/^#casa=(CT-\d+)$/)?.[1];if(id&&houseLinkBlocked(id)){S.role='guest';go('detail',{id});}};
  window.addEventListener('hashchange',openBlocked);openBlocked();
}
// Persistencia de demo: estado de suscripción y pausa por casa en este navegador, para que un enlace
// abierto en otra pestaña o tras recargar respete que la casa está Inactiva o Pendiente de pago.
const BILLING_STORE='bnbtico-demo-houses';
function billingSave(){
  try{const data={};for(const [id,b] of houseBilling)data[id]={plan:b.plan,promoEndsAt:b.promoEndsAt,paymentMethod:b.paymentMethod,paidSince:b.paidSince,active:houseSettings(id).active};localStorage.setItem(BILLING_STORE,JSON.stringify(data));}catch(e){}
}
function billingRestore(){
  try{const data=JSON.parse(localStorage.getItem(BILLING_STORE)||'{}');for(const [id,v] of Object.entries(data)){const b=billingFor(id);Object.assign(b,{plan:v.plan,promoEndsAt:v.promoEndsAt,paymentMethod:v.paymentMethod,paidSince:v.paidSince});houseSettings(id).active=v.active!==false;}}catch(e){}
}
billingRestore();
for(const name of ['billingAddPaymentMethod','billingExpireDemo','houseSetActive']){const previous=globalThis[name];globalThis[name]=(...args)=>{const r=previous(...args);billingSave();return r;};}
render();
