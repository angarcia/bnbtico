// Formulario de publicación: se retira «Uso de los baños» · 2026-10-13
// El campo queda fijo en «privados» por debajo; no se pregunta ni se muestra.
{const previous=SCREENS['o-new'];SCREENS['o-new']=()=>previous()
  .replace(/<div class="field"><label for="pub-bathroomUse">[\s\S]*?<\/select><\/div>/,'')
  .replace('<p class="xs muted">Privados: exclusivos del alojamiento, no necesariamente dentro de cada habitación. Compartidos: con otros huéspedes o residentes.</p>','');}
{const previous=publicationSet;publicationSet=(key,value)=>previous(key,key==='bathroomUse'?'private':value);}
{const previous=publicationReset;publicationReset=(...a)=>{const r=previous(...a);publication.draft.bathroomUse='private';return r;};}
if(SCREENS['a-review']){const previous=SCREENS['a-review'];SCREENS['a-review']=()=>previous().replace(/<div class="stack"[^>]*><dt class="small muted">Uso de baños<\/dt>[\s\S]*?<\/div>/,'');}
{const previous=SCREENS['o-houses'];SCREENS['o-houses']=()=>previous().replace(/ baños (?:privados|compartidos|privados y compartidos)<\/span>/g,' baños</span>');}
render();
