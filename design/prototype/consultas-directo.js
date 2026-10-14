// Mis consultas · abrir WhatsApp directamente · 2026-10-13
// El cliente ya abrió el chat con el propietario; responder no necesita plantilla ni pantalla intermedia.
function consultaOpenable(lead){
  const t=lead&&relay.threads.find(t=>t.id===lead.threadId);
  return t&&relayActor(t)==='owner'&&t.clientConsent===true&&houseContactAvailable(t.house,t.client)?t:null;
}
const consultasLeads=SCREENS['o-leads'];
SCREENS['o-leads']=()=>consultasLeads()
  .replace('Clientes que intentaron abrir tu WhatsApp desde una ficha. No confirma que enviaron el mensaje. Respondés por WhatsApp; no tenés que aceptar ni rechazar consultas aquí.','Clientes que te escribieron por WhatsApp desde una ficha. Tocá una consulta para seguir la conversación en WhatsApp; aquí no hay nada que aceptar ni rechazar.')
  .replace('Contactos desde tus fichas y consultas enviadas por bnbtico a petición de clientes. No confirma que enviaron el mensaje. Respondés por WhatsApp; no tenés que aceptar ni rechazar consultas aquí.','Clientes que te escribieron desde una ficha o a través de bnbtico. Tocá una consulta para seguir la conversación en WhatsApp; aquí no hay nada que aceptar ni rechazar.')
  .replace(/(<button class="btn btn-wa" data-relay-lead="\d+"[^>]*>)([\s\S]*?<\/svg>)? ?Contactar por WhatsApp<\/button>/g,(m,open,icon)=>`${open}${icon||''} Abrir WhatsApp</button>`);
// Se registra en window en fase de captura para adelantarse al manejador de relay.js, que abre la hoja con plantilla.
(typeof window!=='undefined'?window:document).addEventListener('click',event=>{
  if(S.role!=='owner')return;
  const button=event.target.closest('[data-relay-lead]');if(!button||button.disabled)return;
  event.stopImmediatePropagation();event.stopPropagation();
  const lead=S.leads[Number(button.dataset.relayLead)],t=consultaOpenable(lead);
  if(!t){toast('Contacto no disponible. Revisá las verificaciones y el estado de ambas cuentas.');return;}
  lead.openedByOwnerAt=Date.now();
  toast(`Demo: se abriría WhatsApp con ${lead.n}. La conversación ya existe; sin mensaje preparado.`);
},true);

render();
