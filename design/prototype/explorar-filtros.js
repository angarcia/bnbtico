// Explorar: sin buscador de texto; filtros ordenados y a la vista · 2026-10-13
// Orden: 1) dónde (provincia) · 2) para quién (personas, habitaciones) · 3) qué necesita (características) · 4) más filtros.
// La moneda va junto a la línea de resultados, porque afecta a cómo se leen los precios, no a qué casas salen.
function explorarExtras(){const f=S.filters;return (f.ppl>0)+(f.beds>0)+['pool','pets','ac','wifi','ev'].filter(k=>f[k]).length;}
function explorarFiltros(){
  const f=S.filters,extras=explorarExtras();
  const sel=(key,label,values,fmt)=>`<label class="chip" style="gap:6px;padding:6px 10px 6px 12px" aria-pressed="${f[key]>0}"><span>${label}</span><select data-sel="${key}" style="border:0;background:transparent;font:inherit;font-weight:700;color:inherit">${values.map(n=>`<option value="${n}" ${f[key]===n?'selected':''}>${fmt(n)}</option>`).join('')}</select></label>`;
  const tog=(key,label)=>`<button class="chip" data-tog="${key}" aria-pressed="${!!f[key]}">${label}</button>`;
  const provs=`<div class="stack" style="gap:6px"><span class="eyebrow">Zona</span><div class="chiprow">${PROVS.map(d=>`<button class="chip" data-prov="${d}" aria-pressed="${f.prov===d}">${d}</button>`).join('')}</div></div>`;
  const who=`<div class="stack" style="gap:6px"><span class="eyebrow">Para quiénes</span><div class="row" style="flex-wrap:wrap;gap:8px">${sel('ppl','Personas',[0,2,4,6,8,12],n=>n?n+'+':'Cualquiera')}${sel('beds','Habitaciones',[0,1,2,3,4],n=>n?n+'+':'Cualquiera')}</div></div>`;
  // En web no hay «Más filtros»: todo está a la vista. En móvil, «Qué necesitan» y «Precio» se pliegan tras el botón.
  const phone=S.dev==='phone',open=!phone||S.filtersOpen||extras>0;
  const what=`<div class="stack" style="gap:6px"><span class="eyebrow">Qué necesitan</span><div class="row" style="flex-wrap:wrap;gap:8px">${tog('pool','Piscina')}${tog('pets','Mascotas')}${tog('ac','Aire acondicionado')}${tog('wifi','Wifi')}${tog('ev','⚡ Cargador eléctrico')}<button class="chip" data-go="filters" style="font-weight:700">Más filtros${extras?` <span class="badge badge-ok">${extras}</span>`:''}</button>${extras?'<button class="btn-link xs" data-clear>Limpiar</button>':''}</div></div>`;
  const toggleBtn=phone?`<div class="row" style="gap:8px;align-items:center"><button class="chip" data-filters-toggle style="font-weight:700" aria-expanded="${open}">${open?'Menos filtros':'Más filtros'}${extras?` <span class="badge badge-ok">${extras}</span>`:''}</button>${extras?'<button class="btn-link xs" data-clear>Limpiar</button>':''}</div>`:(extras?'<div><button class="btn-link xs" data-clear>Limpiar filtros</button></div>':'');
  return `<div class="stack" style="gap:14px">${provs}${who}${open?what:''}<!--filtros-precio-->${toggleBtn}</div>`;
}
{const previous=SCREENS.home;SCREENS.home=()=>{
  let html=previous();
  const toggle=(html.match(/<div class="seg" aria-label="Moneda">[\s\S]*?<\/div>/)||[''])[0];
  html=html
    .replace(/<div class="row between" style="flex-wrap:wrap;gap:8px"><div class="seg" aria-label="Moneda">[\s\S]*?<\/div><\/div>/,'')
    .replace(/<div class="chiprow">(?:(?!<\/div>)[\s\S])*?data-prov=[\s\S]*?<\/div>/,'')
    .replace(/<div class="search">[\s\S]*?<\/button><\/div>/,explorarFiltros())
    .replace('<b class="num">1</b> casas','<b class="num">1</b> casa')
    .replace(/(<span class="small muted"><b class="num">\d+<\/b> casas?[^<]*<\/span>)/,`<div class="row between" style="flex-wrap:wrap;gap:8px;align-items:center">$1${toggle}</div>`);
  return html;
};}
document.addEventListener('click',event=>{if(!event.target.closest('[data-filters-toggle]'))return;event.stopImmediatePropagation();S.filtersOpen=!S.filtersOpen;render();});
render();
