// Cuenta simplificada · 2026-10-13
// Portada de Mi cuenta / Cuenta con lo frecuente a un clic; lo demás dentro de «Editar perfil».
// Retirados «Cerrar otras sesiones» y «Mis contactos». Reutiliza las acciones de account-access.js.
let accountEditOpen=false;
// account-access.js declara sus const dentro de un bloque; se replican aquí las dos notas que necesita esta portada.
const accountSimpleNote=()=>'<p class="xs muted">Demo sin envíos reales. Usá datos ficticios. Perfil y sesión se guardan solo en este navegador; no es autenticación segura.</p>';
const accountSimpleFeedback=()=>`${accountAccess.state.error?`<p class="note" role="alert">${safe(accountAccess.state.error)}</p>`:''}${accountAccess.state.notice?`<p class="small" role="status">${safe(accountAccess.state.notice)}</p>`:''}`;
function accountSimpleVerification(a){
  const u=adminUsers.items.find(u=>u.name===adminSelfName()),owner=S.role==='owner',identity=!!a.identity;
  const line=identity
    ?'<p class="small"><span class="badge badge-ok">✓ Identidad verificada</span> <span class="badge badge-ok">✓ WhatsApp verificado</span></p>'
    :'<p class="small"><span class="badge badge-ok">✓ WhatsApp verificado</span> <span class="badge badge-mute">Identidad sin verificar</span></p>';
  const pending=identity?'':`<p class="small">Tu WhatsApp verificado es lo único necesario para ${owner?'publicar':'contactar'}. Si verificás tu identidad con Veriff, ${owner?'los clientes':'los propietarios'} verán el sello <b>Identidad verificada</b> junto a tu nombre.</p><button class="btn btn-ghost" data-go="account-identity">Verificar mi identidad · opcional</button>`;
  const inactive=u?.active===false?'<div class="note"><div><b>Cuenta desactivada</b><p>No podés publicar ni contactar. Escribile a bnbtico por WhatsApp si creés que es un error.</p></div></div>':'';
  return line+pending+inactive;
}
function accountSimpleEdit(a){
  return `<section class="card stack"><div class="row between"><h3>Editar perfil</h3><button class="chip" data-account-edit="close">Listo</button></div>${a.photo?`<img src="${safe(a.photo)}" alt="Foto de perfil" style="width:88px;height:88px;border-radius:50%;object-fit:cover">`:''}<label for="account-photo">Foto de perfil (opcional)</label><input id="account-photo" type="file" accept="image/png,image/jpeg,image/webp">${a.photo?'<button class="btn-link" data-account="remove-photo">Quitar foto</button>':''}<label for="account-description">Descripción (opcional)</label><textarea id="account-description" rows="3" maxlength="1000" placeholder="Contanos un poco sobre vos">${safe(a.description)}</textarea><label for="account-email">Correo de recuperación (opcional)</label><input id="account-email" type="email" autocomplete="email" value="${safe(a.email)}" placeholder="nombre@ejemplo.com"><p class="xs muted">Sirve para recuperar la cuenta si perdés acceso a tu WhatsApp.</p><button class="btn btn-primary" data-account="save-profile">Guardar</button>${a.email?`<p class="small">Correo ${a.emailVerified?'confirmado':'pendiente de confirmar'} · demo</p>${a.emailVerified?'':'<button class="btn btn-ghost" data-account="email-request">Confirmar correo</button>'}`:''}${accountAccess.state.emailLink?'<p class="note small">En la app recibirías un enlace por correo. Aquí no se envía ningún email.</p><button class="btn btn-ghost" data-account="email-confirm">Simular apertura del enlace de confirmación</button>':''}${accountSimpleFeedback()}<hr style="border:0;border-top:1px solid var(--line);margin:4px 0"><button class="btn btn-ghost" data-account="phone">Cambiar WhatsApp</button><p class="xs muted">Sesión recordada en este navegador. En otro dispositivo necesitarás un código por WhatsApp.</p></section>`;
}
function accountSimpleScreen(){
  if(!accountAccess.session())return accountLoginScreen();
  const a=accountAccess.user(),owner=S.role==='owner';
  return header(owner?'Cuenta':'Mi cuenta')+`<section class="card stack"><div class="row" style="gap:12px;align-items:center">${a.photo?`<img src="${safe(a.photo)}" alt="" style="width:48px;height:48px;border-radius:50%;object-fit:cover">`:''}<div><h3 style="margin:0">${safe(a.name)}</h3><span class="small muted">${safe(a.phone)}</span></div></div>${accountSimpleVerification(a)}</section>`
    +`<button class="btn btn-wa" data-go="support-info">${I.wa} Escribile a bnbtico por WhatsApp</button>`
    +(owner?'<button class="btn btn-ghost" data-go="o-sub">Promoción y suscripción</button>':'<button class="btn btn-ghost" data-role-switch="owner">¿Tenés una casa? Publicala</button>')
    +(accountEditOpen?accountSimpleEdit(a):'<button class="btn btn-ghost" data-account-edit="open">Editar perfil</button>')
    +'<p style="text-align:center"><button class="btn-link" data-account="logout">Cerrar sesión</button></p>'
    +accountSimpleNote();
}
SCREENS.profile=SCREENS['o-profile']=accountSimpleScreen;
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-account-edit]');if(!button)return;
  event.stopImmediatePropagation();
  accountEditOpen=button.dataset.accountEdit==='open';
  if(!accountEditOpen){accountAccess.state.error='';accountAccess.state.notice='';}
  render();
});

render();
