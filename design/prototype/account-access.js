/* Account UX DEMO ONLY. Local records, visible example codes, no server or real authentication.
   Role selectors represent separate fixture people; localStorage is not a secure device credential. */
var accountAccess;
if(typeof launchVerificationNote==='function'){
accountAccess=(()=>{
 const KEY='bnbtico-account-demo-v1',roles=['guest','owner'];
 const state={accounts:{},sessions:{},challenge:null,emailLink:null,recovery:null,recoveryGrant:null,error:'',notice:'',mode:'register',name:'',phone:'',returnTo:null,storageAvailable:true};
 const role=()=>roles.includes(S.role)?S.role:'guest';
 const now=()=>relayNow();
 const user=()=>state.accounts[role()]||null;
 const fail=message=>{state.error=message;return false;};
 const phone=value=>String(value||'').replace(/[\s()-]/g,'');
 const validPhone=value=>/^\+[1-9]\d{7,14}$/.test(value);
 const validEmail=value=>value.length<=254&&/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
 const validPhoto=value=>value===''||(/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(value)&&value.length<=360000);
 function save(){try{localStorage.setItem(KEY,JSON.stringify({accounts:state.accounts,sessions:state.sessions}));}catch{state.storageAvailable=false;}}
 function load(){
  try{
   const data=JSON.parse(localStorage.getItem(KEY)||'{}');
   for(const r of roles){
    const a=data.accounts?.[r],s=data.sessions?.[r];
    if(!a||typeof a.name!=='string'||!a.name.trim()||a.name.length>80||!validPhone(a.phone)||!Number.isInteger(a.version)||a.version<1)continue;
    state.accounts[r]={name:a.name,phone:a.phone,identity:a.identity===true,version:a.version,description:typeof a.description==='string'?a.description.slice(0,1000):'',email:typeof a.email==='string'&&validEmail(a.email)?a.email:'',emailVerified:a.emailVerified===true&&validEmail(String(a.email||'')),photo:typeof a.photo==='string'&&validPhoto(a.photo)?a.photo:''};
    if(s&&s.version===a.version&&Number.isFinite(s.expiresAt))state.sessions[r]={version:s.version,expiresAt:s.expiresAt};
   }
  }catch{state.storageAvailable=false;}
 }
 function session(){const a=user(),s=state.sessions[role()];return !!a&&!!s&&s.version===a.version&&s.expiresAt>now();}
 function sync(){
  for(const r of roles){
   const a=state.accounts[r];if(!a)continue;
   const name=r==='guest'?'Andrea Castro':MY[0].owner,u=adminUsers.items.find(u=>u.name===name);
   if(u)Object.assign(u,{identity:a.identity?'approved':'pending',whatsappVerified:true,displayName:a.name,whatsapp:a.phone});
   if(r==='owner')Object.assign(publication.account,{whatsapp:a.phone,whatsappVerified:true,identityVerified:a.identity});
  }
  S.loggedIn=session();
 }
 function authorize(){state.sessions[role()]={version:user().version,expiresAt:now()+30*DAY_MS};sync();save();}
 function issue(kind,target,name=''){
  const old=state.challenge;
  if(old&&old.role===role()&&old.kind===kind&&old.target===target&&now()<old.sentAt+30000)return fail('Esperá 30 segundos antes de pedir otro código de ejemplo.');
  state.challenge={kind,target,name,role:role(),sentAt:now(),expiresAt:now()+300000,attempts:0};state.error='';state.notice='';return true;
 }
 function start(mode,name,value){
  state.name=String(name||'').trim();state.phone=phone(value);state.mode=mode;state.error='';
  if(!roles.includes(S.role)||!['register','login'].includes(mode))return false;
  if(!validPhone(state.phone))return fail('Indicá el WhatsApp con código de país. Ejemplo ficticio: +506 80000001.');
  if(mode==='register'&&(!state.name||state.name.length>80))return fail('Indicá tu nombre (máximo 80 caracteres).');
  if(mode==='register'&&user())return fail('Ya hay una cuenta de ejemplo para este rol. Elegí Iniciar sesión o Recuperar mi cuenta.');
  if(mode==='login'&&user()?.phone!==state.phone)return fail('No podemos continuar con ese número en esta demo. Revisalo o recuperá tu cuenta.');
  return issue(mode,state.phone,state.name);
 }
 function verify(code){
  const c=state.challenge;
  if(!c||c.role!==role()||c.expiresAt<=now()||c.attempts>=5){state.challenge=null;return fail('El código ya no es válido. Pedí otro código de ejemplo.');}
  c.attempts++;
  if(String(code)!=='123456')return fail('Código incorrecto. En esta demo usá 123456.');
  if(c.kind==='register'){
   if(user())return fail('Esta cuenta ya existe. Iniciá sesión.');
   state.accounts[role()]={name:c.name,phone:c.target,identity:false,version:1,description:'',email:'',emailVerified:false,photo:''};
  }else if(c.kind==='login'){
   if(user()?.phone!==c.target)return fail('El número cambió. Pedí un nuevo código.');
  }else if(c.kind==='change'){
   if(!session()&&!(state.recoveryGrant?.role===role()&&state.recoveryGrant.expiresAt>now()))return fail('Volvé a iniciar sesión o recuperar tu cuenta.');
   user().phone=c.target;user().version++;state.recoveryGrant=null;
  }else return false;
  state.challenge=null;state.error='';state.notice=c.kind==='change'?'Nuevo WhatsApp verificado. Otras autorizaciones quedan revocadas en la simulación.':'WhatsApp verificado · simulación.';
  authorize();return true;
 }
 function logout(){delete state.sessions[role()];state.challenge=null;state.recoveryGrant=null;state.emailLink=null;state.error='';state.mode='login';sync();save();}
 function changePhone(value){
  if(!user()||(!session()&&!(state.recoveryGrant?.role===role()&&state.recoveryGrant.expiresAt>now())))return false;
  const target=phone(value);if(!validPhone(target))return fail('Indicá un WhatsApp con código de país.');
  if(target===user().phone&&!state.recoveryGrant)return fail('Ese es tu WhatsApp actual.');
  return issue('change',target);
 }
 function saveProfile(description,email){
  if(!session())return false;
  const text=String(description||''),address=String(email||'').trim().toLowerCase();
  if(text.length>1000)return fail('La descripción admite hasta 1000 caracteres.');
  if(address&&!validEmail(address))return fail('Revisá el correo electrónico.');
  if(user().email!==address){user().emailVerified=false;state.emailLink=null;}
  Object.assign(user(),{description:text,email:address});state.error='';state.notice='Perfil guardado en este navegador · demo.';save();return true;
 }
 function setPhoto(value){if(!session()||!validPhoto(value))return fail('Usá una imagen PNG, JPG o WebP de hasta 250 KB.');user().photo=value;save();return true;}
 function requestEmail(){
  if(!session()||!user().email)return fail('Guardá un correo válido antes de confirmarlo.');
  state.emailLink={role:role(),email:user().email,expiresAt:now()+15*60000};state.error='';return true;
 }
 function confirmEmail(){
  const link=state.emailLink;
  if(!session()||!link||link.role!==role()||link.email!==user().email||link.expiresAt<=now())return fail('Pedí otro enlace de confirmación.');
  user().emailVerified=true;state.emailLink=null;state.error='';state.notice='Correo confirmado · simulación, no se envió ningún email.';save();return true;
 }
 function recover(email){
  const address=String(email||'').trim().toLowerCase();state.recovery=null;state.recoveryGrant=null;
  if(!user()?.emailVerified||user().email!==address)return fail('No hay un correo confirmado coincidente en esta demo. Pedí ayuda a bnbtico.');
  state.recovery={role:role(),email:address,expiresAt:now()+15*60000};state.error='';return true;
 }
 function confirmRecovery(){
  const link=state.recovery;
  if(!link||link.role!==role()||link.expiresAt<=now()||!user()?.emailVerified||user().email!==link.email)return fail('El enlace ya no es válido. Reiniciá la recuperación.');
  state.recovery=null;state.recoveryGrant={role:role(),expiresAt:now()+15*60000};state.error='';return true;
 }
 function verifyIdentity(){if(!session())return false;user().identity=true;sync();save();return true;}
 function revokeOthers(){if(!session())return false;user().version++;authorize();state.notice='Simulación: las otras autorizaciones quedan revocadas. Este navegador sigue conectado.';return true;}
 load();sync();
 return {state,user,session,start,verify,logout,changePhone,saveProfile,setPhoto,requestEmail,confirmEmail,recover,confirmRecovery,verifyIdentity,revokeOthers,sync};
})();

const accountDemoNote=()=>'<p class="xs muted">Demo sin envíos reales. Usá datos ficticios. Guardamos el perfil de ejemplo y la sesión en este navegador; no es autenticación segura ni vinculación real del teléfono. Las casas y consultas siguen siendo ejemplos.</p>';
const accountFeedback=()=>`${accountAccess.state.error?`<p class="note" role="alert">${safe(accountAccess.state.error)}</p>`:''}${accountAccess.state.notice?`<p class="small" role="status">${safe(accountAccess.state.notice)}</p>`:''}${!accountAccess.state.storageAvailable?'<p class="note">El navegador no permite guardar la sesión. Al recargar tendrás que repetir esta demo.</p>':''}`;
const accountProfileRoute=()=>S.role==='owner'?'o-profile':'profile';
function accountCodeScreen(){
 const c=accountAccess.state.challenge;
 return header('Verificá tu WhatsApp')+`<section class="card stack"><h3>Introducí el código</h3><p>Para ${safe(c.target)}</p><label for="account-code">Código de 6 dígitos</label><input id="account-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="123456"><p class="note small">Código de ejemplo: <b>123456</b>. No enviamos WhatsApp. Válido 5 minutos, máximo 5 intentos.</p><button class="btn btn-primary" data-account="verify">Verificar y continuar</button><button class="btn btn-ghost" data-account="resend">Pedir otro código de ejemplo</button><button class="btn-link" data-account="cancel-code">Cambiar número o volver</button>${accountFeedback()}${accountDemoNote()}</section>`;
}
function accountLoginScreen(){
 if(accountAccess.state.challenge?.role===S.role)return accountCodeScreen();
 const a=accountAccess.state,register=a.mode==='register';
 return header(register?'Creá tu cuenta':'Iniciá sesión',S.role==='guest'?'home':null)+`<section class="card stack"><h3>${register?'Tu nombre y WhatsApp. Nada más.':'Entrá con tu WhatsApp'}</h3><p class="small">${register?'Verificá tu WhatsApp con un código para crear la cuenta.':'Te pediremos un código para autorizar este navegador.'} Verificás tu identidad con Veriff ${S.role==='owner'?'antes de publicar tu primera casa':'antes de contactar a un propietario'}.</p>${register?`<label for="account-name">Nombre</label><input id="account-name" autocomplete="name" maxlength="80" value="${safe(a.name)}" placeholder="Tu nombre">`:''}<label for="account-phone">WhatsApp con código de país</label><input id="account-phone" type="tel" autocomplete="tel" value="${safe(a.phone)}" placeholder="+506 80000001"><button class="btn btn-primary" data-account="start">${register?'Crear cuenta':'Recibir código'}</button><button class="btn-link" data-account="mode">${register?'Ya tengo cuenta · Iniciar sesión':'Crear una cuenta'}</button><button class="btn-link" data-account="recovery">No tengo acceso a mi WhatsApp</button>${accountFeedback()}${accountDemoNote()}</section>`;
}
SCREENS.login=accountLoginScreen;
launchVerificationNote=()=>`<div class="note small"><span><b>La misma verificación para ambas partes.</b> ${S.role==='owner'?'Los clientes verifican su identidad con Veriff antes de contactarte, igual que vos antes de publicar.':'Los propietarios verifican su identidad con Veriff antes de publicar, igual que vos antes de contactarlos.'} Todos verifican su WhatsApp al crear la cuenta.</span></div>`;
launchVerification=()=>{
 const a=accountAccess.user(),u=adminUsers.items.find(u=>u.name===adminSelfName()),verified=a?a.identity:u?.identity==='approved';
 return `${u?.active===false?'<div class="note">Cuenta desactivada. Conservás tu historial y ayuda, pero no podés publicar ni contactar.</div>':''}<section class="card stack"><h3>Tu verificación</h3><p>WhatsApp: ${a||u?.whatsappVerified?'verificado':'pendiente'}</p><p>Identidad (Veriff): ${verified?'verificada':'pendiente'}</p><p class="small">${S.role==='owner'?'Podés preparar tu anuncio ahora. Verificá tu identidad antes de publicar tu primera casa.':'Podés explorar y guardar favoritos. Verificá tu identidad antes de contactar a un propietario.'} Tu WhatsApp se verifica al crear la cuenta.</p>${launchVerificationNote()}${!verified?'<button class="btn btn-primary" data-go="account-identity">Verificar mi identidad</button>':''}<p class="xs muted">Estados simulados: no comprobamos documentos ni enviamos códigos reales.</p></section>`;
};
function accountProfileScreen(){
 if(!accountAccess.session())return accountLoginScreen();
 const a=accountAccess.user();
 return header('Mi perfil')+`<section class="card stack"><h3>${safe(a.name)}</h3><p>${safe(a.phone)} · WhatsApp verificado</p>${a.photo?`<img src="${safe(a.photo)}" alt="Foto de perfil" style="width:88px;height:88px;border-radius:50%;object-fit:cover">`:''}<label for="account-photo">Foto de perfil (opcional)</label><input id="account-photo" type="file" accept="image/png,image/jpeg,image/webp"><p class="xs muted">Imagen de prueba, máximo 250 KB. Solo se guarda en este navegador.</p>${a.photo?'<button class="btn-link" data-account="remove-photo">Quitar foto</button>':''}<label for="account-description">Descripción (opcional)</label><textarea id="account-description" rows="3" maxlength="1000" placeholder="Contanos un poco sobre vos">${safe(a.description)}</textarea><label for="account-email">Correo electrónico (opcional)</label><input id="account-email" type="email" autocomplete="email" value="${safe(a.email)}" placeholder="nombre@ejemplo.com"><p class="small">Añadí un correo para recuperar tu cuenta si perdés acceso a tu WhatsApp.</p><button class="btn btn-primary" data-account="save-profile">Guardar perfil</button>${a.email?`<p class="small">Correo ${a.emailVerified?'confirmado':'pendiente de confirmar'} · demo</p>${a.emailVerified?'':'<button class="btn btn-ghost" data-account="email-request">Confirmar correo</button>'}`:''}${accountAccess.state.emailLink?'<p class="note small">En la app recibirías un enlace por correo. Aquí no se envía ningún email.</p><button class="btn btn-ghost" data-account="email-confirm">Simular apertura del enlace de confirmación</button>':''}${accountFeedback()}</section>${launchVerification()}<section class="card stack"><h3>Acceso a tu cuenta</h3><p class="small">Sesión recordada en este navegador. En otro dispositivo necesitarás un código por WhatsApp.</p><button class="btn btn-ghost" data-account="phone">Cambiar WhatsApp</button><button class="btn btn-ghost" data-account="revoke">Cerrar otras sesiones</button><button class="btn btn-ghost" data-account="logout">Cerrar sesión</button></section>${S.role==='owner'?'<button class="btn btn-ghost" data-go="o-sub">Promoción y suscripción</button>':'<button class="btn btn-primary" data-go="contacts">Mis contactos</button><button class="btn btn-ghost" data-role-switch="owner">¿Tenés una casa? Publicala</button>'}${launchHelp()}${accountDemoNote()}`;
}
SCREENS.profile=SCREENS['o-profile']=accountProfileScreen;
SCREENS['account-email-offer']=()=>header('Tu cuenta está lista')+`<section class="card stack"><h3>Protegé el acceso a tu cuenta</h3><p>Tu WhatsApp ya está verificado. Añadí un correo para recuperar tu cuenta si perdés acceso a ese número.</p><p class="small">Es opcional. Podés añadirlo y confirmarlo después en Mi perfil.</p><button class="btn btn-primary" data-go="${accountProfileRoute()}">Añadir correo a mi perfil</button><button class="btn btn-ghost" data-account="continue">Ahora no · continuar</button>${accountDemoNote()}</section>`;
SCREENS['account-phone']=()=>accountAccess.state.challenge?accountCodeScreen():header('Cambiar WhatsApp',accountAccess.session()?accountProfileRoute():'account-recovery')+`<section class="card stack"><p>Verificá el nuevo WhatsApp antes de sustituir el anterior. Conservás tu cuenta y tu verificación de identidad. Al completar el cambio se revocan las demás sesiones.</p>${S.role==='owner'?'<p class="small">Los WhatsApps propios de cada casa no se cambian automáticamente. Podés revisarlos desde Editar casa.</p>':''}<label for="account-new-phone">Nuevo WhatsApp con código de país</label><input id="account-new-phone" type="tel" placeholder="+506 80000002"><button class="btn btn-primary" data-account="change-phone">Verificar nuevo WhatsApp</button>${accountFeedback()}${accountDemoNote()}</section>`;
SCREENS['o-whatsapp']=SCREENS['account-phone'];
SCREENS['account-recovery']=()=>header('Recuperar mi cuenta','login')+`<section class="card stack"><p>Usá el correo que añadiste y confirmaste en tu perfil. Después podrás verificar tu nuevo WhatsApp para recuperar el acceso.</p><label for="account-recovery-email">Correo confirmado</label><input id="account-recovery-email" type="email"><button class="btn btn-primary" data-account="recover">Recuperar con mi correo</button>${accountAccess.state.recovery?'<p class="note">Enlace de ejemplo preparado. No se envió ningún correo.</p><button class="btn btn-ghost" data-account="recover-confirm">Simular apertura del enlace de recuperación</button>':''}${accountFeedback()}<h3>¿No tenés un correo confirmado?</h3><p class="small">Pedí ayuda a bnbtico para revisar la recuperación. Indicar tu nombre y otro número no basta para recuperar una cuenta. No mandés documentos ni códigos por este formulario.</p><button class="btn btn-ghost" data-go="support-info">Pedir ayuda a bnbtico</button>${accountDemoNote()}</section>`;
SCREENS['account-identity']=()=>header('Verificá tu identidad',accountProfileRoute())+`<section class="card stack"><p>${S.role==='owner'?'Antes de publicar tu primera casa':'Antes de contactar a un propietario'}, completá la verificación de identidad con Veriff. Tu WhatsApp ya está verificado.</p>${launchVerificationNote()}<p class="note">Simulación: no subas documentos ni fotos. No hay conexión con Veriff.</p><button class="btn btn-primary" data-account="identity">Simular verificación aprobada</button></section>`;
const accountOldChrome=chrome;
chrome=body=>{
 const restricted=S.role==='owner'||['profile','contacts','favs','account-email-offer','account-identity'].includes(S.screen);
 const recoveryAllowed=['login','account-recovery','support-info'].includes(S.screen)||(S.screen==='account-phone'&&accountAccess.state.recoveryGrant?.expiresAt>relayNow());
 return accountOldChrome(restricted&&!recoveryAllowed&&!accountAccess.session()&&S.role!=='admin'&&S.role!=='landing'?accountLoginScreen():body);
};
const accountOldRole=setRole;
setRole=r=>{accountAccess.state.challenge=null;accountAccess.state.emailLink=null;accountAccess.state.recovery=null;accountAccess.state.recoveryGrant=null;accountAccess.state.error='';accountAccess.state.notice='';accountAccess.state.returnTo=null;S.role=r;accountAccess.state.mode=accountAccess.user()?'login':'register';accountAccess.state.name='';accountAccess.state.phone='';accountAccess.sync();accountOldRole(r);};
const accountOldOpen=relayOpenHouse;
relayOpenHouse=id=>{
 if(accountAccess.user())accountAccess.sync();
 const result=accountOldOpen(id);
 if(S.role==='guest'&&accountAccess.session()&&!accountAccess.user().identity){accountAccess.state.returnTo={screen:'detail',id};S.toast=null;go('account-identity');return false;}
 return result;
};
const accountOldPublication=SCREENS['o-new'];
SCREENS['o-new']=()=>accountOldPublication()+(S.wizStep===5&&accountAccess.session()&&!accountAccess.user().identity?'<section class="card stack"><p>Tu borrador se conserva. Verificá tu identidad antes de enviarlo a revisión.</p><button class="btn btn-primary" data-account="publish-identity">Verificar identidad para publicar</button></section>':'');
function accountContinue(){
 const dest=accountAccess.state.returnTo;accountAccess.state.returnTo=null;
 if(dest)go(dest.screen,{id:dest.id});else go(S.role==='owner'?'o-dash':'home');
}
document.addEventListener('change',e=>{
 if(e.target.id!=='account-photo')return;
 const file=e.target.files?.[0],r=S.role;if(!file)return;
 if(!['image/png','image/jpeg','image/webp'].includes(file.type)||file.size>250000){accountAccess.state.error='Usá una imagen PNG, JPG o WebP de hasta 250 KB.';render();return;}
 const reader=new FileReader();reader.onload=()=>{if(S.role!==r||!accountAccess.session())return;accountAccess.setPhoto(String(reader.result));render();};reader.onerror=()=>{accountAccess.state.error='No pudimos leer esa imagen.';render();};reader.readAsDataURL(file);
});
document.addEventListener('click',e=>{
 const el=e.target.closest('[data-account]');if(!el)return;e.stopImmediatePropagation();
 const action=el.dataset.account,a=accountAccess.state,value=id=>document.getElementById(id)?.value||'';
 if(action==='mode'){a.mode=a.mode==='register'?'login':'register';a.error='';render();return;}
 if(action==='start'){
  if(!a.returnTo&&S.params.after==='contact')a.returnTo={screen:'detail',id:S.params.id};
  else if(!a.returnTo&&S.role==='owner'&&S.screen!=='login')a.returnTo={screen:S.screen,id:S.params.id};
  accountAccess.start(a.mode,value('account-name'),value('account-phone'));render();return;
 }
 if(action==='verify'){const kind=a.challenge?.kind;if(accountAccess.verify(value('account-code'))){go(kind==='register'?'account-email-offer':accountProfileRoute());}else render();return;}
 if(action==='resend'){const c=a.challenge;if(c){if(c.kind==='change')accountAccess.changePhone(c.target);else accountAccess.start(c.kind,c.name,c.target);}render();return;}
 if(action==='cancel-code'){const change=a.challenge?.kind==='change';a.challenge=null;a.error='';go(change?'account-phone':'login');return;}
 if(action==='continue'){accountContinue();return;}
 if(action==='save-profile'){accountAccess.saveProfile(value('account-description'),value('account-email'));render();return;}
 if(action==='remove-photo')accountAccess.setPhoto('');
 if(action==='email-request')accountAccess.requestEmail();
 if(action==='email-confirm')accountAccess.confirmEmail();
 if(action==='phone'){a.error='';a.notice='';go('account-phone');return;}
 if(action==='change-phone'){accountAccess.changePhone(value('account-new-phone'));render();return;}
 if(action==='revoke')accountAccess.revokeOthers();
 if(action==='logout'){accountAccess.logout();go('login');return;}
 if(action==='recovery'){a.challenge=null;a.error='';go('account-recovery');return;}
 if(action==='recover')accountAccess.recover(value('account-recovery-email'));
 if(action==='recover-confirm'){if(accountAccess.confirmRecovery())go('account-phone');else render();return;}
 if(action==='publish-identity'){a.returnTo={screen:'o-new'};go('account-identity');return;}
 if(action==='identity'){if(accountAccess.verifyIdentity())accountContinue();return;}
 render();
},true);
render();
}
