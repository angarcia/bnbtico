# Plan · maestro del logo y variantes

Spec: spec.md. Ejecución directa en este chat, sobre los recursos locales indicados por Ana; sin despliegue ni cambios de código de la aplicación.

- [x] Conservar referencias y originales; separar las letras aprobadas y vectorizar sus contornos.
- [x] Construir BNBTICO y BNBTICO.COM desde los mismos glifos; exportar SVG y PNG sobre transparente, blanco y arena.
- [x] Preparar Instagram y merchandising sin rana y cinco alternativas compactas reutilizando los glifos.
- [x] Inspeccionar las imágenes, comprobar contornos, fondos, dimensiones y coincidencia entre variantes; registrar decisión y empaquetar.

Verificación: renderizar los SVG con sharp; comprobar que no contienen text/image/font, que todos los glifos de BNBTICO.COM proceden del maestro, fondos opacos uniformes, y comparar el trazado con la referencia a resolución original. Revisar visualmente BNBTICO, dominio y opciones a 16/32/48/64 px. No se añaden pruebas de aplicación para este cambio de recursos gráficos.

Verificado: 62 SVG sin fuentes ni imágenes; silueta 98,921 % de intersección/unión frente a la referencia; fondos planos; mismo path en BNBTICO y BNBTICO.COM; 5 alternativas compactas y sus ICO. Comparativas revisadas en el visor. La B compacta es propuesta, no elección de Ana.

Ampliación completada: cuatro composiciones × todos los colores/fondos; fotos transparentes; crema #FFFBF2; opción E de cuadrado vacío, con reducción de puntos en 16–32 px.

Ampliación completada: negro puro/foto; propuestas F/G/H de BT en cuadrado, círculos geométricos en todos los marcos y SVG nativos de iconos. Verificación: 88 SVG y comprobación de los centros y núcleos de tinta de cada punto pequeño.

Corrección de tinta completada: crema sobre negro/tinta oscura/verde selva en las cuatro composiciones; blanco transparente sobre fotos. Variantes blancas sobre oscuro archivadas, paquetes reconstruidos.

Selección final completada: seis tamaños según elección explícita de Ana; 42 SVG nativos y PNG1×/2×/3×, siete ICO. Coincidencia exacta con las seis referencias elegidas y revisión visual de la tira final. Decisión y diseño v1 actualizados.

Regeneración final completada: B hasta32, BT desde48; predeterminado terra/crema, alternativa crema/terra; SVG y PNG densidades1×/2×/3×, ICO por tamaño y favicon B dedicado. Kit final organizado y comprobado.

## Biblioteca completa por uso (solicitud ampliada)

Reutilizar el kit aprobado y añadir exportaciones por plataforma: cabeceras web 1×/2×/3×, iconos PWA y capas adaptativas Android, iOS y tiendas, perfiles sociales, escritorio, vectores EPS CMYK y PNG RGB de impresión a 300 ppp. Conservar maestros, formas y colores; generar catálogo visual, inventario con procedencia y paquete ZIP. Verificar dimensiones, transparencia, DPI, CMYK y márgenes de recorte antes de entregar.

Biblioteca por plataforma completada en `design/logo/biblioteca-completa-2026-11-05/`. Reutilizados 350 archivos aprobados; exportaciones adicionales por tamaño/formato sin nuevos diseños. Cabeceras web transparentes, tiendas, PWA maskable, Android por capas y monocromo, catálogo iOS, capas Icon Composer, redes, ICO/ICNS y 60 EPS + PDF CMYK de 60 páginas. PNG de impresión RGB a 300 ppp; perfil ICC genérico incluido. Vista general comprobada en Chrome en los diez acabados y a 390 px sin errores/desbordamiento; PDF renderizado y revisado; dimensiones, alfa, hash de recursos reutilizados, DPI, vectores sin fuentes/mapas de bits, CMYK y zonas seguras comprobados. Accesos rápidos y colores transparentes separados para facilitar la revisión. No se cambia la aplicación.

Aclaración final de Ana: las cuatro composiciones usadas en web siempre transparentes (terracota/negro/crema; blanco para fotos), sin rectángulo crema. Fondos sólidos reservados a perfiles e iconos. Carpeta `03-web/` depurada de variantes opacas, `LOGOS-TRANSPARENTES/` reúne SVG/PNG de las cuatro composiciones en las tres tintas y `EMPEZAR-AQUI/` usa terracota transparente.

## Ampliación autorizada: archivar rana y sustituir referencias activas

Ana pide guardar el juego antiguo en logos-obsoletos y garantizar sustitutos para todas las referencias de código. Inventario: PNG de compatibilidad de design/logo usados por maquetas/tarjetas; dos apps, favicon y manifest PWA; portada e imagen OG; original del prototipo. Guardar cada original con ruta y hash antes de sustituir; conservar nombres públicos como alias de la nueva marca; prototipo pasa a SVG nuevo sin regenerar su PNG original (se archiva). Añadir módulo para quitar el recorte antiguo y probarlo primero. Validar todas las rutas y alfa, ejecutar las pruebas de prototipo y revisar en navegador móvil prototipo/portada/maqueta. No desplegar.

Ampliación de archivo completada: 53 sustituciones documentadas con SHA-256 y respaldo anterior; original del prototipo idéntico a Git, conservado intacto en logos-obsoletos. Referencias activas del prototipo actualizadas a SVG; alias de cabecera/manifest/iconos/OG para ambas apps y maquetas vigentes. Prueba nueva vista fallar antes del cambio y pasar después; suite completa de prototipo ejecutada directamente con Node: 35/35. Chrome: prototipo móvil, portada, maqueta, imágenes de logo y las nueve rutas de recursos HTTP 200, sin errores. Sin compilación de apps: dependencias ausentes y registro npm inaccesible (pnpm intentó instalar y se interrumpió tras ENOTFOUND). No se cambia lockfile ni paquetes y no se despliega.

Regla final de transparencia general aplicada: todos los aliases predeterminados del nombre y de las composiciones con puntos, maestros y PNG de impresión son transparentes. También los del kit previo, nombres sin sufijo y alta resolución. Fondos conservados únicamente como acabados deliberados para perfiles/iconos o usos explícitos. PDF y EPS reexportados desde esos maestros; verificación y ZIP actualizados.

Propuesta de negro suave para merchandising (pendiente de elección): carbón cálido #2B2926 recomendado, neutro #292929 y tinta vigente #1C2B2A; negro puro como referencia. Comparativa y SVG/PNG transparentes en design/merchandising/propuestas-negro-suave-2026-11-05/. No cambia todavía el negro de los archivos aprobados.

Colores finales aplicados: tinta #1C2B2A para las variantes oscuras de pantalla; carbón cálido #2B2926 para merchandising y maestros de impresión. Alias negros conservados según contexto; colores originales de interfaz intactos. Nuevos maestros nombrados explícitamente, PNG transparentes y CMYK ICC regenerados.

Guía de marca solicitada: 15 páginas con historia aportada por Ana, misión/visión, principios, públicos, cuatro composiciones, protección y tamaños, usos incorrectos, colores y referencias CMYK, tipografía Figtree/Outfit, fotografía, voz de usted, símbolos, impresión y ejemplos de aplicaciones. Historia sin nombrar la villa ni afirmar inexistencia de competidores. Fuentes OFL incluidas. Edición 1.0 para revisión, sin Pantone inventado y con mínimos físicos pendientes de prueba de producción.

Guía completada y comprobada: 15 páginas A4, PDF renderizado con Poppler e inspeccionado visualmente, texto extraído comprobado, ninguna página con contenido sobre el pie, imágenes/fuentes cargadas sin errores. Fuentes estáticas y variables con licencias OFL incluidas; plantilla HTML y contenido editables. Once acabados de la galería revisados en Chrome, sin imágenes rotas ni desbordamiento móvil. Geometría de las cuatro composiciones idéntica entre tinta y carbón (solo cambia el color), PNG transparentes y 18 PNG de imprenta carbón a 300 ppp. 60 maestros EPS/PDF CMYK, originales de negro puro de imprenta archivados. Guía y colores finales incluidos en el ZIP verificado por CRC y SHA-256.

## Revisión de organización · 2026-11-06

Índice de entrega vigente y accesos por uso; perfiles y portadas finales documentados. Carpetas intermedias y propuestas identificadas sin romper sus rutas ni las entradas de los generadores. ZIP locales excluidos de Git por duplicación. Referencias activas a rana en tokens y prueba manual C100 corregidas; sin cambios en los valores de color. Verificación actual e inventario se registran en design/logo/verificacion-organizacion.json. Preparar solo los archivos de marca y los fragmentos de documentación correspondientes; conservar sin añadir los cambios de otras tareas.
