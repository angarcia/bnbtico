# Genera la sección «Antes y después» (python3 comparar.py > /tmp/comparar.part).
import os, html
AQUI = os.path.dirname(os.path.abspath(__file__))
P = [
 ("ficha", "Ficha pública", ["Barra superior y contenedor de 1232 px", "Título y datos alineados a la izquierda", "Características como lista sin cajas; mensual junto al precio", "«Escribir a Marlen por WhatsApp» y dos avisos en lugar de cuatro", "Aviso de seguridad en tinta, no en ocre", "Pie de marca común"]),
 ("explorar", "Explorar", ["Logo más grande alineado con el contenido", "Moneda como control segmentado neutro", "«Personas» en lugar de «— − +»", "Título «12 casas en Costa Rica»", "Tarjetas de altura natural; WhatsApp como icono sin caja"]),
 ("ingresar", "Ingresar", ["Sin la franja dorada de publicar", "Logo en la ventana", "«Elija otro país» en lugar de «Toque»", "Privacidad en una línea, sin caja"]),
 ("mis-casas", "Mis casas", ["Cabecera «Mis casas» con resumen en una línea", "«+ Añadir casa» con texto", "Fotos 4:3 y tarjetas de la misma altura", "«Calendario» y «Consultas» con texto", "«Consultas» con texto en la barra"]),
 ("detalle", "Detalle de casa", ["«Ver ficha» y «Compartir ficha» en la cabecera; sin botón flotante", "Estadísticas con borde, sin arena", "«clics en WhatsApp»"]),
 ("calendario", "Calendario", ["Cabecera con instrucción", "Días de la semana bajo cada mes", "Casillas de 64 px: un mes entero en pantalla", "Precio base en la leyenda; en el día solo si cambia", "Días pasados sin fondo ni precio; leyenda de 16 px con borde"]),
 ("cuenta", "Cuenta del anfitrión", ["Cabecera «Cuenta»", "Títulos de columna al mismo nivel («Suscripción» = «Mi perfil»)", "«₡0» al tamaño del texto", "«Parar suscripción» en terracota, sin subrayado", "Crédito de OSM al pie; «Cerrar sesión» como botón secundario"]),
 ("admin-anuncios", "Admin · Anuncios", ["Barra superior de admin en lugar de pestañas móviles", "Resumen en una línea; contenedor común"]),
 ("admin-revisar", "Admin · Revisar anuncio", ["Dos columnas con la decisión fija a la derecha (diseno-v1 §18)", "Nada tapa el mensaje", "«Aprobar» principal, «Pedir cambios» secundario, «Rechazar» en texto terracota", "Fotos más grandes"]),
]
def has(n): return os.path.exists(os.path.join(AQUI, "despues", n + ".png"))
out = []
for key, titulo, cambios in P:
    vars_ = [(t, f"{t}-{key}") for t in ("1440", "1280")] + ([("Oscuro", f"1440-oscuro-{key}")] if has(f"1440-oscuro-{key}-antes") else [])
    vars_ = [v for v in vars_ if has(v[1] + "-antes")]
    btns = "".join(f'<button type="button" class="{"on" if i == 0 else ""}" data-a="despues/{n}-antes.png" data-d="despues/{n}-despues.png">{t}</button>' for i, (t, n) in enumerate(vars_))
    n0 = vars_[0][1]
    extra = ""
    if has(f"1440-{key}-despues-relleno"):
        extra = f'<p class="muted">Variante para la decisión 1 (botón principal relleno verde selva): <a href="despues/1440-{key}-despues-relleno.png" target="_blank">ver captura</a>.</p>'
    if key == "ficha":
        extra += '<p class="muted"><a href="despues/1440-ficha-despues-completa.png" target="_blank">Ficha completa (después)</a>.</p>'
    out.append(f'''<article class="pair"><div class="cap-head"><h3>{html.escape(titulo)}</h3><span class="var">{btns}</span></div>
<div class="compare"><figure class="shot"><a href="despues/{n0}-antes.png" target="_blank"><img loading="lazy" src="despues/{n0}-antes.png" alt="{html.escape(titulo)}, antes"></a><figcaption><b>Antes</b></figcaption></figure>
<figure class="shot"><a href="despues/{n0}-despues.png" target="_blank"><img loading="lazy" src="despues/{n0}-despues.png" alt="{html.escape(titulo)}, después"></a><figcaption><b>Después</b></figcaption></figure></div>
<ul class="changes">{"".join(f"<li>{html.escape(c)}</li>" for c in cambios)}</ul>{extra}</article>''')
print("\n".join(out))
