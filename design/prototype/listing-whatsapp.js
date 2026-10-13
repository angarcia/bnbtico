/* WhatsApp por casa. Solo demo: el código visible no autentica a nadie ni envía mensajes. */
const listingPhones=new Map();
let listingDraftPhone=null;
function listingPhoneSeed(number,verified){return {active:verified?number:null,pending:number||'',challenge:null,error:'',notice:''};}
// Snapshot at load: account changes must never rewrite existing house destinations.
HOUSES.forEach(h=>listingPhones.set(h.id,listingPhoneSeed(MY.some(m=>m.id===h.id)?publication.account.whatsapp:'+506 8xxx-xxxx',true)));
function listingPhoneCurrent(){
  if(publication.editingHouse)return listingPhones.get(publication.editingHouse);
  return listingDraftPhone??(listingDraftPhone=listingPhoneSeed(publication.account.whatsapp,publication.account.whatsappVerified));
}
function listingPhoneFor(id){return listingPhones.get(id)?.active||null;}
function listingPhoneVerified(id){return !!listingPhoneFor(id);}
function listingPhoneDestination(thread){return relayActor(thread)==='guest'&&relayCanWhatsApp(thread)?listingPhoneFor(thread.house):null;}
function listingPhoneAllowed(){return S.role==='owner'&&adminUserActive(adminSelfName())&&(!publication.editingHouse||houseManageable(publication.editingHouse));}
function listingPhoneNormalize(value){return String(value).replace(/[\s()-]/g,'');}
function listingPhoneEdit(value){
  if(!listingPhoneAllowed())return false;
  const p=listingPhoneCurrent(),next=String(value);
  if(p.pending!==next){p.pending=next;p.challenge=null;p.error='';p.notice='';}return true;
}
function listingPhoneSave(){
  if(!listingPhoneAllowed())return false;
  const p=listingPhoneCurrent(),phone=listingPhoneNormalize(p.pending);
  p.error='';p.notice='';
  if(phone===listingPhoneNormalize(p.active||'')&&p.active){p.pending=p.active;p.notice='Este WhatsApp ya está verificado.';return true;}
  if(publication.account.whatsappVerified&&phone===listingPhoneNormalize(publication.account.whatsapp)){
    p.active=publication.account.whatsapp;p.pending=p.active;p.challenge=null;p.notice='WhatsApp de tu cuenta verificado y guardado para esta casa.';return true;
  }
  if(!/^\+[1-9]\d{7,14}$/.test(phone)){p.error='Indicá un número con código de país. Demo: usá +506 80000001, sin datos reales.';return false;}
  p.pending=phone;p.challenge={phone,expiresAt:relayNow()+5*60*1000,attempts:0};
  p.notice='Código de ejemplo: 123456. No enviamos ningún mensaje. Válido 5 minutos y hasta 5 intentos.';return true;
}
function listingPhoneVerify(code){
  if(!listingPhoneAllowed())return false;
  const p=listingPhoneCurrent(),c=p.challenge;
  if(!c||c.phone!==listingPhoneNormalize(p.pending)||relayNow()>=c.expiresAt||c.attempts>=5){p.error='Solicitá otro código de ejemplo: el anterior ya no es válido.';p.challenge=null;return false;}
  c.attempts++;
  if(String(code)!=='123456'){p.error='Código incorrecto. Usá 123456 solo en esta demo.';return false;}
  p.active=c.phone;p.pending=c.phone;p.challenge=null;p.error='';p.notice=publication.editingHouse?'WhatsApp verificado y actualizado solo para esta casa · demo.':'WhatsApp verificado para este anuncio · demo.';return true;
}
const listingReset=publicationReset;
publicationReset=()=>{listingReset();listingDraftPhone=listingPhoneSeed(publication.account.whatsapp,publication.account.whatsappVerified);};
const listingSubmit=publicationSubmit;
publicationSubmit=()=>{
  if(!listingPhoneAllowed())return false;
  const p=listingPhoneCurrent();
  if(!p.active||listingPhoneNormalize(p.pending)!==listingPhoneNormalize(p.active)){
    S.wizStep=5;publication.error='Verificá y guardá el WhatsApp de esta casa antes de enviar el anuncio.';return false;
  }
  const ok=listingSubmit();if(ok)Object.assign(publication.submitted.at(-1),{whatsapp:p.active,whatsappVerified:true});return ok;
};
const listingPreviousPhone=publicationPhoneFor;
publicationPhoneFor=listing=>listing.ownerId===publication.account.id&&listing.whatsappVerified?listing.whatsapp:listingPreviousPhone(listing);
function listingPhonePanel(){
  const p=listingPhoneCurrent(),unchanged=p.active&&listingPhoneNormalize(p.pending)===listingPhoneNormalize(p.active);
  return `<section class="card stack"><h3>WhatsApp de esta casa</h3><p class="small">Por defecto usamos el WhatsApp de tu cuenta. Podés elegir otro para esta casa, pero tenés que verificarlo.</p><p class="note">Demo sin envíos ni datos reales. Número de ejemplo: +506 80000001. Verificar acceso al número no verifica la identidad de otra persona.</p><label for="listing-whatsapp">WhatsApp con código de país para esta casa</label><input id="listing-whatsapp" type="tel" value="${safe(p.pending)}"><span class="badge ${unchanged?'badge-ok':'badge-warn'}">${unchanged?'WhatsApp verificado · demo':'Cambio pendiente de verificación'}</span>${publication.editingHouse&&p.active?`<p class="small">Contacto actual: ${safe(p.active)}. Se mantiene hasta verificar y guardar el nuevo número. Las otras casas no cambian.</p>`:''}<button class="btn btn-ghost" data-listing-phone-save>Guardar o verificar WhatsApp</button>${p.challenge?`<label for="listing-whatsapp-code">Código de verificación de ejemplo</label><input id="listing-whatsapp-code" inputmode="numeric" maxlength="6" autocomplete="off" placeholder="123456"><button class="btn btn-primary" data-listing-phone-verify>Verificar y guardar para esta casa</button>`:''}${p.error?`<p role="alert">${safe(p.error)}</p>`:''}${p.notice?`<p role="status">${safe(p.notice)}</p>`:''}<p class="xs muted">Solo se comparte según el contacto directo o la aceptación de consultas de esta casa. Cambiar el número no retira los contactos ya compartidos. Todo se borra al recargar.</p></section>`;
}
const listingPublicationScreen=SCREENS['o-new'];
SCREENS['o-new']=()=>{
  if(S.role!=='owner')return listingPublicationScreen();
  let body=listingPublicationScreen();
  body=body.replace(/<div class="card stack"><b>WhatsApp de tu cuenta<\/b>[\s\S]*?<\/div>/,publication.editingHouse?'':listingPhonePanel());
  return publication.editingHouse?body+listingPhonePanel():body;
};
document.addEventListener('input',e=>{if(e.target.id==='listing-whatsapp')listingPhoneEdit(e.target.value);});
document.addEventListener('click',e=>{
  const el=e.target.closest('[data-listing-phone-save],[data-listing-phone-verify]');if(!el)return;e.stopImmediatePropagation();
  if(!listingPhoneAllowed())return;
  if(el.dataset.listingPhoneSave!==undefined)listingPhoneSave();
  else listingPhoneVerify(document.getElementById('listing-whatsapp-code')?.value||'');
  render();
},true);
render();
