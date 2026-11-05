# Viabilidad, costes y proyecciones de crecimiento

Fecha de referencia: 30 de octubre de 2026. Precios de proveedores consultados ese día.

Este documento reúne dos análisis: los costes de infraestructura y herramientas, y tres escenarios de crecimiento a 24 meses. Las cifras son estimaciones. Dependen de supuestos que se declaran aquí. Ningún supuesto de mercado está verificado para Costa Rica.

Cifras en dólares salvo indicación. Tipo de cambio: 510 colones por dólar. Los colones usan espacio como separador de miles y coma decimal.

## 1. Resumen

- Con ₡2 900 por casa, el modelo no recupera la captación pagada en 24 meses, en ningún escenario. En el escenario base, con ₡6 900 o más, sí la recupera antes del mes 24. Esto supone la misma conversión.
- La oferta de lanzamiento retrasa los ingresos casi un año. Por eso, la meta de 150 casas de pago a los 6 meses de la visión no es posible.
- Cada casa publicada cuesta entre US$75 y US$96 en marketing pagado. Cada casa genera unos US$41 de ingresos en sus primeros 24 meses.
- La infraestructura no limita el proyecto. Cuesta unos US$30 al mes fijos. A 24 meses, en el escenario optimista, el total con verificaciones por WhatsApp llega a unos US$109 al mes.
- Los visitantes que no pagan cuestan menos de US$1 por cada 1 000 sesiones.
- El precio es la palanca de ingresos más grande. Con ₡9 900 y la misma conversión, el ingreso a 24 meses es 3,4 veces el de ₡2 900. Nadie ha medido cuántas casas pagarían ese precio.
- Lo que decide la viabilidad es el coste de conseguir casas publicadas y cuántas pagan al terminar la oferta.
- Recomendación de precio: mantener ₡2 900 hasta medir la conversión real. Después, decidir un precio para las casas nuevas y corregir la tabla de agencias antes de publicarla (sección 8). Conviene probar con un presupuesto pequeño y medir antes de gastar más.

## 2. Límites gratuitos y tarifas de pago

| Herramienta | Plan gratuito | Cuándo se supera | Plan de pago |
|---|---|---|---|
| Cloudflare Workers | 100 000 peticiones al día y 10 ms de CPU por petición | Error de límite de CPU, más de 50 000 peticiones al día o CPU p95 mayor de 7 ms | 5 USD al mes. Incluye 10 M peticiones y 30 M ms de CPU. Después, 0,30 USD por millón de peticiones y 0,02 USD por millón de ms de CPU |
| Cloudflare Observability (registros) | 0,5 GB al día y 7 días de retención (desde el 1 de diciembre de 2026) | Más de 0,5 GB al día | Incluye 50 GB y 10 GB-mes. Después, 0,25 USD por GB y 0,10 USD por GB-mes |
| Supabase | 500 MB de base de datos, 1 GB de almacenamiento, 5 GB de salida y 50 000 usuarios activos al mes. Pausa tras una semana sin actividad. Sin copias diarias | Almacenamiento de 800 MB, salida de 4 GB al mes o base de 400 MB (disparadores de paso a pago) | Pro, 25 USD al mes. Incluye 8 GB de base, 100 GB de almacenamiento, 250 GB de salida y 100 000 usuarios activos. Copias diarias. Excesos: 0,125 USD/GB de base, 0,0213 USD/GB de almacenamiento, 0,09 USD/GB de salida y 0,00325 USD por usuario activo extra |
| Twilio Verify (código por WhatsApp) | Pago por uso | Siempre | Unos 0,05 USD por verificación más el mensaje de WhatsApp (unos 0,0147 USD con la tarifa de Estados Unidos). Tarifa de Costa Rica: no verificada. El modelo usa 0,065 USD por verificación |
| Stripe | Modo de prueba, sin coste | Al cobrar de verdad | Comisiones: no verificadas. No está en el modelo, porque el cobro real aún no tiene pasarela elegida |
| Cloudflare R2 (copias de seguridad) | No verificado | No verificado | No verificado |
| GitHub Actions | No verificado | No verificado | No verificado |
| GoDaddy (dominio) | No aplica | No aplica | Renovación anual: no verificada |
| Vercel (app anterior) | Plan Hobby gratuito | No aplica | Se retira en el corte. Fuera del modelo |
| OpenStreetMap (teselas del mapa) | Uso público con límites de política no verificados | Si el tráfico del mapa crece | No verificado. El escenario optimista genera unas 600 000 cargas de teselas al mes |
| ExchangeRate-API (tipo de cambio) | No verificado | No verificado | No verificado |
| Tiendas Apple y Google | No aplica | No aplica | Comisión de 15 % a 30 % si aplican las compras dentro de la app. Fuera de v1 y del modelo |
| Veriff (identidad) | No aplica | No aplica | Fuera de v1 (v1.1). Fuera del modelo |

### 2.1 Gasto fijo mensual

Desde el lanzamiento, el gasto fijo sería:

- Supabase Pro: 25 USD.
- Cloudflare Workers Paid: 5 USD.
- Total: 30 USD al mes.

Con los planes gratuitos, el gasto fijo sería cero. Pero Supabase pausa un proyecto gratuito tras una semana sin actividad, y no hace copias diarias. El cron diario del worker evita la pausa. Aun así, las copias diarias faltan. Por eso no se recomienda el plan gratuito para producción.

## 3. Coste de los visitantes que no pagan

Los visitantes que solo buscan y miran casas sí aumentan el coste. El aumento es pequeño.

Supuestos por sesión:

- 1,5 MB de fotos y datos.
- 10 peticiones al worker.
- 1 % de las sesiones se convierte en cliente verificado por WhatsApp.
- 20 % de las sesiones abre el mapa, con 25 teselas por vista.

| Concepto | Por cada 1 000 sesiones | Coste |
|---|---|---|
| Salida de datos | 1,5 GB | 0,14 USD, solo cuando se supera el límite de 250 GB |
| Peticiones al worker | 10 000 | 0 USD. Están dentro de los 10 M incluidos |
| Verificaciones por WhatsApp | 10 | 0,65 USD |
| Teselas del mapa | 5 000 cargas | No verificado |

Conclusiones:

- Por cada 1 000 sesiones, el coste es de unos US$0,80 cuando se supera el límite de salida. Sin contar las teselas.
- La salida incluida en Supabase Pro cubre unas 166 000 sesiones al mes sin coste extra.
- El riesgo real está en las teselas del mapa, no en el tráfico. Su precio no está verificado.
- La verificación por WhatsApp cuesta solo cuando un visitante se verifica. Una visita sin contacto no cuesta nada.

## 4. Supuestos de crecimiento

El lanzamiento no tiene comunidad previa. Todo el crecimiento viene de canales pagados y de SEO. Los propietarios son el cuello de botella, porque sin casas no hay búsquedas que convertir.

La oferta de lanzamiento sigue estas reglas:

- Las primeras 50 casas tienen 12 meses sin pagar.
- Las casas 51 a 100 tienen 6 meses sin pagar.
- Las casas 101 a 200 tienen 3 meses sin pagar.
- Desde la casa 201 no hay oferta aprobada. El modelo supone que esas casas pagan desde el primer mes.

| Supuesto | Conservador | Base | Optimista |
|---|---|---|---|
| Casas nuevas publicadas al mes (desde el mes 2) | 4 | 10 | 20 |
| Casas que pagan al terminar la oferta | 40 % | 60 % | 70 % |
| Bajas mensuales de casas de pago | 6 % | 5 % | 4 % |
| Marketing pagado | 300 USD al mes, desde el mes 2 | 1 000 USD al mes, desde el mes 3 | 2 000 USD al mes, desde el mes 3 |
| Visitas invitadas al mes (meses 6, 12 y 24) | 1 000 / 3 000 / 8 000 | 3 000 / 10 000 / 40 000 | 10 000 / 25 000 / 120 000 |

Este análisis mide solo los ingresos por suscripción. No incluye comisiones de pasarela, personal, soporte, impuestos ni tiendas de aplicaciones.

## 5. Resultados a 24 meses

| Resultado | Conservador | Base | Optimista |
|---|---|---|---|
| Casas publicadas, mes 12 | 44 | 110 | 220 |
| Casas publicadas, mes 24 | 92 | 230 | 460 |
| Casas de pago, mes 12 | 0 | 0 | 88 |
| Casas de pago, mes 18 | 7 | 75 | 199 |
| Casas de pago, mes 24 | 20 | 104 | 232 |
| Ingresos del mes 24 | 112 USD | 592 USD | 1 319 USD |
| Costes del mes 24 | 335 USD | 1 057 USD | 2 109 USD |
| Ingresos del año 1 | 0 USD | 0 USD | 895 USD |
| Costes del año 1 | 3 674 USD | 10 402 USD | 20 468 USD |
| Ingresos de 24 meses | 601 USD | 4 439 USD | 14 126 USD |
| Costes de 24 meses | 7 682 USD | 22 974 USD | 45 440 USD |
| Punto de equilibrio | No en 24 meses | No en 24 meses | No en 24 meses |

Los costes incluyen infraestructura, verificaciones y marketing. El marketing supone más del 90 % de los costes en los tres escenarios.

## 6. Economía por casa

| Concepto | Valor |
|---|---|
| Ingreso por casa en sus primeros 24 meses (casas 1 a 200, promedio) | Unos US$41 |
| Ingreso por casa en sus primeros 24 meses (casas desde la 201) | Unos US$48 |
| Valor de por vida sin límite de tiempo (60 % de conversión, 5 % de bajas) | Unos US$68 |
| Coste de marketing pagado por casa publicada | US$75 a US$96 |

Para recuperar el marketing pagado en 24 meses, cada casa debería costar menos de unos US$35. Ese margen deja espacio para comisiones y soporte.

Punto de equilibrio con 1 000 USD de marketing al mes:

- Hacen falta unas 185 casas de pago (1 050 USD entre 5,69 USD por casa).
- Para mantener 185 casas de pago con 5 % de bajas, hacen falta unas 9 altas de pago al mes.
- Con 60 % de conversión, eso son unas 15 casas publicadas al mes.

## 7. Sensibilidad al precio

| Precio mensual por casa | Ingreso a 24 meses, misma conversión (base) | Conversión que iguala el ingreso de ₡2 900 (base) | Mes de equilibrio: conservador / base / optimista |
|---|---:|---:|---|
| ₡2 900 (US$5,69) | US$4 439 | 60 % | No / No / No |
| ₡4 900 (US$9,61) | US$7 500 | 35,5 % | No / No / Mes 22 |
| ₡6 900 (US$13,53) | US$10 561 | 25,2 % | No / Mes 20 / Mes 15 |
| ₡9 900 (US$19,41) | US$15 153 | 17,6 % | Mes 23 / Mes 17 / Mes 13 |

Cada fila cambia solo el precio. La conversión no cambia en las columnas de ingreso y equilibrio. La última columna del cuadro muestra la conversión que haría falta para ganar lo mismo que con ₡2 900. Nadie ha medido la conversión a otros precios. Por eso este cuadro no es una recomendación. Un cambio de precio requiere una decisión del equipo y una entrada en `docs/decisiones.md`.

## 8. Recomendaciones de precio

Estas recomendaciones no cambian ningún precio. Cada cambio necesita una decisión del equipo y una entrada en `docs/decisiones.md`.

1. **Mantener ₡2 900 como precio de lista.** Es el precio decidido el 2026-10-27. Nadie ha medido cuántas casas pagarían más. Subirlo sin datos es una apuesta.
2. **Medir la conversión antes de subir.** A ₡4 900 hacen falta el 35,5 % de las casas que paguen. A ₡6 900, el 25,2 %. A ₡9 900, el 17,6 %. Medir el porcentaje que paga al terminar la oferta, con las primeras casas que la terminen.
3. **Subir el precio solo para las casas que entren después.** Ejemplo: las casas 1 a 50 siguen en ₡2 900. Las casas desde la 51 pagan ₡4 900 al terminar su oferta. Con la conversión base (60 %), el ingreso a 24 meses sube de US$4 439 a US$6 634. Los primeros propietarios ya conocen ₡2 900. Explicar la diferencia es lo más delicado de esta opción.
4. **No recortar la oferta todavía.** El modelo supone las mismas altas con cualquier oferta. Por eso no puede medir cuántas casas se pierden al ofrecer menos meses. Las variantes de esta tabla no son una recomendación.

| Oferta (meses para los tramos 1–50 / 51–100 / 101–200) | Ingreso a 24 meses | Ingreso del mes 24 |
|---|---:|---:|
| 12 / 6 / 3 (vigente) | US$4 439 | US$592 |
| 12 / 3 / 0 | US$5 473 | US$538 |
| 6 / 3 / 0 | US$6 044 | US$508 |
| Sin oferta | US$6 714 | US$473 |

Sin oferta, el ingreso a 24 meses es mayor porque las casas pagan antes. El ingreso del mes 24 es menor porque las bajas empiezan antes.

5. **Pago anual: decidir antes de ofrecerlo.** El pago anual cuesta ₡29 000 por adelantado, es decir ₡2 417 al mes. Eso es unos 17 % menos que pagar cada mes. El modelo no lo incluye. Hay dos puntos por decidir. El primero es qué pasa con el año pagado si la casa se da de baja. Choca con la regla de no tener permanencia. El segundo es si se combina con la oferta gratuita.
6. **Corregir la tabla de agencias antes de publicarla.** US$7 equivale a ₡3 570 por casa. Eso es más que la tarifa individual de ₡2 900. Una agencia con 50 casas pagaría más que 50 propietarios individuales. Propuesta de partida, sin validar: tramos marginales en colones. Cada precio se aplica solo a las casas de su tramo.

| Casas de la agencia | Total con tramos (₡ al mes) | Total con tarifa individual (₡ al mes) | Diferencia |
|---|---:|---:|---:|
| 5 | 14 500 | 14 500 | 0 % |
| 10 | 28 500 | 29 000 | −2 % |
| 25 | 64 000 | 72 500 | −12 % |
| 50 | 111 500 | 145 000 | −23 % |

Tramos: de 1 a 9 casas, ₡2 900 cada una. De 10 a 24, ₡2 400. Desde 25, ₡1 900. Con tramos marginales, el total no baja al añadir una casa. Esto se comprobó hasta 200 casas. Quedan por definir si las casas en oferta cuentan para el tramo y cuánto cuesta el soporte de una agencia grande.

## 9. Riesgos

1. **Oferta larga.** Las casas sin pagar retrasan el primer ingreso casi un año. Si los propietarios no reciben contactos, no pagarán al terminar la oferta.
2. **Oferta de casas por zona.** Sin casas en una zona, las búsquedas de clientes no convierten.
3. **SEO más lento de lo previsto.** Solo la ficha de cada casa sale ya renderizada desde el servidor. Explorar y las páginas por zona no. Las páginas por zona están aplazadas para después del lanzamiento, y cambian la regla de renderizado del servidor.
4. **Pérdida en la verificación.** Cada cliente que quiere escribir debe verificarse por WhatsApp. Cada paso pierde visitantes. Este paso no está medido.
5. **Teselas del mapa.** Si el tráfico del mapa crece, el proveedor puede cobrar más. Su precio no está verificado.
6. **Costes sin modelar.** Comisiones de pasarela, soporte, personal, impuestos, dominio, GitHub Actions, R2, Veriff y tiendas de aplicaciones.
7. **Planes gratuitos.** Supabase Free pausa el proyecto y no hace copias diarias. Workers Free puede agotar su límite diario en un pico de visitas.

## 10. Recomendaciones

1. **Censar los alquileres de una sola zona antes de gastar en marketing.** Contar los anuncios activos en Airbnb, Facebook y las agencias de la zona.
2. **Captar propietarios de forma directa.** Usar contacto personal, grupos de propietarios, referidos y agencias. Meta: 10 casas publicadas al mes.
3. **Comprar tráfico de clientes solo en una zona con al menos 20 casas activas.** Antes, la publicidad envía visitas que no encuentran casas.
4. **Probar con un presupuesto pequeño.** La prueba de 200 USD que describe `docs/marketing.md` aún no está autorizada. Seguir invirtiendo solo si el coste por casa publicada queda por debajo de unos US$35.
5. **SEO: páginas de zona fuera de v1** (decisión del 2026-10-30). Se reabren con impresiones sostenidas en Search Console y una zona con 10 o más casas activas; entonces la regla de renderizado del servidor pasa a incluir las páginas de zona.
6. **Medir indicadores de adelanto.** Casas publicadas al mes, consultas por casa, respuesta de propietarios, paso a verificación y coste por casa publicada. Los pagos reales llegan de 3 a 12 meses después de publicar.
7. **Ajustar la meta de la visión.** Cambiar "150 casas de pago a los 6 meses" por una cifra que la oferta permita. `docs/vision.md` está marcado como desactualizado en su propia nota.
8. **Decidir el precio con datos.** Antes de cambiar los ₡2 900, revisar la sección 8.

## 11. Datos que faltan

| Dato | Por qué importa | Cómo obtenerlo |
|---|---|---|
| Tamaño del mercado de una zona | Limita las casas posibles | Contar anuncios activos en Airbnb, Facebook y agencias |
| Coste por clic y por registro en Costa Rica (Meta y Google) | Define el coste de captación | Prueba pequeña con presupuesto fijo |
| Conversión de propietarios al terminar la oferta | Define los ingresos | Medir con las primeras casas que terminan la oferta |
| Conversión a precios de ₡4 900 o más | Define si subir el precio gana ingresos | Probar un precio distinto con las casas nuevas y medir |
| Tarifa de Twilio para Costa Rica | Coste por verificación | Consultar la tarifa de Twilio |
| Precio del proveedor de teselas | Coste del mapa | Consultar su política y tarifa |
| Comisión de la pasarela elegida | Ingreso neto | Elegir la pasarela y consultar su tarifa |
| Precios de R2, GitHub Actions, GoDaddy y ExchangeRate-API | Costes fijos menores | Consultar la página de cada proveedor |

## 12. Método

El modelo calcula cada mes durante 24 meses:

- Las casas nuevas se publican según el escenario, desde el mes 2.
- Cada casa tiene una oferta según su orden de publicación. Su pago empieza al terminar la oferta.
- Casas de pago en el mes t: suma, por cada grupo, de casas × conversión × (1 − bajas) elevado a los meses desde el inicio del pago.
- Ingreso: casas de pago × precio ÷ 510. El precio es ₡2 900 salvo en las secciones 7 y 8.
- Infraestructura: 30 USD fijos, más el exceso de salida y de peticiones.
- Exceso de salida: 0,09 USD por GB por encima de 250 GB. Exceso de peticiones: 0,30 USD por millón por encima de 10 M.
- Verificaciones: 1 % de las visitas más las casas nuevas, a 0,065 USD cada una.
- Visitas: interpoladas en línea recta entre los meses de referencia, desde 500 visitas en el mes 1.
- Por visita: 1,5 MB de salida y 10 peticiones.
- Coste total: infraestructura, verificaciones y marketing.

Los cambios de precio de la sección 7 mantienen la conversión. No suponen que los propietarios paguen igual a otro precio.

El modelo no incluye pasarela, personal, impuestos ni tiendas de aplicaciones.

## Documentos relacionados

- `docs/business-model.md`: modelo de negocio. Algunas partes están superadas.
- `docs/marketing.md`: plan de marketing y prueba de 200 USD pendiente de autorizar.
- `docs/vision.md`: objetivos de la visión. Marcado como desactualizado.
- `docs/antes-de-produccion.md`: pendientes antes del lanzamiento.
- `docs/telemetria.md`: medición de visitas, errores y tiempos de carga.
