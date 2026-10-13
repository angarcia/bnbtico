/* Lanzamiento centrado en publicar casas. Conserva las exploraciones, fuera de la UI inicial. */
const launchDeferred=new Set(['request','my-requests','o-requests','assisted','o-verify']);
for(const key of launchDeferred)delete SCREENS[key];
NAV.guest=NAV.guest.filter(([key])=>!launchDeferred.has(key));
NAV.owner=NAV.owner.filter(([key])=>!launchDeferred.has(key));
NOTES.owner='Publicá y compartí tus casas, mantené su disponibilidad y recibí consultas de clientes verificados.';
const launchChrome=chrome;
chrome=body=>launchChrome(body).replace('<nav class="tabs',`<nav style="grid-template-columns:repeat(${NAV[S.role].length},minmax(0,1fr))" class="tabs`);
const launchGo=go;
go=(screen,params={})=>launchGo(launchDeferred.has(screen)?ROOT[S.role]:screen,params);
submitHouseRequest=()=>false;
requestProcessDue=()=>{};
requestScheduleDistribution=()=>{};
if(requestDistributionTimer!==null)clearTimeout(requestDistributionTimer);
calendarConsultations.visibleHouses.clear();calendarSearches.visibleHouses.clear();
calendarSetConsultations=()=>false;calendarSetSearches=()=>false;
const launchCleanCopy=body=>body.replaceAll('Las búsquedas de «Buscan casa» no cambian.','').replaceAll('No afecta a «Buscan casa».','').replaceAll('No afecta a «Buscan casa», no cambia','No cambia').replaceAll('Valoralos después de hablar: tu valoración la ven otros propietarios.','').replace(/Solo afecta a esta casa, no a las búsquedas compartidas de «(?:Solicitudes|Buscan casa)»\./g,'Solo afecta a esta casa.').replaceAll('No cambia las búsquedas compartidas.','');
SCREENS.home=()=>home().replace(/<div class="map" style="order:-1">[\s\S]*?<span class="badge tag">Mapa · Costa Rica<\/span><\/div>/,'').replace('class="home-layout"','class="stack"');
SCREENS.filters=()=>filters().replace(/<div class="note"><span>¿No encontrás[\s\S]*?<\/span><\/div>/,'');
const launchLogin=SCREENS.login;
SCREENS.login=()=>launchLogin().replace('Los owners ven tu nombre y tu puntuación como cliente. Esto los ayuda a confiar en vos y responderte rápido.','Podés registrarte sin verificarte. Antes de contactar una casa necesitarás identidad y WhatsApp verificados.').replace('Simulamos una identidad ya verificada','Simulamos identidad y WhatsApp ya verificados');
function launchVerification(){
  const u=adminUsers.items.find(u=>u.name===adminSelfName());
  return `${u?.active===false?'<div class="note">Cuenta desactivada: no podés publicar ni iniciar o aceptar contactos. Tu historial, ayuda y reclamaciones siguen disponibles.</div>':''}<div class="card stack"><h3>Tu verificación</h3><span>Identidad (Veriff): ${u?.identity==='approved'?'verificada':'pendiente'}</span><span>WhatsApp: ${u?.whatsappVerified?'verificado':'pendiente'}</span><p class="small">Ambas verificaciones son necesarias para publicar o contactar, incluso con WhatsApp directo. Explorar, registrarse y preparar un borrador no las requieren.</p>${launchVerificationNote()}<p class="xs muted">Estados simulados. Esta demo no comprueba documentos ni envía códigos.</p></div>`;
}
function launchVerificationNote(){return '<div class="note small"><span><b>La misma verificación para ambas partes.</b> Los clientes pasan por las mismas comprobaciones que los propietarios: identidad con Veriff y verificación de WhatsApp. Vos las completás antes de publicar; ellos, antes de contactarte.</span></div>';}
const launchHelp=()=>'<button class="btn btn-ghost" data-go="claims">Reclamaciones y ayuda</button><button class="btn btn-ghost" data-go="support-info">WhatsApp de soporte bnbtico</button>';
SCREENS.profile=()=>!S.loggedIn?SCREENS.login():header('Mi cuenta')+`<div class="card"><b>Andrea Castro</b></div>${launchVerification()}<button class="btn btn-primary" data-go="contacts">Mis contactos</button><button class="btn btn-ghost" data-role-switch="owner">¿Tenés una casa? Publicala</button>${launchHelp()}`;
SCREENS['o-profile']=()=>header('Cuenta')+`<div class="card"><b>${safe(adminSelfName())}</b></div>${launchVerification()}<button class="btn btn-ghost" data-go="o-whatsapp">WhatsApp de mi cuenta</button><button class="btn btn-ghost" data-go="o-sub">Promoción y suscripción</button>${launchHelp()}`;
function launchPromotion(){
  const n=HOUSES.filter(h=>h.ownerV).length+publication.submitted.filter(h=>h.status==='approved-demo').length;
  return `<section class="card stack"><span class="eyebrow">Promoción de lanzamiento · demo</span><h3>Publicá tu casa sin comisiones por alquiler</h3><p>Primeras 50 casas: <b>1 año gratis</b>. Siguientes 50: <b>6 meses gratis</b>. Siguientes 100: <b>3 meses gratis</b>.</p><p class="small">${n} casas de ejemplo · ${Math.max(0,50-n)} plazas hasta completar el primer tramo de 50. Cada casa ocupa una plaza, también si publicás varias.</p><p class="xs muted">Contador simulado, no plazas reales. Tarifa posterior prevista: ₡9.900 al mes por casa. Condiciones e inicio del período por confirmar antes del lanzamiento. No se realiza ningún cobro aquí.</p></section>`;
}
SCREENS['o-sub']=()=>header('Promoción y suscripción','o-profile')+launchPromotion();
const launchOwnerCard=ownerCard;
ownerCard=h=>launchOwnerCard(h).replace(`${h.views} vistas · ${h.contacts} contactos · `,'').replace('<div class="house-actions">',`<button class="btn btn-primary" style="width:100%;margin-top:12px" data-launch-share="${h.id}" ${houseAvailable(h.id)?'':'disabled'}>Compartir ficha</button><p class="xs muted" style="margin-top:6px">Invitá a tus clientes a contactarte con identidad y WhatsApp verificados.</p><div class="house-actions">`);
const launchShareTip=(withAction=false)=>`<section class="card stack" style="border:1px solid var(--primary);background:var(--primary-soft,#fff0f3);gap:10px"><span class="eyebrow">Recomendado para tus clientes</span><h3>Compartí tu ficha con tus clientes</h3><p>Enviá el enlace por WhatsApp o compartilo en tus redes. Pueden ver la ficha sin registrarse; para contactarte desde bnbtico, deben verificar su identidad y su WhatsApp.</p><p class="small muted">Así, las consultas que recibís desde bnbtico vienen de clientes verificados. No verifica contactos externos ni garantiza una reserva segura.</p>${withAction?'<button class="btn btn-primary" data-go="o-houses">Elegir una casa para compartir</button>':''}</section>`;
const launchHouses=SCREENS['o-houses'];
SCREENS['o-houses']=()=>launchCleanCopy(launchHouses()).replace('<div class="listings">',launchShareTip()+'<div class="listings">').replace(/<div class="card small"><b>Pago por casa<\/b>[\s\S]*?<\/div><\/div>/,'')+launchPromotion();
SCREENS['o-dash']=()=>houseActionsStyle+header('Tu panel',null,'<button class="btn btn-primary" data-go="o-new">Publicá tu casa</button>')+launchShareTip(true)+`<div class="card stack"><b>Mis consultas · ${ownerPending('o-leads')} pendientes</b><p>Personas interesadas en una de tus casas concretas.</p><button class="btn btn-primary" data-go="o-leads">Ver mis consultas</button></div><div class="row between"><h3>Mis casas</h3><button class="btn-link" data-go="o-houses">Ver todas</button></div><div class="listings">${MY.map(ownerCard).join('')}</div>`;
const launchLeads=SCREENS['o-leads'];
SCREENS['o-leads']=()=>launchCleanCopy(launchLeads())
  .replace(/<span class="score">[\s\S]*?<\/span><\/span>/g,'')
  .replace(/<button class="chip">Sin valorar<\/button>/g,'')
  .replace(/<div class="row" style="gap:8px;margin-top:6px;flex-wrap:wrap"><div class="ratebtn"[\s\S]*?<\/div><span class="(?:badge badge-ok|xs muted)">(?:Valorado|Valorar)<\/span><\/div>/g,'');
const launchDetail=SCREENS.detail;
const launchDetailBody=()=>launchDetail().replace('data-toast="Enlace copiado"',`data-launch-share="${safe(S.params.id||HOUSES[0].id)}"`)+`<p class="small note">Para contactar necesitás cuenta, identidad verificada con Veriff y WhatsApp verificado. Contacto directo no significa contacto sin verificar. Los números se comparten al continuar por WhatsApp.</p>`;
SCREENS.detail=launchDetailBody;
const launchOwnerDetail=SCREENS['o-house'];
SCREENS['o-house']=()=>launchOwnerDetail().replace('data-toast="Enlace copiado"',`data-launch-share="${safe(S.params.id||MY[0].id)}"`);
SCREENS.landing=()=>`<section class="hero"><div class="stack"><span class="eyebrow">bnbtico · lanzamiento</span><h1>Tu casa publicada. Tu contacto, bajo tu control.</h1><p>Una ficha para mostrar y compartir tu alojamiento. Clientes con identidad y WhatsApp verificados te consultan por tu casa; acordás los detalles directamente, sin comisiones por alquiler.</p><div class="row" style="flex-wrap:wrap"><button class="btn btn-primary" data-role-switch="owner">Publicá tu casa</button><button class="btn btn-ghost" data-role-switch="guest">Explorar casas</button></div></div>${photo('p-playa','Alojamiento de ejemplo')}</section>${launchPromotion()}<section class="how"><div class="card stack"><b>1. Prepará tu anuncio</b><p>Fotos, descripción, zona y precio orientativo. Guardá el borrador y completá las verificaciones antes de publicar.</p></div><div class="card stack"><b>2. Compartí tu ficha</b><p>Una presentación de tu casa con un enlace para compartir.</p></div><div class="card stack"><b>3. Recibí consultas</b><p>Elegí contacto directo o revisá cada consulta en bnbtico. En ambos casos el cliente debe estar verificado.</p></div></section><div class="note">bnbtico no gestiona reservas ni pagos entre las partes. Verificar identidad no garantiza la propiedad de la casa ni evita todos los fraudes.</div>`;
// Retain the selection/availability editor; expose only the usual nightly price.
SCREENS['o-cal']=()=>{
  let body=calendarConsultationScreen();const e=calendarEditor,h=HOUSES.find(h=>h.id===e.house);
  if(!h||!calendarEditable(h.id))return body;
  const panel=`<details class="card calendar-rates" id="calendar-rates" ${e.configOpen?'open':''}><summary>Precio habitual · ${calendarMoney(h,calendarState(h.id).rates.base)}</summary><div class="stack"><label for="launch-base">Precio por noche (${h.cur})</label><input id="launch-base" type="number" min="0.01" step="0.01" value="${safe(e.config.base)}"><p class="small muted">Se aplica a los días sin precio especial. Los precios son orientativos.</p><button class="btn btn-primary" data-launch-save-base>Guardar precio</button></div></details>`;
  return body.replace(/<details class="card calendar-rates"[\s\S]*?<\/details>/,panel);
};
function launchSaveBase(id,price){
  if(!calendarEditable(id)||!calendarValidPrice(price))return false;
  const ok=calendarConfigure(id,{...calendarConfigValues(id),base:price});
  if(ok){calendarEditor.config=calendarConfigValues(id);calendarEditor.configOpen=false;calendarRefreshSelection();}return ok;
}
const launchSheet=sheet;
sheet=()=>S.sheet?.type==='launch-share'?`<div class="sheet" data-close><div class="sheet-body stack" data-stop><div class="row between"><h3>Compartir ficha</h3><button class="chip" data-close-btn>Cerrar</button></div><b>${safe(HOUSES.find(h=>h.id===S.sheet.house)?.t||'Tu casa')}</b><p>Mandales este enlace a tus clientes. Podrán ver tu casa sin registrarse y, para contactarte desde bnbtico, deberán verificar su identidad y su WhatsApp.</p><label for="launch-share-link">Enlace de esta casa</label><input id="launch-share-link" readonly value="${safe(S.sheet.url)}"><button class="btn btn-primary" data-launch-copy>Copiar enlace de mi casa</button><p class="small muted">Pegalo en WhatsApp, tus redes o tu sitio web. No incluye teléfonos.</p><p class="xs muted">Demo: el enlace solo funciona en este ordenador con el servidor local abierto; no es una publicación pública. Las verificaciones también son simuladas.</p></div></div>`:launchCleanCopy(launchSheet());
function launchSharedHouse(hash){const id=String(hash).match(/^#casa=(CT-\d+)$/)?.[1];return id&&houseAvailable(id)?id:null;}
document.addEventListener('input',e=>{if(e.target.id==='launch-base'&&houseManageable(calendarEditor.house))calendarEditor.config.base=e.target.value;});
document.addEventListener('click',async e=>{
  const button=e.target.closest('[data-launch-save-base],[data-launch-share],[data-launch-copy]');if(!button)return;
  e.stopImmediatePropagation();const d=button.dataset;
  if(d.launchSaveBase!==undefined){const ok=launchSaveBase(calendarEditor.house,calendarEditor.config.base);calendarRender();toast(ok?'Precio habitual guardado. Los especiales se conservan.':'Indicá un precio válido.');return;}
  if(d.launchShare){if(!houseAvailable(d.launchShare))return;S.sheet={type:'launch-share',house:d.launchShare,url:location.origin+location.pathname+'#casa='+d.launchShare};render();return;}
  if(d.launchCopy!==undefined&&S.sheet?.type==='launch-share'){try{await navigator.clipboard.writeText(S.sheet.url);toast('Enlace copiado.');}catch{toast('Seleccioná y copiá el enlace del campo.');}}
},true);
if(typeof window!=='undefined'){
  const openShared=()=>{const id=launchSharedHouse(window.location.hash);if(id){S.role='guest';go('detail',{id});}};
  window.addEventListener('hashchange',openShared);openShared();
}
// Lanzamiento: el cliente inicia el chat; el propietario conserva un registro, no una bandeja de aceptación.
const launchHouseSettings=houseSettings;
houseSettings=id=>{const settings=launchHouseSettings(id);settings.direct=true;return settings;};
houseContactDefaults.direct=true;
NOTES.guest='Explorá sin registrarte. Para contactar por WhatsApp, verificá identidad y WhatsApp. Aperturas y verificaciones simuladas en esta demo.';
const launchControls=houseControls;
houseControls=h=>launchControls(h).replace(/<button[^>]*data-house-direct="[^"]+"[^>]*>[\s\S]*?<\/button>/,'');
ownerPending=()=>0; // No hay aceptaciones pendientes en el lanzamiento.
const launchDashboard=SCREENS['o-dash'];
SCREENS['o-dash']=()=>launchDashboard().replace(/Mis consultas · \d+ pendientes/,'Mis consultas').replace('Personas interesadas en una de tus casas concretas.','Registro de clientes que intentaron abrir tu WhatsApp desde una ficha. No confirma que enviaron un mensaje.');
const launchHouseList=SCREENS['o-houses'];
SCREENS['o-houses']=()=>launchHouseList().replace(/<p class="small muted">La preferencia general[\s\S]*?<\/p>/,'').replace(/<button[^>]*disabled>Contacto directo: (?:Sí|No)<\/button>/g,'');
const launchPublicDetail=SCREENS.detail;
SCREENS.detail=()=>launchPublicDetail().replaceAll('Solicitar contacto','Contactar por WhatsApp').replace(/value="2026-12-(?:12|15)"/g,'value=""').replace('>Llegada</label>','>Llegada (opcional)</label>').replace('>Salida</label>','>Salida (opcional)</label>').replace(/<select id="d-ppl">[\s\S]*?<\/select>/,'<input id="d-ppl" type="number" min="1" step="1" placeholder="Opcional">');
SCREENS.landing=()=>`
  <section class="hero">
    <div class="stack" style="gap:16px">
      <span class="badge badge-sun" style="align-self:flex-start">Hecho para alojamientos en Costa Rica</span>
      <h1>Tu casa merece que la encuentren. El trato sigue siendo tuyo.</h1>
      <p>Publicá tu alojamiento en bnbtico, compartí su ficha y recibí consultas de clientes con identidad y WhatsApp verificados. Acordá fechas, precio y condiciones directamente, sin comisiones por alquiler.</p>
      <div class="row" style="gap:10px;flex-wrap:wrap"><button class="btn btn-primary" data-role-switch="owner">Publicar mi casa</button><button class="btn btn-ghost" data-role-switch="guest">Buscar una casa</button></div>
      <div class="row small muted" style="gap:14px;flex-wrap:wrap"><span>0% de comisión por alquiler</span><span>WhatsApp directo</span><span>Identidad y WhatsApp verificados</span></div>
    </div>${photo('p-playa','Tamarindo, Guanacaste · imagen de ejemplo')}
  </section>
  <section class="stack"><span class="eyebrow">Más que pasar tu número</span><h2>Ya alquilás por WhatsApp. Ahora tenés una ficha para mostrar tu casa.</h2><p>Reuní fotos, descripción, características, ubicación aproximada, disponibilidad y precio orientativo en un solo lugar. Compartí ese enlace en tus redes o con tus clientes, y formá parte de un catálogo donde también puedan encontrarte otras personas.</p></section>
  <section class="how" aria-label="Cómo funciona bnbtico">
    <div class="card stack"><span class="eyebrow">1 · Publicás</span><h3>Prepará tu anuncio</h3><p>Agregá fotos, zona y precio orientativo. Podés registrarte y preparar el borrador sin verificarte; antes de publicar completás identidad y WhatsApp.</p></div>
    <div class="card stack"><span class="eyebrow">2 · Te encuentran</span><h3>Compartí tu ficha</h3><p>Cualquiera puede explorar y ver tu casa. Para contactarte desde bnbtico, el cliente también debe verificar su identidad y su WhatsApp.</p></div>
    <div class="card stack"><span class="eyebrow">3 · Hablás directo</span><h3>Los detalles, entre ustedes</h3><p>El cliente abre tu WhatsApp con un mensaje preparado. Respondés allí y acordás fechas, precio y condiciones. bnbtico no gestiona reservas ni pagos entre las partes.</p></div>
  </section>
  <section class="stack" style="gap:16px" aria-label="Precio y promoción">
    <div class="price-box stack" style="gap:14px"><span class="eyebrow">Precio simple · después de la promoción</span><div class="big">₡9.900 <span style="font-size:16px;font-weight:600">/ casa / mes</span></div><h2>Una reserva de fin de semana puede pagar tu mensualidad.</h2><p>No pagás una comisión por cada alquiler. La cuota por casa es la misma aunque alquilés más noches.</p><div style="padding:16px;border:1px solid currentColor;border-radius:12px"><b>Un ejemplo sencillo, no una promesa</b><p class="small">Si un alquiler de fin de semana te deja ₡20.000 después de sus gastos y antes de la suscripción, alcanza para cubrir la cuota mensual prevista de ₡9.900 y quedan ₡10.100. El resultado depende de tus precios, gastos y alquileres reales.</p></div><p class="small">Tarifa prevista, sin permanencia. Condiciones de contratación y cobro por confirmar antes del lanzamiento. No garantizamos consultas, reservas ni ingresos.</p><button class="btn btn-onprimary" data-role-switch="owner">Quiero publicar mi casa</button></div>
    ${launchPromotion()}
  </section>
  <section class="stack"><h2>El WhatsApp de siempre, con una presentación más completa.</h2><div class="card tbl-wrap"><table class="compare"><caption style="text-align:left;padding-bottom:12px">Qué aporta bnbtico al contacto directo</caption><thead><tr><th scope="col">Para tu alojamiento</th><th scope="col">bnbtico</th><th scope="col">Solo pasar tu WhatsApp</th></tr></thead><tbody>
    <tr><th scope="row">Presentación</th><td>Ficha con fotos, detalles y precio orientativo</td><td>Compartís la información en la conversación</td></tr>
    <tr><th scope="row">Visibilidad</th><td>Catálogo público y enlace para compartir</td><td>Personas a las que les llega tu número</td></tr>
    <tr><th scope="row">Verificación</th><td>Identidad y WhatsApp de ambas partes antes del contacto</td><td>Sin la verificación de bnbtico</td></tr>
    <tr><th scope="row">Precio y condiciones</th><td>Los acordás vos con el cliente</td><td>Los acordás vos con el cliente</td></tr>
    <tr><th scope="row">Pagos del alojamiento</th><td>Directamente entre ustedes</td><td>Directamente entre ustedes</td></tr>
    <tr><th scope="row">Comisión de bnbtico</th><td>0% por alquiler; suscripción por casa</td><td>No interviene bnbtico</td></tr>
  </tbody></table></div></section>
  <section class="how"><div class="card stack"><h3>Verificación para ambas partes</h3><p>Propietarios antes de publicar y clientes antes de contactar: identidad con Veriff y comprobación de acceso al WhatsApp. No es una verificación de titularidad ni una garantía contra fraudes.</p></div><div class="card stack"><h3>Una ficha que podés compartir</h3><p>Enviá el enlace en lugar de repetir toda la información. Quien contacte desde bnbtico tendrá que completar las verificaciones; los contactos por fuera de la app no quedan verificados automáticamente.</p></div><div class="card stack"><h3>Un equipo al que podés escribir</h3><p>Atención de bnbtico para propietarios y para quienes buscan alojamiento, con canales separados. Los reportes se revisan en la plataforma; los acuerdos y pagos siguen siendo entre ustedes.</p></div></section>
  <section class="stack"><h2>Así se vería tu casa en el catálogo</h2><p class="small muted">Alojamientos de ejemplo del prototipo, no anuncios reales recién publicados.</p><div class="listings">${HOUSES.filter(h=>houseAvailable(h.id)).slice(0,3).map(listingCard).join('')}</div></section>
  <section class="card stack" style="gap:14px"><h2>Preguntas frecuentes</h2>
    <details><summary><b>¿Puedo seguir usando otras plataformas?</b></summary><p class="small">Sí. Podés usar bnbtico junto con tus otros canales. Mantené la disponibilidad actualizada manualmente; en esta versión no hay sincronización automática.</p></details>
    <details><summary><b>¿Qué pasa si no recibo consultas?</b></summary><p class="small">No garantizamos un número de consultas ni reservas. El período promocional permite probar el servicio y valorar si te aporta; compartir tu ficha ayuda a que tus clientes conozcan el alojamiento.</p></details>
    <details><summary><b>¿Se publica mi teléfono o la dirección exacta?</b></summary><p class="small">El teléfono no aparece al explorar la ficha. Se comparte al contactar por WhatsApp con un cliente verificado; ambos podrán verlo y guardarlo. La ficha muestra la zona aproximada, y vos compartís la dirección exacta cuando lo decidás.</p></details>
    <details><summary><b>¿Qué significa estar verificado?</b></summary><p class="small">Comprobar identidad y acceso al WhatsApp, no la propiedad de la casa ni la fiabilidad de una persona. No garantiza que un alojamiento o una reserva sean seguros.</p></details>
    <details><summary><b>¿bnbtico cobra la reserva o protege un adelanto?</b></summary><p class="small">No. Fechas, condiciones, pagos y devoluciones se acuerdan directamente entre cliente y propietario. bnbtico no retiene dinero ni garantiza reembolsos. Podés reportar un problema para que revisemos cuentas y anuncios.</p></details>
    <details><summary><b>¿Puedo publicar varias casas?</b></summary><p class="small">Sí. La suscripción y las plazas de promoción se cuentan por casa, no por propietario.</p></details>
    <details><summary><b>¿Es obligatorio aceptar largo plazo?</b></summary><p class="small">No. Al publicar elegís Sí o No. Si aceptás, podés indicar un precio mensual orientativo o pedir que te consulten.</p></details>
  </section>
  <section class="card stack" style="text-align:center;align-items:center;padding:28px"><h2>Tu próxima consulta puede empezar con una ficha compartida.</h2><p>Prepará tu anuncio y conocé la promoción de lanzamiento para las primeras 200 casas.</p><button class="btn btn-primary" data-role-switch="owner">Publicar mi casa</button><p class="xs muted">Prototipo: anuncios y contador de ejemplo, verificaciones y contactos simulados. No se realizan cobros ni publicaciones reales.</p></section>`;
const launchRegistration=SCREENS.login;
SCREENS.login=()=>launchRegistration().replace('Solo compartimos contacto cuando el cliente lo solicita y el owner acepta.','El cliente autoriza compartir su contacto al abrir WhatsApp desde la ficha.');
const launchPublish=SCREENS['o-new'];
SCREENS['o-new']=()=>launchPublish()+(S.wizStep===5?launchVerificationNote():'')+'<p class="note small">Al publicar, aceptás recibir contactos directos de clientes con identidad y WhatsApp verificados. Podrán ver y guardar el WhatsApp verificado de esta casa. No se muestra el número al explorar la ficha.</p>';

const launchLead=t=>S.leads.find(l=>l.threadId===t?.id);
function launchContext(data={}){
  const lines=[];
  if(calendarConsultationRange(data))lines.push(`Entrada: ${data.arrival} · Salida: ${data.departure}`);
  if(Number.isInteger(Number(data.people))&&Number(data.people)>0)lines.push(`${Number(data.people)} persona${Number(data.people)===1?'':'s'}`);
  return lines;
}
function launchOwnerMessage(t){
  const h=relayHouse(t),lead=launchLead(t)||{},message=String(lead.msg||'').trim();
  return [`Hola ${t.client.split(' ')[0]}, soy ${h.owner.split(' ')[0]}, de ${h.t}. Vi tu interés en mi casa a través de bnbtico.`,...launchContext(lead),...(message?[`💬 Tu consulta: «${message}»`]:[]),'¿Hablamos de los detalles?'].join('\n\n');
}
function launchClientMessage(id,data={}){
  const h=HOUSES.find(h=>h.id===id);
  return [`Hola, vi ${h.t} (${h.id}) en bnbtico y me interesa el alojamiento.`,...launchContext(data),String(data.message||'').trim()||'¿Podés darme más información?'].join('\n\n');
}
function launchContactDataValid(data={}){
  return (!(data.arrival||data.departure)||!!calendarConsultationRange(data))&&(!data.people||(Number.isInteger(Number(data.people))&&Number(data.people)>0))&&String(data.message||'').length<=2000;
}
function launchRecordContact(id,consent,data={}){
  if(!launchContactDataValid(data)||!houseDirectContact(id,consent))return false;
  const t=relayActive(id,'Andrea Castro'),lead=launchLead(t);
  if(lead)Object.assign(lead,{msg:String(data.message||'').trim(),arrival:data.arrival||'',departure:data.departure||'',people:data.people?Number(data.people):null});
  t.lastOpeningAt=relayNow();return true;
}
relayOpenHouse=id=>{
  if(S.role!=='guest'||!houseAvailable(id)||!houseSettings(id).available)return false;
  let draft=calendarContactDrafts.get(id)||{message:'',arrival:'',departure:'',people:''};
  if(S.screen==='detail')draft={...draft,arrival:document.getElementById('d-in')?.value||'',departure:document.getElementById('d-out')?.value||'',people:document.getElementById('d-ppl')?.value||''};
  if(!launchContactDataValid(draft)){toast('Completá llegada y salida válidas, o dejá ambas vacías. Personas debe ser un número entero positivo.');return false;}
  calendarContactDrafts.set(id,draft);
  if(!S.loggedIn){go('login',{id,after:'contact'});return false;}
  if(!houseContactAvailable(id)){toast('Necesitás identidad y WhatsApp verificados para contactar.');return false;}
  if(S.screen==='login'){S.screen='detail';S.params={id};}
  S.sheet={type:'launch-contact',id};render();return true;
};
SCREENS['o-leads']=()=>header('Mis consultas')+'<p class="small muted">Clientes que intentaron abrir tu WhatsApp desde una ficha. No confirma que enviaron el mensaje. Respondés por WhatsApp; no tenés que aceptar ni rechazar consultas aquí.</p>'+S.leads.map((l,i)=>({l,i,t:relay.threads.find(t=>t.id===l.threadId)})).filter(({l,t})=>t?.source==='direct'&&MY.some(h=>h.id===l.h)).map(({l,i,t})=>`<article class="card stack"><b>${safe(l.n)}</b><span>${safe(relayHouse(t).t)}</span><span class="small muted">${launchContext(l).map(safe).join(' · ')||'Sin fechas ni personas indicadas'}</span>${String(l.msg||'').trim()?`<p>«${safe(l.msg)}»</p>`:''}<span class="xs muted">Apertura de WhatsApp · registro de demo, no mensaje confirmado</span><button class="btn btn-wa" data-relay-lead="${i}" ${houseContactAvailable(t.house,t.client)?'':'disabled'}>${I.wa} Contactar por WhatsApp</button></article>`).join('');
SCREENS.contacts=()=>!S.loggedIn?SCREENS.login():header('Mis contactos','profile')+'<p class="small muted">Registro de aperturas de WhatsApp, no de mensajes enviados ni reservas.</p>'+relay.threads.filter(t=>relayActor(t)==='guest'&&t.source==='direct').map(t=>`<div class="card stack"><b>${safe(relayHouse(t).t)}</b><button class="btn btn-wa" data-contact="${t.house}">Contactar por WhatsApp</button></div>`).join('');
const launchContactSheet=sheet;
sheet=()=>{
  const s=S.sheet;
  if(s?.type==='launch-contact'&&S.role==='guest'&&S.loggedIn&&houseContactAvailable(s.id)){
    const d=calendarContactDrafts.get(s.id)||{};
    return `<div class="sheet" data-close><div class="sheet-body stack" data-stop><div class="row between"><h3>Contactar por WhatsApp</h3><button class="chip" data-close-btn>Cerrar</button></div><b>${safe(HOUSES.find(h=>h.id===s.id).t)}</b><p class="small">Fechas y personas son opcionales. Si las indicaste en la ficha, se añadirán al mensaje.</p>${launchContext(d).length?`<p class="small">${launchContext(d).map(safe).join(' · ')}</p>`:''}<label for="launch-query">Tu consulta (opcional)</label><textarea id="launch-query" rows="3" maxlength="2000" placeholder="¿Qué te gustaría preguntar?">${safe(d.message||'')}</textarea><label class="row small"><input type="checkbox" id="launch-contact-consent"><span>Acepto compartir mi número con este propietario para hablar por WhatsApp.</span></label><p class="small muted">Se prepara un saludo con el nombre de la casa y tu consulta, si la escribís. Podés editarlo en WhatsApp antes de pulsar Enviar. Los números quedan visibles para ambas partes.</p><button class="btn btn-wa" data-launch-contact="${s.id}">Contactar por WhatsApp</button><p class="xs muted">Demo: simula la apertura y muestra el texto. No abre chats ni envía mensajes reales.</p></div></div>`;
  }
  if(s?.type==='direct'&&S.role==='owner'){
    const t=relay.threads.find(t=>t.id===s.thread);
    if(!t||relayActor(t)!=='owner'||!t.clientConsent||!houseContactAvailable(t.house,t.client))return '<div class="sheet"><div class="sheet-body"><p>Contacto no disponible. Revisá las verificaciones y el estado de ambas cuentas.</p><button class="btn" data-close-btn>Cerrar</button></div></div>';
    return `<div class="sheet" data-close><div class="sheet-body stack" data-stop><div class="row between"><h3>Contactar por WhatsApp</h3><button class="chip" data-close-btn>Cerrar</button></div><label for="launch-owner-message">Mensaje para WhatsApp</label><textarea id="launch-owner-message" rows="8" maxlength="4000">${safe(launchOwnerMessage(t))}</textarea><p class="small muted">Podés editarlo. En WhatsApp tendrás que pulsar Enviar. bnbtico no confirma si el cliente llegó a enviarte su mensaje ni guarda esa conversación.</p><button class="btn btn-wa" data-launch-owner="${t.id}">Contactar por WhatsApp</button><p class="xs muted">Demo sin apertura ni envío real. Ambos podrán ver y guardar sus números en WhatsApp.</p></div></div>`;
  }
  if(s?.type==='launch-preview')return `<div class="sheet" data-close><div class="sheet-body stack" data-stop><h3>Mensaje preparado · demo</h3><p style="white-space:pre-wrap">${safe(s.message)}</p><p class="small muted">Este texto se abriría en WhatsApp. No se ha enviado ningún mensaje.</p><button class="btn btn-primary" data-close-btn>Cerrar</button></div></div>`;
  if(['house-direct-all','house-direct-setting'].includes(s?.type))return '';
  return launchContactSheet();
};
document.addEventListener('input',e=>{if(e.target.id==='launch-query'&&S.sheet?.type==='launch-contact'){const draft=calendarContactDrafts.get(S.sheet.id);if(draft)draft.message=e.target.value;}});
document.addEventListener('click',e=>{
  const button=e.target.closest('[data-launch-contact],[data-launch-owner]');if(!button)return;e.stopImmediatePropagation();
  const d=button.dataset;
  if(d.launchContact){
    const data=calendarContactDrafts.get(d.launchContact)||{};
    if(S.sheet?.type!=='launch-contact'||S.sheet.id!==d.launchContact||!launchRecordContact(d.launchContact,document.getElementById('launch-contact-consent')?.checked===true,data)){toast('Aceptá compartir tu número y comprobá las verificaciones.');return;}
    S.sheet={type:'launch-preview',message:launchClientMessage(d.launchContact,data)};render();return;
  }
  const t=relay.threads.find(t=>t.id===d.launchOwner),message=document.getElementById('launch-owner-message')?.value.trim();
  if(!t||relayActor(t)!=='owner'||!t.clientConsent||!houseContactAvailable(t.house,t.client)||!message)return;
  S.sheet={type:'launch-preview',message};render();
},true);
// La simplificación de la app conserva la landing comercial original.
SCREENS.landing=landing;
render();
