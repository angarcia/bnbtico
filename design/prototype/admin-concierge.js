/* Atención manual de bnbtico. Solo demo: no envíos, teléfonos reales ni verificación externa. */
const concierge={draft:null,selected:new Set(),reviewed:false,error:'',result:null,welcome:null,batches:[]};
const conciergeUser=id=>adminUsers.items.find(u=>u.id===id);
const conciergeChannel=role=>role==='owner'?'bnbtico · atención a propietarios':'bnbtico · buscadores de alojamiento';
function conciergeWelcome(user,role){
  const greeting=`Hola ${user.name.split(' ')[0]}, somos el equipo de bnbtico.`;
  return role==='owner'?`${greeting}\n\nEste es nuestro número de atención a propietarios. Guardalo y escribinos por aquí cuando necesités ayuda con tu cuenta, tus anuncios o cualquier consulta sobre bnbtico.\n\nLos clientes verifican su identidad y WhatsApp antes de contactarte, igual que los propietarios antes de publicar. Nunca te pediremos contraseñas ni códigos de acceso.`:`${greeting}\n\nEste es el número de bnbtico para quienes buscan alojamiento. Si buscás alojamiento, escribinos la zona, las fechas, cuántas personas son y qué necesitás. Te ayudamos a ponerte en contacto con propietarios de casas compatibles.\n\nAntes de compartir tu contacto te pediremos autorización y que verifiqués tu identidad y WhatsApp. Consultaremos disponibilidad; no garantizamos alojamiento ni gestionamos reservas o pagos. Guardá este número para escribirnos cuando lo necesités.`;
}
function conciergeMarkWelcome(id,role,confirmed){
  const u=conciergeUser(id);
  if(S.role!=='admin'||!u?.active||!u.roles.includes(role)||confirmed!==true||u.history.some(e=>e.kind==='Bienvenida enviada manualmente'&&e.channel===role))return false;
  u.history.push({at:new Date(relayNow()).toISOString(),kind:'Bienvenida enviada manualmente',channel:role,note:`Administración confirmó el envío desde ${conciergeChannel(role)}. No confirmado por WhatsApp.`});return true;
}
function conciergeOpen(id){
  const u=conciergeUser(id);if(S.role!=='admin'||!u?.roles.includes('guest'))return false;
  concierge.draft={clientId:id,arrival:'',departure:'',people:'',zone:'',message:'',consent:false,consentNote:''};
  concierge.selected.clear();concierge.reviewed=false;concierge.error='';concierge.result=null;go('a-concierge',{user:id});return true;
}
function conciergeValid(d){
  const u=conciergeUser(d?.clientId);
  return S.role==='admin'&&u?.active&&u.roles.includes('guest')&&u.identity==='approved'&&u.whatsappVerified===true&&calendarConsultationRange(d)&&Number.isInteger(Number(d.people))&&Number(d.people)>0&&String(d.message||'').length<=2000;
}
function conciergeCandidates(d){
  if(!conciergeValid(d))return [];
  const u=conciergeUser(d.clientId),nights=(Date.parse(d.departure)-Date.parse(d.arrival))/DAY_MS;
  return HOUSES.filter(h=>houseContactAvailable(h.id,u.name)&&houseSettings(h.id).available&&h.ppl>=Number(d.people)&&nights>=(h.min||1)&&(!d.zone||searchNormalize(h.loc).includes(searchNormalize(d.zone)))&&requestHouseDatesAvailable(h,d)&&!relayActive(h.id,u.name)&&!requestHasDirectDuplicate(d,h.ownerId));
}
function conciergeCreate(d,ids){
  if(!conciergeValid(d)||d.consent!==true||!String(d.consentNote||'').trim()||String(d.consentNote).length>1000||!Array.isArray(ids)||!ids.length||ids.length>10||new Set(ids).size!==ids.length)return false;
  const eligible=new Map(conciergeCandidates(d).map(h=>[h.id,h]));
  if(ids.some(id=>!eligible.has(id))||new Set(ids.map(id=>eligible.get(id).ownerId)).size!==ids.length)return false;
  const u=conciergeUser(d.clientId),batchId=`AC-${concierge.batches.length+1}`,at=new Date(relayNow()).toISOString();
  // All recipients are checked before any mutation. Existing contacts are never overwritten.
  const created=[];
  for(const id of ids){
    const t=relayCreate(id,u.name,null,'direct');
    Object.assign(t,{initiatedBy:'admin',adminBatchId:batchId,directOpening:false,ownerConsent:true,ownerConsentSource:'listing',clientConsent:true});
    Object.assign(launchLead(t),{msg:String(d.message||'').trim(),arrival:d.arrival,departure:d.departure,people:Number(d.people),when:'ahora'});
    created.push(t.id);
  }
  concierge.batches.push({id:batchId,at,createdBy:'admin-demo',clientId:u.id,houseIds:[...ids],threadIds:created,consentNote:String(d.consentNote).trim()});
  u.history.push({at,kind:'Consultas creadas a petición del cliente',note:`${batchId} · ${ids.join(', ')} · autorización: ${String(d.consentNote).trim()}`});
  concierge.result={id:batchId,count:ids.length};return true;
}
function conciergeActions(u){
  return `<section class="card stack"><h3>Atención manual de bnbtico</h3>${u.roles.map(role=>`<button class="btn btn-wa" data-concierge-welcome="${u.id}" data-concierge-role="${role}">Preparar bienvenida · ${role==='owner'?'propietario':'cliente'}</button><span class="xs muted">${u.history.some(e=>e.kind==='Bienvenida enviada manualmente'&&e.channel===role)?'Bienvenida marcada como enviada manualmente':'Bienvenida pendiente'} · ${conciergeChannel(role)}</span>`).join('')}${u.roles.includes('guest')?`<button class="btn btn-primary" data-concierge-new="${u.id}" ${u.active?'':'disabled'}>Crear consulta en nombre del cliente</button>`:''}<p class="xs muted">Dos números de bnbtico distintos, todavía sin configurar. La bienvenida no autoriza a compartir el contacto con propietarios.</p></section>`;
}
function conciergeWelcomeScreen(){
  const w=concierge.welcome,u=conciergeUser(w?.user);
  if(S.role!=='admin'||!u||!u.roles.includes(w.role))return '<p>Solo administración.</p>';
  const sent=u.history.some(e=>e.kind==='Bienvenida enviada manualmente'&&e.channel===w.role);
  return header('Bienvenida por WhatsApp','a-user')+`<section class="card stack"><h3>${safe(u.name)}</h3><p>Enviar desde: <b>${conciergeChannel(w.role)}</b> · número pendiente de configurar.</p><p class="note small">Usá la sesión del número correcto. Un enlace no cambia automáticamente la cuenta remitente. Demo: no abre WhatsApp ni envía mensajes.</p><label for="concierge-welcome-text">Mensaje de bienvenida</label><textarea id="concierge-welcome-text" rows="10">${safe(w.message)}</textarea><label class="row small"><input type="checkbox" id="concierge-welcome-permission" ${w.permission?'checked':''}><span>El usuario autorizó recibir esta bienvenida por WhatsApp.</span></label><button class="btn btn-wa" data-concierge-preview ${u.active?'':'disabled'}>Preparar apertura de WhatsApp · demo</button>${w.preview?`<p class="note" role="status">Texto preparado, no enviado. En la versión real abrirías WhatsApp y pulsarías Enviar.</p>`:''}<label class="row small"><input type="checkbox" id="concierge-welcome-confirm"><span>Confirmo que ya envié la bienvenida manualmente.</span></label><button class="btn btn-ghost" data-concierge-mark ${sent||!u.active?'disabled':''}>${sent?'Bienvenida marcada como enviada':'Marcar bienvenida enviada'}</button>${concierge.error?`<p class="note" role="alert">${safe(concierge.error)}</p>`:''}</section>`;
}
function conciergeScreen(){
  const d=concierge.draft,u=conciergeUser(d?.clientId);
  if(S.role!=='admin'||!u)return '<p>Solo administración. Elegí un cliente desde Usuarios.</p>';
  if(concierge.result)return header('Consultas creadas','a-user')+`<div class="card stack"><h3>${concierge.result.count} consultas registradas</h3><p>${concierge.result.id} · ${safe(u.name)}</p><p>Aparecen en Mis consultas de los propietarios seleccionados, como enviadas por bnbtico a petición del cliente. No se envió ningún WhatsApp ni notificación real.</p><button class="btn btn-primary" data-concierge-new="${u.id}">Crear otra consulta</button></div>`;
  const candidates=concierge.reviewed?conciergeCandidates(d):[];
  return header('Consulta en nombre del cliente','a-user')+`<section class="card stack"><h3>${safe(u.name)}</h3><p class="small">Identidad: ${u.identity==='approved'?'verificada':'pendiente'} · WhatsApp: ${u.whatsappVerified?'verificado':'pendiente'} · Cuenta: ${u.active?'activa':'desactivada'}</p><p class="note small">Solo podés compartir contactos con identidad y WhatsApp verificados. La demo comprueba disponibilidad únicamente en diciembre de 2026; no inventa fechas disponibles fuera de ese mes.</p><label for="concierge-arrival">Llegada *</label><input id="concierge-arrival" type="date" value="${safe(d.arrival)}"><label for="concierge-departure">Salida *</label><input id="concierge-departure" type="date" value="${safe(d.departure)}"><label for="concierge-people">Personas *</label><input id="concierge-people" type="number" min="1" step="1" value="${safe(d.people)}"><label for="concierge-zone">Zona o provincia (opcional)</label><input id="concierge-zone" value="${safe(d.zone)}"><label for="concierge-message">Consulta del cliente (opcional)</label><textarea id="concierge-message" rows="3" maxlength="2000">${safe(d.message)}</textarea><button class="btn btn-primary" data-concierge-match>Buscar casas compatibles</button></section>${concierge.reviewed?`<section class="card stack"><h3>Elegí las casas destinatarias</h3><p class="small">Compatibilidad por fechas, capacidad, estancia mínima y zona. Confirmá manualmente las demás condiciones del mensaje. Máximo 10 propietarios, una casa por propietario. Excluimos contactos activos con esa casa y consultas del mismo cliente con fechas solapadas al mismo propietario.</p>${candidates.map(h=>`<label class="row"><input type="checkbox" data-concierge-house="${h.id}" ${concierge.selected.has(h.id)?'checked':''}><span><b>${safe(h.t)}</b><br><span class="small">${safe(h.owner)} · ${safe(h.loc)} · ${h.ppl} personas · ${fmt(h)} orientativo</span></span></label>`).join('')||'<p>No hay casas compatibles. Revisá fechas, verificaciones o contactos previos.</p>'}<label class="row small"><input id="concierge-consent" type="checkbox" ${d.consent?'checked':''}><span>El cliente me autorizó a crear estas consultas y compartir su contacto con los propietarios seleccionados para que le escriban por WhatsApp.</span></label><label for="concierge-consent-note">Referencia de la autorización *</label><textarea id="concierge-consent-note" maxlength="1000" rows="2" placeholder="Fecha y referencia de la conversación; sin documentos ni códigos">${safe(d.consentNote)}</textarea><p class="xs muted">Referencia privada, solo para administración. Cambiar los datos o destinatarios requiere confirmar de nuevo la autorización.</p><button class="btn btn-primary" data-concierge-send ${candidates.length?'':'disabled'}>Crear consultas para las casas seleccionadas</button></section>`:''}${concierge.error?`<p class="note" role="alert">${safe(concierge.error)}</p>`:''}`;
}
// Only install launch UI adapters when that layer is present (legacy explorations have their own tests).
if(typeof launchOwnerMessage==='function'){
  const conciergeUserScreen=SCREENS['a-user'];
  SCREENS['a-user']=()=>{const u=adminUserCurrent();return conciergeUserScreen()+(u?conciergeActions(u):'');};
  const conciergeUsersScreen=SCREENS['a-owners'];
  SCREENS['a-owners']=()=>conciergeUsersScreen().replace(/<div class="card stack"><h3>WhatsApp de soporte bnbtico<\/h3>[\s\S]*?<\/div>/,'<div class="card stack"><h3>Dos canales de atención bnbtico</h3><p>Un WhatsApp para propietarios y otro para buscadores de alojamiento. Números pendientes de configurar.</p><p class="small">Abrí la ficha de un usuario para preparar su bienvenida o crear una consulta en su nombre.</p></div>');
  SCREENS['a-welcome']=conciergeWelcomeScreen;SCREENS['a-concierge']=conciergeScreen;
  const conciergeCurrent=current;current=()=>['a-welcome','a-concierge'].includes(S.screen)?'a-owners':conciergeCurrent();
  const conciergeReview=SCREENS['a-review'];
  SCREENS['a-review']=()=>{const q=adminCurrentReview(),u=q&&adminUsers.items.find(u=>u.name===q.n);return conciergeReview()+(S.role==='admin'&&q?.status==='ok'&&u?conciergeActions(u):'');};
  const conciergeLeads=SCREENS['o-leads'];
  SCREENS['o-leads']=()=>{
    let body=conciergeLeads().replace('Clientes que intentaron abrir tu WhatsApp desde una ficha.','Contactos desde tus fichas y consultas enviadas por bnbtico a petición de clientes.');
    const visible=S.leads.filter(l=>MY.some(h=>h.id===l.h)&&relay.threads.some(t=>t.id===l.threadId&&t.source==='direct'));
    let index=0;
    return body.replace(/Apertura de WhatsApp · registro de demo, no mensaje confirmado/g,()=>{const l=visible[index++],t=relay.threads.find(t=>t.id===l?.threadId);return t?.initiatedBy==='admin'?'Consulta enviada por bnbtico a petición del cliente · demo':'Apertura de WhatsApp · registro de demo, no mensaje confirmado';});
  };
  const conciergeHistory=SCREENS.contacts;
  SCREENS.contacts=()=>conciergeHistory().replace('Registro de aperturas de WhatsApp, no de mensajes enviados ni reservas.','Registro de contactos y consultas creadas por bnbtico con tu autorización. No confirma mensajes enviados ni reservas.');
  SCREENS['support-info']=()=>header('Ayuda de bnbtico',S.role==='owner'?'o-profile':'profile')+`<div class="card stack"><h3>${conciergeChannel(S.role)}</h3><p>${S.role==='owner'?'Escribinos para recibir ayuda con tu cuenta, tus casas o cualquier consulta sobre bnbtico.':'¿Buscás alojamiento? Contanos la zona, fechas, personas y lo que necesitás. Podemos crear consultas para casas compatibles con tu autorización, después de verificar identidad y WhatsApp.'}</p><p class="note small">Canal separado del de ${S.role==='owner'?'buscadores':'propietarios'}. Número real pendiente de configurar. No se abre WhatsApp en esta demo.</p><button class="btn btn-ghost" data-go="claims">Reclamaciones y ayuda</button></div>`;
  document.addEventListener('input',e=>{
    if(S.role!=='admin')return;const id=e.target.id;
    if(id==='concierge-welcome-text'&&concierge.welcome){concierge.welcome.message=e.target.value;concierge.welcome.preview=false;}
    const fields={'concierge-arrival':'arrival','concierge-departure':'departure','concierge-people':'people','concierge-zone':'zone','concierge-message':'message','concierge-consent-note':'consentNote'};
    if(fields[id]&&concierge.draft){concierge.draft[fields[id]]=e.target.value;if(fields[id]!=='consentNote'){concierge.reviewed=false;concierge.selected.clear();concierge.draft.consent=false;}}
  });
  document.addEventListener('change',e=>{
    if(S.role!=='admin')return;
    if(e.target.id==='concierge-welcome-permission'&&concierge.welcome)concierge.welcome.permission=e.target.checked;
    if(e.target.id==='concierge-consent'&&concierge.draft)concierge.draft.consent=e.target.checked;
    if(e.target.dataset.conciergeHouse&&concierge.draft){const id=e.target.dataset.conciergeHouse;if(e.target.checked)concierge.selected.add(id);else concierge.selected.delete(id);concierge.draft.consent=false;render();}
  });
  document.addEventListener('click',e=>{
    const b=e.target.closest('[data-concierge-welcome],[data-concierge-new],[data-concierge-preview],[data-concierge-mark],[data-concierge-match],[data-concierge-send]');if(!b)return;e.stopImmediatePropagation();if(S.role!=='admin')return;const d=b.dataset;concierge.error='';
    if(d.conciergeWelcome){const u=conciergeUser(d.conciergeWelcome),role=d.conciergeRole;if(!u||!u.roles.includes(role))return;concierge.welcome={user:u.id,role,message:conciergeWelcome(u,role),permission:false,preview:false};go('a-welcome',{user:u.id});return;}
    if(d.conciergeNew){conciergeOpen(d.conciergeNew);return;}
    if(d.conciergePreview!==undefined){const w=concierge.welcome;if(w?.permission&&w.message.trim()&&conciergeUser(w.user)?.active)w.preview=true;else concierge.error='Confirmá autorización del usuario y revisá el mensaje.';render();return;}
    if(d.conciergeMark!==undefined){const w=concierge.welcome;const ok=w?.permission&&conciergeMarkWelcome(w.user,w.role,document.getElementById('concierge-welcome-confirm')?.checked===true);if(!ok)concierge.error='Confirmá permiso y envío manual; no se envía automáticamente.';render();return;}
    if(d.conciergeMatch!==undefined){concierge.reviewed=true;concierge.selected.clear();concierge.draft.consent=false;if(!conciergeValid(concierge.draft))concierge.error='Revisá identidad, WhatsApp y cuenta del cliente, fechas válidas y número de personas.';render();return;}
    if(d.conciergeSend!==undefined){if(!concierge.reviewed||!conciergeCreate(concierge.draft,[...concierge.selected]))concierge.error='No se creó ninguna consulta. Elegí hasta 10 propietarios distintos, confirmá autorización y revisá disponibilidad, verificaciones o duplicados.';render();}
  },true);
  render();
}
