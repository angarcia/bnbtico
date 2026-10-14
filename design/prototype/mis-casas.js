// Mis casas en móvil: tarjeta ligera; la gestión completa vive en el detalle de la casa · 2026-10-13
// Regla de producto (todas las vistas): «Añadir método de pago» solo aparece mientras la casa no tiene método de pago
// y toca avisar (ventana de recordatorio de la oferta gratuita o estado «Pendiente de pago»). Después desaparece.
function casaPayButtonDue(id){const s=houseState(id),b=billingFor(id);return !b.paymentMethod&&(s.key==='payment_due'||!!s.reminder);}
{const previous=houseStateBlock;houseStateBlock=id=>{let html=previous(id);if(!casaPayButtonDue(id))html=html.replace(/<button class="btn btn-primary btn-sm" data-billing-pay="[^"]+">Añadir método de pago<\/button>/,'');return html;};}
// Móvil: la tarjeta queda con estado, precio, aviso de la oferta si toca, Compartir ficha y Calendario.
const casaPhone=()=>S.dev==='phone';
{const previous=ownerCard;ownerCard=h=>{
  let html=previous(h);if(!casaPhone())return html;
  return html
    .replace(/<div class="house-actions">[\s\S]*?<\/div>/,'')
    .replace(/<p class="xs muted" style="margin-top:6px">Invitá a tus clientes[^<]*<\/p>/,'')
    .replace(/<button class="btn btn-ghost btn-sm" data-billing-stop="[^"]+">Parar suscripción<\/button>/,'')
    .replace(/<button class="btn-link xs" data-billing-expire="[^"]+">[^<]*<\/button>/,'')
    .replace(/<div class="row between"><b>([^<]*)<\/b>/,`<div class="row between"><b data-go="o-house" data-id="${h.id}" style="cursor:pointer">$1</b>`)
    .replace(/<button class="btn btn-primary" style="width:100%;margin-top:12px" data-launch-share="([^"]+)"([^>]*)>Compartir ficha<\/button>/,(m,id,attrs)=>`<div class="row" style="gap:8px;margin-top:12px"><button class="btn btn-primary" style="flex:1" data-launch-share="${id}"${attrs}>Compartir ficha</button><button class="btn btn-ghost" data-go="o-cal" data-id="${id}">Calendario</button></div><p class="xs muted" style="margin-top:6px">Tocá la casa para editar, pausar o gestionar la suscripción.</p>`);
};}
{const previous=SCREENS['o-houses'];SCREENS['o-houses']=()=>{
  let html=previous();if(!casaPhone())return html;
  return html
    // El consejo de compartir y la promoción de lanzamiento viven en Inicio, no aquí.
    .replace(/<section class="card stack" style="border:1px solid var\(--primary\)[^>]*><span class="eyebrow">Recomendado para tus clientes<\/span>[\s\S]*?<\/section>/,'')
    .replace(/<section class="card stack"><span class="eyebrow">Promoción de lanzamiento · demo<\/span>[\s\S]*?<\/section>/,'')
    // Casas pendientes: sin botones deshabilitados ni texto técnico.
    .replace(/<div class="house-actions"><button class="btn btn-ghost btn-sm" disabled>Calendario<\/button>[\s\S]*?<\/div><p class="xs muted">Controles no disponibles[^<]*<\/p>/g,'');
};}
{const previous=SCREENS['o-dash'];SCREENS['o-dash']=()=>casaPhone()&&typeof launchPromotion==='function'?previous()+launchPromotion():previous();}
// Detalle de la casa (owner, móvil): estado, suscripción y controles en un solo sitio.
{const previous=SCREENS['o-house'];SCREENS['o-house']=()=>{
  if(S.role!=='owner'||!casaPhone())return previous();
  const h=MY.find(x=>x.id===S.params.id);if(!h)return previous();
  const s=houseState(h.id);
  return (typeof houseActionsStyle==='string'?houseActionsStyle:'')+header(safe(h.t),'o-houses')
    +`<div class="photo ${h.photo}"><span>${safe(h.loc.split(',')[0])}</span></div>`
    +`<section class="card stack"><div class="row between"><b class="num">${fmt(h)}/${h.unit}</b><span class="badge ${s.badge}">${s.label}</span></div>${houseStateBlock(h.id)}</section>`
    +`<section class="card stack"><b>Ficha</b><button class="btn btn-primary" data-launch-share="${h.id}" ${houseAvailable(h.id)?'':'disabled'}>Compartir ficha</button><p class="xs muted">Enviá el enlace por WhatsApp o compartilo en tus redes. Para escribirte desde bnbtico, tus clientes solo necesitan su WhatsApp verificado.</p></section>`
    +`<section class="card stack"><b>Gestión</b>${houseControls(h)}${houseReopeningNote(h.id)}</section>`;
};}
render();
