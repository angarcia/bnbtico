// Verificación: WhatsApp obligatorio, identidad (Veriff) opcional · 2026-10-13
// Publicar y contactar solo exigen WhatsApp verificado. Veriff se sugiere al contactar y al publicar,
// pero se puede saltar. Cada parte ve qué verificaciones tiene la otra.
function userVerification(name){
  const u=adminUsers.items.find(u=>u.name===name);
  return {exists:!!u,active:!u||u.active!==false,whatsapp:!!u&&u.whatsappVerified===true,identity:!!u&&u.identity==='approved'};
}
function verificationBadges(name,size=''){
  const v=userVerification(name),cls=size?` ${size}`:'';
  return `<span class="row" style="gap:6px;flex-wrap:wrap"><span class="badge${v.whatsapp?' badge-ok':' badge-mute'}${cls}" title="Acceso al número comprobado con un código por WhatsApp">${v.whatsapp?'✓ ':''}WhatsApp ${v.whatsapp?'verificado':'pendiente'}</span>${v.identity?`<span class="badge badge-ok${cls}" title="Documento, rostro y prueba de persona real comprobados con Veriff">${I.shield} Identidad verificada</span>`:`<span class="badge badge-mute${cls}" title="Verificación de identidad opcional, no realizada">Identidad sin verificar</span>`}</span>`;
}
// 1. Requisito de contacto/publicación: solo cuenta activa y WhatsApp verificado.
houseVerified=name=>{const v=userVerification(name);return v.exists&&v.active&&v.whatsapp;};
// 2. Enviar a revisión no exige identidad; el estado de identidad del envío se conserva tal cual.
{const previous=publicationSubmit;publicationSubmit=(...args)=>{const was=publication.account.identityVerified;publication.account.identityVerified=true;try{return previous(...args);}finally{publication.account.identityVerified=was;}};}
// (La cola de admin toma el estado de identidad al sincronizar, ya con el valor real restaurado.)
// 3. Aprobar un anuncio no exige identidad del propietario.
{const previous=moderateListing;moderateListing=(index,status,reason='')=>{const q=S.queue[index],was=q?.identityStatus;if(q&&status==='ok')q.identityStatus='approved';try{return previous(index,status,reason);}finally{if(q)q.identityStatus=was;}};}
{const previous=SCREENS['a-review'];SCREENS['a-review']=()=>previous()
  .replace('<p class="note">Identidad pendiente: no podés aprobar el anuncio ni verificar manualmente al usuario.</p>','<p class="small muted">Identidad (Veriff) sin verificar: es opcional y no impide aprobar el anuncio.</p>')
  .replace(/(data-admin-decision="ok") disabled(?=>Aprobar anuncio)/,(m,a)=>{const q=typeof adminCurrentReview==='function'?adminCurrentReview():null;return q&&q.listing&&q.listing.photoCount>=5?a:m;});}
{const previous=adminDecide;adminDecide=(status,reason)=>{const ok=previous(status,reason);if(!ok&&/identidad debe estar aprobada/i.test(adminReview.error))adminReview.error='Pedí al menos 5 fotos antes de aprobar.';return ok;};}
// 4. Administración puede crear consultas para clientes sin Veriff.
{const previous=conciergeValid;conciergeValid=d=>{const u=conciergeUser(d?.clientId),was=u?.identity;if(u)u.identity='approved';try{return previous(d);}finally{if(u)u.identity=was;}};}
// 5. Sugerir Veriff al contactar, con opción de saltarla.
{const previous=relayOpenHouse;relayOpenHouse=id=>{
  const acc=typeof accountAccess==='object'&&accountAccess?accountAccess:null,a=acc?acc.user():null;
  if(!acc)return previous(id);
  if(S.role==='guest'&&acc.session()&&a&&!a.identity&&!acc.state.identitySkipped){
    // Guardar lo escrito en la ficha antes de ir a la sugerencia de Veriff, para restaurarlo al volver.
    if(typeof calendarContactDrafts!=='undefined'&&S.screen==='detail'&&S.params.id===id){const g=k=>document.getElementById(k)?.value||'';const prev=calendarContactDrafts.get(id)||{};calendarContactDrafts.set(id,{...prev,arrival:g('d-in'),departure:g('d-out'),people:g('d-ppl'),kids:parseInt(g('d-kids'),10)||0});}
    acc.state.returnTo={screen:'detail',id,resume:'contact'};S.toast=null;go('account-identity');return false;}
  const was=a?a.identity:true;if(a&&!a.identity)a.identity=true;try{return previous(id);}finally{if(a){a.identity=was;acc.sync();}}
};}
SCREENS['account-identity']=()=>{
  const owner=S.role==='owner';
  return header('Verificá tu identidad · opcional',S.role==='owner'?'o-profile':'profile')+`<section class="card stack"><p><b>Tu WhatsApp ya está verificado</b>, que es lo único necesario para ${owner?'publicar':'contactar'}.</p><p>${owner?'Si además verificás tu identidad con Veriff (documento, rostro y prueba de persona real), tu casa muestra el sello <b>Identidad verificada</b> y los clientes te escriben con más confianza.':'Si además verificás tu identidad con Veriff (documento, rostro y prueba de persona real), el propietario verá el sello <b>Identidad verificada</b> junto a tu nombre y te responderá con más confianza.'} Podés hacerlo ahora o más tarde desde tu cuenta.</p><p class="xs muted">Simulación: no subas documentos ni fotos. No hay conexión con Veriff.</p><button class="btn btn-primary" data-account="identity">Verificar ahora · simulación</button><button class="btn btn-ghost" data-identity-skip>Continuar sin verificar</button></section>`;
};
{const previous=SCREENS['o-new'];SCREENS['o-new']=()=>previous()
  .replace('<p>Tu borrador se conserva. Verificá tu identidad antes de enviarlo a revisión.</p>','<p><b>Recomendado:</b> verificá tu identidad con Veriff para que tu casa muestre el sello Identidad verificada. Es opcional: podés enviar el anuncio sin hacerlo.</p>')
  .replace('>Verificar identidad para publicar<','>Verificar identidad · opcional<');}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-identity-skip]');if(!button)return;
  event.stopImmediatePropagation();
  accountAccess.state.identitySkipped=true;
  const dest=accountAccess.state.returnTo;accountAccess.state.returnTo=null;
  if(dest?.resume==='contact'&&dest.id){
    // Conservar lo que la persona ya había escrito en la ficha (fechas, personas, niños) al volver tras saltar Veriff.
    const saved=typeof calendarContactDrafts!=='undefined'?{...(calendarContactDrafts.get(dest.id)||{})}:{};
    go('detail',{id:dest.id});
    const set=(id,v)=>{const el=document.getElementById(id);if(el&&v!==undefined&&v!==null&&v!=='')el.value=v;};
    set('d-in',saved.arrival);set('d-out',saved.departure);set('d-ppl',saved.people);set('d-kids',saved.kids);
    relayOpenHouse(dest.id);return;
  }
  if(dest)go(dest.screen,{id:dest.id});else go(S.role==='owner'?'o-dash':'home');
});
// 6. Sellos visibles para la otra parte.
{const previous=listingCard;listingCard=h=>previous(h).replace(verified(h.ownerV),verificationBadges(h.owner,'xs'));}
{const previous=SCREENS.detail;SCREENS.detail=()=>{
  const h=HOUSES.find(x=>x.id===S.params.id)||HOUSES[0];
  return previous()
    .replace(verified(h.ownerV),verificationBadges(h.owner))
    .replace(`Owner ${h.ownerV?"verificado con cédula":"en revisión"} · responde en ~1 h · en 3bstays desde 2026`,`Publica en 3bstays desde 2026 · responde en ~1 h`)
    .replace(`<b>${h.owner}</b>`,`<b>${h.owner}</b>${verificationBadges(h.owner,'xs')}`)
    .replace('Para contactar necesitás cuenta, identidad verificada con Veriff y WhatsApp verificado. Contacto directo no significa contacto sin verificar. Los números se comparten al continuar por WhatsApp.','Para contactar necesitás cuenta con WhatsApp verificado. La verificación de identidad con Veriff es opcional y se muestra como sello a la otra parte. Los números se comparten al continuar por WhatsApp.')
    .replace('1. Verificás tu cuenta y aceptás compartir tu número.','1. Creás tu cuenta con tu WhatsApp y aceptás compartir tu número.');
};}
{const previous=SCREENS['o-leads'];SCREENS['o-leads']=()=>previous().replace(/<article class="card stack"><b>([^<]+)<\/b>/g,(m,name)=>`<article class="card stack"><b>${name}</b>${verificationBadges(name,'xs')}`);}
{const previous=sheet;sheet=()=>{const s=S.sheet,html=previous();if(s?.type==='launch-contact'&&S.role==='guest'){const h=HOUSES.find(x=>x.id===s.id);if(h)return html.replace(`<b>${safe(h.t)}</b>`,`<b>${safe(h.t)}</b><p class="small">${safe(h.owner)} ${verificationBadges(h.owner,'xs')}</p>`);}return html;};}
// 7. Textos generales.
const verificationCopy=[
  ['con identidad y WhatsApp verificados','con WhatsApp verificado'],
  ['identidad y WhatsApp verificados','WhatsApp verificado'],
  ['Verificá identidad y WhatsApp.','Verificá tu WhatsApp; la identidad con Veriff es opcional.'],
  ['verificá identidad y WhatsApp.','verificá tu WhatsApp; la identidad con Veriff es opcional.'],
  ['deben verificar su identidad y su WhatsApp','deben verificar su WhatsApp (la identidad es opcional)'],
  ['Necesitás identidad y WhatsApp verificados para contactar.','Necesitás WhatsApp verificado para contactar.'],
  ['Ambas verificaciones son necesarias para publicar o contactar, incluso con WhatsApp directo. Explorar, registrarse y preparar un borrador no las requieren.','Solo el WhatsApp verificado es necesario para publicar o contactar. La identidad con Veriff es opcional y se muestra como sello.'],
  ['Propietario y cliente con identidad verificada','Propietario y cliente con WhatsApp verificado; identidad opcional con Veriff']
];
function verificationStrip(html){let out=String(html);for(const [a,b] of verificationCopy)out=out.split(a).join(b);return out;}
// La landing comercial se conserva tal cual (ver launch-scope.cjs); su copy de confianza queda anotado para la revisión de textos.
for(const key of Object.keys(SCREENS)){if(key==='landing')continue;const previous=SCREENS[key];if(typeof previous==='function')SCREENS[key]=(...args)=>verificationStrip(previous(...args));}
{const previous=sheet;sheet=()=>verificationStrip(previous());}
for(const k of Object.keys(NOTES))NOTES[k]=verificationStrip(NOTES[k]);
{const previous=toast;toast=t=>previous(verificationStrip(t));}
// 8. Catálogo: las casas de propietarios con identidad verificada aparecen primero (orden estable dentro de cada grupo).
{const previous=filtered;filtered=()=>previous().map((h,i)=>[h,i]).sort((a,b)=>(Number(userVerification(b[0].owner).identity)-Number(userVerification(a[0].owner).identity))||(a[1]-b[1])).map(x=>x[0]);}
verificationCopy.push(['casas · precios orientativos, acordalos con el owner','casas · precios orientativos, acordalos con el owner. Primero, las de propietarios con identidad verificada.']);
// Fixture de demo: dos propietarios de ejemplo sin Veriff para que el orden y los sellos se vean en el catálogo.
for(const name of ['Don Álvaro','Nadia V.']){const u=adminUsers.items.find(u=>u.name===name);if(u)u.identity='pending';}

render();
