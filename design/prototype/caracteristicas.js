// Características: la misma lista al publicar y al filtrar · 2026-10-13
// Piscina · Mascotas · Wifi · Aire acondicionado · Parqueo · Cargador eléctrico · Niños pequeños gratis.
// Se retiran de los filtros Amueblado, Sin depósito y los chips decorativos (Frente al mar, Rancho/BBQ, Accesible, Cochera).
const FEATURES=[['pool','Piscina'],['pets','Mascotas'],['wifi','Wifi'],['ac','Aire acondicionado'],['parking','Parqueo'],['ev','⚡ Cargador eléctrico'],['kidsFree','Niños pequeños gratis'],['beachfront','Frente al mar'],['bbq','Rancho / BBQ']];
// Datos de ejemplo: todas las casas tienen parqueo salvo indicación; un par ofrecen niños gratis para que el filtro se vea.
HOUSES.forEach(h=>{if(h.parking===undefined)h.parking=true;if(h.kidsFree===undefined)h.kidsFree=false;if(h.beachfront===undefined)h.beachfront=false;if(h.bbq===undefined)h.bbq=false;});
for(const id of ['CT-1042','CT-1171','CT-1133'])(HOUSES.find(h=>h.id===id)||{}).beachfront=true;
for(const id of ['CT-1042','CT-1150','CT-1173','CT-1101'])(HOUSES.find(h=>h.id===id)||{}).bbq=true;
for(const id of ['CT-1171','CT-1150'])(HOUSES.find(h=>h.id===id)||{}).kidsFree=true;
(HOUSES.find(h=>h.id==='CT-1172')||{}).parking=false;
// Filtros: estado, cálculo y limpieza.
S.filters.parking=false;S.filters.kidsFree=false;S.filters.beachfront=false;S.filters.bbq=false;
{const previous=filtered;filtered=()=>previous().filter(h=>(!S.filters.parking||h.parking)&&(!S.filters.kidsFree||h.kidsFree)&&(!S.filters.beachfront||h.beachfront)&&(!S.filters.bbq||h.bbq));}
{const previous=activeFilters;activeFilters=()=>previous()+['parking','kidsFree','beachfront','bbq'].filter(k=>S.filters[k]).length;}
explorarExtras=()=>{const f=S.filters;return (f.ppl>0)+(f.beds>0)+FEATURES.filter(([k])=>f[k]).length;};
document.addEventListener('click',event=>{if(event.target.closest('[data-clear]')){for(const k of ['parking','kidsFree','beachfront','bbq'])S.filters[k]=false;}},true);
const featureChips=()=>FEATURES.map(([k,l])=>`<button class="chip" data-tog="${k}" aria-pressed="${!!S.filters[k]}">${l}</button>`).join('');
// Explorar: los chips de «Qué necesitan» son exactamente las características del formulario.
{const previous=SCREENS.home;SCREENS.home=()=>previous().replace(/(<span class="eyebrow">Qué necesitan<\/span><div class="row" style="flex-wrap:wrap;gap:8px">)[\s\S]*?<\/div><\/div>/,(m,a)=>`${a}${featureChips()}</div></div>`);}
// Pantalla de filtros: misma lista, sin chips decorativos ni amueblado/sin depósito.
{const previous=SCREENS.filters;SCREENS.filters=()=>previous().replace(/<div class="row" style="flex-wrap:wrap;gap:8px">\s*<button class="chip" data-tog="pool"[\s\S]*?<\/div>/,`<div class="row" style="flex-wrap:wrap;gap:8px">${featureChips()}</div>`);}
// Ficha: «Lo que ofrece» refleja parqueo real y niños gratis.
{const previous=SCREENS.detail;SCREENS.detail=()=>{
  const h=HOUSES.find(x=>x.id===S.params.id)||HOUSES[0],check=`<span style="color:var(--primary)">${I.check}</span>`;
  const item=(label,on)=>`<div style="${on?'':'opacity:.4;text-decoration:line-through'}">${check}${label}</div>`;
  return previous().replace(/<div style="[^"]*"><span style="color:var\(--primary\)">(?:(?!<\/div>)[\s\S])*?<\/span>Parqueo<\/div>/,item('Parqueo',h.parking!==false)+item('Niños pequeños gratis',!!h.kidsFree)+item('Frente al mar',!!h.beachfront)+item('Rancho / BBQ',!!h.bbq));
};}
// Publicación: casilla «Niños pequeños gratis» y «Cargador eléctrico» junto a las demás.
const featureDraftDefaults={kidsFree:'no',ev:'no',beachfront:'no',bbq:'no'};
Object.assign(publication.draft,featureDraftDefaults);
{const previous=publicationReset;publicationReset=(...a)=>{const r=previous(...a);Object.assign(publication.draft,featureDraftDefaults);return r;};}
{const previous=SCREENS['o-new'];SCREENS['o-new']=()=>previous().replace(/(<label class="row" style="gap:10px"><input type="checkbox" data-publication-check="parking"[^>]*><span>Parqueo<\/span><\/label>)/,`$1${publicationCheckbox('ev','Cargador para carro eléctrico')}${publicationCheckbox('kidsFree','Niños pequeños gratis')}${publicationCheckbox('beachfront','Frente al mar')}${publicationCheckbox('bbq','Rancho / BBQ')}`);}
// Casa aprobada → catálogo con sus características; admin las ve.
if(typeof zonaFromSubmission==='function'){const previous=zonaFromSubmission;zonaFromSubmission=q=>{const h=previous(q),l=q.listing;h.ev=l.ev==='yes';h.parking=l.parking==='yes';h.kidsFree=l.kidsFree==='yes';h.beachfront=l.beachfront==='yes';h.bbq=l.bbq==='yes';return h;};}
if(SCREENS['a-review']){const previous=SCREENS['a-review'];SCREENS['a-review']=()=>{const q=typeof adminCurrentReview==='function'?adminCurrentReview():null;let html=previous();if(!q?.listing)return html;const l=q.listing;return html.replace(/(<dt class="small muted">Parqueo<\/dt><dd[^>]*>[^<]*<\/dd><\/div>)/,`$1<div class="stack" style="gap:3px;min-width:0"><dt class="small muted">Cargador eléctrico</dt><dd style="margin:0">${reviewBoolean(l.ev)}</dd></div><div class="stack" style="gap:3px;min-width:0"><dt class="small muted">Niños pequeños gratis</dt><dd style="margin:0">${reviewBoolean(l.kidsFree)}</dd></div><div class="stack" style="gap:3px;min-width:0"><dt class="small muted">Frente al mar</dt><dd style="margin:0">${reviewBoolean(l.beachfront)}</dd></div><div class="stack" style="gap:3px;min-width:0"><dt class="small muted">Rancho / BBQ</dt><dd style="margin:0">${reviewBoolean(l.bbq)}</dd></div>`);};}
// Precio por noche: filtro real, visible en Explorar sin abrir «Más filtros» (y también en la pantalla de filtros).
S.filters.min=0;S.filters.max=0;
{const previous=filtered;filtered=()=>previous().filter(h=>(!S.filters.min||h.price>=S.filters.min)&&(!S.filters.max||h.price<=S.filters.max));}
{const previous=activeFilters;activeFilters=()=>previous()+(S.filters.min?1:0)+(S.filters.max?1:0);}
{const previous=explorarExtras;explorarExtras=()=>previous()+(S.filters.min?1:0)+(S.filters.max?1:0);}
document.addEventListener('click',event=>{if(event.target.closest('[data-clear]')){S.filters.min=0;S.filters.max=0;}},true);
const priceInputs=(idMin,idMax)=>`<div class="field"><input id="${idMin}" data-price="min" inputmode="numeric" placeholder="Mín ₡" aria-label="Precio mínimo por noche" value="${S.filters.min||''}"></div><div class="field"><input id="${idMax}" data-price="max" inputmode="numeric" placeholder="Máx ₡" aria-label="Precio máximo por noche" value="${S.filters.max||''}"></div>`;
{const previous=SCREENS.home;SCREENS.home=()=>{let html=previous();const open=html.includes('>Qué necesitan<');return html.replace('<!--filtros-precio-->',open?`<div class="stack" style="gap:6px"><span class="eyebrow">Precio por noche</span><div class="grid" style="grid-template-columns:1fr 1fr;gap:8px;max-width:360px">${priceInputs('h-min','h-max')}</div></div>`:'');};}
{const previous=SCREENS.filters;SCREENS.filters=()=>previous().replace(/<div class="grid" style="grid-template-columns:1fr 1fr"><div class="field"><input id="f-min"[\s\S]*?<\/div><\/div>/,`<div class="grid" style="grid-template-columns:1fr 1fr">${priceInputs('f-min','f-max')}</div>`);}
document.addEventListener('change',event=>{const el=event.target;if(!el.dataset||!el.dataset.price)return;const v=Math.max(0,parseInt(String(el.value).replace(/[^\d]/g,''),10)||0);S.filters[el.dataset.price]=v;render();});
render();
