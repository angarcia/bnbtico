// Colones como única moneda · 2026-10-13
// Los propietarios ingresan todos los precios en colones. El cliente ve colones por defecto y puede cambiar a dólares,
// pero es solo visualización: conversión con un tipo de cambio de referencia, nunca el precio «real».
const FX_CRC_PER_USD=510; // referencia de demo, no cotización oficial
S.currency=S.currency||'CRC';
// Datos de ejemplo: los anuncios históricos en dólares pasan a colones (redondeo a ₡500).
HOUSES.forEach(h=>{if(h.cur==='$'){h.price=Math.round(h.price*FX_CRC_PER_USD/500)*500;h.cur='₡';}});
// Los calendarios ya creados conservan la moneda de la casa; se reinician para que tomen colones.
if(typeof calendarData!=='undefined'&&calendarData.clear)calendarData.clear();
const monedaActive=()=>S.role==='guest'&&S.currency==='USD';
function monedaFormat(priceCRC,compact=false){
  if(!monedaActive())return compact?'₡'+Math.round(priceCRC/1000)+'k':'₡'+priceCRC.toLocaleString('es-CR');
  const usd=Math.round(priceCRC/FX_CRC_PER_USD);
  return '$'+usd.toLocaleString('en-US');
}
const monedaFmtOriginal=fmt;
fmt=h=>h.cur==='₡'?monedaFormat(h.price):monedaFmtOriginal(h);
const monedaToggle=()=>`<div class="seg" aria-label="Moneda"><button data-currency="CRC" aria-pressed="${S.currency==='CRC'}">₡ Colones</button><button data-currency="USD" aria-pressed="${S.currency==='USD'}">$ Dólares</button></div>`;
const monedaNote=()=>S.currency==='USD'?`<p class="xs muted">Precios convertidos a dólares solo para orientarte (≈ ₡${FX_CRC_PER_USD} por US$1). Los propietarios fijan sus precios en colones y se acuerdan en colones.</p>`:'';
{const previous=SCREENS.home;SCREENS.home=()=>previous()
  .replace('<div class="chiprow">',`<div class="row between" style="flex-wrap:wrap;gap:8px">${monedaToggle()}</div><div class="chiprow">`)
  .replace(/(casas[^<]*precios orientativos[^<]*<\/span>)/,`$1${monedaNote()}`);}
{const previous=SCREENS.detail;SCREENS.detail=()=>{
  if(S.role!=='guest')return previous();
  let html=previous();
  if(monedaActive())html=html
    .replace(/<small>₡(\d+)k<\/small>/g,(m,k)=>`<small>${monedaFormat(Number(k)*1000,true)}</small>`)
    .replace(/Precios orientativos\./,`Precios orientativos, convertidos a dólares para orientarte (≈ ₡${FX_CRC_PER_USD} por US$1). El propietario cobra en colones.`);
  return html.replace('<div class="cta-bar">',`${monedaToggle().replace('class="seg"','class="seg" style="margin:8px 0"')}<div class="cta-bar">`);
};}
// Publicación: la moneda es siempre colones; se retira el selector.
{const previous=SCREENS['o-new'];SCREENS['o-new']=()=>previous().replace(/<label for="pub-currency">[\s\S]*?<\/select>/,'<p class="small muted">Los precios se ingresan en colones (₡). Los clientes pueden verlos convertidos a dólares solo como referencia.</p>');}
{const previous=publicationSet;publicationSet=(key,value)=>previous(key,key==='currency'?'CRC':value);}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-currency]');if(!button)return;
  event.stopImmediatePropagation();
  S.currency=button.dataset.currency==='USD'?'USD':'CRC';render();
});
render();
