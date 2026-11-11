/* WhatsApp directo · demo en memoria, sin números ni envíos reales. */
const CONTACT_TTL_DAYS=7, DAY_MS=86400000;
const relay={threads:[],selected:null,next:1042,clockOffset:0};
const relayNow=()=>Date.now()+relay.clockOffset;
const relayExpired=t=>relayNow()>=t.expiresAt;
const relayDate=ms=>new Intl.DateTimeFormat('es-CR',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Costa_Rica'}).format(ms);
const relayActive=(house,client)=>relay.threads.find(t=>t.house===house&&t.client===client&&!relayExpired(t));
const relayCurrent=()=>relay.threads.find(t=>t.id===relay.selected);
const safe=value=>String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const relayHouse=t=>HOUSES.find(h=>h.id===t?.house);
function relayActor(t){
  if(!t)return null;
  if(S.role==='guest'&&S.loggedIn&&t.client==='Andrea Castro')return 'guest';
  if(S.role==='owner'&&MY.some(h=>h.id===t.house))return 'owner';
  return null;
}
function relayCreate(house,client='Andrea Castro',existingLead=null,source='direct'){
  let t=relayActive(house,client);
  if(!t){
    const createdAt=relayNow();
    t={id:'B-'+relay.next++,house,client,source,createdAt,expiresAt:createdAt+CONTACT_TTL_DAYS*DAY_MS,clientConsent:true,ownerConsent:false};
    relay.threads.push(t);
    const lead=existingLead||{n:client,h:house,when:'ahora',msg:'Solicitó contacto por WhatsApp',score:null,count:0,rated:0};
    lead.threadId=t.id;if(!existingLead&&source!=='request')S.leads.unshift(lead);
  }
  relay.selected=t.id;return t;
}
S.leads.slice().forEach(l=>relayCreate(l.h,l.n,l));
// Estas propuestas precargadas simulan solicitudes consentidas y respuestas del owner.
S.requests.forEach(r=>{r.contactConsent=true;r.offers.forEach(o=>{const t=relayCreate(o.house,r.client,null,'request');t.ownerConsent=true;o.threadId=t.id;});});
relay.selected=null;
const relayLeadExpired=l=>{const t=relay.threads.find(t=>t.id===l.threadId);return t&&relayExpired(t);};
function relayLeadExpiry(l){
  const t=relay.threads.find(t=>t.id===l.threadId);
  return t?(relayExpired(t)?'Solicitud expirada · expiró ':'Solicitud activa · vence ')+relayDate(t.expiresAt)+' (Costa Rica)':'';
}
function relayRequest(house,consent){
  if(S.role!=='guest'||!S.loggedIn||consent!==true||!HOUSES.some(h=>h.id===house&&h.ownerV))return false;
  relayCreate(house);return true;
}
function relayAccept(t){
  if(relayActor(t)!=='owner'||!t.clientConsent||(!t.ownerConsent&&relayExpired(t))||!relayHouse(t)?.ownerV)return false;
  t.ownerConsent=true;return true;
}
const relayCanWhatsApp=t=>!!relayActor(t)&&t.clientConsent&&t.ownerConsent&&(typeof adminContactActive!=='function'||adminContactActive(t))&&(typeof houseContactAvailable!=='function'||houseContactAvailable(t.house,t.client));
function relayOpenHouse(house){
  if(S.role!=='guest')return false;
  if(!S.loggedIn){go('login',{id:house,after:'contact'});return false;}
  if(!HOUSES.some(h=>h.id===house&&h.ownerV)){toast('Esta casa aún no está disponible para contactar.');return false;}
  if(S.screen==='login'){S.screen='detail';S.params={id:house};}
  const t=relayActive(house,'Andrea Castro');relay.selected=t?.id||null;
  S.sheet=t?{type:'direct',thread:t.id}:{type:'contact',id:house};render();return true;
}
function relayOpenOffer(house,threadId){
  if(S.role==='guest'&&!S.loggedIn){go('login',{id:house,after:'offer',thread:threadId});return false;}
  const t=relay.threads.find(t=>t.id===threadId&&t.house===house);
  if(!t)return relayOpenHouse(house);
  if(!relayActor(t))return false;
  if(S.screen==='login'){S.screen='my-requests';S.params={};}
  relay.selected=t.id;S.sheet={type:'direct',thread:t.id};render();return true;
}
function contactHistory(){
  if(S.role!=='guest'||!S.loggedIn)return login();
  const list=relay.threads.filter(t=>relayActor(t)).slice().reverse();
  return header('Mis contactos','profile')+'<p class="small muted">Historial de solicitudes, no de conversaciones. Cuando ambos aceptan, hablan directamente por WhatsApp.</p>'+(list.length?list.map(t=>`<div class="card stack"><b>${safe(relayHouse(t).t)}</b><span class="small">${t.ownerConsent?'Contacto aceptado':relayExpired(t)?'Solicitud expirada':'Esperando al owner'}</span><span class="xs muted">${t.id} · vence ${relayDate(t.expiresAt)}</span><button class="btn btn-ghost" data-relay-select="${t.id}">${relayCanWhatsApp(t)?'Continuar por WhatsApp':'Ver solicitud'}</button>${relayExpired(t)?`<button class="btn btn-primary" data-contact="${t.house}">Nueva solicitud</button>`:''}</div>`).join(''):'<div class="card">Todavía no solicitaste ningún contacto.</div>');
}
SCREENS.contacts=contactHistory;
const originalCurrent=current;
current=()=>S.screen==='contacts'?'profile':originalCurrent();
const originalProfile=profile;
SCREENS.profile=()=>originalProfile()+(S.loggedIn?'<button class="btn btn-ghost" data-go="contacts">Mis contactos</button>':'');
const originalLeads=oLeads;
SCREENS['o-leads']=()=>originalLeads()+'<details class="card"><summary>Probar caducidad · demo</summary><p class="small">«No me interesa» no reinicia los 7 días ni bloquea futuras solicitudes. Recargar restablece la demo.</p><button class="btn btn-ghost" data-relay-week>Avanzar 7 días en la demo</button></details>';
const originalSheet=sheet;
sheet=function(){
  if(!S.sheet||!['contact','reply','direct'].includes(S.sheet.type))return originalSheet();
  const reply=S.sheet.type==='reply',r=reply?S.requests[S.sheet.i]:null;
  const options=reply&&S.role==='owner'&&r?.status==='open'&&r.contactConsent?receivedRequestHouses(r).filter(h=>h.ownerV&&MY.some(m=>m.id===h.id)&&(!S.sheet.calendarHouse||S.sheet.calendarHouse===h.id)):[];
  const t=S.sheet.type==='direct'?relay.threads.find(x=>x.id===S.sheet.thread):null;
  const h=reply?options[0]:HOUSES.find(x=>x.id===(t?t.house:S.sheet.id));
  if(!h?.ownerV||(t&&!relayActor(t))||(!t&&!reply&&(S.role!=='guest'||!S.loggedIn)))return '<div class="sheet"><div class="sheet-body"><p>No hay un contacto disponible.</p><button class="btn" data-close-btn>Cerrar</button></div></div>';
  const recipient=reply?r.client:relayActor(t)==='owner'?t.client:h.owner;
  const canOpen=reply||relayCanWhatsApp(t)||relayActor(t)==='owner'&&!relayExpired(t);
  return `<div class="sheet" data-close><div class="sheet-body stack" data-stop><div class="row between"><h3>${!t&&!reply?'Solicitar contacto':'WhatsApp directo'}</h3><button class="chip" data-close-btn>Cerrar</button></div>
    <p>${!t&&!reply?`Pedile a ${safe(recipient)} que te contacte por WhatsApp.`:canOpen?`Conversá directamente con ${safe(recipient)}.`:'El owner todavía no aceptó el contacto.'}</p>
    ${t?`<div class="note small">${relayExpired(t)?'Solicitud expirada.':'Ya existe una solicitud para esta casa.'} No se creará otro aviso. Plazo original: ${relayDate(t.expiresAt)} (Costa Rica).</div>`:''}
    ${reply?`<label for="relay-house">Casa que ofrecés</label><select id="relay-house">${options.map(x=>`<option value="${x.id}">${safe(x.t)}</option>`).join('')}</select>`:''}
    ${canOpen?`<div class="field"><label for="relay-first">Mensaje para WhatsApp</label><textarea id="relay-first" rows="3" maxlength="2000">${safe(reply?`Hola ${recipient}, vi tu búsqueda de casa en 3bstays. Tengo una propuesta para vos. ¿Confirmamos fechas y precio?`:`Hola ${recipient}, te escribo por «${h.t}» (${h.id}) en 3bstays. ¿Confirmamos los detalles?`)}</textarea></div>`:''}
    <p class="small muted">En WhatsApp podrán ver y guardar sus números. Recomendamos usar uno de negocio. 3bstays no lee, filtra ni guarda esa conversación.</p>
    ${!t&&!reply?`<label class="row small"><input type="checkbox" id="relay-consent"><span>Acepto compartir mi número con este owner para que me contacte por WhatsApp.</span></label><button class="btn btn-primary" data-relay-request-contact="${h.id}">Enviar solicitud</button>`:canOpen?`<button class="btn btn-wa" data-relay-start="${h.id}" ${t?`data-contact-thread="${t.id}"`:''} ${reply?`data-relay-request="${S.sheet.i}"`:''}>${t?.ownerConsent?'Simular apertura de WhatsApp':'Aceptar y contactar por WhatsApp'}</button>`:relayExpired(t)?'<p class="small">Podés enviar una nueva solicitud desde la ficha de la casa.</p>':'<p class="small">Te avisaremos cuando acepte. Podés ver el estado en Mi cuenta → Mis contactos.</p>'}
    <p class="xs muted">Demo: identidad simulada, sin teléfonos reales ni envíos. Los 7 días limitan avisos en 3bstays, no mensajes en WhatsApp.</p></div></div>`;
};
document.addEventListener('click',event=>{
  const el=event.target.closest('[data-relay-request-contact],[data-relay-start],[data-relay-lead],[data-relay-offer],[data-relay-select],[data-relay-dismiss],[data-relay-restore],[data-relay-week]');
  if(!el)return;event.stopImmediatePropagation();const d=el.dataset;
  if(d.relayWeek!==undefined){relay.clockOffset+=CONTACT_TTL_DAYS*DAY_MS;render();return;}
  if(d.relayDismiss!==undefined||d.relayRestore!==undefined){const l=S.leads[Number(d.relayDismiss??d.relayRestore)];if(S.role==='owner'&&l&&MY.some(h=>h.id===l.h)&&!relayLeadExpired(l)){l.dismissed=d.relayDismiss!==undefined;render();}return;}
  if(d.relayRequestContact){
    if(!relayRequest(d.relayRequestContact,document.getElementById('relay-consent')?.checked)){toast('Aceptá compartir tu número antes de enviar.');return;}
    S.sheet={type:'direct',thread:relayCurrent().id};render();toast('Solicitud registrada · demo sin avisos reales');return;
  }
  if(d.relayStart){
    if(!document.getElementById('relay-first')?.value.trim())return;
    const r=d.relayRequest!==undefined?S.requests[Number(d.relayRequest)]:null;
    let t=relay.threads.find(t=>t.id===d.contactThread);
    if(r){
      const house=document.getElementById('relay-house').value;
      if(S.role!=='owner'||r.status!=='open'||!r.contactConsent||(S.sheet?.calendarHouse&&S.sheet.calendarHouse!==house)||!receivedRequestHouses(r).some(h=>h.id===house&&h.ownerV&&MY.some(m=>m.id===house)))return;
      t=relayCreate(house,r.client,null,'request');
    }
    if(!t)return;
    if(relayActor(t)==='owner')relayAccept(t);
    if(!relayCanWhatsApp(t))return;
    if(r){r.replied=true;const offer=r.offers.find(o=>o.house===t.house);if(offer)offer.threadId=t.id;else r.offers.push({house:t.house,owner:relayHouse(t).owner,price:'precio por confirmar',threadId:t.id});}
    const destination=typeof listingPhoneDestination==='function'?listingPhoneDestination(t):null;
    S.sheet=null;render();toast(destination?`Demo: se abriría el WhatsApp de esta casa: ${destination}. No se envió ningún mensaje.`:'Demo: se abriría WhatsApp directo. No se compartieron números ni se envió un mensaje.');return;
  }
  if(d.relayOffer){relayOpenOffer(d.relayOffer,d.relayThread);return;}
  const lead=d.relayLead!==undefined?S.leads[Number(d.relayLead)]:null;
  const t=relay.threads.find(t=>t.id===(lead?lead.threadId:d.relaySelect));
  if(t&&relayActor(t)){relay.selected=t.id;S.sheet={type:'direct',thread:t.id};render();}
},true);
render();
