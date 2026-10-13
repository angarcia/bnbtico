/* Publicación vacacional: estado local de demostración, sin archivos ni datos enviados. */
const publication={draft:null,submitted:[],error:'',sent:false,account:{id:'owner-demo',whatsapp:'+506 8xxx-xxxx',identityVerified:true}};
let publicationReturn=false;
function publicationReset(){
  publication.draft={kind:'',acceptsLongTerm:'',province:'',canton:'',zone:'',people:'',bedrooms:'',bathrooms:'',bathroomUse:'private',title:'',description:'',pets:'no',pool:'no',wifi:'no',ac:'no',parking:'no',parkingType:'',photoCount:0,nightlyPrice:'',currency:'CRC',minNights:'',monthlyMode:'',monthlyPrice:'',minMonths:''};
  publication.error='';publication.sent=false;publicationReturn=false;S.wizStep=1;
}
publicationReset();
function publicationSet(key,value){
  if(S.role!=='owner'||!Object.hasOwn(publication.draft,key))return false;
  publication.draft[key]=value;publication.error='';
  if(key==='acceptsLongTerm'&&value!=='yes')Object.assign(publication.draft,{monthlyMode:'',monthlyPrice:'',minMonths:''});
  if(key==='parking'&&value!=='yes')publication.draft.parkingType='';
  if(key==='monthlyMode'&&value!=='amount')publication.draft.monthlyPrice='';
  return true;
}
const publicationInteger=(v,min)=>String(v).trim()!==''&&Number.isInteger(Number(v))&&Number(v)>=min;
const publicationMoney=v=>/^\d+(\.\d{1,2})?$/.test(String(v))&&Number(v)>0&&Number.isSafeInteger(Math.round(Number(v)*100));
function publicationError(step){
  const d=publication.draft;
  if(step===1){
    if(!['house','apartment','room'].includes(d.kind))return 'Elegí Casa, Apartamento o Habitación.';
    if(!['yes','no'].includes(d.acceptsLongTerm))return 'Respondé si aceptás alquileres de largo plazo.';
  }
  if(step===2&&(!d.province||!d.canton.trim()||!d.zone.trim()))return 'Completá provincia, cantón y zona aproximada.';
  if(step===3){
    if(!publicationInteger(d.people,1))return 'Indicá cuántas personas pueden alojarse (mínimo 1).';
    if(!publicationInteger(d.bedrooms,d.kind==='apartment'?0:1))return 'Indicá las habitaciones ofrecidas; solo un apartamento tipo estudio puede tener 0.';
    if(!publicationInteger(d.bathrooms,1))return 'Indicá el número de baños disponibles (mínimo 1).';
    if(!['private','shared','mixed'].includes(d.bathroomUse))return 'Indicá si los baños son privados, compartidos o ambos.';
    if(!d.title.trim()||!d.description.trim())return 'Completá el título y la descripción.';
    if(['pets','pool','wifi','ac','parking'].some(k=>!['yes','no'].includes(d[k])))return 'Revisá las características principales.';
    if(d.parking==='yes'&&!['free','paid'].includes(d.parkingType))return 'Indicá si el parqueo es gratuito o de pago.';
  }
  if(step===4&&d.photoCount<5)return 'Agregá al menos 5 fotos de ejemplo.';
  if(step===5){
    if(!publicationMoney(d.nightlyPrice))return 'Indicá un precio por noche mayor que cero, sin separadores de miles.';
    if(!['CRC','USD'].includes(d.currency))return 'Elegí colones o dólares.';
    if(!publicationInteger(d.minNights,1))return 'Indicá la estancia mínima en noches.';
    if(d.acceptsLongTerm==='yes'){
      if(!['amount','contact'].includes(d.monthlyMode))return 'Elegí indicar un precio mensual o Consultar con el propietario.';
      if(d.monthlyMode==='amount'&&!publicationMoney(d.monthlyPrice))return 'Indicá un precio mensual válido.';
      if(d.minMonths!==''&&!publicationInteger(d.minMonths,1))return 'La estancia mínima en meses debe ser un número entero mayor que cero.';
    }
  }
  return '';
}
function publicationNext(){
  if(S.role!=='owner')return false;
  publication.error=publicationError(S.wizStep);
  if(publication.error)return false;
  S.wizStep=Math.min(5,S.wizStep+1);return true;
}
function publicationSubmit(){
  if(S.role!=='owner'||publication.sent)return false;
  for(let step=1;step<=5;step++){
    const error=publicationError(step);if(error){S.wizStep=step;publication.error=error;return false;}
  }
  if(!publication.account.whatsapp){publication.error='Configurá tu WhatsApp en Mi cuenta antes de publicar.';return false;}
  if(!publication.account.identityVerified){publication.error='Verificá tu identidad antes de publicar. Esta demo no conecta con Veriff.';return false;}
  const d=publication.draft;
  publication.submitted.push({...d,id:'DEMO-'+(publication.submitted.length+1),ownerId:publication.account.id,mode:'vac',status:'review',people:Number(d.people),bedrooms:Number(d.bedrooms),bathrooms:Number(d.bathrooms),nightlyPrice:Number(d.nightlyPrice),minNights:Number(d.minNights),acceptsLongTerm:d.acceptsLongTerm==='yes',monthlyPrice:d.acceptsLongTerm==='yes'&&d.monthlyMode==='amount'?Number(d.monthlyPrice):null,minMonths:d.acceptsLongTerm==='yes'&&d.minMonths!==''?Number(d.minMonths):null});
  publication.sent=true;publication.error='';publicationReturn=false;return true;
}
function publicationSetWhatsapp(value){
  if(S.role!=='owner')return false;
  const phone=String(value).replace(/[\s()-]/g,'');
  if(!/^\+[1-9]\d{7,14}$/.test(phone))return false;
  publication.account.whatsapp=phone;return true;
}
function publicationPhoneFor(listing){return listing.ownerId===publication.account.id?publication.account.whatsapp:null;}
const publicationLabels={house:'Casa',apartment:'Apartamento',room:'Habitación',private:'Privados',shared:'Compartidos',mixed:'Privados y compartidos'};
function publicationInput(key,label,type='text',extra=''){
  return `<div class="field"><label for="pub-${key}">${label}</label><input id="pub-${key}" data-publication-field="${key}" type="${type}" value="${safe(publication.draft[key])}" ${extra}></div>`;
}
function publicationSelect(key,label,options,placeholder=true){
  return `<div class="field"><label for="pub-${key}">${label}</label><select id="pub-${key}" data-publication-field="${key}" required>${placeholder?'<option value="">Seleccioná una opción</option>':''}${options.map(([value,text])=>`<option value="${value}" ${publication.draft[key]===value?'selected':''}>${text}</option>`).join('')}</select></div>`;
}
const publicationCheckbox=(key,label)=>`<label class="row" style="gap:10px"><input type="checkbox" data-publication-check="${key}" ${publication.draft[key]==='yes'?'checked':''}><span>${label}</span></label>`;
const publicationYesNo=(key,label)=>publicationSelect(key,label,[['yes','Sí'],['no','No']]);
function publicationScreen(){
  if(S.role!=='owner')return '<div class="note">Disponible en el modo Owner.</div>';
  const d=publication.draft,steps=['Alojamiento','Ubicación','Detalles','Fotos','Precio'];
  const panels=[
    ()=>`<h3>Tu alojamiento vacacional</h3><p class="small muted">Todos los anuncios son de alquiler vacacional. También podés aceptar estancias de largo plazo.</p>${publicationSelect('kind','Tipo de alojamiento *',[['house','Casa'],['apartment','Apartamento'],['room','Habitación']])}${publicationYesNo('acceptsLongTerm','¿Aceptás largo plazo? *')}<p class="xs muted">Respondé Sí o No para continuar; no elegimos por vos.</p>`,
    ()=>`<h3>¿Dónde está?</h3>${publicationSelect('province','Provincia *',['San José','Alajuela','Cartago','Heredia','Guanacaste','Puntarenas','Limón'].map(v=>[v,v]))}${publicationInput('canton','Cantón *','text','required maxlength="80"')}${publicationInput('zone','Zona / playa / barrio *','text','required maxlength="120"')}<p class="small muted">Solo ubicación aproximada. No incluyás la dirección exacta; la compartís directamente cuando lo decidás.</p>`,
    ()=>`<h3>Detalles del alojamiento</h3>${publicationInput('people','Máximo de personas *','number','required min="1" step="1"')}${publicationInput('bedrooms','Número de habitaciones ofrecidas *','number',`required min="${d.kind==='apartment'?0:1}" step="1"`)}<p class="xs muted">Contá solo las habitaciones que ofrecés. En apartamentos tipo estudio podés indicar 0.</p>${publicationInput('bathrooms','Número de baños disponibles *','number','required min="1" step="1"')}${publicationSelect('bathroomUse','Uso de los baños *',[['private','Privados'],['shared','Compartidos'],['mixed','Privados y compartidos']],false)}<p class="xs muted">Privados: exclusivos del alojamiento, no necesariamente dentro de cada habitación. Compartidos: con otros huéspedes o residentes.</p><h3>Características principales</h3><p class="small muted">Marcá lo que ofrece tu alojamiento.</p>${[['pets','Acepta mascotas'],['pool','Piscina'],['wifi','Wifi'],['ac','Aire acondicionado'],['parking','Parqueo']].map(([key,label])=>publicationCheckbox(key,label)).join('')}${d.parking==='yes'?publicationSelect('parkingType','Tipo de parqueo *',[['free','Gratuito'],['paid','De pago']]):''}${publicationInput('title','Título *','text','required maxlength="100"')}<div class="field"><label for="pub-description">Descripción *</label><textarea id="pub-description" data-publication-field="description" rows="4" required maxlength="3000">${safe(d.description)}</textarea></div><p class="xs muted">Sin enlaces, teléfonos ni publicidad de agencias. El contenido se revisa antes de publicar.</p>`,
    ()=>`<h3>Fotos del alojamiento</h3><p class="small">Mínimo 5 fotos, con una portada. Sin teléfonos, enlaces ni publicidad de agencias.</p><div class="note">Demo: no se suben archivos. Usá imágenes de ejemplo para probar el formulario.</div><div class="photos-grid">${Array.from({length:d.photoCount},(_,i)=>photo(['p-playa','p-piscina','p-selva','p-ciudad','p-montana'][i%5],i===0?'Portada':'')).join('')}</div><p role="status">${d.photoCount} fotos de ejemplo</p><div class="row" style="flex-wrap:wrap"><button class="btn btn-ghost" data-publication-photos="5">Usar 5 fotos de ejemplo</button><button class="btn btn-ghost" data-publication-photos="0">Quitar fotos</button></div>`,
    ()=>`<h3>Precio orientativo</h3>${publicationInput('nightlyPrice','Precio por noche *','number','required min="0.01" step="0.01"')}${publicationSelect('currency','Moneda *',[['CRC','₡ Colones'],['USD','$ Dólares']],false)}${publicationInput('minNights','Estancia mínima (noches) *','number','required min="1" step="1"')}${d.acceptsLongTerm==='yes'?`<h3>Largo plazo</h3>${publicationSelect('monthlyMode','Precio mensual *',[['amount','Indicar precio mensual orientativo'],['contact','Consultar con el propietario']])}${d.monthlyMode==='amount'?publicationInput('monthlyPrice',`Precio mensual (${d.currency==='CRC'?'₡':'$'}) *`,'number','required min="0.01" step="0.01"'):d.monthlyMode==='contact'?'<p class="note">Se mostrará «Consultar precio mensual con el propietario». El cliente solicitará contacto por el flujo habitual.</p>':''}${publicationInput('minMonths','Estancia mínima (meses, opcional)','number','min="1" step="1"')}`:''}<p class="xs muted">Precios orientativos. bnbtico no gestiona reservas ni pagos entre las partes.</p><div class="card stack"><b>WhatsApp de tu cuenta</b><span>${safe(publication.account.whatsapp||'Sin configurar')}</span><p class="small muted">Un único número para todos tus anuncios. No se muestra en la ficha pública; se comparte tras aceptar el contacto.</p><button class="btn btn-ghost" data-publication-account>Configurar en Mi cuenta</button></div><div class="note">Identidad verificada: simulada en esta demo. En la app se pedirá al publicar por primera vez. Suscripción por casa y promoción según las condiciones vigentes; no se realiza ningún cobro aquí.</div>`
  ];
  return header('Publicar alojamiento','o-houses',`<span class="xs muted">Paso ${S.wizStep} de 5</span>`)+`<div class="steps">${steps.map((_,i)=>`<span class="${i<S.wizStep?'on':''}"></span>`).join('')}</div><div class="card stack" style="gap:14px;max-width:640px"><p class="xs muted">* Obligatorio · borrador en memoria, se borra al recargar.</p>${publication.error?`<div class="note" role="alert">${safe(publication.error)}</div>`:''}${panels[S.wizStep-1]()}</div><div class="row between" style="max-width:640px"><button class="btn btn-ghost" data-publication-back ${S.wizStep===1?'disabled':''}>Atrás</button>${S.wizStep<5?'<button class="btn btn-primary" data-publication-next>Continuar</button>':'<button class="btn btn-primary" data-publication-submit>Enviar a revisión</button>'}</div>`;
}
SCREENS['o-new']=publicationScreen;
const publicationOriginalHouses=SCREENS['o-houses'];
SCREENS['o-houses']=()=>publicationOriginalHouses()+publication.submitted.map(h=>`<article class="card stack"><span class="badge badge-sun">${{'review':'En revisión','approved-demo':'Aprobado','rejected':'Rechazado','changes-requested':'Cambios solicitados'}[h.status]||'En revisión'} · demo</span><b>${safe(h.title)}</b><span>${publicationLabels[h.kind]} · ${h.bedrooms} habitaciones · ${h.bathrooms} baños ${publicationLabels[h.bathroomUse].toLowerCase()}</span><span>${h.currency} ${h.nightlyPrice.toLocaleString('es-CR')} / noche · orientativo</span><span>${h.acceptsLongTerm?(h.monthlyPrice===null?'Largo plazo: consultar precio con el propietario':`Largo plazo: ${h.currency} ${h.monthlyPrice.toLocaleString('es-CR')} / mes · orientativo`):'No acepta largo plazo'}</span><p class="xs muted">Guardado solo en esta sesión. No publicado en el catálogo.</p></article>`).join('');
SCREENS['o-whatsapp']=()=>header('WhatsApp de mi cuenta','o-profile')+`<div class="card stack"><p>Este número se propone al crear una nueva casa. Cada casa guarda su propio WhatsApp verificado; cambiar el de tu cuenta no modifica los anuncios existentes.</p><p class="small muted">Recomendamos un número de negocio o distinto del personal. Solo se comparte según el consentimiento de contacto.</p><p class="note">Demo sin envíos: no ingresés datos reales. Podés probar con +506 80000000.</p><div class="field"><label for="account-whatsapp">WhatsApp con código de país</label><input id="account-whatsapp" type="tel" value="${safe(publication.account.whatsapp)}"></div><button class="btn btn-primary" data-publication-save-account>Guardar WhatsApp</button>${publicationReturn?'<button class="btn btn-ghost" data-publication-return>Volver al anuncio</button>':''}</div>`;
document.addEventListener('input',e=>{if(e.target.dataset?.publicationField)publicationSet(e.target.dataset.publicationField,e.target.value);});
document.addEventListener('change',e=>{if(e.target.dataset?.publicationCheck){publicationSet(e.target.dataset.publicationCheck,e.target.checked?'yes':'no');if(e.target.dataset.publicationCheck==='parking')render();return;}if(e.target.dataset?.publicationField){publicationSet(e.target.dataset.publicationField,e.target.value);if(e.target.tagName==='SELECT')render();}});
document.addEventListener('click',e=>{
  if(S.role!=='owner')return;
  const el=e.target.closest('[data-publication-next],[data-publication-back],[data-publication-submit],[data-publication-photos],[data-publication-account],[data-publication-save-account],[data-publication-return],[data-go="o-new"]');
  if(!el)return;
  const d=el.dataset;
  if(d.go==='o-new'){if(publication.sent)publicationReset();return;}
  e.stopImmediatePropagation();
  if(d.publicationAccount!==undefined){publicationReturn=true;go('o-whatsapp');return;}
  if(d.publicationReturn!==undefined){if(publication.sent)publicationReset();publicationReturn=false;go('o-new');return;}
  if(d.publicationSaveAccount!==undefined){const ok=publicationSetWhatsapp(document.getElementById('account-whatsapp').value);render();toast(ok?'WhatsApp de cuenta actualizado; tus casas conservan sus números · demo':'Indicá un número con código de país, por ejemplo +506 80000000');return;}
  if(d.publicationPhotos!==undefined)publication.draft.photoCount=Number(d.publicationPhotos);
  if(d.publicationBack!==undefined){S.wizStep=Math.max(1,S.wizStep-1);publication.error='';}
  if(d.publicationNext!==undefined)publicationNext();
  if(d.publicationSubmit!==undefined&&publicationSubmit()){go('o-houses');toast('Anuncio guardado en revisión · demo sin publicación real');return;}
  render();document.querySelector('.view').scrollTop=0;
},true);
render();
