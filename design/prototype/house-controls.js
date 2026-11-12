/* Preferencias por anuncio. Todo es una simulación en memoria, sin llamadas a WhatsApp. */
const housePreferences=new Map();
const houseContactDefaults={direct:false};
NOTES.guest='Buscá una casa y contactá por WhatsApp: algunas permiten contacto directo; otras requieren aceptación. Una consulta por cliente y casa cada 7 días, sin avisos duplicados.';
publication.account.whatsappVerified=true; // Fixture de demostración; no es un OTP real.
adminUsers.items.forEach(u=>u.whatsappVerified=true);
function houseSettings(id){
  if(!housePreferences.has(id))housePreferences.set(id,{direct:MY.some(h=>h.id===id)&&houseContactDefaults.direct,active:true,available:true,reopenAt:null});
  const p=housePreferences.get(id);
  if(!p.available&&p.reopenAt!==null&&relayNow()>=p.reopenAt){p.available=true;p.reopenAt=null;}
  return p;
}
function houseVerified(name){
  const u=adminUsers.items.find(u=>u.name===name);
  return !!u&&u.active&&u.identity==='approved'&&u.whatsappVerified===true&&(!MY.some(h=>h.owner===name)||(publication.account.identityVerified&&(typeof listingPhoneVerified==='function'||publication.account.whatsappVerified)));
}
function houseManageable(id){return S.role==='owner'&&adminUserActive(adminSelfName())&&MY.some(h=>h.id===id);}
function houseAvailable(id){
  const h=HOUSES.find(h=>h.id===id);
  return !!h&&h.ownerV&&houseSettings(id).active&&houseVerified(h.owner)&&(typeof listingPhoneVerified!=='function'||listingPhoneVerified(id));
}
function houseContactAvailable(id,client='Andrea Castro'){
  return houseAvailable(id)&&houseVerified(client)&&adminUserActive(adminSelfName());
}
function houseCanSetDirect(id,value){
  if(!houseManageable(id)||typeof value!=='boolean')return false;
  if(value&&(!publication.account.identityVerified||!(typeof listingPhoneVerified==='function'?listingPhoneVerified(id):publication.account.whatsappVerified)||!houseVerified(HOUSES.find(h=>h.id===id).owner)))return false;
  return true;
}
function houseSetDirect(id,value){
  if(!houseCanSetDirect(id,value))return false;
  houseSettings(id).direct=value;return true;
}
function houseSetAllDirect(value){
  if(S.role!=='owner'||!adminUserActive(adminSelfName())||typeof value!=='boolean'||(value&&!publication.account.identityVerified)||!MY.every(h=>houseCanSetDirect(h.id,value)))return false;
  MY.forEach(h=>{houseSettings(h.id).direct=value;});houseContactDefaults.direct=value;return true;
}
function houseDirectAccountPanel(){
  const enabled=MY.filter(h=>houseSettings(h.id).direct).length;
  return `<section class="card stack" style="flex-shrink:0" aria-label="Contacto por WhatsApp de todas mis casas"><h3>¿Cómo querés recibir consultas?</h3><p class="small">Elegí para todas tus casas actuales y las que publiques después.</p><p class="small"><b>WhatsApp directo:</b> los clientes verificados pueden escribirte sin que aceptés cada consulta.</p><p class="small"><b>Revisar primero en 3bstays:</b> vos decidís qué consultas continuar por WhatsApp.</p><div class="note small"><span>Nuevas casas: <b>${houseContactDefaults.direct?'WhatsApp directo':'Revisar primero en 3bstays'}</b>.<br>Contacto directo activo en ${enabled} de ${MY.length} casas actuales.</span></div><button class="btn btn-ghost" data-house-direct-all>Configurar para todas mis casas</button><p class="xs muted">Podés cambiarlo en cada casa desde Mis casas → Contacto directo. No afecta a «Buscan casa».</p></section>`;
}
function houseSetActive(id,value){
  if(!houseManageable(id)||typeof value!=='boolean')return false;
  const h=MY.find(h=>h.id===id);
  if(value&&(!h.ownerV||!houseVerified(h.owner)||!publication.account.identityVerified||!(typeof listingPhoneVerified==='function'?listingPhoneVerified(id):publication.account.whatsappVerified)))return false;
  houseSettings(id).active=value;return true;
}
function houseScheduleReopening(id){
  const p=houseSettings(id);if(p.timer)clearTimeout(p.timer);
  if(p.reopenAt===null)return;
  p.timer=setTimeout(()=>{houseScheduleReopening(id);render();},Math.min(2147483647,Math.max(1,p.reopenAt-relayNow())));
}
function houseSetAvailability(id,value,reopenDate=''){
  if(!houseManageable(id)||typeof value!=='boolean'||!houseSettings(id).active)return false;
  let reopenAt=null;
  if(!value&&reopenDate!==''){
    if(!/^\d{4}-\d{2}-\d{2}$/.test(reopenDate))return false;
    reopenAt=Date.parse(reopenDate+'T00:00:00-06:00');
    if(!Number.isFinite(reopenAt)||new Date(reopenAt-6*3600000).toISOString().slice(0,10)!==reopenDate||reopenAt<=relayNow())return false;
  }
  Object.assign(houseSettings(id),{available:value,reopenAt});houseScheduleReopening(id);return true;
}
function houseReopeningNote(id){const at=houseSettings(id).reopenAt;return at===null?'':`<p class="xs muted">Reapertura programada: ${relayDate(at)} (Costa Rica). Demo en memoria.</p>`;}
function houseControls(h){
  const p=houseSettings(h.id);
  return `<div class="house-actions"><button class="btn btn-ghost btn-sm" data-go="o-cal" data-id="${h.id}">Calendario</button><button class="btn btn-ghost btn-sm" data-house-edit="${h.id}">Editar</button><button class="btn btn-sm ${p.available?'house-positive':'house-negative'}" data-house-availability="${h.id}" aria-pressed="${p.available}" ${!p.active?'disabled':''}>${p.available?'Disponible':'No disponible'}</button><button class="btn btn-sm ${p.direct?'house-positive':'house-review'}" data-house-direct="${h.id}" aria-pressed="${p.direct}">Contacto directo: ${p.direct?'Sí':'No'}</button></div>`;
}
ownerCard=h=>`<article class="listing"><div class="photo ${h.photo}" data-go="o-house" data-id="${h.id}"><span>${safe(h.loc.split(',')[0])}</span></div><div class="body"><div class="row between"><b>${safe(h.t)}</b><span class="badge ${houseSettings(h.id).active?'badge-ok':'badge-mute'}">${houseSettings(h.id).active?'Activa':'Desactivada'}</span></div><div class="small muted num">${h.views} vistas · ${h.contacts} contactos · ${fmt(h)}/${h.unit}</div>${houseControls(h)}${houseReopeningNote(h.id)}</div></article>`;
const housesPage=SCREENS['o-houses'];
const houseActionsStyle='<style>.house-actions{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:8px;margin-top:8px}.house-actions .btn{white-space:normal;min-width:0;padding:10px 8px}.house-actions .btn:last-child{font-size:12px}.house-actions .btn:disabled{opacity:.5;cursor:not-allowed}.house-actions .house-positive{background:#d3efdf;color:#174a30;border:1px solid #84b89a}.house-actions .house-negative{background:#f8dce2;color:#7a2036;border:1px solid #dc94a4}.house-actions .house-review{background:#fff0ca;color:#6b470d;border:1px solid #d4b66d}</style>';
const housePendingControls=()=>'<div class="house-actions"><button class="btn btn-ghost btn-sm" disabled>Calendario</button><button class="btn btn-ghost btn-sm" disabled>Editar</button><button class="btn btn-ghost btn-sm" disabled>No disponible</button><button class="btn btn-ghost btn-sm" disabled>Contacto directo: '+(houseContactDefaults.direct?'Sí':'No')+'</button></div><p class="xs muted">Controles no disponibles: anuncio aún fuera del catálogo de esta demo. No se puede activar sin aprobación.</p>';
SCREENS['o-houses']=()=>houseActionsStyle+housesPage().replace('Enviada hace 2 h · revisión simulada, sin avisos reales.</div>','Enviada hace 2 h · revisión simulada, sin avisos reales.</div>'+housePendingControls()).replaceAll('Guardado solo en esta sesión. No publicado en el catálogo.</p>','Guardado solo en esta sesión. No publicado en el catálogo.</p>'+housePendingControls())+'<p class="small muted">La preferencia general se configura en Mis consultas para todas tus casas actuales y futuras. Podés cambiarla por casa. Si elegís Sí, los clientes verificados pueden abrir el WhatsApp de esa casa sin que aceptés cada consulta. Podés cambiar y verificar su número desde Editar. Las búsquedas de «Buscan casa» no cambian.</p>';
const housesDash=SCREENS['o-dash'];
SCREENS['o-dash']=()=>houseActionsStyle+housesDash().replace('<div class="v num">2</div>',`<div class="v num">${MY.filter(h=>houseSettings(h.id).active).length}</div>`);
const housesFiltered=filtered;filtered=()=>housesFiltered().filter(h=>houseAvailable(h.id));
const housesSearch=searchMatches;searchMatches=c=>housesSearch(c).filter(h=>houseAvailable(h.id)&&houseSettings(h.id).available);matches=searchMatches;
const housesCard=listingCard;listingCard=h=>houseAvailable(h.id)?housesCard(h).replace('</article>',`${!houseSettings(h.id).available?'<p class="badge badge-warn" style="margin:12px">No disponible · sin nuevas consultas</p>':''}</article>`):'';
const housesDetail=detail;
detail=back=>{
  if(S.role==='guest'&&!houseAvailable(S.params.id))return header('Anuncio no disponible','home')+'<p>Esta casa no está disponible actualmente.</p>';
  const body=housesDetail(back);
  if(!houseSettings(S.params.id).available)return body.replace(/<button\b[^>]*data-contact="[^"]+"[^>]*>[\s\S]*?<\/button>/g,'<button class="btn btn-ghost" disabled>No disponible</button>')+'<p class="note">El anuncio sigue visible, pero no admite nuevas consultas. Los contactos anteriores se conservan en Mis contactos.</p>';
  return houseSettings(S.params.id).direct?body.replaceAll('Solicitar contacto','Contactar por WhatsApp').replace('cuando acepte tu solicitud','sin esperar aceptación: esta casa acepta contacto directo').replace('1. Solicitás contacto y aceptás compartir tu número. 2. El owner decide si te contacta por WhatsApp.','1. Verificás tu cuenta y aceptás compartir tu número. 2. Abrís WhatsApp directamente con el propietario.'):body;
};
const housesCreate=relayCreate;
relayCreate=(id,client='Andrea Castro',lead=null,source='direct')=>houseSettings(id).available&&houseContactAvailable(id,client)?housesCreate(id,client,lead,source):null;
const housesRequest=relayRequest;relayRequest=(id,consent)=>houseSettings(id).available&&houseContactAvailable(id)&&housesRequest(id,consent);
const housesAccept=relayAccept;relayAccept=t=>!!t&&houseContactAvailable(t.house,t.client)&&housesAccept(t);
function houseDirectContact(id,consent){
  if(S.role!=='guest'||!S.loggedIn||consent!==true||!houseSettings(id).direct||!houseContactAvailable(id))return false;
  const t=relayCreate(id);if(!t)return false;
  t.ownerConsent=true;t.ownerConsentSource=t.ownerConsentSource||'listing';
  // An intent to open a chat, not proof that a message was sent or delivered.
  t.directOpening=true;return true;
}
const housesOpen=relayOpenHouse;
relayOpenHouse=id=>{
  if(S.role!=='guest')return false;
  if(!houseSettings(id).available){toast('Esta casa no admite nuevas consultas. Los contactos anteriores se conservan en Mis contactos.');return false;}
  if(!S.loggedIn)return housesOpen(id);
  if(!houseContactAvailable(id)){toast('Necesitás identidad y WhatsApp verificados, y una casa activa para contactar.');return false;}
  const t=relayActive(id,'Andrea Castro');
  if(!houseSettings(id).direct||t?.ownerConsent)return housesOpen(id);
  if(S.screen==='login'){S.screen='detail';S.params={id};}
  S.sheet={type:'house-direct-contact',id};render();return true;
};
const housesSheet=sheet;
sheet=()=>{
  if(S.sheet?.type==='house-direct-all'&&S.role==='owner')return `<div class="sheet" data-close><div class="sheet-body stack" data-stop><div class="row between"><h3>Contacto de todas mis casas</h3><button class="chip" data-close-btn>Cancelar</button></div><p>Se aplicará a todas tus casas actuales, reemplazando sus ajustes individuales, y será la opción predeterminada para las nuevas. Después podés cambiar cualquier casa por separado.</p><p class="small muted">Con contacto directo, los clientes verificados pueden abrir el WhatsApp de cada casa sin esperar tu aceptación. Podrán ver y guardar el número. No se envían mensajes automáticamente.</p><button class="btn btn-wa" style="white-space:normal" data-house-direct-all-save="yes">Sí, WhatsApp directo para todas</button><button class="btn btn-ghost" style="white-space:normal" data-house-direct-all-save="no">No, revisar primero en 3bstays</button><p class="xs muted">No afecta a «Buscan casa», no cambia los números de WhatsApp y no retira contactos ya compartidos. Demo en memoria.</p></div></div>`;
  const s=S.sheet;if(!s||!['house-direct-setting','house-direct-contact','house-close-calendar'].includes(s.type))return housesSheet();
  const h=HOUSES.find(h=>h.id===s.id);if(!h)return housesSheet();
  if(s.type==='house-close-calendar'){
    if(!houseManageable(h.id))return '';
    const min=new Date(relayNow()-6*3600000+DAY_MS).toISOString().slice(0,10);
    return `<div class="sheet" data-close><div class="sheet-body stack" data-stop><div class="row between"><h3>Cerrar calendario temporalmente</h3><button class="chip" data-close-btn>Cancelar</button></div><b>${safe(h.t)}</b><p>La casa seguirá visible, sin nuevas consultas. Todas las fechas, disponibilidades y tarifas se conservan.</p><label for="house-reopen-date">¿Querés que 3bstays la vuelva a poner disponible en una fecha?</label><input type="date" id="house-reopen-date" min="${min}"><p class="small muted">Fecha opcional. En blanco: cerrada hasta que la reabrás. Con fecha: reapertura a las 00:00, hora de Costa Rica.</p><button class="btn btn-primary" data-house-close-confirm="${h.id}">Poner No disponible</button><p class="xs muted">Demo: la programación solo funciona mientras la página siga abierta; recargar borra los cambios. En producción se ejecutará en el servidor.</p></div></div>`;
  }
  const setting=s.type==='house-direct-setting';
  return `<div class="sheet" data-close><div class="sheet-body stack" data-stop><div class="row between"><h3>${setting?'Contacto directo por WhatsApp':'Contactar por WhatsApp'}</h3><button class="chip" data-close-btn>Cerrar</button></div><b>${safe(h.t)}</b>${setting?'<p>Si elegís Sí, autorizás que los clientes verificados abran tu WhatsApp sin aceptar cada consulta en 3bstays. Solo afecta a esta casa, no a las búsquedas compartidas de «Buscan casa».</p>':'<p>Este propietario acepta el contacto directo. No necesitás esperar su aprobación en 3bstays.</p>'}<p class="small muted">En WhatsApp podrán ver y guardar sus números. No se envía ningún mensaje automáticamente. 3bstays no lee ni guarda esa conversación.</p>${setting?`<button class="btn btn-wa" data-house-direct-save="${h.id}" data-value="yes" style="white-space:normal;text-align:center">Sí, aceptar contacto directo por WhatsApp</button><button class="btn btn-ghost" data-house-direct-save="${h.id}" data-value="no" style="white-space:normal;text-align:center">No, revisar cada consulta en 3bstays antes de contactar por WhatsApp con los clientes</button><p class="xs muted">Desactivarlo no retira números ni contactos ya compartidos.</p>`:`<label class="row small"><input id="house-direct-consent" type="checkbox"><span>Acepto compartir mi número con este propietario al hablar por WhatsApp.</span></label><button class="btn btn-wa" data-house-contact="${h.id}">Simular apertura de WhatsApp</button><p class="xs muted">Demo sin números reales ni envíos.</p>`}</div></div>`;
};
// Editar abre un borrador de ESTA casa; enviar conserva el anuncio original y pide revisión.
const housesReset=publicationReset;
publicationReset=()=>{housesReset();publication.editingHouse=null;};
function houseEdit(id){
  if(!houseManageable(id))return false;
  const h=MY.find(h=>h.id===id);publicationReset();publication.editingHouse=id;
  Object.assign(publication.draft,{kind:'house',acceptsLongTerm:h.acceptsLongTerm?'yes':'no',province:h.loc.split(',').at(-1).trim(),zone:h.loc.split(',')[0],people:String(h.ppl),bedrooms:String(h.beds),bathrooms:String(h.baths),title:h.t,description:h.desc,photoCount:5,nightlyPrice:String(h.price),currency:h.cur==='$'?'USD':'CRC',minNights:String(h.min||1)});
  for(const k of ['pets','pool','wifi','ac','parking'])publication.draft[k]=h[k]?'yes':'no';
  go('o-new');return true;
}
const housesPublication=SCREENS['o-new'];
SCREENS['o-new']=()=>publication.editingHouse?housesPublication().replace('Publicar alojamiento','Editar alojamiento')+`<div class="note">Editando ${safe(publication.editingHouse)}. Completá los datos que falten. Los cambios se envían a revisión; el anuncio original se conserva. La demo no aplica automáticamente la edición al catálogo.</div><section class="card stack"><h3>Estado del anuncio</h3><p>Desactivar oculta la casa del catálogo. No disponible la mantiene visible sin nuevas consultas. Ninguno borra contactos ni modifica fechas o precios del calendario.</p><button class="btn btn-ghost" data-house-active="${publication.editingHouse}">${houseSettings(publication.editingHouse).active?'Desactivar anuncio':'Activar anuncio'}</button><p class="xs muted">Cambio inmediato en esta demo; sin cobros reales.</p></section>`:housesPublication();
const housesSubmit=publicationSubmit;
publicationSubmit=()=>{if(typeof listingPhoneCurrent!=='function'&&!publication.account.whatsappVerified){publication.error='Verificá tu nuevo número de WhatsApp antes de publicar. Verificación real pendiente en esta demo.';return false;}const id=publication.editingHouse,ok=housesSubmit();if(ok&&id)publication.submitted.at(-1).editingHouse=id;return ok;};
const housesSetWhatsapp=publicationSetWhatsapp;
publicationSetWhatsapp=value=>{const before=publication.account.whatsapp,ok=housesSetWhatsapp(value);if(ok&&publication.account.whatsapp!==before)publication.account.whatsappVerified=false;return ok;};
const housesWhatsapp=SCREENS['o-whatsapp'];
SCREENS['o-whatsapp']=()=>housesWhatsapp()+(!publication.account.whatsappVerified?'<div class="note">Nuevo número pendiente de verificación. Al usarlo en una nueva casa tendrás que verificarlo allí. Los números ya verificados de otras casas se conservan. Demo sin envíos reales.</div>':'');
const housesLeads=SCREENS['o-leads'];
SCREENS['o-leads']=()=>{
  let body=housesLeads();
  body=body.replace(header('Interés en mis casas'),header('Interés en mis casas')+houseDirectAccountPanel());
  S.leads.forEach((l,i)=>{
    if(!relay.threads.some(t=>t.id===l.threadId&&t.directOpening))return;
    body=body.replace(`<button class="btn btn-ghost btn-sm" data-relay-dismiss="${i}">No me interesa</button>`,`<span class="badge badge-ok">Contacto directo habilitado · sin aceptación pendiente</span>`);
  });
  return body.replace('Podés contactarles por WhatsApp o marcar «No me interesa».','Si el cliente usó contacto directo, ya puede escribirte por WhatsApp y no necesita aceptación. En las demás consultas podés contactar o marcar «No me interesa».');
};
document.addEventListener('change',e=>{if(e.target.id==='c-house'&&S.role==='owner')go('o-cal',{id:e.target.value});});
document.addEventListener('click',e=>{
  if(e.target.closest('[data-go="o-new"]')&&publication.editingHouse&&S.role==='owner')publicationReset();
  const el=e.target.closest('[data-house-edit],[data-house-active],[data-house-availability],[data-house-close-confirm],[data-house-direct],[data-house-direct-save],[data-house-contact],[data-house-direct-all],[data-house-direct-all-save]');
  if(!el)return;e.stopImmediatePropagation();const d=el.dataset;
  if(d.houseDirectAll!==undefined){if(S.role==='owner'){S.sheet={type:'house-direct-all'};render();}return;}
  if(d.houseDirectAllSave!==undefined){if(houseSetAllDirect(d.houseDirectAllSave==='yes')){S.sheet=null;render();toast('Preferencia aplicada a todas tus casas actuales y futuras.');}else toast('No se aplicó ningún cambio. Revisá identidad y WhatsApp de tus casas.');return;}
  if(d.houseEdit){houseEdit(d.houseEdit);return;}
  if(d.houseAvailability){if(!houseManageable(d.houseAvailability))return;if(houseSettings(d.houseAvailability).available){S.sheet={type:'house-close-calendar',id:d.houseAvailability};render();}else{const ok=houseSetAvailability(d.houseAvailability,true);render();toast(ok?'Calendario reabierto con todos sus datos anteriores':'No se pudo cambiar la disponibilidad.');}return;}
  if(d.houseCloseConfirm){const ok=houseSetAvailability(d.houseCloseConfirm,false,document.getElementById('house-reopen-date')?.value||'');if(!ok){toast('Elegí una fecha futura válida o dejá el campo vacío.');return;}S.sheet=null;render();toast('Calendario cerrado temporalmente. Todos sus datos se conservan.');return;}
  if(d.houseActive){const ok=houseSetActive(d.houseActive,!houseSettings(d.houseActive).active);render();toast(ok?'Estado actualizado · demo sin cambios en cobros':'No se puede activar: revisá aprobación y verificaciones.');return;}
  if(d.houseDirect){if(houseManageable(d.houseDirect)){S.sheet={type:'house-direct-setting',id:d.houseDirect};render();}return;}
  if(d.houseDirectSave){if(houseSetDirect(d.houseDirectSave,d.value==='yes')){S.sheet=null;render();toast('Preferencia guardada para esta casa · demo');}else toast('No se pudo cambiar la preferencia. Revisá tu cuenta y verificaciones.');return;}
  if(d.houseContact){if(!houseDirectContact(d.houseContact,document.getElementById('house-direct-consent')?.checked===true)){toast('Aceptá compartir tu número. La casa y ambas cuentas deben seguir habilitadas.');return;}const destination=typeof listingPhoneDestination==='function'?listingPhoneDestination(relayActive(d.houseContact,'Andrea Castro')):null;S.sheet=null;render();toast(destination?`Demo: se abriría el WhatsApp de esta casa: ${destination}. No se envió ningún mensaje.`:'Demo: se abriría WhatsApp con el propietario. No se envió ningún mensaje.');}
},true);
render();
