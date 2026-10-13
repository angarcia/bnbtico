> **Histórico.** La última decisión del 2026-10-07 vuelve a WhatsApp directo con solicitud consentida y aceptación del owner. Prevalece [contacto-whatsapp.md](contacto-whatsapp.md).
> La oferta de un mes gratuito citada aquí también es histórica: el 2026-10-07 se aprobó 1 año gratis para las primeras 50 casas, 6 meses para las siguientes 50 y 3 meses para las siguientes 100. Condiciones vigentes en [business-model.md](business-model.md).

# Resumen de decisiones de la sesión · 2026-10-02

Las últimas decisiones prevalecen sobre alternativas discutidas anteriormente. Este documento registra el alcance; no acredita integración en producción.

## Producto y marca

- Dirección de marca elegida: bnbtico; logo preferido, rana sonriente sobre hoja en rojo coral. Afinidad visual con Airbnb buscada, evitando parecerse a la rana de Kölbi. Assets y nombre del repositorio/prototipo todavía pendientes de homogeneizar.
- Comunidad local de propietarios como orientación del producto. Sin contacto directo propietario → propietario. Consejos, proveedores y derivaciones se exploraron, pero las funciones y sus permisos no están cerrados.
- Posible suscripción más barata para pertenecer sin anunciar una casa; precio y alcance pendientes. No conceder comunidad gratuita solo por verificar identidad. Se descartó el año gratuito para verificados; primer mes gratuito como referencia vigente.
- Cuota de anuncio de referencia: ₡9.900/mes por casa. Disposición a subirla por una verificación de calidad, sin aprobar otra cifra.
- Preocupación por agencias que capten owners o clientes: limitar exposición y acceso masivo; no prometer impedir captación una vez compartido un contacto. Política comercial para agencias pendiente.

## Contacto — aprobado y simulado en el prototipo

- WhatsApp directo; se descartaron número intermediario, chat privado y doble aceptación. No son necesarios los controles de ventanas de 24 h para este contacto directo.
- No hay número visible en la ficha pública; se usa al contactar. Recomendar WhatsApp Business o un número distinto del personal. No prometer anonimato en WhatsApp.
- En «Me contactaron»: Contactar por WhatsApp / No me interesa.
- Una solicitud por cliente y casa durante 7 días desde el envío original; sin avisos duplicados ni reinicio del plazo al descartar. Tras vencer puede enviar otra, incluso meses después. Historial conservado; el límite no controla mensajes externos.
- Pedir casa conserva consentimiento explícito para que hasta 10 owners compatibles accedan al contacto y respondan.
- Detalle y límites: [contacto-whatsapp.md](contacto-whatsapp.md). El antiguo contacto-privado.md se conserva solo como historial.

## Identidad — aprobado, pendiente de reflejar en prototipo y producción

- Clientes y propietarios deben verificar identidad; no basta OTP.
- Registro fácil; verificación al llegar a contactar/enviar solicitud o publicar/responder.
- No comprobar titularidad ni autorización de alquiler: se retira expresamente la propuesta de dos sellos.
- Único sello «Identidad verificada» con alcance claro; no garantiza legitimidad de vivienda ni ausencia de fraude.
- Veriff Essential como opción de piloto, no contratación ni elección definitiva. Se compararon Plus, Premium y Sumsub.
- Protección de cuentas con passkeys, autenticación reforzada, avisos, límites y recuperación: propuesta, no implementación ni selección técnica aprobada.
- Detalle, fuentes, precios de referencia y pendientes: [identidad-y-seguridad.md](identidad-y-seguridad.md).

## Estado real

El prototipo simula WhatsApp directo y caducidad en memoria; no envía mensajes ni verifica identidades. La nueva política de identidad está documentada, pero las pantallas, backend, migraciones e integración con proveedores siguen pendientes. No se han contratado servicios ni cambiado la cuota.
