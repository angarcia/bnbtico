// Foco en el Caribe · 2026-10-13
// Explorar arranca en Limón. Los filtros de provincia solo muestran provincias con al menos una casa visible;
// cuando se aprueba una casa de otra zona, su provincia aparece automáticamente. Las zonas sin casas no aparecen.
const PROVS_ALL=['Guanacaste','Puntarenas','Limón','Alajuela','San José','Heredia','Cartago'];
const ZONA_DEFAULT='Limón';
// Casas de ejemplo del Caribe (demo) para que el piloto no arranque vacío.
const CARIBE_DEMO=[
  {id:'CT-1171',t:'Casa Manzanillo, a pie de playa',loc:'Manzanillo, Limón',prov:'Limón',type:'vac',price:85000,cur:'₡',unit:'noche',ppl:5,beds:2,baths:2,pool:false,pets:true,ac:true,wifi:true,ev:false,photo:'p-playa',owner:'Yorleny S.',ownerV:true,views:96,contacts:4,x:90,y:66,desc:'Casa de madera a 80 m de la playa de Manzanillo, con rancho y hamacas. Entrada del refugio Gandoca a 5 minutos.'},
  {id:'CT-1172',t:'Cabina Cahuita, frente al parque',loc:'Cahuita, Limón',prov:'Limón',type:'vac',price:42000,cur:'₡',unit:'noche',ppl:2,beds:1,baths:1,pool:false,pets:false,ac:true,wifi:true,ev:false,photo:'p-selva',owner:'Don Walter',ownerV:true,views:72,contacts:3,x:86,y:58,desc:'Cabina independiente a dos cuadras de la entrada del Parque Nacional Cahuita. Bicis y desayuno caribeño opcional.'},
  {id:'CT-1173',t:'Villa Punta Uva con piscina',loc:'Punta Uva, Limón',prov:'Limón',type:'vac',price:160,cur:'$',unit:'noche',ppl:8,beds:4,baths:3,pool:true,pets:true,ac:true,wifi:true,ev:true,photo:'p-piscina',owner:'Fam. Araya',ownerV:true,views:210,contacts:11,x:89,y:64,desc:'Villa para grupos a 300 m de Punta Uva, piscina privada, cargador para eléctrico y cocina equipada.'}
];
function zonaRegisterHouse(h){
  if(HOUSES.some(x=>x.id===h.id))return;
  HOUSES.push(h);
  if(typeof adminUserSeed==='function')adminUserSeed(h.owner,'owner','approved');
  const u=adminUsers.items.find(u=>u.name===h.owner);if(u)u.whatsappVerified=true;
  if(typeof listingPhones!=='undefined')listingPhones.set(h.id,listingPhoneSeed('+506 8xxx-xxxx',true));
  if(typeof requestDispatchAccountId==='function')h.ownerId=requestDispatchAccountId(h.owner);
}
CARIBE_DEMO.forEach(zonaRegisterHouse);
// Provincias con casas visibles, en el orden habitual. Se recalculan en cada render de Explorar y Filtros.
function zonaProvinces(){
  const visible=new Set(HOUSES.filter(h=>h.type===S.mode&&houseAvailable(h.id)).map(h=>h.prov));
  return ['Todas',...PROVS_ALL.filter(p=>visible.has(p))];
}
function zonaSyncProvs(){
  const list=zonaProvinces();PROVS.length=0;PROVS.push(...list);
  if(!list.includes(S.filters.prov)||(S.filters.prov==='Todas'&&!S.zonaProvChosen))S.filters.prov=list.includes(ZONA_DEFAULT)?ZONA_DEFAULT:'Todas';
}
// Si la persona elige una provincia (o «Todas») a mano, se respeta; hasta entonces Limón es el punto de partida en cada modo.
document.addEventListener('click',event=>{if(event.target.closest('[data-prov],[data-prov-stay]'))S.zonaProvChosen=true;},true);
if(zonaProvinces().includes(ZONA_DEFAULT))S.filters.prov=ZONA_DEFAULT;
for(const key of ['home','filters']){const previous=SCREENS[key];SCREENS[key]=(...args)=>{zonaSyncProvs();return previous(...args);};}
{const previous=SCREENS.home;SCREENS.home=()=>previous().replace('casas · precios orientativos, acordalos con el owner.',`casas${S.filters.prov==='Todas'?'':' en '+safe(S.filters.prov)} · precios orientativos, acordalos con el owner.`);}
// Una casa aprobada entra en el catálogo de la demo; si es de otra provincia, esa provincia aparece en los filtros desde ese momento.
const ZONA_PHOTO={'Limón':'p-caribe','Guanacaste':'p-playa','Puntarenas':'p-playa','Alajuela':'p-volcan','Cartago':'p-montana','Heredia':'p-montana','San José':'p-ciudad'};
let zonaSeq=1200;
function zonaFromSubmission(q){
  const l=q.listing,price=Number(l.nightlyPrice)||0;
  return {id:'CT-'+(++zonaSeq),t:l.title,loc:`${l.zone||l.canton}, ${l.province}`,prov:l.province,type:'vac',price,cur:l.currency==='USD'?'$':'₡',unit:'noche',ppl:Number(l.people)||1,beds:Number(l.bedrooms)||0,baths:Number(l.bathrooms)||1,pool:l.pool==='yes',pets:l.pets==='yes',ac:l.ac==='yes',wifi:l.wifi==='yes',ev:false,photo:ZONA_PHOTO[l.province]||'p-caribe',owner:q.n,ownerV:true,views:0,contacts:0,x:50,y:50,desc:l.description||'',submissionId:q.submissionId,acceptsLongTerm:!!l.acceptsLongTerm};
}
{const previous=moderateListing;moderateListing=(index,status,reason='')=>{
  const ok=previous(index,status,reason),q=S.queue[index];
  if(ok&&status==='ok'&&q?.listing&&q.submissionId&&!HOUSES.some(h=>h.submissionId===q.submissionId)){const h=zonaFromSubmission(q);zonaRegisterHouse(h);q.catalogId=h.id;}
  return ok;
};}
{const previous=SCREENS['o-houses'];SCREENS['o-houses']=()=>previous().replace(/Aprobada · entra en la oferta gratuita \(simulado\)/g,'Aprobada · ya visible en el catálogo y en la oferta gratuita (simulado)');}
render();
