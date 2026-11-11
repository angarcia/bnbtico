/* Optional ownership wizard. In-memory demo only: no registry API, real codes or approval. */
const propertyChecks={};
const PROPERTY_DEMO_CODE='RNPDIGITAL-DEMO-2026';
const PROPERTY_STEPS=['choice','guide1','guide2','guide3','code'];
function propertyCurrent(){
  if(S.role!=='owner'||!MY.some(h=>h.id===S.params.id))return null;
  return propertyChecks[S.params.id]||null;
}
function propertyStart(id){
  if(S.role!=='owner'||!MY.some(h=>h.id===id))return false;
  propertyChecks[id]??={status:'draft',step:'choice',code:'',consent:false};
  go('o-verify',{id});return true;
}
function propertyStep(step){
  const p=propertyCurrent();
  if(!p||p.status!=='draft'||!PROPERTY_STEPS.includes(step))return false;
  p.step=step;render();const view=document.querySelector('.view');if(view)view.scrollTop=0;return true;
}
function propertySubmit(code,consent){
  const p=propertyCurrent();
  if(!p||p.status!=='draft'||p.step!=='code'||code!==PROPERTY_DEMO_CODE||consent!==true)return false;
  p.code=code;p.consent=true;p.status='review';p.submittedAt=new Date().toISOString();
  render();return true;
}
function propertyButton(h){
  if(S.role!=='owner'||!MY.some(x=>x.id===h.id))return '';
  const p=propertyChecks[h.id];
  const label=p?.status==='review'?'Verificación en revisión':p?'Continuar verificación':'Verificar propiedad';
  return `<button class="btn btn-ghost btn-sm" style="margin-top:10px;white-space:normal" data-property-start="${h.id}">${I.shield} ${label}</button>`;
}
const registryLink=(url,label)=>`<a class="btn btn-primary" style="text-decoration:none" href="${url}" target="_blank" rel="noopener noreferrer">${label} ↗</a>`;
const propertyNext=(step,label)=>`<button class="btn btn-primary" data-property-step="${step}">${label}</button>`;
const propertyBack=(step)=>`<button class="btn btn-ghost" data-property-step="${step}">Atrás</button>`;
function propertyScreen(){
  const p=propertyCurrent(),h=MY.find(h=>h.id===S.params.id);
  if(!p||!h)return '<div class="note">Esta opción está disponible desde Mis casas en el modo Owner.</div>';
  const intro=header('Verificar propiedad','o-houses')+`<div class="stack" style="max-width:680px;width:100%;margin-inline:auto">
    <div class="card row" style="flex-wrap:wrap"><span class="avatar">${I.home}</span><div><b>${safe(h.t)}</b><p class="small muted">${safe(h.loc)} · ${h.id}</p></div></div>
    <p class="xs muted">Demo: no ingresés datos reales ni comprés una certificación para probarla. El progreso se borra al recargar.</p>`;
  if(p.status==='review')return intro+`<div class="card stack" role="status"><span class="badge badge-sun">Verificación en revisión</span><h3>Solicitud de ejemplo recibida</h3><p>En el servicio final, el equipo comprobará la certificación y su correspondencia con tu identidad y esta casa.</p><p class="small muted">En esta demo no se envió ninguna solicitud al Registro ni se concedió el sello de propietario.</p><button class="btn btn-primary" data-go="o-houses">Volver a Mis casas</button></div></div>`;
  const progress={choice:'Inicio',guide1:'Guía · 1 de 3',guide2:'Guía · 2 de 3',guide3:'Guía · 3 de 3',code:'Enviar a revisión'};
  let body='';
  if(p.step==='choice')body=`<h3>¿Ya tenés una certificación literal?</h3><p class="small muted">Esta comprobación es opcional. Podés seguir publicando sin solicitarla.</p>
    <button class="opt" data-property-step="code"><b>Sí, tengo el código</b><span class="small muted">Continuá directamente al envío.</span></button>
    <button class="opt" data-property-step="guide1"><b>No, ayudame a conseguirla</b><span class="small muted">Te acompañamos paso a paso.</span></button>
    <details><summary>¿Qué significa «Propietario verificado»?</summary><p class="small" style="margin-top:8px">Comprobamos que quien publica figura como titular de esta propiedad en el Registro Nacional. Revisado el [fecha].</p><p class="xs muted">La fecha se mostrará después de la comprobación.</p></details>`;
  if(p.step==='guide1')body=`<h3>1. Prepará la referencia de tu finca</h3><p>Necesitás provincia, número de finca o folio real y derecho, tal como aparecen en la documentación.</p>
    <div class="note">El número de plano y el número de finca no son lo mismo. No adivinés el derecho.</div>
    <details><summary><b>No sé mi número de finca</b></summary><div class="stack" style="margin-top:10px"><p class="small">Revisá los documentos de compra o consultá al notario. Otra opción es buscar la Certificación Índice de Personas en el Registro Inmobiliario, con nombre e identificación del titular.</p><p class="small muted">Ese índice es de pago y puede incluir otras propiedades. No hace falta comprarlo si ya tenés la finca; no lo compartás completo con 3bstays.</p>${registryLink('https://www.rnpdigital.com/','Abrir Registro Nacional')}</div></details>
    ${propertyNext('guide2','Continuar')}${propertyBack('choice')}`;
  if(p.step==='guide2')body=`<h3>2. Obtené la certificación</h3><p>Ingresá con tu cuenta al Registro Nacional. Si no tenés una, podés crearla allí.</p><div class="card small">Consultas y Certificaciones → Registro Inmobiliario → <b>Certificación Literal de Bienes Inmuebles</b></div><p class="small">Revisá el precio antes de comprar. El pago se realiza en el Registro, no en 3bstays.</p>
    ${registryLink('https://www.rnpdigital.com/','Abrir Registro Nacional')}<p class="xs muted">Se abre en otra pestaña. No compartás tu contraseña ni datos de tarjeta. Los menús del portal pueden cambiar.</p>
    ${propertyNext('guide3','Continuar a emisión')}${propertyBack('guide1')}`;
  if(p.step==='guide3')body=`<h3>3. Emití y copiá el código</h3><ol style="padding-left:20px;margin:0"><li>Entrá en <b>Mi Inventario</b> y elegí <b>Emitir</b>.</li><li>Completá provincia, finca y derecho, y revisá los datos.</li><li>Descargá la certificación y copiá su número identificador.</li></ol><p class="small">Si ya la emitiste, buscala en <b>Historial de Usos</b>. El código de certificación es distinto del número de finca.</p>
    <details><summary>¿El código no funciona?</summary><p class="small" style="margin-top:8px">Comprobá que esté completo y siga disponible en el verificador oficial. Si falla, consultá al Registro antes de comprar otra certificación.</p><a href="https://www.rnpdigital.com/shopping/validacion.jspx" target="_blank" rel="noopener noreferrer">Abrir verificador oficial ↗</a></details>
    ${propertyNext('code','Ya tengo el código')}${propertyBack('guide2')}`;
  if(p.step==='code')body=`<h3>Pegá el código de certificación</h3><p class="small muted">Lo encontrarás en la certificación emitida por el Registro. No necesitás adjuntar el PDF.</p>
    <div class="field"><label for="property-code">Número de certificación digital</label><input id="property-code" value="${p.code}" readonly placeholder="Usá el ejemplo de abajo" aria-describedby="property-code-help"><span class="xs muted" id="property-code-help">Campo de demostración: solo admite el código ficticio, no datos reales.</span></div>
    <button class="btn btn-ghost" data-property-example>Usar código de ejemplo</button>
    <details><summary><b>Aviso de privacidad · demostración</b></summary><p class="small" style="margin-top:8px">El servicio final utilizará el código para consultar la certificación oficial y cotejar el titular con tu identidad y el anuncio. Solo personal autorizado revisará los datos necesarios; el código no aparecerá en la ficha pública.</p><p class="xs muted">Antes de recoger datos reales deberán estar definidos el responsable, proveedores, conservación, derechos y contacto de privacidad. Este texto no es un aviso legal definitivo. Aquí solo guardamos el ejemplo en memoria.</p></details>
    <label class="row small" style="align-items:flex-start"><input id="property-consent" type="checkbox" ${p.consent?'checked':''} style="margin-top:4px"><span>Leí el aviso de demostración y quiero simular la solicitud de comprobación de esta casa.</span></label>
    <p class="small" role="alert" id="property-error"></p><button class="btn btn-primary" data-property-submit>Enviar a revisión · demo</button>${propertyBack('choice')}`;
  return intro+`<div class="card stack"><span class="eyebrow">${progress[p.step]}</span>${body}</div><button class="btn btn-link" data-go="o-houses">Salir y continuar después</button></div>`;
}
SCREENS['o-verify']=propertyScreen;
document.addEventListener('change',event=>{
  if(event.target.id==='property-consent'){const p=propertyCurrent();if(p&&p.status==='draft')p.consent=event.target.checked;}
});
document.addEventListener('click',event=>{
  const el=event.target.closest('[data-property-start],[data-property-step],[data-property-example],[data-property-submit]');
  if(!el)return;
  event.stopImmediatePropagation();const d=el.dataset;
  if(d.propertyStart){propertyStart(d.propertyStart);return;}
  if(d.propertyStep){propertyStep(d.propertyStep);return;}
  const p=propertyCurrent();if(!p||p.status!=='draft')return;
  if(d.propertyExample!==undefined){p.code=PROPERTY_DEMO_CODE;render();return;}
  if(d.propertySubmit!==undefined&&!propertySubmit(p.code,document.getElementById('property-consent')?.checked===true)){
    const error=document.getElementById('property-error');
    if(error)error.textContent=p.code!==PROPERTY_DEMO_CODE?'Usá el código de ejemplo para continuar.':'Aceptá el aviso de demostración antes de enviar.';
  }
},true);
render();
