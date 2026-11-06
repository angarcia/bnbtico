# Opciones compactas · pendientes de elección

Ana pide alternativas simples para favicon y otros espacios pequeños. Ninguna está adoptada aún en la app.

- **A · `01-b`**: B original con refuerzo óptico de 3 unidades del trazo. Conserva más el carácter de las letras; a 16 px sigue siendo muy fina.
- **B · `02-bt`**: B y T originales, con T elevada y el mismo refuerzo. Funciona mejor a partir de 48 px.
- **C · `03-bnb-tico`**: nombre completo en dos líneas, letras originales y refuerzo óptico de 2 unidades. Para avatares grandes, no recomendado como favicon.
- **D · `04-b-compacta`**: B geométrica nueva de trazo sólido, en terracota sobre crema. Es la opción más legible del conjunto a 16–32 px. Esta simplificación es una propuesta para el símbolo pequeño; no cambia las letras del nombre completo.

- **E · `05-cuadrado`**: solo el cuadrado de puntos, sin letras. Marco doble trazado desde la referencia del icono, con versión simplificada de una fila y 12 puntos para 16–32 px (`05-cuadrado-favicon.svg`), y una fila de 20 puntos para 48/64 px. Se incluyen también terracota y blanco transparentes.

Todos incluyen SVG, PNG de 1024 px, PNG de 16/32/48/64/180/192/512 px, versión crema sobre oscuro de 512 px y favicon ICO con imágenes 16/32/48. Los tamaños pequeños se muestran a escala real en `comparativa-iconos.png`.

Son propuestas con margen para uso cuadrado; no se presentan como iconos maskable definitivos. Tras elegir una, ajustar zona segura y exportar el juego de la app.

## BT dentro del cuadrado · ampliación de Ana

- **F · `06-bt-12-puntos`**: marco de una fila, 12 puntos grandes y BT original con refuerzo óptico.
- **G · `07-bt-20-puntos`**: una fila, 20 puntos y BT. Equilibrio recomendado para revisar a partir de 32 px.
- **H · `08-bt-28-puntos`**: una fila, 28 puntos y BT. Marco más continuo, más apropiado a partir de 48 px.

`comparativa-bt-puntos.png` compara F/G/H a tamaño real. Las ocho opciones siguen pendientes de elección. La comparativa anterior reúne A–E.

Todos los puntos, también los del marco doble de las composiciones completas, son círculos vectoriales de radio uniforme. Se eliminan los bordes irregulares del raster de referencia. E y F/G/H incluyen SVG específicos de 16/32/48/64 px; sus centros de puntos caen en medios píxeles y los PNG se renderizan directamente desde esos SVG, sin reducir una imagen grande. A 16 px, F/G/H reducen el marco a 12 puntos. BT sigue perdiendo lectura a ese tamaño: se recomienda el cuadrado vacío como favicon mínimo. Los SVG para 16/32/48/64 px son las referencias para reproducir esos tamaños concretos.
