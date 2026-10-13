/* Gestión de cuentas y soporte: datos ficticios, solo memoria, sin WhatsApp real. */
const adminUsers={items:[],query:'',error:'',reason:'',note:''};
function adminUserSeed(name,role,identity='approved'){
  let u=adminUsers.items.find(x=>x.name===name);
  if(!u){u={id:'U-'+(adminUsers.items.length+1),name,roles:[],identity,active:true,history:[]};adminUsers.items.push(u);}
  if(!u.roles.includes(role))u.roles.push(role);
  return u;
}
HOUSES.forEach(h=>adminUserSeed(h.owner,'owner',h.ownerV?'approved':'pending'));
S.queue.forEach(q=>adminUserSeed(q.n,'owner',q.identityStatus));
S.leads.forEach(l=>adminUserSeed(l.n,'guest'));
S.requests.forEach(r=>adminUserSeed(r.client,'guest'));
adminUserSeed('Andrea Castro','guest');
const adminUserActive=name=>adminUsers.items.find(u=>u.name===name)?.active!==false;
const adminSelfName=()=>S.role==='owner'?MY[0].owner:S.role==='guest'?'Andrea Castro':null;
const adminHouseActive=id=>{const h=HOUSES.find(h=>h.id===id);return !!h&&adminUserActive(h.owner);};
const adminContactActive=t=>!!t&&adminUserActive(adminSelfName())&&adminUserActive(t.client)&&adminHouseActive(t.house);
const adminUserCurrent=()=>S.role==='admin'?adminUsers.items.find(u=>u.id===S.params.user):null;
function adminUserChange(id,active,reason,confirmed){
  const u=adminUsers.items.find(u=>u.id===id),note=String(reason||'').trim();
  if(S.role!=='admin'||!u||typeof active!=='boolean'||u.active===active||confirmed!==true||!note||note.length>2000)return false;
  u.active=active;u.history.push({at:new Date().toISOString(),kind:active?'Cuenta reactivada':'Cuenta desactivada',note});return true;
}
function adminSupportNote(id,caseId,note){
  const u=adminUsers.items.find(u=>u.id===id),c=claims.items.find(c=>c.id===caseId),text=String(note||'').trim();
  if(S.role!=='admin'||!u||!text||text.length>2000||(caseId&&(!c||![c.owner,c.client].includes(u.name))))return false;
  u.history.push({at:new Date().toISOString(),kind:'Nota interna de soporte',caseId:caseId||null,note:text});return true;
}
const adminUserBadge=u=>`<span class="badge ${u.active?'badge-ok':'badge-bad'}">${u.active?'Activa':'Desactivada'}</span>`;
const adminUserLabels=u=>u.roles.map(r=>r==='owner'?'Propietario':'Cliente').join(' · ');
const adminUserLink=(u,label='Ver usuario')=>`<button class="btn btn-ghost btn-sm" data-user-open="${u.id}">${label}</button>`;
const adminSupportButton=(u,c)=>`<button class="btn btn-wa" data-user-support="${u.id}" ${c?`data-user-case="${c.id}"`:''}>Contactar ${safe(u.name)} por WhatsApp · demo</button>`;
function adminUsersScreen(){
  if(S.role!=='admin')return '<p>Esta sección es solo para administración.</p>';
  const query=searchNormalize(adminUsers.query),items=adminUsers.items.filter(u=>searchNormalize(u.name+' '+u.id+' '+adminUserLabels(u)).includes(query));
  return header('Usuarios')+`<div class="note">Cuentas de ejemplo. Desactivar oculta anuncios e impide nuevos contactos y publicaciones en esta demo. Conserva historial, ayuda y reclamaciones; no borra conversaciones de WhatsApp ni cambia cobros.</div>
    <div class="card stack"><h3>WhatsApp de soporte bnbtico</h3><p class="small">Número de negocio exclusivo: +506 8xxx-xxxx · ficticio. Cuenta real pendiente de configurar. No es un número intermediario entre usuarios.</p></div>
    <div class="field"><label for="admin-user-query">Buscar por nombre, ID o tipo de usuario</label><div class="row"><input id="admin-user-query" value="${safe(adminUsers.query)}"><button class="btn btn-ghost" data-user-search>Buscar</button></div></div>
    <p class="small muted">${items.length} usuarios · identidad de solo lectura, simulada</p><div class="stack">${items.map(u=>`<div class="card stack"><div class="row between" style="flex-wrap:wrap;gap:8px"><b>${safe(u.name)}</b>${adminUserBadge(u)}</div><p class="small">${u.id} · ${adminUserLabels(u)}</p>${adminUserLink(u)}</div>`).join('')||'<p>No hay usuarios con esa búsqueda.</p>'}</div>`;
}
function adminUserScreen(){
  const u=adminUserCurrent();if(!u)return '<p>Usuario no disponible para este rol.</p>';
  const houses=HOUSES.filter(h=>h.owner===u.name),reports=claims.items.filter(c=>[c.owner,c.client].includes(u.name));
  return header('Ficha de usuario','a-owners')+`<div class="stack" style="max-width:860px">
    <div class="card stack"><div class="row between" style="flex-wrap:wrap"><h2>${safe(u.name)}</h2>${adminUserBadge(u)}</div><p>${u.id} · ${adminUserLabels(u)}</p><p class="small">Identidad ${u.identity==='approved'?'verificada':'pendiente'} · proveedor simulado. Activar una cuenta no aprueba su identidad.</p>${adminSupportButton(u)}</div>
    <div class="card stack"><h3>${u.active?'Desactivar':'Reactivar'} cuenta</h3><p class="small">${u.active?'Sus anuncios quedarán ocultos y no podrá publicar ni iniciar o aceptar contactos. Podrá consultar su historial y acceder a ayuda y reclamaciones.':'Se levanta el bloqueo de cuenta. No se aprueban anuncios rechazados ni se cambia su identidad.'}</p><p class="xs muted">No elimina datos ni revoca teléfonos ya compartidos. Sin cambios de suscripción o cobros.</p><div class="field"><label for="admin-user-reason">Motivo de la decisión</label><textarea id="admin-user-reason" rows="3" maxlength="2000">${safe(adminUsers.reason)}</textarea></div><label class="row small"><input type="checkbox" id="admin-user-confirm">Confirmo que quiero ${u.active?'desactivar':'reactivar'} esta cuenta en la demo.</label>${adminUsers.error?`<p role="alert" class="note">${safe(adminUsers.error)}</p>`:''}<button class="btn ${u.active?'btn-danger':'btn-primary'}" data-user-change="${u.active?'off':'on'}">${u.active?'Desactivar':'Reactivar'} cuenta</button></div>
    <section class="card stack"><h3>Anuncios</h3>${houses.map(h=>`<div class="row between" style="flex-wrap:wrap"><span>${safe(h.t)} · ${h.id}</span><span class="small">${!u.active?'Oculto por cuenta desactivada':h.ownerV?'Visible':'En revisión'}</span></div>`).join('')||'<p class="small muted">Sin anuncios en el catálogo.</p>'}${u.name===MY[0].owner?publication.submitted.map(h=>`<p class="small">${safe(h.title)} · ${safe(h.status)} · ${!u.active?'cuenta desactivada':'solo demo, no publicado'}</p>`).join(''):''}</section>
    <section class="card stack"><h3>Reportes relacionados</h3>${reports.map(c=>`<button class="btn btn-ghost" data-user-report="${c.id}">${c.id} · ${safe(c.houseTitle)} · ${CLAIM_STATUS[c.status]}</button>`).join('')||'<p class="small muted">Sin reportes.</p>'}</section>
    <section class="card stack"><h3>Historial de administración · privado</h3>${u.history.map(e=>`<div class="small"><b>${safe(e.kind)}${e.caseId?' · '+safe(e.caseId):''}</b><p class="xs muted">${safe(new Date(e.at).toLocaleString('es-CR'))}</p><p style="white-space:pre-wrap;overflow-wrap:anywhere">${safe(e.note)}</p></div>`).join('')||'<p class="small muted">Sin acciones registradas.</p>'}</section><p class="xs muted">Datos en memoria. Recargar restablece las cuentas. No hay notificaciones reales.</p></div>`;
}
function adminSupportScreen(){
  const u=adminUserCurrent(),c=claims.items.find(c=>c.id===S.params.caseId);
  if(!u||(S.params.caseId&&(!c||![c.owner,c.client].includes(u.name))))return '<p>Contacto de soporte no disponible.</p>';
  return header('Soporte por WhatsApp','a-owners')+`<div class="card stack" style="max-width:800px"><h2>Contactar a ${safe(u.name)}</h2><p class="small">Desde: bnbtico · +506 8xxx-xxxx (número ficticio de negocio). Destino: usuario de demostración, sin teléfono real.</p><p class="note">Vista previa: no abre WhatsApp ni envía mensajes. En la versión real deberás usar la sesión del WhatsApp de bnbtico; un enlace no selecciona automáticamente la cuenta remitente.</p><div class="field"><label for="admin-support-message">Mensaje sugerido</label><textarea id="admin-support-message" rows="4">${safe(`Hola ${u.name}, somos el equipo de soporte de bnbtico. ${c?`Te contactamos por el caso ${c.id}. Queremos escuchar tu versión y aclarar lo ocurrido.`:'¿Podemos conversar para ayudarte con tu cuenta?'} Nunca te pediremos contraseñas ni códigos de acceso.`)}</textarea></div><button class="btn btn-wa" data-user-preview>Simular apertura de WhatsApp</button><p class="xs muted">Las respuestas no se importan ni se registran automáticamente. No compartimos el teléfono de la otra parte.</p><div class="field"><label for="admin-support-note">Nota interna de seguimiento</label><textarea id="admin-support-note" rows="3" maxlength="2000" placeholder="Anotá el resultado de la gestión, sin datos sensibles reales…">${safe(adminUsers.note)}</textarea></div><button class="btn btn-primary" data-user-note>Guardar nota interna</button>${adminUsers.error?`<p class="note" role="alert">${safe(adminUsers.error)}</p>`:''}${adminUserLink(u,'Volver a la ficha')}</div>`;
}
// Account status is independent from identity, listing moderation and subscription state.
const usersFiltered=filtered;filtered=()=>usersFiltered().filter(h=>adminHouseActive(h.id));
const usersSearch=searchMatches;searchMatches=c=>c.client&&!adminUserActive(c.client)?[]:usersSearch(c).filter(h=>adminHouseActive(h.id));matches=searchMatches;
const usersCard=listingCard;listingCard=h=>!adminHouseActive(h.id)?'':usersCard(h);
const usersDetail=detail;detail=back=>S.role!=='admin'&&S.role!=='owner'&&!adminHouseActive(S.params.id)?header('Anuncio no disponible','home')+'<p>Este anuncio no está disponible actualmente.</p><button class="btn btn-ghost" data-claim-new="'+safe(S.params.id||'')+'">Reportar un problema</button>':usersDetail(back);
const usersRelayCreate=relayCreate;relayCreate=(house,client='Andrea Castro',lead=null,source='direct')=>!adminUserActive(adminSelfName())||!adminHouseActive(house)||!adminUserActive(client)?null:usersRelayCreate(house,client,lead,source);
const usersRelayRequest=relayRequest;relayRequest=(house,consent)=>adminUserActive('Andrea Castro')&&adminHouseActive(house)&&usersRelayRequest(house,consent);
const usersRelayAccept=relayAccept;relayAccept=t=>adminContactActive(t)&&usersRelayAccept(t);
const usersRelayOpen=relayOpenHouse;relayOpenHouse=house=>{if(!adminUserActive('Andrea Castro')||!adminHouseActive(house)){toast('Contacto no disponible: cuenta desactivada. Podés acceder a ayuda.');return false;}return usersRelayOpen(house);};
const usersSheet=sheet;sheet=()=>{
  const t=S.sheet?.thread?relay.threads.find(t=>t.id===S.sheet.thread):null;
  if(['contact','direct','reply'].includes(S.sheet?.type)&&(!adminUserActive(adminSelfName())||(t&&!adminContactActive(t))))return '<div class="sheet"><div class="sheet-body stack"><h3>Contacto no disponible</h3><p>Una cuenta está desactivada. Se conserva el historial, pero no se pueden iniciar o aceptar contactos desde bnbtico.</p><button class="btn btn-ghost" data-go="support-info">Ayuda de bnbtico</button><button class="btn btn-ghost" data-close-btn>Cerrar</button></div></div>';
  return usersSheet();
};
const usersSubmitRequest=submitHouseRequest;submitHouseRequest=consent=>adminUserActive('Andrea Castro')&&usersSubmitRequest(consent);
const usersPublish=publicationSubmit;publicationSubmit=()=>{if(!adminUserActive(MY[0].owner)){publication.error='Cuenta desactivada. Podés conservar el borrador y acceder a ayuda.';return false;}return usersPublish();};
const usersModerate=moderateListing;moderateListing=(index,status,reason='')=>(status!=='ok'||adminUserActive(S.queue[index]?.n))&&usersModerate(index,status,reason);
const usersDecide=adminDecide;adminDecide=(status,reason)=>{if(status==='ok'&&!adminUserActive(adminCurrentReview()?.n)){adminReview.error='Cuenta desactivada. No se puede aprobar este anuncio.';return false;}return usersDecide(status,reason);};
for(const key of ['profile','o-profile']){const before=SCREENS[key];SCREENS[key]=()=>before()+(!adminUserActive(adminSelfName())?'<div class="note"><div><b>Cuenta desactivada</b><p>No podés publicar ni iniciar o aceptar contactos. Tu historial, ayuda y reclamaciones siguen disponibles.</p></div></div>':'')+'<button class="btn btn-ghost" data-go="support-info">WhatsApp de soporte bnbtico</button>';}
SCREENS['support-info']=()=>header('Ayuda de bnbtico',S.role==='owner'?'o-profile':'profile')+'<div class="card stack"><h3>WhatsApp de soporte</h3><p>Un número exclusivo de bnbtico para ayudarte con tu cuenta y los reportes.</p><p class="note">+506 8xxx-xxxx · número ficticio. Contacto real pendiente de configurar.</p><button class="btn btn-ghost" data-go="claims">Ir a Reclamaciones y ayuda</button></div>';
const usersClaims=SCREENS.claims;SCREENS.claims=()=>{
  const body=usersClaims(),c=claims.items.find(c=>c.id===claims.selected);if(S.role!=='admin'||!c)return body;
  const parties=adminUsers.items.filter(u=>[c.owner,c.client].includes(u.name));
  return body+`<section class="card stack"><h3>Contactar a las partes · soporte</h3>${parties.map(u=>`<div class="stack"><b>${safe(u.name)} · ${adminUserLabels(u)}</b>${adminSupportButton(u,c)}${adminUserLink(u,'Gestionar usuario')}${u.history.filter(e=>e.caseId===c.id).map(e=>`<p class="small" style="overflow-wrap:anywhere">Nota interna: ${safe(e.note)}</p>`).join('')}</div>`).join('')}<p class="xs muted">Notas solo para administración. No se envían mensajes ni se cambia el estado del caso automáticamente.</p></section>`;
};
SCREENS['a-owners']=adminUsersScreen;SCREENS['a-user']=adminUserScreen;SCREENS['a-support']=adminSupportScreen;
NAV.admin.find(n=>n[0]==='a-owners')[1]='Usuarios';
const usersCurrent=current;current=()=>['a-user','a-support'].includes(S.screen)?'a-owners':usersCurrent();
document.addEventListener('input',e=>{if(e.target.id==='admin-user-query')adminUsers.query=e.target.value;if(e.target.id==='admin-user-reason')adminUsers.reason=e.target.value;if(e.target.id==='admin-support-note')adminUsers.note=e.target.value;});
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-user-search],[data-user-open],[data-user-change],[data-user-support],[data-user-preview],[data-user-note],[data-user-report]');if(!el)return;
  e.stopImmediatePropagation();if(S.role!=='admin')return;const d=el.dataset;
  if(d.userSearch!==undefined){render();return;}
  if(d.userOpen||d.userSupport){adminUsers.reason='';adminUsers.error='';adminUsers.note='';go(d.userSupport?'a-support':'a-user',{user:d.userSupport||d.userOpen,caseId:d.userCase||null});return;}
  if(d.userReport){const c=claims.items.find(c=>c.id===d.userReport);if(c){claims.selected=c.id;go('claims');}return;}
  if(d.userPreview!==undefined){toast('Demo: se abriría el WhatsApp de soporte. No se envió ningún mensaje.');return;}
  if(d.userChange){const ok=adminUserChange(S.params.user,d.userChange==='on',adminUsers.reason,document.getElementById('admin-user-confirm')?.checked===true);adminUsers.error=ok?'':'Escribí un motivo y confirmá la acción.';if(ok)adminUsers.reason='';render();return;}
  if(d.userNote!==undefined){const ok=adminSupportNote(S.params.user,S.params.caseId,adminUsers.note);adminUsers.error=ok?'':'Escribí una nota de hasta 2000 caracteres para este usuario/caso.';if(ok){adminUsers.note='';toast('Nota interna guardada. No se envió al usuario.');}render();}
},true);
render();
