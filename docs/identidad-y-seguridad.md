# Identidad y seguridad de cuentas

> **Nota 2026-10-15.** Partes de este documento están superadas. Reglas vigentes en `CLAUDE.md` y `docs/plan-implementacion.md`; el prototipo (vista Móvil) es la especificación de v1. En particular: WhatsApp verificado es lo único obligatorio (Veriff opcional, fuera de v1); contacto directo por WhatsApp sin solicitud/aceptación; sin reclamaciones en la app; colones con visualización en dólares; «Mensual» en vez de «Largo plazo».


## Registro y acceso aprobado · 2026-10-13

- Registro igual para clientes y propietarios: **nombre + WhatsApp + código recibido por WhatsApp**. No se pide correo, contraseña ni Veriff en el alta. WhatsApp queda verificado al completar el código; Veriff sigue pendiente hasta contactar o publicar.
- Recordar la sesión en la instalación/navegador autorizado mientras sea válida. Otro dispositivo/navegador requiere WhatsApp + código, sin repetir el nombre. No se implementan huella ni Face ID. Una sesión web recordada no equivale a una credencial de hardware ni detecta cambios externos de SIM/número.
- Mi perfil: foto, descripción y correo opcionales. Recomendar correo para recuperación; solo sirve después de confirmar su enlace. Cambiarlo invalida su confirmación anterior.
- Cambiar WhatsApp desde una sesión abierta: comprobar el nuevo número antes de sustituir el anterior, conservar cuenta e identidad y revocar las demás sesiones. Los destinos propios de casas ya verificadas no cambian automáticamente. Sin sesión ni acceso al número: recuperación mediante correo previamente confirmado, seguida de verificación del nuevo WhatsApp; sin correo confirmado, revisión manual por soporte. No conceder acceso por conocer nombre y otro teléfono.
- Copy por rol: el cliente verifica identidad antes de **contactar**; el propietario antes de **publicar**. Ambos verifican WhatsApp al registrarse. No presentar el OTP como aprobación de Veriff.

**Prototipo:** `account-access.js` simula códigos `123456`, caducidad de 5 minutos, máximo 5 intentos y 30 segundos entre reenvíos pendientes; enlaces de correo simulados de 15 minutos. Perfil y sesión se guardan en localStorage por rol de demostración (cliente/owner son personajes separados con casas/consultas precargadas); sesión de ejemplo de 30 días, no política de producción aprobada. No hay envíos, Veriff, autenticación segura, autorización real de dispositivo, revocación remota ni recuperación real. Foto local de prueba PNG/JPG/WebP hasta 250 KB. No introducir datos reales. HTTP y `file://` no comparten necesariamente almacenamiento. Si el almacenamiento no está disponible se avisa y se conserva el flujo solo en memoria.

Producción pendiente: proveedor, plantillas/costes, OTP y enlaces aleatorios validados en servidor, sesiones seguras y revocables, protección de cambios sensibles, límites antiabuso persistentes, unicidad de cuentas por número, recuperación y revisión jurídica. El estado local del prototipo nunca debe convertirse en autorización del backend. Lo siguiente conserva antecedentes; esta sección prevalece en registro/acceso.

## Alcance vigente · 2026-10-12

La verificación de titularidad de la casa queda **fuera de v1**. Se mantiene la identidad obligatoria de propietarios y clientes mediante Veriff antes de publicar, responder o solicitar contacto. En v1 no se pedirán finca ni certificación literal, no habrá cola registral ni sello de «Propietario verificado». El diseño de la segunda comprobación descrito más abajo se conserva para evaluar después de v1, sin fecha comprometida. `property.js` conserva el recorrido histórico, pero el prototipo ya no lo carga ni muestra sus botones. Admin muestra moderación del anuncio e identidad simulada de solo lectura; se retiró la revisión manual de cédula/selfie.

Requisitos de identidad documentados, sin integración real: el prototipo simula autenticación y estado del proveedor. La revisión manual de documentos se retiró de admin el 2026-10-12. Guía histórica fuera de v1: [verificación por finca](guia-verificacion-finca.md). Revisión jurídica y mapa de datos: [privacidad de las verificaciones](privacidad-verificaciones.md).

## Decisiones aprobadas

### Veriff y WhatsApp obligatorios · 2026-10-12

**Aclaración aprobada:** el estado público único **«Identidad verificada» incluye las dos comprobaciones completas: Veriff aprobado + WhatsApp actual verificado**. No mostrar un sello público separado de WhatsApp ni conceder el sello solo por Veriff. Separar los pasos únicamente para informar al usuario de qué le falta, y mantener estados técnicos separados para control y soporte. No atribuir a Veriff la comprobación de WhatsApp.

**Corrección por casa · 2026-10-12:** el propietario puede asignar otro WhatsApp a cada anuncio, copiado por defecto de su cuenta y editable. Reutilizar la verificación del número de cuenta si coincide y sigue válida; otro número requiere nueva comprobación antes de publicar o utilizarlo. Un cambio pendiente no sustituye el contacto verificado anterior. Comprobar acceso al número alternativo no identifica a su operador ni transfiere la identidad Veriff del propietario. Identidad del propietario y verificación del destino de cada casa permanecen separadas; los clientes conservan su WhatsApp de cuenta. Demo con código ficticio en `listing-whatsapp.js`, sin proveedor ni comprobación real.

No puede haber casas publicadas cuyo usuario no cumpla ambas condiciones, ni un cliente puede contactar a un propietario sin haber completado ambas. La regla se aplica en servidor al publicar/activar y habilitar contactos, no solo como aviso en pantalla. La publicación también sigue sujeta a moderación y al resto de requisitos. El cambio de teléfono no hereda verificación: un número pendiente no puede convertirse en el contacto activo verificado. El procedimiento concreto de cambio/recuperación queda pendiente de diseño.

- Todos los propietarios y clientes deben completar **identidad mediante Veriff y acceso al número de WhatsApp mediante un código de un solo uso (OTP) recibido por WhatsApp**. Una comprobación no sustituye a la otra.
- Acceso progresivo: explorar sin cuenta; WhatsApp se verifica en el registro. Preparar borradores sin Veriff; completar identidad antes de contactar, publicar o responder. No repetir por cada casa o conversación mientras siga vigente.
- Se verifica el número de contacto del usuario, compartido por todos sus anuncios, no un número por casa. El OTP comprueba acceso a ese WhatsApp, no identidad legal ni titularidad de una vivienda.
- Desde el 2026-10-13 WhatsApp + código es el método de acceso aprobado. No sustituye el consentimiento para compartir teléfono o recibir otros mensajes. La titularidad registral continúa fuera de v1.

Criterios para implementación: estados separados de identidad y WhatsApp; código vinculado a cuenta, número y finalidad, validado en servidor, con caducidad, uso único y límites de intentos/reenvíos. Enviar o entregar un mensaje no verifica el número. Un nuevo número requiere verificación antes de usarlo como contacto; no hereda el estado del anterior ni exige repetir Veriff automáticamente. No guardar códigos en claro en registros ni mostrarlos a admin. Recuperación segura y límites concretos pendientes de diseño; SMS por sí solo no acredita acceso a WhatsApp.

Estado real: **pantalla OTP simulada, sin integración**. Se considera Meta WhatsApp Business Platform / Cloud API directa, sin necesidad de Twilio; configuración, plantillas de autenticación, costes e integración pendientes. La app móvil WhatsApp Business por sí sola no implementa este flujo. Veriff tampoco está contratado ni conectado.

### Identidad y comprobación registral histórica

- La verificación de identidad es el principal servicio diferencial de bnbtico. Priorizar calidad y facilidad de uso; la usuaria acepta evaluar una cuota mayor si es necesario, sin aprobar todavía un nuevo precio.
- Identidad obligatoria para propietarios y clientes: documento, comparación facial y prueba de persona real (liveness) mediante proveedor especializado. Un código por WhatsApp/SMS acredita acceso al número, no identidad.
- Registro sencillo separado de verificación: explorar sin verificar; con cuenta, guardar favoritos y preparar borradores. Verificar antes del primer contacto o de enviar «Pedir casa»; el owner debe estar verificado antes de publicar o responder.
- La identidad se verifica por persona, no por casa ni por conversación. Criterios de reverificación por seguridad pendientes; no prometer validez perpetua ni imponer comprobaciones mensuales por defecto.
- **Comprobación registral histórica, fuera de v1:** titularidad opcional por casa mediante número de finca, adicional a las comprobaciones de usuario. Sustituye la decisión del 2026-10-02 de no comprobar titularidad, pero queda aplazada. No se verifica autorización para alquilar.
- **«Identidad verificada»** corresponde a la persona, tanto cliente como owner. **«Propietario verificado»** corresponde a la titularidad de esa casa, con fecha y finca vinculada internamente; **«Copropietario verificado»** cuando proceda. Sociedades y otros derechos requieren revisión particular; no presentar al representante como propietario personal. Sin comprobación opcional, mostrar solo identidad, sin etiqueta negativa.
- Cada etiqueta tendrá un botón de ayuda pulsable (también en móvil). Copy aprobado de identidad: **«Comprobamos la identidad de este usuario.»** Sin mencionar Veriff en esta explicación; el proveedor sí debe figurar donde corresponda en los avisos de privacidad.
- Copy aprobado de propiedad: **«Comprobamos que quien publica figura como titular de esta propiedad en el Registro Nacional. Revisado el [fecha].»** Se retira de este texto breve la frase sobre estado de la vivienda/autorización para alquilar; no cambia el alcance real del servicio ni sustituye los avisos jurídicos.
- Guía para obtener y aportar el código de una certificación literal: [guia-verificacion-finca.md](guia-verificacion-finca.md). Asistente owner implementado en la demo con código ficticio y envío a revisión solo en memoria. La validación del código y el cotejo con la identidad no están automatizados ni implementados. Conocer el código no demuestra que quien lo aporta sea titular.
- No solicitar o no obtener el segundo sello no bloquea por sí solo la publicación. Casos de fraude acreditado siguen su proceso independiente. No basta conocer una finca ni aportar una imagen documental para obtenerlo.
- Una persona con identidad verificada puede cometer fraude o anunciar una casa ajena. No prometer anuncios legítimos, ausencia de estafas ni garantía de reserva/pago.

## Veriff: proveedor elegido como dirección de producto; contratación pendiente

La usuaria elige Veriff para la identidad obligatoria el 2026-10-05. No está contratado ni integrado. Essential continúa como candidato de plan para un piloto, no conclusión de suficiencia universal. El lanzamiento depende de documentos locales, resultados, contrato y revisión jurídica, incluida la biometría obligatoria. La consulta registral opcional es un proceso separado, no una capacidad atribuida a Essential.

| Plan | Precio publicado consultado el 2026-10-02 (USD) | Alcance relevante |
|---|---|---|
| Essential | 0,80/verificación; mínimo 49/mes | Decisión automatizada, documento, extracción de campos, comparación facial y liveness; página alojada y exportación PDF |
| Plus | 1,39/verificación; mínimo 99/mes | Automatización + especialistas, grabación de sesión y herramientas adicionales Risk Insights, FaceBlock y CrossLinks |
| Premium | 1,89/verificación; mínimo 209/mes | Opciones adicionales de personalización y eliminación de sesiones por API |

Son precios de referencia, no oferta contractual: confirmar impuestos, extras, sesiones facturables, reintentos y mínimos. No sumar automáticamente el mínimo a todas las verificaciones ni confundir verificación con usuario activo mensual.

Fuentes consultadas: [planes Veriff](https://www.veriff.com/plans/self-serve), [cobertura documental](https://www.veriff.com/supported-countries). La cobertura general incluye Costa Rica; confirmar versiones concretas de cédula, DIMEX/residencia y pasaportes necesarios. La prueba gratuita anunciada ofrece Premium: pedir una evaluación bajo las condiciones de Essential.

Plus no implica necesariamente revisión humana de todos los casos. Preguntar cuándo intervienen especialistas. Essential no es solo OCR; ya incluye comprobaciones biométricas y de presencia real anunciadas con conformidad iBeta. No atribuir esa conformidad a código propio.

Alternativas comentadas, no seleccionadas: Sumsub Basic (1,35 USD/verificación, mínimo 149 USD/mes, [fuente](https://sumsub.com/pricing/)); Premium o Plus si el piloto demuestra necesidad. Ningún paquete de identidad prueba el derecho a alquilar.

### Condiciones para elegir proveedor

- Probar facilidad de captura, abandonos, reintentos y rechazos de personas legítimas con documentos y dispositivos representativos, con consentimiento.
- Evaluar controles antifraude y tratamiento de resultados inconclusos; no aprobar por defecto un caso fallido ni sustituir el proveedor por una lectura de foto con IA generalista.
- Definir soporte, revisión/reclamación y alternativa accesible para quien no pueda completar el proceso.
- Revisar contrato, ubicación/tratamiento de datos, acceso, conservación, borrado y responsabilidades con asesoramiento apropiado antes del lanzamiento.
- Presupuestar verificaciones de ambos roles, repeticiones justificadas y recuperación, no solo las altas de owners.

## Qué construye bnbtico y qué hace el proveedor

bnbtico integra la página/SDK, muestra estados y sello, aplica permisos, gestiona incidencias y registra el resultado mínimo necesario. El proveedor especializado analiza documento, rostro y liveness. No construir una supuesta certificación iBeta propia ni equiparar extracción de datos con autenticidad.

Propuesta técnica pendiente de diseño: estado de identidad separado de teléfono, rol y estado del anuncio; referencia de sesión/proveedor y fechas; decisiones recibidas y comprobadas en servidor. Nunca conceder el sello por una redirección o dato enviado por el navegador. Validar notificaciones del proveedor, vinculación con la cuenta e idempotencia.

Preferir captura alojada en el proveedor y evitar copias innecesarias de cédulas/selfies en bnbtico. Eso no significa ausencia de acceso o responsabilidad: el proveedor puede entregar datos personales y medios según configuración y contrato. Política exacta de acceso, retención y borrado pendiente; ver privacidad-verificaciones.md. No asumir que todos los planes permiten borrar mediante API.

## Protección de cuentas — propuesta discutida, pendiente de aprobar/diseñar

La identidad al alta no impide el robo posterior de una cuenta. Se propuso:

- Passkeys como acceso preferente, usando desbloqueo del dispositivo (Face ID, huella o PIN); bnbtico no recibe la biometría local de desbloqueo. Esto es distinto de la selfie enviada al proveedor de identidad.
- Autenticación reforzada al cambiar teléfono de contacto, correo o métodos de acceso.
- Avisos de nuevos accesos/cambios y opción para cerrar sesiones.
- Límites de intentos y de solicitudes de códigos.
- Códigos de recuperación y procedimiento seguro si se pierden dispositivos; posible reverificación de identidad en casos de riesgo.
- No depender solo de WhatsApp/SMS para proteger o recuperar la cuenta. Conocer nombre y cédula no basta para recuperarla.

No se ha seleccionado proveedor de autenticación ni validado soporte de passkeys en el stack propuesto. No presentar estas medidas como disponibles en el prototipo.

## Pendientes de implementación

- Actualizar pantallas de alta, cliente, owner y admin: separar registro, teléfono e identidad.
- Sustituir etiquetas genéricas por identidad y, cuando proceda, titularidad registral opcional con alcance preciso; nunca autorización de alquiler.
- Diseñar la revisión por finca y su formulario privado, consentimiento/aviso, prueba de correspondencia con el anuncio, excepciones y vigencia. La guía ya está documentada, no implementada.
- Aplicar permisos en backend para contactar, publicar y responder, además de ocultar/deshabilitar controles en UI.
- Diseñar estados, reintentos, reclamación, recuperación y reverificación; probar también accesos no autorizados.
- Adaptar esquema/migraciones y documentación técnica detallada cuando se elijan proveedores.
