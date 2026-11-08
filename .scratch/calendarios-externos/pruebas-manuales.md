# Plan manual propuesto · épica #4

Estado: pendiente de ejecución y comprobaciones técnicas de entrada. Diseño móvil v0.1 y reglas de producto consultadas P1–P6 aprobados por Ana el 2026-11-07. No sustituye `docs/pruebas-manuales.md`: incorporar allí los casos aceptados al implementar cada entrega. Ana ejecuta comandos; Daniel verifica despliegues. No acceder mediante herramientas a `pruebas.bnbtico.com`.

## Preparación y evidencia

Usar entorno local ya existente sin start/reset/stop del Supabase compartido; casa desechable del dueño A, segunda casa y otro dueño B, sesión anónima y fixtures iCal sin datos personales. No tocar las diez casas reservadas de prueba. Contar con alojamiento Airbnb de prueba autorizado para comprobación externa; sin él, se puede verificar el feed/fixtures, pero queda pendiente la integración real con Airbnb.

Fixtures: evento de día completo 10–13 del mes siguiente, cambio 11–14, cancelación, vacío válido, dos eventos solapados, cruce de mes/año y bisiesto, límites hoy/hoy+365, fuera de ventana, HTML en vez de ICS, descarga truncada, timeout, UID contradictorio, horas y recurrencias según la decisión P2. Bloqueo manual en 11 y precio especial allí y en 12.

Para cada caso guardar historia, entorno, viewport, pasos, esperado/observado y evidencia sin URLs/token; no copiar enlaces privados a capturas compartidas. Probar móvil en 375×667 y 390×844, texto largo, zoom 200 %, teclado, foco y lector. La adaptación y las pruebas específicas de escritorio quedan aplazadas por acuerdo de Ana del 2026-11-07 y no bloquean estas entregas. No atribuir usabilidad a usuarios sin observar una sesión real.

## #5 · I · Importación

1. Abrir Calendario, elegir casa y conectar fixture 10–13. Esperado: carga, éxito, 10–12 ocupados, 13 libre salvo otro origen; última importación real.
2. Elegir otra casa y volver. Esperado: sin mezcla de conexión, noches o precio.
3. Leer de nuevo el mismo fixture mediante arnés de prueba. Esperado: sin duplicados. Cambiar/eliminar evento y repetir: cambia solo importado; 11 manual sigue ocupado y precio especial se conserva.
4. Quitar manual donde también existe importado. Esperado: sigue ocupado con explicación; nunca éxito «Disponible» falso. Probar selección mixta.
5. Probar vacío válido, límites y eventos no admitidos según P1–P3. Esperado: vacío es éxito; fallo completo conserva resultado previo, sin liberaciones parciales.
6. Conectar URL errónea, HTML, timeout, sin red, como B y con sesión vencida. Esperado: explicación, sin modificación ni éxito falso.
7. En sesión anónima buscar 10–13 y consultar la ficha vigente: respeta todas las noches; estancia que solo sale el 10 no se bloquea por la noche del 10. No se añade pantalla pública ni se expone procedencia.

## #6 · E · Exportación

1. Generar/copiar enlace y leerlo sin sesión con cliente iCal independiente. Esperado: calendario válido solo lectura, exclusivo de esa casa, sin datos personales/precios.
2. Manual 10–12 produce fin exclusivo 13; importado solo no se exporta; coincidencia manual/importado se incluye una vez.
3. Quitar manual y volver a consultar: desaparece aunque Airbnb siga bloqueando localmente; sin manuales produce ICS válido vacío.
4. Abrir WhatsApp desde ficha: no crea noches ni eventos exportados.
5. Denegar portapapeles y simular error de generación: recuperación manual/error sin éxito ficticio ni desbordamiento de URL.
6. Añadir en Airbnb de prueba siguiendo instrucciones verificadas. Registrar cuándo se ve el bloqueo, sin deducir una garantía de tiempo a partir de esta observación.

## #7 · G · Gestión

1. Actualizar sin cambios y con cambios: fecha de éxito correcta. Provocar fallo posterior: fecha anterior permanece y error posterior visible.
2. Dos toques/dos pestañas y lectura lenta: una ejecución. Cambiar casa: estados aislados.
3. Sustituir por URL inválida y luego válida: conserva anterior hasta éxito. Cerrar y volver durante lectura refleja el resultado real.
4. Cancelar desconexión: intacto. Confirmar: solo retira importados; manuales, precios y exportación permanecen. Resolver lectura antigua retenida tras desconectar: no reaplica noches.
5. Cancelar revocación: enlace funciona. Confirmar y leer antiguo en sesión anónima con caché previa: deja de acceder. Generar nuevo: distinto; importación intacta. Mensaje pide retirar el viejo de Airbnb sin prometer desaparición inmediata.
6. Fallar gestión y perder respuesta de red: no mostrar éxito falso; recuperar estado antes de repetir. Escape/X/Cancelar y Atrás devuelven foco/contexto.

## #8 · A · Automática

1. Con reloj controlado, modificar fixture y llegar al siguiente ciclo: cambia sin pulsar Actualizar; fecha real visible.
2. Fallar un ciclo y recuperar en el siguiente: conserva último válido durante error, se recupera sin intervención.
3. Solapar manual y programada, desconectar/sustituir con trabajo en vuelo, varias casas con una fallida: exclusión, resultados obsoletos descartados y aislamiento.
   Con una casa pausada por su anfitrión, modificar o cancelar un evento en Airbnb y ejecutar el siguiente ciclo: se actualizan sus bloqueos importados aunque no salga en Explorar. Volver a publicarla conserva el calendario actualizado; la importación no debe deshacer la pausa.
4. Verificar ciclo real en entorno autorizado registrando intentos separados tres horas y tolerancia acordada; comprobar que los trabajos horarios previos siguen funcionando. Simulación y programador real se aceptan por separado.

## R · Regresión por entrega y aceptación

Eliminar definitivamente una casa desechable por un procedimiento existente autorizado: comprobar que cesan las importaciones y que su enlace de exportación deja de funcionar, incluidos accesos con caché previa. Una lectura iniciada antes de eliminarla no puede reaplicar bloqueos ni reactivar la conexión. Este caso no autoriza borrar casas existentes de otros usuarios ni crear un nuevo flujo de eliminación.

Casa bloqueada o rechazada por bnbtico: comprobar que se suspende la importación y que el enlace de exportación deja de servir disponibilidad durante la suspensión, incluidos accesos con caché previa; los datos existentes se conservan. Una respuesta de lectura iniciada antes del bloqueo no debe aplicar cambios después de este. No confundirlo con la pausa del anfitrión, que mantiene las actualizaciones. Al levantar el bloqueo administrativo, comprobar lectura nueva y reactivación de las conexiones suspendidas por ese motivo; si falla la lectura, conserva los últimos bloques y muestra error. Las que el anfitrión desconectó o revocó no se reactivan.

Repetir guía vigente A94–A107 (selector, meses, precio, reserva manual, pausa y sin red), C50–C67 (disponibilidad/contacto), búsqueda por noches, permisos entre dueños y aislamiento de caché al cerrar sesión. Conservar llegada/salida, moneda, selección y navegación de teclado; no nuevas pestañas. Pruebas automáticas futuras: contratos fake/PostgREST, ingestión/generación ICS, concurrencia y Playwright móvil pertinentes; comandos concretos se entregan al implementar según scripts vigentes.

Cada entrega requiere resultado observado, regresión pertinente, documentación actualizada y aceptación de Ana antes de continuar. Ninguna de estas comprobaciones se ha ejecutado en esta preparación.
