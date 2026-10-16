# Verificaciones: alcance, datos y revisión jurídica

> **Nota 2026-10-15.** Partes de este documento están superadas. Reglas vigentes en `CLAUDE.md` y `docs/plan-implementacion.md`; el prototipo (vista Móvil) es la especificación de v1. En particular: WhatsApp verificado es lo único obligatorio (Veriff opcional, fuera de v1); contacto directo por WhatsApp sin solicitud/aceptación; sin reclamaciones en la app; colones con visualización en dólares; «Mensual» en vez de «Largo plazo».


Actualización 2026-10-12: además de Veriff, se aprueba verificar WhatsApp de clientes y propietarios mediante OTP. Antes de integrar, incorporar al mapa de datos el número, finalidad del envío, proveedor Meta y evidencias mínimas de verificación; definir acceso, retención y avisos correspondientes. No confundir esta comprobación con consentimiento para marketing o para compartir el número entre usuarios. No se recogen datos nuevos mediante esta actualización documental. Fuente: [identidad-y-seguridad.md](identidad-y-seguridad.md).

**Alcance actualizado 2026-10-12:** la titularidad registral queda fuera de v1. Las secciones sobre finca, certificación y datos registrales son preparación para una posible versión posterior. V1 mantiene identidad mediante Veriff y sus requisitos de privacidad/revisión jurídica; no recoge datos para verificar propiedad.

Fecha de investigación: 2026-10-05. Orientación preliminar de producto, no dictamen jurídico ni política de privacidad lista para publicar. Revisar con asesoría costarricense antes de recoger datos reales; considerar otras jurisdicciones según establecimiento y usuarios objetivo, sin asumir que Costa Rica será la única aplicable.

## Decisión aprobada y límites

1. Identidad obligatoria mediante **Veriff** para clientes y owners antes de contactar/publicar/responder, no para explorar o preparar borradores. Proveedor elegido como dirección de producto; contrato, plan e integración aún pendientes. Essential sigue siendo candidato de plan.
2. Comprobación **opcional por casa** de titularidad registral a partir de la finca. No sustituye identidad ni bloquea la publicación por no solicitarla.
3. La nueva segunda comprobación sustituye la decisión del 2026-10-02 de no revisar titularidad. No se añade una verificación de autorización de alquiler.

Guía del owner: [Cómo aportar la finca](guia-verificacion-finca.md). No hay implementación real ni cambios de pantallas en esta actualización.

## Veriff no implica «bnbtico no recibe datos»

Veriff describe al cliente empresarial normalmente como responsable y a Veriff como encargado, con ciertos tratamientos propios. Su aviso contempla que el cliente reciba documento, foto y resultado; no equiparar esas imágenes con plantillas biométricas derivadas ni extrapolar avisos regionales a todos los usuarios. Confirmar alcance contractual y permisos. [Aviso de Veriff](https://www.veriff.com/privacy-notice).

El webhook de decisión puede entregar datos identificativos y de sesión, no solo aprobado/rechazado. La presencia de campos varía por producto y documento. Hay que probar qué campo corresponde a la identificación costarricense; no confundir número de documento con número personal. [Documentación técnica](https://devdocs.veriff.com/docs/decision-webhook).

El DPA exige al cliente una base jurídica apropiada, avisos y, cuando corresponda, consentimientos. Contratar un tercero no elimina estas tareas. Verificar que la versión del DPA revisada sea la que se incorpore al contrato. [DPA de Veriff, sección 3](https://www.veriff.com/data-processing-addendum/ver-dpa-2304).

## Mapa propuesto de datos mínimos

Esto es una propuesta técnica de minimización, no una capacidad ya configurada:

| Finalidad | Datos que proponemos conservar | No recopilar/replicar por defecto |
|---|---|---|
| Identidad | Referencia de usuario y sesión, proveedor, estado, fecha, evidencia del aviso/consentimiento; nombre e identificación solo con necesidad documentada | Fotos de cédula, selfies, vídeos, datos biométricos derivados, payload íntegro |
| Cotejo registral opcional | Casa, referencia completa de finca, titular y tipo de derecho necesarios, resultado, fecha/fuente, revisor, motivo y evidencia mínima | Patrimonio completo, historial financiero, datos de copropietarios no necesarios, escritura completa |
| Vista pública | Estado aprobado y explicación de alcance | Identificación, referencia registral, documentos y dirección exacta |

Para cruzar con el Registro se necesita un identificador fiable asociado a la persona verificada. «Solo guardamos un sí/no» no permite realizar ese cotejo sin obtener o consultar más datos. Definir si se conserva el identificador cifrado o se recupera temporalmente; un hash simple de cédula no anonimiza de forma segura un espacio de números predecible.

Descartar campos al recibirlos reduce conservación, pero la recepción ya supone tratamiento. Evitar que webhooks, logs, analítica, trazas de errores o copias de seguridad almacenen los documentos/payloads completos. No enviar documentos a IA generalista para decidir su autenticidad ni entrenar modelos propios con ellos.

## Costa Rica: asuntos jurídicos que resolver

La Ley 8968 regula información previa, consentimiento y sus excepciones, calidad/finalidad, derechos, seguridad y confidencialidad (arts. 5–11). La excepción para datos de acceso irrestricto no convierte cualquier documento descargable en información reutilizable sin límites. Su art. 14 regula transferencias. [Texto de la ley alojado por INAMU](https://formatos.inamu.go.cr/SIDOC/DOCS/ley_8968.pdf). La versión consolidada debe confirmarse con asesoría: el visor de SCIJ no expuso el articulado en esta consulta.

La PGR vincula la biometría con intimidad y autodeterminación informativa y analiza consentimiento expreso o habilitación legal. Es un pronunciamiento dirigido a una entidad pública, no una aprobación de este marketplace. [PGR-C-251-2021](https://www.pgrweb.go.cr/DOCS/DICTAMENES/1/P/D/2020-2029/2020-2024/2021/147B50.HTML).

Por ello, no dar por suficiente una casilla para hacer obligatoria la captura biométrica: encargar revisión de necesidad, proporcionalidad, categoría de datos y validez del consentimiento, y evaluar alternativas accesibles/no biométricas y revisión humana. Si se requiere modificar el diseño aprobado, volver a decidirlo antes del lanzamiento.

PRODHAB distingue transferencias entre responsables del traslado a encargados/proveedores; también señala la inscripción para bases destinadas a comercialización, distribución o difusión comercial. No toda app comercial se clasifica automáticamente de la misma forma. Determinar las obligaciones de cada base y protocolos con asesoría/PRODHAB. [Preguntas frecuentes de PRODHAB, 4, 8 y 22](https://www.prodhab.go.cr/preguntasfrecuentes.aspx).

### Lista de revisión previa al lanzamiento

- Identificar la entidad responsable de bnbtico y contacto de privacidad; separar cuenta, identidad, cotejo registral, difusión del sello y marketing.
- Avisar antes de cada recogida: propósito, destinatarios, obligatoriedad u opción, consecuencias de no aportar datos y derechos. Solicitud separada para titularidad; ningún consentimiento de marketing ligado al sello.
- Revisar facultades del representante y datos de terceros cuando hay sociedades/copropiedad. No asumir que el consentimiento de un anunciante cubre todos los datos de otras personas.
- Documentar encargados, subencargados, países de alojamiento/acceso, fines propios de Veriff y base aplicable a cada flujo internacional. No afirmar que el DPA por sí solo resuelve toda transferencia.
- Definir plazos específicos por categoría y proceso de borrado/rectificación/revocación tanto en bnbtico como en proveedores y copias. Excepciones por reclamaciones u obligaciones documentadas, no conservación indefinida por si acaso.
- Restringir acceso con roles, MFA para personal, cifrado, enlaces privados y auditoría; preparar respuesta a incidentes y determinar obligaciones de notificación aplicables.
- Diseñar revisión humana y corrección de discrepancias; un error OCR, nombre distinto o sociedad titular no equivale a fraude.
- Revisar la redacción del sello y la correspondencia finca–anuncio. Consulta registral no equivale a inspección física ni a autorización para alquilar.
- Acordar uso autorizado de los servicios del Registro o del proveedor; no asumir una API pública ni automatización permitida.

## Retención y contrato de Veriff

La tabla Self-Serve consultada publica para Essential tres meses de retención de sesión y no ofrece borrado de sesiones por API. Son condiciones publicadas, no un plazo legal para bnbtico; confirmar mecanismo de supresión, archivos, copias y excepciones con el proveedor. [Planes](https://www.veriff.com/plans/self-serve).

La política general diferencia Self-Serve de Enterprise y contempla conservación para fines propios de Veriff. No aplicar el archivo Enterprise a Essential ni prometer borrado total automático a los tres meses. [Retención de Veriff](https://www.veriff.com/data-retention/ver-vdr-2301).

Preguntas concretas para Veriff antes de contratar:

1. ¿Qué datos exactos recibe Essential para cédula costarricense, DIMEX y pasaporte? ¿Qué campos pueden desactivarse?
2. ¿Quién puede consultar/descargar documento, foto y otros medios en el portal o por API? ¿Cómo limitar accesos y auditarlos?
3. ¿Qué datos biométricos derivados son accesibles y cuáles no, según contrato y jurisdicción?
4. ¿Dónde se trata cada categoría, por quién y para qué fines adicionales? ¿Qué opciones hay para limitar usos secundarios?
5. ¿Cómo se ejecutan solicitudes de derechos y borrado en Essential, incluidas copias, archivos, subencargados y fines propios? ¿Qué evidencia de ejecución ofrecen?
6. ¿Podemos conservar/utilizar el identificador estrictamente necesario para el cotejo registral opcional informado al usuario?

## Operación propuesta para el cotejo de finca

Comenzar con revisión asistida por una persona y fuente registral reciente. Comprobar identificación, derecho y correspondencia con el anuncio; tratar sociedades/copropiedad como revisión particular, no aceptación automática. El número de finca es un localizador, no un secreto ni prueba de control sobre la vivienda.

Estados propuestos: no solicitado, en revisión, necesita aclaración, comprobado, no comprobado, pendiente de renovación. Guardar fecha y fuente; invalidar/revisar al cambiar finca, titular o anunciante. Vigencia, renovaciones, coste, evidencia mínima y proveedor registral quedan pendientes. Rechazar el sello no debe convertirse por sí solo en rechazo de cuenta o anuncio; el fraude acreditado se trata por el flujo de reclamaciones.

La documentación puede redactarse ahora, pero la recopilación real y la publicación del sello quedan condicionadas a resolver estas cuestiones jurídicas y operativas.
