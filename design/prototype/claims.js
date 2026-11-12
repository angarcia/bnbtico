/* Reclamaciones: demo en memoria. Sin pagos, archivos, mensajes ni sanciones reales. */
const claims={items:[],next:1,selected:null};
const CLAIM_STATUS={review:'En revisión',owner:'Esperando respuesta del propietario',resolved:'Revisión cerrada',unresolved:'Sin acuerdo'};
const CLAIM_MEASURE={none:'Sin medida',warning:'Advertencia',restriction:'Restricción temporal',suspension:'Suspensión'};
const CLAIM_FINDING={pending:'Pendiente de revisión',substantiated:'Incumplimiento comprobado',unsubstantiated:'No acreditado con las pruebas disponibles'};
const claimNote=(c,text)=>c.history.push({at:new Date().toISOString(),actor:S.role,text});
const claimAllowed=c=>S.role==='admin'||(S.role==='guest'&&S.loggedIn&&c.client==='Andrea Castro')||(S.role==='owner'&&c.owner===MY[0].owner);
function claimCreate(data){
  const h=HOUSES.find(h=>h.id===data.house);
  if(S.role!=='guest'||!S.loggedIn||!h||!data.detail?.trim()||!data.evidence?.trim())throw Error('Revisá los datos del reporte y las pruebas.');
  const c={id:'R-'+String(claims.next++).padStart(3,'0'),house:h.id,houseTitle:h.t,owner:h.owner,client:'Andrea Castro',reason:data.reason||'Otro problema',detail:data.detail.trim(),evidence:data.evidence.trim(),status:'review',finding:'pending',measure:'none',history:[]};
  claimNote(c,'Reporte recibido. No implica culpabilidad.');claims.items.push(c);claims.selected=c.id;return c;
}
function claimAct(c,action,note=''){
  if(!claimAllowed(c))return false;
  note=note.trim();
  if(action==='request_response'&&S.role==='admin'&&note){c.status='owner';}
  else if(action==='respond'&&S.role==='owner'&&note){c.status='review';}
  else if(action==='resolve'&&S.role==='admin'&&note){c.status='resolved';}
  else if(action==='unresolved'&&S.role==='admin'&&note){c.status='unresolved';}
  else if(action==='appeal'&&S.role!=='admin'&&c.finding!=='pending'&&note){c.status='review';}
  else return false;
  const labels={request_response:'Solicitud de respuesta',respond:'Respuesta del propietario',resolve:'Revisión cerrada',unresolved:'Caso sin acuerdo',appeal:'Revisión de decisión solicitada'};
  claimNote(c,labels[action]+(note?': '+note:'.'));return true;
}
function claimDecide(c,finding,measure,note){
  if(S.role!=='admin'||!note.trim()||!Object.hasOwn(CLAIM_FINDING,finding)||!Object.hasOwn(CLAIM_MEASURE,measure))return false;
  if(finding!=='substantiated'&&['warning','suspension'].includes(measure))return false;
  if(finding==='unsubstantiated'&&measure!=='none')return false;
  c.finding=finding;c.measure=measure;
  claimNote(c,'Decisión simulada: '+CLAIM_FINDING[finding]+' · '+CLAIM_MEASURE[measure]+'. Motivo: '+note.trim());return true;
}
const claimButton=(action,label)=>`<button class="btn btn-ghost" data-claim-action="${action}">${label}</button>`;
function claimsScreen(){
  if(S.role==='guest'&&!S.loggedIn)return header('Reclamaciones','home')+'<p>Ingresá para presentar o consultar un reporte.</p><button class="btn btn-primary" data-go="login">Ingresar</button>';
  if(!['guest','owner','admin'].includes(S.role))return header('Reclamaciones','home');
  const visible=claims.items.filter(claimAllowed),c=visible.find(x=>x.id===claims.selected);
  const intro=header('Reclamaciones',S.role==='guest'?'profile':S.role==='owner'?'o-profile':'a-queue')+`<section class="card stack" aria-labelledby="claim-help-title"><h3 id="claim-help-title">¿Qué hace 3bstays con tu reporte?</h3>
    <ul class="small" style="margin:0;padding-left:20px;display:grid;gap:10px">
      <li>Revisamos la información y las pruebas que aportés.</li>
      <li>Pedimos aclaraciones y la respuesta del propietario cuando corresponda.</li>
      <li>Según lo que encontremos, podemos pedir correcciones, advertir, pausar o retirar anuncios y suspender cuentas.</li>
      <li>Te comunicamos el resultado. Si no estás de acuerdo, podés solicitar una revisión.</li>
    </ul>
    <p class="small"><b>3bstays no gestiona pagos ni devoluciones entre usuarios.</b> Si querés pedir una devolución, podés explicarlo en el reporte y acordarla directamente con la otra parte. No registramos importes, comprobantes de devolución ni confirmaciones de pago.</p>
    <p class="small">No podemos leer tus conversaciones de WhatsApp. Un reporte no implica una sanción automática: revisamos cada caso.</p>
    <p class="xs muted">Cuota sin recargos por denuncias. No hay multas automáticas.</p>
    <div class="note"><div><b>Estás en un prototipo</b><p>Las decisiones del caso se registran como ejemplo. Admin puede desactivar una cuenta desde Usuarios: el bloqueo afecta solo a esta demo. No se envían mensajes ni hay conexión con Veriff. No adjuntés datos personales reales; recargar borra los casos y restablece las cuentas.</p></div></div>
  </section>`;
  const list=`<div class="card stack"><b>Casos ${S.role==='admin'?'para revisar':'de tu cuenta'}</b>${visible.map(x=>`<button class="btn btn-ghost" style="text-align:left;white-space:normal" data-claim-open="${x.id}">${x.id} · ${safe(x.houseTitle)} · ${CLAIM_STATUS[x.status]}</button>`).join('')||'<p class="small muted">Todavía no hay reportes.</p>'}</div>`;
  const create=S.role==='guest'?`<details class="card" ${!visible.length?'open':''}><summary><b>Presentar un reporte</b></summary><div class="stack" style="margin-top:12px">
    <div class="field"><label for="claim-house">Casa relacionada</label><select id="claim-house">${HOUSES.map(h=>`<option value="${h.id}" ${S.params.house===h.id?'selected':''}>${safe(h.t)} · ${h.id}</option>`).join('')}</select></div>
    <div class="field"><label for="claim-reason">Motivo</label><select id="claim-reason"><option>No se cumplió lo acordado</option><option>Posible estafa</option><option>Posible suplantación de identidad</option><option>Otro problema</option></select></div>
    <div class="field"><label for="claim-detail">¿Qué ocurrió y cuándo?</label><textarea id="claim-detail" rows="3" maxlength="2000"></textarea></div>
    <div class="field"><label for="claim-evidence">Pruebas aportadas · descripción de ejemplo</label><textarea id="claim-evidence" rows="2" maxlength="2000" placeholder="Describí conversación y comprobante de ejemplo. Sin subir archivos reales."></textarea><span class="hint">No tenemos acceso a tus mensajes de WhatsApp. En producción podrás aportar las pruebas de forma segura.</span></div>
    <button class="btn btn-primary" data-claim-create>Registrar reporte · demo</button></div></details>`:'';
  if(!c)return intro+create+list;
  let actions='';
  if(S.role==='owner')actions=claimButton('respond','Responder / proponer solución');
  if(S.role!=='admin'&&c.finding!=='pending')actions+=claimButton('appeal','Solicitar revisión de la decisión');
  if(S.role==='admin')actions=claimButton('request_response','Pedir respuesta al propietario')+`<div class="field"><label for="claim-finding">Resultado de revisión</label><select id="claim-finding">${Object.entries(CLAIM_FINDING).map(([k,v])=>`<option value="${k}" ${k===c.finding?'selected':''}>${v}</option>`).join('')}</select></div><div class="field"><label for="claim-measure">Medida proporcional · demo</label><select id="claim-measure">${Object.entries(CLAIM_MEASURE).map(([k,v])=>`<option value="${k}" ${k===c.measure?'selected':''}>${v}</option>`).join('')}</select></div><p class="xs muted">Antes de decidir, revisá las pruebas y escuchá a ambas partes. Una restricción provisional requiere indicios creíbles documentados. Advertencias y suspensiones requieren incumplimiento comprobado. La medida aquí se registra; para desactivar la cuenta, abrí Gestionar usuario. No hay recargos.</p>`+claimButton('decide','Guardar decisión simulada')+claimButton('resolve','Cerrar revisión')+claimButton('unresolved','Marcar sin acuerdo');
  return intro+list+`<div class="card stack"><div class="row between"><h3>${c.id}</h3><span class="badge badge-sun">${CLAIM_STATUS[c.status]}</span></div><b>${safe(c.houseTitle)}</b><span class="small">${safe(c.client)} · ${safe(c.owner)}</span><b>${safe(c.reason)}</b><p style="white-space:pre-wrap;overflow-wrap:anywhere">${safe(c.detail)}</p><p class="small"><b>Pruebas descritas:</b> ${safe(c.evidence)}</p><p class="small">Revisión: ${CLAIM_FINDING[c.finding]}<br>Medida registrada: ${CLAIM_MEASURE[c.measure]}</p><p class="xs muted">La revisión trata la conducta y el anuncio. Los acuerdos económicos se gestionan directamente entre las partes, fuera de 3bstays.</p></div>
    <div class="card stack"><h3>${S.role==='admin'?'Revisar caso':'Seguimiento'}</h3>${actions?'<div class="field"><label for="claim-note">Respuesta o motivo</label><textarea id="claim-note" rows="3" maxlength="2000"></textarea></div>'+actions:'<p class="small muted">Esperá la respuesta o revisión. Podés consultar el historial.</p>'}</div>
    <div class="card stack"><h3>Historial conservado</h3>${c.history.map(e=>`<div class="small" style="overflow-wrap:anywhere"><b>${e.actor==='admin'?'3bstays':e.actor==='owner'?'Owner':'Cliente'} · ${new Date(e.at).toLocaleString('es-CR',{timeZone:'America/Costa_Rica'})}</b><p>${safe(e.text)}</p></div>`).join('')}</div><p class="xs muted">Si no hay acuerdo, podés acudir a los canales oficiales de denuncia. 3bstays no entrega cédulas ni selfies a la otra parte. Verificar identidad no demuestra quién cometió una estafa.</p>`+create;
}
SCREENS.claims=claimsScreen;
for(const screen of ['profile','o-profile','a-queue']){
  const previous=SCREENS[screen];
  SCREENS[screen]=()=>previous()+((screen!=='profile'||S.loggedIn)?'<button class="btn btn-ghost" data-go="claims">Reclamaciones y ayuda</button>':'');
}
NAV.admin.push(['claims','Reclamaciones',I.shield]);
document.addEventListener('click',event=>{
  const el=event.target.closest('[data-claim-new],[data-claim-open],[data-claim-create],[data-claim-action]');
  if(!el)return;event.stopImmediatePropagation();const d=el.dataset;
  if(d.claimNew){claims.selected=null;go('claims',{house:d.claimNew});return;}
  if(d.claimOpen){const c=claims.items.find(x=>x.id===d.claimOpen);if(c&&claimAllowed(c)){claims.selected=c.id;render();}return;}
  const value=id=>document.getElementById(id)?.value||'';
  if(d.claimCreate!==undefined){try{claimCreate({house:value('claim-house'),reason:value('claim-reason'),detail:value('claim-detail'),evidence:value('claim-evidence')});render();toast('Reporte registrado en la demo. Sin recargos.');}catch(e){toast(e.message);}return;}
  const c=claims.items.find(x=>x.id===claims.selected);if(!c)return;
  const ok=d.claimAction==='decide'?claimDecide(c,value('claim-finding'),value('claim-measure'),value('claim-note')):claimAct(c,d.claimAction,value('claim-note'));
  if(ok){render();toast('Actualizado en la demo. No se ha cobrado ni transferido dinero.');}else toast('Completá el motivo y revisá que la acción corresponda al estado del caso.');
},true);
render();
