/* Revisión completa de anuncios. Fixtures y decisiones locales; no publicación ni avisos reales. */
const adminReview={photo:null,reason:'',error:''};
const ADMIN_REVIEW_STATUS={pend:'Pendiente',ok:'Aprobado · demo',no:'Rechazado · demo',changes:'Cambios solicitados · demo'};
const reviewFixture=(overrides)=>({kind:'apartment',people:3,bedrooms:1,bathrooms:1,bathroomUse:'private',province:'Limón',canton:'Talamanca',zone:'Puerto Viejo',currency:'CRC',nightlyPrice:35000,minNights:2,acceptsLongTerm:true,monthlyMode:'contact',monthlyPrice:null,minMonths:null,pets:'no',pool:'no',wifi:'yes',ac:'yes',parking:'yes',furnished:'yes',photoCount:5,status:'review',...overrides});
S.queue[0].listing=reviewFixture({title:'Loft Caribe · Puerto Viejo',description:'Loft luminoso para tres personas, con cocina equipada, dormitorio y baño de uso exclusivo. Cuenta con terraza y parqueo. La playa está a unos minutos a pie. Coordiná con la anfitriona los detalles de llegada.',conditions:'Sin fiestas. No fumar dentro del alojamiento. Llegada desde las 15:00 y salida hasta las 11:00.'});
S.queue[1].listing=reviewFixture({title:'Estudio cerca del TEC · Cartago',province:'Cartago',canton:'Cartago',zone:'Oriental',people:2,bedrooms:0,nightlyPrice:25000,ac:'no',parking:'no',monthlyMode:'amount',monthlyPrice:280000,minMonths:2,description:'Estudio independiente con cocina y baño privado. Ofrece wifi y una mesa de trabajo. Entrada independiente y acceso a lavandería compartida.',conditions:'Máximo dos personas. No se permiten fiestas. Horario de descanso desde las 22:00.'});
S.queue[2].listing=reviewFixture({title:'Casa en Nosara',kind:'house',province:'Guanacaste',canton:'Nicoya',zone:'Nosara',people:6,bedrooms:3,bathrooms:2,nightlyPrice:85000,pool:'yes',pets:'yes',acceptsLongTerm:false,photoCount:2,description:'Casa con terraza, piscina y jardín. Tres habitaciones y dos baños privados para familias o grupos de hasta seis personas.',conditions:'Mascotas bajo supervisión. No se permiten eventos.'});
function adminReviewSync(){
  for(const listing of publication.submitted){
    if(S.queue.some(q=>q.submissionId===listing.id))continue;
    S.queue.push({n:MY[0].owner,house:listing.title,sent:'ahora · demo',flags:[],status:'pend',identityStatus:publication.account.identityVerified?'approved':'pending',submissionId:listing.id,listing});
  }
}
function adminCurrentReview(){
  const index=S.params.review;
  return S.role==='admin'&&Number.isInteger(index)&&index>=0?S.queue[index]||null:null;
}
function adminOpenReview(index){
  if(S.role!=='admin'||!Number.isInteger(index)||index<0)return false;
  adminReviewSync();const q=S.queue[index];if(!q?.listing)return false;
  q.reviewOpened=true;Object.assign(adminReview,{photo:null,reason:'',error:''});go('a-review',{review:index});return true;
}
function adminSelectPhoto(index){
  const q=adminCurrentReview();if(!q||!Number.isInteger(index)||index<0||index>=q.listing.photoCount)return false;
  adminReview.photo=index;return true;
}
function adminDecide(status,reason){
  const q=adminCurrentReview();if(!q)return false;
  adminReview.reason=String(reason??'');adminReview.error='';
  if(!moderateListing(S.params.review,status,adminReview.reason)){
    adminReview.error=q.status!=='pend'?'Este anuncio ya tiene una decisión.':status==='ok'&&q.identityStatus!=='approved'?'La identidad debe estar aprobada por el proveedor antes de aprobar el anuncio.':status==='ok'&&q.listing.photoCount<5?'Pedí al menos 5 fotos antes de aprobar.':'Escribí un motivo de hasta 2000 caracteres para pedir cambios o rechazar.';
    return false;
  }
  return true;
}
const reviewMoney=(value,currency)=>value===null||value===undefined?'No informado':`${currency==='USD'?'$':'₡'}${Number(value).toLocaleString('es-CR')}`;
const reviewBoolean=value=>value===true||value==='yes'?'Sí':value===false||value==='no'?'No':'No informado';
const reviewRow=(label,value)=>`<div class="stack" style="gap:3px;min-width:0"><dt class="small muted">${label}</dt><dd style="margin:0;overflow-wrap:anywhere">${safe(value??'No informado')}</dd></div>`;
const reviewPhotoClass=index=>['p-playa','p-piscina','p-selva','p-ciudad','p-montana'][index%5];
function adminReviewScreen(){
  const q=adminCurrentReview();
  if(!q?.listing)return '<div class="note">Este anuncio no está disponible. Entrá desde Admin → Anuncios.</div>';
  const h=q.listing,selected=adminReview.photo,canApprove=q.identityStatus==='approved'&&h.photoCount>=5;
  return header('Revisar anuncio','a-queue')+`<div class="stack" style="max-width:900px;width:100%;min-width:0">
    <div class="card stack"><div class="row between" style="flex-wrap:wrap;gap:8px"><span class="badge badge-sun">${ADMIN_REVIEW_STATUS[q.status]}</span><span class="xs muted">${safe(h.id||'Anuncio de ejemplo')}</span></div><h1 style="font-size:24px;overflow-wrap:anywhere">${safe(h.title)}</h1><p class="small">Publicado por ${safe(q.n)} · Identidad ${q.identityStatus==='approved'?'aprobada':'pendiente'} en Veriff (simulada).</p><p class="xs muted">Vista de revisión v1. No hay verificación de propiedad ni documentos de identidad en esta pantalla.</p></div>
    <section class="card stack"><h2>Fotos (${h.photoCount})</h2><p class="small muted">Imágenes de ejemplo: tocá una para ampliarla. En esta demo no son fotografías reales ni archivos subidos.</p>
      ${selected!==null?`<div class="stack" aria-live="polite"><h3>Foto ${selected+1} de ${h.photoCount}${selected===0?' · Portada':''}</h3><div role="img" aria-label="Foto ${selected+1} ampliada, imagen de ejemplo" class="photo ${reviewPhotoClass(selected)}" style="height:280px;min-height:200px;border-radius:16px"><span>Imagen de ejemplo ${selected+1}</span></div><div class="row" style="flex-wrap:wrap;gap:8px"><button class="btn btn-ghost btn-sm" data-admin-photo="${selected-1}" ${selected===0?'disabled':''}>Anterior</button><button class="btn btn-ghost btn-sm" data-admin-photo="${selected+1}" ${selected===h.photoCount-1?'disabled':''}>Siguiente</button><button class="btn btn-ghost btn-sm" data-admin-photo-close>Cerrar ampliación</button></div></div>`:''}
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(110px,1fr));gap:10px">${Array.from({length:h.photoCount},(_,i)=>`<button class="photo ${reviewPhotoClass(i)}" style="height:120px;min-height:100px;width:100%;border-radius:12px;position:relative" data-admin-photo="${i}" aria-label="Ampliar foto ${i+1}${i===0?', portada':''}" aria-pressed="${selected===i}"><span>${i===0?'Portada':`Foto ${i+1}`}</span></button>`).join('')}</div>${h.photoCount<5?'<p class="note">Faltan fotos: se requieren al menos 5 para aprobar.</p>':''}
    </section>
    <section class="card stack"><h2>Descripción</h2><p style="white-space:pre-wrap;overflow-wrap:anywhere">${safe(h.description)}</p></section>
    <section class="card stack"><h2>Ubicación y alojamiento</h2><dl style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin:0">${reviewRow('Provincia',h.province)}${reviewRow('Cantón',h.canton)}${reviewRow('Zona aproximada',h.zone)}${reviewRow('Tipo',publicationLabels[h.kind])}${reviewRow('Máximo de personas',h.people)}${reviewRow('Habitaciones',h.bedrooms)}${reviewRow('Baños',h.bathrooms)}${reviewRow('Uso de baños',publicationLabels[h.bathroomUse])}</dl><p class="xs muted">Sin dirección exacta ni comprobación registral.</p></section>
    <section class="card stack"><h2>Características</h2><dl style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin:0">${[['pets','Acepta mascotas'],['pool','Piscina'],['wifi','Wifi'],['ac','Aire acondicionado']].map(([key,label])=>reviewRow(label,reviewBoolean(h[key]))).join('')}${reviewRow('Parqueo',h.parking==='yes'?({'free':'Gratuito','paid':'De pago'}[h.parkingType]||'Sí · tarifa sin indicar'):reviewBoolean(h.parking))}</dl></section>
    <section class="card stack"><h2>Precios y condiciones</h2><dl style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:18px;margin:0">${reviewRow('Precio por noche',reviewMoney(h.nightlyPrice,h.currency)+' · orientativo')}${reviewRow('Mínimo de noches',h.minNights)}${reviewRow('Acepta largo plazo',reviewBoolean(h.acceptsLongTerm))}${h.acceptsLongTerm?reviewRow('Precio mensual',h.monthlyMode==='contact'?'Consultar con el propietario':reviewMoney(h.monthlyPrice,h.currency)+' · orientativo')+reviewRow('Mínimo de meses',h.minMonths):''}</dl><p style="white-space:pre-wrap;overflow-wrap:anywhere">${safe(h.conditions||'Condiciones adicionales no informadas. Revisá también la descripción.')}</p><p class="xs muted">Sin reservas ni pagos entre partes en bnbtico.</p></section>
    <section class="card stack"><h2>Revisión y decisión</h2>${q.flags.length?`<ul>${q.flags.map(f=>`<li>${safe(f)}</li>`).join('')}</ul>`:''}<p class="small muted">Comprobá que fotos y descripción correspondan al anuncio y no incluyan teléfonos, enlaces ni publicidad de agencias.</p>
    ${q.status==='pend'?`${q.identityStatus!=='approved'?'<p class="note">Identidad pendiente: no podés aprobar el anuncio ni verificar manualmente al usuario.</p>':''}<div class="field"><label for="admin-review-reason">Motivo o indicaciones</label><textarea id="admin-review-reason" rows="4" maxlength="2000" placeholder="Explicá qué debe corregir el propietario…">${safe(adminReview.reason)}</textarea><span class="xs muted">Obligatorio para pedir cambios o rechazar; opcional al aprobar.</span></div>${adminReview.error?`<p class="note" role="alert">${safe(adminReview.error)}</p>`:''}<div class="row" style="flex-wrap:wrap;gap:10px"><button class="btn btn-primary" data-admin-decision="ok" ${!canApprove?'disabled':''}>Aprobar anuncio</button><button class="btn btn-ghost" data-admin-decision="changes">Pedir cambios</button><button class="btn btn-danger" data-admin-decision="no">Rechazar anuncio</button></div>`:`<div class="note" role="status"><b>${ADMIN_REVIEW_STATUS[q.status]}</b><p style="white-space:pre-wrap;overflow-wrap:anywhere">${safe(q.decision?.reason||'Sin nota adicional.')}</p></div>`}
    <p class="xs muted">Decisión guardada solo en memoria. No publica la casa ni envía mensajes; recargar restablece la demo.</p><button class="btn btn-ghost" data-go="a-queue">Volver a anuncios</button></section></div>`;
}
SCREENS['a-review']=adminReviewScreen;
const adminReviewPreviousCurrent=current;
current=()=>S.screen==='a-review'?'a-queue':adminReviewPreviousCurrent();
document.addEventListener('input',e=>{if(e.target.id==='admin-review-reason'&&adminCurrentReview())adminReview.reason=e.target.value;});
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-admin-review],[data-admin-photo],[data-admin-photo-close],[data-admin-decision]');
  if(!el)return;e.stopImmediatePropagation();if(S.role!=='admin')return;
  const d=el.dataset;
  if(d.adminReview!==undefined){adminOpenReview(Number(d.adminReview));return;}
  if(d.adminPhoto!==undefined)adminSelectPhoto(Number(d.adminPhoto));
  if(d.adminPhotoClose!==undefined)adminReview.photo=null;
  if(d.adminDecision!==undefined)adminDecide(d.adminDecision,adminReview.reason);
  render();
},true);
render();
