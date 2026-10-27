# 15: Moneda única para toda la app

**Qué construir:** un selector de moneda (₡ / $) visible y único, colones por defecto, que cambia toda la app. La ficha deja de tener el botón de cambio; los filtros de precio se escriben en la moneda elegida; un rango con mínimo mayor que el máximo ya no se intercambia solo.

**Bloqueado por:** 14

**Status:** ready-for-agent

- [ ] Selector «₡ | $» en la cabecera de Explorar y en Mi cuenta/Cuenta (mismo componente, estado de `src/shared/currency.ts` en localStorage). Favoritos deja de tener su propio selector y sigue la elección.
- [ ] Ficha: precio en la moneda elegida y debajo la otra como referencia sin botón («≈ $186» / «≈ ₡95 000»). La barra no cambia de alto al hidratar ni al cambiar de moneda (cifras apiladas, como en `fcc14a6`); sin botón muerto antes de hidratar; hidratación sin avisos.
- [ ] Filtros: «Precio orientativo por noche» en la moneda elegida (placeholder y etiqueta con ₡ o $); se convierte a colones enteros para la consulta con `FX_CRC_PER_USD` (el dominio sigue en colones). Al volver a Filtros con un rango en dólares se ve en dólares.
- [ ] Mínimo > máximo: no se intercambian. Aviso «El precio mínimo no puede ser mayor que el máximo.» y «Ver N casas» desactivado hasta corregirlo. Una URL con `min > max` se trata como sin rango (decisión documentada); `parseFilters` y sus pruebas actualizadas.
- [ ] El tipo de cambio sigue siendo la constante; se dice que es orientativo.
- [ ] Unitarias (conversión de la entrada, rango inválido), Playwright (selector en Explorar y Mi cuenta → tarjetas, ficha y filtros; rango inválido), capturas Pixel 7 y 360 px. Baterías en verde.
