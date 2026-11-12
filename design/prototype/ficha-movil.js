// Ficha móvil más corta · 2026-10-13
// Solo en móvil (S.dev==='phone'), para clientes: el precio se muestra una vez (barra fija), el calendario marca solo
// los días con precio distinto al base, «Lo que ofrece» lista solo lo que sí hay, y los avisos se funden en uno.
// La ficha web no cambia.
function fichaMovilNote(h){
  return `<div class="note small">Sin comisiones: fechas, precio y pago los acordás con ${safe(h.owner.split(' ')[0])} por WhatsApp. 3bstays no procesa pagos; no transfieras sin confirmar la casa. Para escribirle necesitás tu WhatsApp verificado (la identidad con Veriff es opcional). Los números quedan visibles para ambas partes.</div>`;
}
{const previous=SCREENS.detail;SCREENS.detail=()=>{
  let html=previous();
  if(S.role!=='guest'||S.dev!=='phone')return html;
  const h=HOUSES.find(x=>x.id===S.params.id)||HOUSES[0];
  if(!html.includes('class="cta-bar"'))return html;// ficha bloqueada u otra variante: no tocar
  const baseLabels=new Set(['₡'+Math.round(h.price/1000)+'k',typeof monedaFormat==='function'?monedaFormat(h.price,true):'']);
  const segRe=/<div class="seg"(?: style="margin:8px 0")? aria-label="Moneda">[\s\S]*?<\/div>(?=<div class="cta-bar">)/;
  const toggle=(html.match(segRe)||[''])[0].replace(/ style="margin:8px 0"/,'');
  html=html
    // Panel lateral (precio repetido, «¿Cómo funciona?») fuera: el precio vive en la barra fija.
    .replace(/<div class="detail-side stack"[^>]*>[\s\S]*?<\/div>\s*<\/div>\s*(?=<div class="seg"|<div class="cta-bar">)/,'</div>')
    // Selector de moneda junto al título del calendario, no como fila suelta antes de la barra.
    .replace(segRe,'')
    .replace('<div class="eyebrow">Disponibilidad y precio orientativo</div>',`<div class="row between" style="align-items:center;flex-wrap:wrap;gap:8px"><div class="eyebrow">Disponibilidad y precio orientativo</div>${toggle}</div>`)
    // Calendario: solo los días con precio distinto al base llevan cifra.
    .replace(/<small>([^<]*)<\/small>/g,(m,label)=>baseLabels.has(label)?'':m)
    .replace(/<p class="xs muted">Precios orientativos[^<]*<\/p>/,`<p class="xs muted">${fmt(h)} por ${h.unit}, salvo los días marcados con otro precio. Precios orientativos.</p>`)
    // «Lo que ofrece»: solo lo que sí tiene.
    .replace(/<div style="opacity:\.4;text-decoration:line-through">[\s\S]*?<\/div>/g,'')
    // Un solo aviso al final, en lugar de dos notas y una tarjeta.
    .replace(/<div class="note">⚠ 3bstays no procesa pagos[^<]*<\/div>/,'')
    .replace(/<p class="small note">Para contactar necesitás cuenta con WhatsApp verificado[^<]*<\/p>/,'')
    .replace('<div class="cta-bar">',`${fichaMovilNote(h)}<div class="cta-bar">`);
  return html;
};}
render();
