// Contacto con 3bstays solo por WhatsApp · 2026-10-13
// Un canal por rol (propietarios / buscadores). Retira el flujo de reclamaciones de la experiencia v1
// sin borrar claims.js: sus pantallas quedan sin acceso desde la interfaz.
const SUPPORT_WHATSAPP={
  owner:{label:'3bstays · atención a propietarios',number:'+506 8xxx-xxx1'},
  guest:{label:'3bstays · buscadores de alojamiento',number:'+506 8xxx-xxx2'}
};
const supportChannel=()=>SUPPORT_WHATSAPP[S.role==='owner'?'owner':'guest'];
const supportButton=()=>'<button class="btn btn-ghost" data-go="support-info">Escribile a 3bstays por WhatsApp</button>';
function supportStrip(html){
  return String(html)
    .replace(/<button class="btn btn-ghost" data-go="claims">[^<]*<\/button>/g,'')
    .replace(/<button class="btn btn-ghost" data-go="support-info">[^<]*<\/button>/g,supportButton())
    .replace(/<button class="btn btn-ghost" data-claim-new="[^"]*">Reportar un problema<\/button>/g,'')
    .replace(/<section class="card stack"><h3>Reportes relacionados<\/h3>[\s\S]*?<\/section>/g,'')
    .replace('Podrá consultar su historial y acceder a ayuda y reclamaciones.','Podrá consultar su historial y escribir al WhatsApp de soporte.');
}
for(const key of Object.keys(SCREENS)){const previous=SCREENS[key];if(typeof previous==='function')SCREENS[key]=(...args)=>supportStrip(previous(...args));}
SCREENS['support-info']=()=>{
  const c=supportChannel(),owner=S.role==='owner';
  return header('Escribile a 3bstays',owner?'o-profile':'profile')+`<div class="card stack"><h3>${c.label}</h3><p>${owner?'Para cualquier duda o problema con tu cuenta, tus casas o una consulta recibida, escribinos por WhatsApp. Es el único canal de atención de 3bstays.':'Para cualquier duda o problema con tu cuenta, una casa o un propietario, escribinos por WhatsApp. Es el único canal de atención de 3bstays. Si querés, contanos zona, fechas y personas y te ayudamos a encontrar casas compatibles.'}</p><p class="note small">${c.number} · número de ejemplo, pendiente de configurar. Canal separado del de ${owner?'buscadores':'propietarios'}.</p><button class="btn btn-wa" data-support-open="${owner?'owner':'guest'}">${I.wa} Abrir WhatsApp</button><p class="xs muted">Demo: no abre WhatsApp ni envía mensajes.</p></div>`;
};
NAV.admin=NAV.admin.filter(([key])=>key!=='claims');
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-support-open]');if(!button)return;
  event.stopImmediatePropagation();
  toast(`Demo: se abriría WhatsApp con ${supportChannel().label}. No se envió ningún mensaje.`);
});

render();
