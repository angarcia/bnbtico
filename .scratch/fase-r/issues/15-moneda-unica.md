# 15: Moneda única para toda la app

**Qué construir:** un selector de moneda (₡ / $) visible y único, colones por defecto, que cambia toda la app. La ficha deja de tener el botón de cambio; los filtros de precio se escriben en la moneda elegida; un rango con mínimo mayor que el máximo ya no se intercambia solo.

**Bloqueado por:** 14

**Status:** done (2026-10-26)

- [x] Selector «₡ | $» en la cabecera de Explorar y en Mi cuenta/Cuenta (mismo componente, estado de `src/shared/currency.ts` en localStorage). Favoritos deja de tener su propio selector y sigue la elección.
- [x] Ficha: precio en la moneda elegida y debajo la otra como referencia sin botón («≈ $186» / «≈ ₡95 000»). La barra no cambia de alto al hidratar ni al cambiar de moneda (cifras apiladas, como en `fcc14a6`); sin botón muerto antes de hidratar; hidratación sin avisos.
- [x] Filtros: «Precio orientativo por noche» en la moneda elegida (placeholder y etiqueta con ₡ o $); se convierte a colones enteros para la consulta con `FX_CRC_PER_USD` (el dominio sigue en colones). Al volver a Filtros con un rango en dólares se ve en dólares.
- [x] Mínimo > máximo: no se intercambian. Aviso «El precio mínimo no puede ser mayor que el máximo.» y «Ver N casas» desactivado hasta corregirlo. Una URL con `min > max` se trata como sin rango (decisión documentada); `parseFilters` y sus pruebas actualizadas.
- [x] El tipo de cambio sigue siendo la constante; se dice que es orientativo.
- [x] Unitarias (conversión de la entrada, rango inválido), Playwright (selector en Explorar y Mi cuenta → tarjetas, ficha y filtros; rango inválido), capturas Pixel 7 y 360 px. Baterías en verde.

## Cierre (2026-10-26)

- **Selector único** `src/client/currency-switch.tsx` («₡ | $», grupo «Moneda de los precios»): en Explorar a la derecha del número de casas (desviación: en la fila del logo no cabe a 360 px y junto al título lo partía; está en la cabecera de resultados) y en Mi cuenta/Cuenta («Moneda», con el tipo de referencia). Favoritos pierde el suyo.
- **Ficha:** `PriceReference` en lugar del botón: la otra moneda debajo, sin botón, cifras apiladas (alto de la barra igual al hidratar y al cambiar; probado a 320 px y con la portada retenida). Sin avisos de hidratación.
- **Filtros:** precios en la moneda elegida (`priceInputToColones`/`colonesToPriceInput` en `domain/filters.ts`), ayuda con el tipo; mínimo > máximo → aviso y «Ver N casas» desactivado (también con Enter). `parseFilters`: URL con `min > max` = sin rango.
- **Pruebas:** unitarias nuevas en `filters.test.ts` (conversión, rango); Playwright: `explorar.spec.ts` (rango inválido, URL inválida, filtros en dólares → `min=43860&max=49980` y vuelta en $, moneda compartida con la ficha sin botón), `ficha.spec.ts`, `ficha-calendario.spec.ts`, `favoritos.spec.ts`; `medicion.spec.ts` mide el toque del corazón.
- **Baterías:** typecheck y build en verde; unitarias 641/641; base 164/164; Playwright 100/101 en la vuelta completa: `consultas.spec.ts:162` (contador de consultas) falló una vez y pasa sola (3/3), igual que el intermitente anotado en `88a3440`; Lighthouse ficha 1,60 s, shell 0,28 s. Zona privada 140,09 KB gz / 150.
- Capturas Pixel 7 y 360 px: Explorar, ficha, Filtros, Mi cuenta. Sin migraciones.
