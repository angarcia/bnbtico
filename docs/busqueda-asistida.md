# Pedir casa y búsqueda asistida · 2026-10-07

> **Nota 2026-10-15.** Partes de este documento están superadas. Reglas vigentes en `CLAUDE.md` y `docs/plan-implementacion.md`; el prototipo (vista Móvil) es la especificación de v1. En particular: WhatsApp verificado es lo único obligatorio (Veriff opcional, fuera de v1); contacto directo por WhatsApp sin solicitud/aceptación; sin reclamaciones en la app; colones con visualización en dólares; «Mensual» en vez de «Largo plazo».


## Estado vigente · 2026-10-12

**Búsqueda asistida por IA pendiente de evaluación, no aprobada para incorporarse.** Fuera de v1, sin compromiso para v2 ni fecha. El prototipo no muestra su entrada ni registra la ruta asistida. Se conserva el simulador como exploración histórica; las propuestas de IA, cuotas, créditos y precios de abajo son condicionales a una futura aprobación.

**Pedir casa sí permanece en v1** como formulario gratuito sin IA. `assisted-search.js` sigue cargado porque también contiene su matching y validación de presupuesto; ocultar el asistente no debe retirarlos.

## Dos opciones diferentes

- **Pedir casa:** formulario gratuito, sin IA ni consumo de búsquedas. El cliente marca filtros obligatorios, revisa coincidencias y consiente compartir contacto con un máximo de 10 owners verificados compatibles. Identidad obligatoria al enviar. WhatsApp directo según `contacto-whatsapp.md`.
- **Búsqueda asistida:** conversación con un asistente para explorar el catálogo. No envía solicitudes ni comparte teléfonos automáticamente. El cliente elige una casa y solicita contacto desde la ficha.
- Buscar y filtrar el catálogo sigue siendo gratuito.

## Preguntas y reglas

Datos básicos: vacaciones/para vivir, zona (una, varias o indiferente), fechas/duración/flexibilidad, personas, presupuesto con moneda (total de estadía o mensual; puede quedar sin definir) e imprescindibles. Para comparar un total vacacional hace falta el número de noches.

La IA de producción debe aprovechar lo ya dicho y preguntar solo lo que falte. Las preferencias ordenan resultados; los imprescindibles los excluyen. Muchos resultados permiten preguntar por una característica que realmente distinga las casas; pocos permiten mostrarlos ya. Siempre se puede ver resultados sin seguir afinando. Sin coincidencias, proponer cambios explícitos: nunca relajar filtros silenciosamente.

Filtros adicionales previstos: habitaciones y baños mínimos, tipo de alojamiento, mascotas, piscina, aire acondicionado, wifi, parqueo/cochera, cargador eléctrico, frente al mar, BBQ, amueblado, sin depósito y necesidades concretas de accesibilidad. No preguntar diagnósticos. No exigir completar todas las opciones.

Ni la IA ni el formulario deben inventar disponibilidad, amenidades o precios finales. Una amenidad obligatoria sin datos confirmados no cumple el filtro. Fechas y condiciones se confirman con el owner. No presentar una preferencia como obligación ni interpretar automáticamente negaciones mediante coincidencias de palabras.

## Cuotas y extras: dirección de producto, no implementada

Las búsquedas incluidas mensuales dependerán del presupuesto disponible a partir de suscripciones cobradas, después de otros costes. Harán falta techo global de gasto y límites por usuario/conversación; no garantiza ausencia de pérdidas. Comunicar el cupo al empezar el mes, sin retirar a mitad de mes búsquedas ya concedidas.

Refinar la misma búsqueda no cobra por mensaje. Extras opcionales por búsqueda asistida; ₡100 es referencia de discusión pendiente de validar, no tarifa definitiva ni cobro activo. Un fallo técnico no debe consumir el crédito. No se garantiza encontrar una casa ni reservarla. Fórmula, cupos, duración de sesión y pasarela pendientes; no integrar Stripe en esta iteración.

## Alcance real del prototipo

`design/prototype/assisted-search.js` contiene un simulador determinista, no una IA. Pregunta los campos básicos, acepta respuestas concretas o botones rápidos, valida moneda/monto, muestra resumen editable y afina con amenidades que diferencian los resultados. No entiende lenguaje natural general ni extrae varios campos de una sola frase. El texto de fechas se conserva, no consulta calendario. No hay API, cobros, cuotas reales, mensajes ni persistencia al recargar.

El formulario usa los mismos filtros estructurados para modo, zona, personas, amenidades y presupuesto orientativo. No convierte divisas: con presupuesto solo compara anuncios en la moneda seleccionada. Las notas libres se envían como notas y ya no marcan chips por palabras sueltas. Las solicitudes nuevas se guardan en memoria con sus destinatarios, consentimiento y sin respuestas ficticias. Cuenta/identidad son simuladas. Las solicitudes históricas precargadas conservan sus ejemplos antiguos; no son prueba de coincidencia con las reglas nuevas.

Pruebas: `node tests/prototype/assisted-search.cjs` mantiene cobertura del matching vigente y del simulador histórico; `v1-scope.cjs` comprueba que el asistente no se exponga en v1 y que Pedir casa siga funcionando. La revisión móvil/web de v1 debe mostrar únicamente el acceso al formulario, sin entradas ni ruta de IA.
