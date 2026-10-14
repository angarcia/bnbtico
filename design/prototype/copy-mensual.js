// Copy: «Largo plazo» pasa a «Mensual» en toda la interfaz · 2026-10-13
const MENSUAL_COPY=[
  ['¿Aceptás largo plazo?','¿Aceptás alquiler mensual?'],
  ['También podés aceptar estancias de largo plazo.','También podés aceptar alquiler mensual.'],
  ['Estancia mínima de largo plazo (meses, opcional)','Estancia mínima del alquiler mensual (meses, opcional)'],
  ['Largo plazo: consultar precio con el propietario','Mensual: consultar precio con el propietario'],
  ['No acepta largo plazo','No acepta alquiler mensual'],
  ['Acepta largo plazo','Acepta alquiler mensual'],
  ['<h3>Largo plazo</h3>','<h3>Alquiler mensual</h3>'],
  ['Largo plazo','Mensual'],
  ['largo plazo','mensual']
];
function mensualStrip(html){let out=String(html);for(const [a,b] of MENSUAL_COPY)out=out.split(a).join(b);return out;}
for(const key of Object.keys(SCREENS)){if(key==='landing')continue;const previous=SCREENS[key];if(typeof previous==='function')SCREENS[key]=(...args)=>mensualStrip(previous(...args));}
{const previous=sheet;sheet=()=>mensualStrip(previous());}
for(const k of Object.keys(NOTES))NOTES[k]=mensualStrip(NOTES[k]);
{const previous=toast;toast=t=>previous(mensualStrip(t));}
render();
