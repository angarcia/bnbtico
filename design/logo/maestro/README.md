# Maestro vectorial · 2026-11-05

Referencia aprobada por Ana: `referencia-aprobada.png`, letras del logo cuadrado de Instagram, ambas B a altura normal y solo T elevada. La rana sale de las variantes vigentes de las cuatro carpetas de esta revisión.

- `bnbtico.svg`: palabra en trazados, sin imágenes incrustadas ni fuentes.
- `bnbtico-com.svg`: misma palabra, C/O repetidas del maestro, punto geométrico y M trazada desde `referencia-m.png`, la imagen que Ana adjuntó en este chat.
- PNG homónimos: exportaciones transparentes de 2400 px de ancho.
- `geometria.json`: medidas y procedencia de los glifos.
- `generar.cjs`: extracción de contornos subpíxel, curvas y exportaciones reproducibles con sharp.
- `previsualizar.cjs`: comparativas.
- `previsualizar-negro-fotos-bt.cjs`: paquete negro/fotos y comparativa BT con 12/20/28 puntos.
- `verificar.cjs`: comprueba independencia de fuentes, geometría compartida, fondos y formatos.
- `sincronizar.cjs`: copia de seguridad y actualización de las cuatro carpetas indicadas.

No se ha sustituido la letra por una fuente parecida ni se han regenerado variantes con IA. El trazado es una reconstrucción vectorial a partir del raster aprobado, con interpolación y suavizado subpíxel; no es identidad píxel a píxel. La coincidencia de silueta medida a resolución original es 98,9 % (intersección/unión). Se conserva la irregularidad de las letras.

Para ejecutar, Node y sharp deben estar disponibles. Ejemplo: `NODE_PATH=/ruta/a/node_modules node design/logo/maestro/generar.cjs`, desde la raíz del repo. No ejecutar toda la cadena por defecto: varios scripts recrean entregas intermedias. Para comprobar la biblioteca final sin regenerar el diseño, usar `verificar-biblioteca.cjs` (actualiza inventario y reporte). `generar-portadas-sociales.cjs` exporta las dos portadas; `generar-bt-sin-marco.cjs` reutiliza BT para el perfil circular. `generar-guia-marca.cjs` y `generar-guia-pdf.cjs` generan la guía. Revisar el destino de cualquier regenerador antes de ejecutarlo.

Los originales están en `../historico/2026-11-05-antes-unificacion/`. El original del prototipo se conserva intacto en `../logos-obsoletos/2026-11-05/design/prototype/assets/bnbtico-original.png`; el prototipo activo utiliza el SVG nuevo. Los PDF de tarjetas anteriores no se regeneran automáticamente.

Los puntos se reconstruyen como círculos geométricos de radio uniforme, conservando la posición del marco de referencia. Los iconos de puntos E/F/G/H cuentan con SVG a tamaño nativo y centros ajustados a medios píxeles para las exportaciones pequeñas.

La entrega de referencia es [la biblioteca completa](../biblioteca-completa-2026-11-05/LEAME.md). Las carpetas intermedias también son entradas de algunos scripts y del campo `reusedFrom` del inventario: no moverlas ni eliminarlas sin actualizar esas referencias.
