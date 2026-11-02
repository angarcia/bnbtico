# 11 · Filtro de precio con deslizador e histograma

Status: ready-for-agent (después del 06 y 07)

## Qué
Ana: «El filtro por precio debería ser de este tipo (con los estilos, colores de bnbtico)», con la referencia de Airbnb «Tu presupuesto (por noche)»: histograma de barras de precios y un deslizador de dos tiradores debajo.
- Sección de Filtros «Precio orientativo por noche» (`client/screens/filtros.tsx:200-243`): encima, la cifra del rango («₡20 000 – ₡150 000+», en la moneda elegida); el histograma (barras de los precios por noche de las casas de la búsqueda actual **sin** el rango de precio; las barras dentro del rango en terracota, fuera en gris claro, tokens de `design/tokens/tokens.json`); el deslizador de dos tiradores con los colores de bnbtico; debajo, se quedan los campos «Mínimo» y «Máximo» (etiquetas accesibles actuales; los dos se sincronizan con el deslizador).
- Topes: del precio más bajo al más alto de esa búsqueda (redondeados); el tope de arriba significa «sin máximo» (`max` vacío en la URL, texto «+»).
- La URL sigue guardando colones enteros `min`/`max`. Conversión con el tipo de cambio como hoy (`priceInputToColones`, `colonesToPriceInput`).
- Datos: una consulta con los filtros del borrador salvo `min`/`max` (hasta 60 casas, `SEARCH_LIMIT`). El conteo «Ver N casas» no debe dispararse en cada píxel del arrastre: al soltar o con espera corta.
- Deslizador accesible: dos `<input type="range">` nativos superpuestos o equivalente con teclado y `aria-valuetext` en la moneda.
- Filtros va en el arranque del shell: el deslizador y el histograma en un trozo diferido si no caben (mida `pnpm size`).

## No tocar
- Regla «mín > máx» (error y botón desactivado) para lo escrito en los campos.
- Moneda única (ticket 15, 2026-10-26).
- Título «Precio orientativo por noche» (revisión UX 2026-10-29).

## Pruebas
- `explorar.spec.ts:70-120` deben seguir pasando con los campos; añadir arrastrar un tirador → URL y «Ver N casas» cambian.
- Unit del cálculo de cubetas del histograma y de los topes.
- Guía `docs/pruebas-manuales.md` (Filtros, precio).
