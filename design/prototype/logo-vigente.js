// El SVG nuevo contiene solo las letras; ya no necesita el recorte del PNG con rana.
{const previous=chrome;chrome=(...args)=>`<style>
.brand-logo{aspect-ratio:auto;overflow:visible;background:transparent;border-radius:0}
.brand-logo img{display:block;position:static;width:100%;max-width:100%;height:auto;left:auto;top:auto}
</style>`+previous(...args);}
render();
