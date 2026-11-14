# Genera la galería de capturas del informe (python3 galeria.py > galeria.html.part).
# Cada pantalla: (archivo base sin ancho, título, nota corta). Busca variantes 1280 y oscuro.
import os, html, json

AQUI = os.path.dirname(os.path.abspath(__file__))
CAP = os.path.join(AQUI, "capturas")

AREAS = [
  ("Visitante · Explorar", [
    ("01-explorar", "Explorar sin búsqueda", "Mapa encuadra Centroamérica; contador de personas «— − +» sin valor; sin título de página."),
    ("01b-explorar-scroll", "Explorar al bajar", "Tarjetas de casas de prueba sin foto: caja gris sin icono. Alturas forzadas iguales dejan huecos."),
    ("02-explorar-lugar", "Lugar abierto", "Panel anclado bajo el campo: bien resuelto."),
    ("02b-explorar-lugar-escrito", "Lugar con texto", ""),
    ("02c-explorar-zona", "Zona elegida", "Aparecen Filtros y una tira de características que se sale del ancho del mapa."),
    ("03-explorar-fechas", "Fechas abiertas", "Dos meses; enero/febrero se ven cortados como cabeceras vacías."),
    ("03b-explorar-fechas-rango", "Rango elegido", ""),
    ("03c-explorar-con-fechas", "Con fechas", "Total orientativo bien; dos bloques promocionales compiten con 2 resultados."),
    ("04-explorar-filtros", "Filtros", "Características repetidas en el cuadro y en la tira del mapa; «Ver 2 casas» parece desactivado."),
    ("04b-explorar-mapa-precio", "Tarjeta del mapa", ""),
    ("04c-explorar-dolares", "En dólares", "Aviso del tipo de cambio en la cabecera de resultados."),
  ]),
  ("Visitante · Ficha", [
    ("05-ficha", "Ficha pública", "Sin barra superior; título centrado; precio repetido en el panel; botón «Continuar» sin decir WhatsApp."),
    ("05b-ficha-completa", "Ficha completa", "Características como tarjetas con sombra; calendario de una casilla de 120 px por día."),
    ("05c-ficha-media", "Ficha (centro)", ""),
    ("05d-ficha-abajo", "Ficha (final)", ""),
    ("05e-ficha-galeria", "Ficha · foto", ""),
    ("06b-ficha-habitacion", "Ficha de habitación", ""),
    ("06c-ficha-mensual", "Ficha sin fotos (dato de prueba)", "Sin foto la portada es un bloque verde liso."),
    ("06d-ficha-no-disponible", "Ficha no disponible", "Plantilla móvil estirada a 1350 px; sin navegación."),
  ]),
  ("Visitante · Cuenta, ayuda y otras", [
    ("07-favoritos-vacio", "Favoritos vacío", "Todo arriba a la izquierda; «Toque el corazón» en escritorio."),
    ("08-ingresar", "Ingresar", "La franja dorada de publicar compite con el botón principal."),
    ("08b-ingresar-numero", "Ingresar con número", ""),
    ("08c-ingresar-codigo", "Pidiendo el código", ""),
    ("09-ayuda", "Ayuda por WhatsApp", "Texto a ~190 caracteres por línea; botón de 1320 px."),
    ("10-publicar-sin-sesion", "Publicar sin sesión", ""),
    ("11-buscar", "¿Dónde? (/explorar/buscar)", "Pantalla móvil a 1440 px, sin barra superior."),
    ("12-que-es", "Qué es 3bstays", "Sigue el lema «Bueno, bonito y bien tico» (retirado en main); oferta repetida tres veces."),
    ("13-no-encontrado", "Casa inexistente", "Sin navegación; otra plantilla de error."),
    ("14-ruta-inexistente", "Ruta inexistente", "Logo duplicado bajo la barra."),
    ("15-portada", "Portada (/?pronto=1)", "La pieza con más marca; su carácter no llega a la app."),
    ("15b-portada-completa", "Portada completa", ""),
  ]),
  ("Cliente con cuenta", [
    ("cliente-20-explorar", "Explorar con sesión", ""),
    ("cliente-21-favoritos", "Favoritos", "Dos tarjetas pegadas a la izquierda y nota a todo el ancho."),
    ("cliente-22-cuenta", "Cuenta del cliente", "Casi vacía; la promoción es el elemento más fuerte."),
    ("cliente-23-cerrar-sesion", "¿Cerrar sesión?", ""),
  ]),
  ("Anfitrión · Mis casas y detalle", [
    ("anfitrion-30-mis-casas", "Mis casas", "Sin título; contadores de 640 px; «+» sin texto; fotos 1:1 ocupan media pantalla."),
    ("anfitrion2-41-mis-casas", "Mis casas (borrador, cambios, inactiva)", "Alturas y pies de tarjeta distintos; «704-playa-grande» visible como zona."),
    ("anfitrion-31-casa-detalle", "Detalle de casa activa", "«Editar» ×7; «Ver ficha» flotando en medio de la página."),
    ("anfitrion-31c-casa-editar-precio", "Editando un dato", "A 1280 px «Ver ficha» tapa la fila Ubicación."),
    ("anfitrion-31d-casa-editar-nombre", "Editando el nombre", ""),
    ("anfitrion-31e-casa-fotos", "Editor de fotos", ""),
    ("anfitrion-31g-casa-suscripcion", "Detalle · suscripción", ""),
    ("anfitrion-32-casa-en-revision", "Casa en revisión", "60 % vacío; sin «ver cómo queda»."),
    ("anfitrion2-42-casa-1", "Borrador", ""),
    ("anfitrion2-42-casa-2", "Cambios pedidos", ""),
    ("anfitrion2-42-casa-4", "Suscripción parada", ""),
  ]),
  ("Anfitrión · Calendario y consultas", [
    ("anfitrion-33-calendario", "Calendario", "Un mes no cabe en pantalla; precio repetido en cada casilla."),
    ("anfitrion-33b-calendario-seleccion", "Noches seleccionadas", "Editor en la columna izquierda: buena decisión."),
    ("anfitrion-33c-calendario-selector-casa", "Selector de casa", ""),
    ("anfitrion-33d-calendario-airbnb", "Conectar con Airbnb", ""),
    ("anfitrion-33e-calendario-marcar-reserva", "Marcar una reserva", ""),
    ("anfitrion-33f-calendario-pausar", "Pausar la casa", "El campo de fecha nativo mostró «yyyy-mm-dd» (comprobar con Chrome en español)."),
    ("anfitrion-34-consultas", "Consultas (ventana)", ""),
    ("anfitrion-34b-actividad-ruta", "Consultas (ruta)", "Vacío sin título ni siguiente paso."),
  ]),
  ("Anfitrión · Cuenta, suscripción y publicar", [
    ("anfitrion-35-cuenta", "Cuenta del anfitrión", "Títulos invertidos: «Promoción y suscripción» > «Mi perfil»."),
    ("anfitrion-35c-cuenta-editar-perfil", "Editando el perfil", ""),
    ("anfitrion-35d-cuenta-cobro", "¿Cómo funciona el cobro?", ""),
    ("anfitrion-35e-parar-suscripcion", "Parar suscripción", ""),
    ("anfitrion-36-suscripcion", "/propietario/suscripcion", "Sin barra superior; plantilla móvil estirada."),
    ("anfitrion-37-favoritos", "Favoritos del anfitrión", ""),
    ("anfitrion-39-ayuda", "Ayuda (anfitrión)", ""),
    ("anfitrion-40-publicar-paso1", "Publicar · datos iniciales", "«Continuar» y «‹» con el mismo aspecto; contadores sin número."),
    ("anfitrion-40d-publicar-habitacion", "Publicar · habitación", ""),
    ("anfitrion2-42-casa-3", "Publicar · retomar borrador", ""),
    ("anfitrion2-43-cuenta", "Cuenta con casa parada", ""),
  ]),
  ("Admin", [
    ("admin-50-anuncios", "Anuncios", "Pestañas móviles flotando a media pantalla."),
    ("admin-51-casas", "Casas", "La barra de pestañas tapa la última fila."),
    ("admin-52-borradores", "Borradores", ""),
    ("admin-53-revisar", "Revisar anuncio", "La barra de decisión tapa el mensaje para el anfitrión."),
    ("admin-53b-revisar-completo", "Revisar anuncio (completo)", ""),
  ]),
]

def exists(name):
    return os.path.exists(os.path.join(CAP, name + ".png"))

def variantes(base):
    out = []
    for etiqueta, nombre in (("1440", f"1440-{base}"), ("1280", f"1280-{base}"), ("Oscuro", f"1440-oscuro-{base}")):
        if exists(nombre):
            out.append((etiqueta, nombre))
    return out

partes = []
total = 0
for area, pantallas in AREAS:
    partes.append(f'<section class="area"><h3>{html.escape(area)}</h3><div class="grid">')
    for base, titulo, nota in pantallas:
        vs = variantes(base)
        if not vs:
            continue
        total += len(vs)
        botones = "".join(
            f'<button type="button" data-src="capturas/{n}.png" class="{"on" if i == 0 else ""}">{e}</button>'
            for i, (e, n) in enumerate(vs)
        ) if len(vs) > 1 else ""
        primera = vs[0][1]
        partes.append(
            f'<figure class="shot"><a href="capturas/{primera}.png" target="_blank"><img loading="lazy" src="capturas/{primera}.png" alt="{html.escape(titulo)}"></a>'
            f'<figcaption><div class="cap-head"><b>{html.escape(titulo)}</b><span class="var">{botones}</span></div>'
            + (f'<p>{html.escape(nota)}</p>' if nota else "")
            + '</figcaption></figure>'
        )
    partes.append("</div></section>")
print("\n".join(partes))
print(f"<!-- {total} capturas -->")
