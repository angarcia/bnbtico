# bnbtico

Catálogo de casas en alquiler en Costa Rica, con contacto directo por WhatsApp entre cliente y anfitrión. Este glosario fija el lenguaje del ingreso y la cuenta; las reglas de producto y la arquitectura están en `CLAUDE.md` y `docs/`.

## Language

### Personas y cuenta

**Cuenta**:
La identidad de una persona en bnbtico. Una persona tiene una sola cuenta, sea invitado, anfitrión o ambos.
_Avoid_: Perfil (es la ficha de datos de la cuenta), usuario

**Invitado**:
Persona que explora casas y contacta a anfitriones. No paga suscripción.
_Avoid_: Cliente, huésped, guest

**Anfitrión**:
Persona o agencia que publica casas y paga la suscripción por casa activa.
_Avoid_: Propietario, dueño, owner (en la interfaz; el código conserva `owner`)

**Administrador**:
Cuenta de bnbtico con permisos de moderación. Entra con correo real y un segundo factor TOTP; no se crea por código inverso.
_Avoid_: Admin (solo en código)

### Ingreso

**WhatsApp verificado**:
El número de WhatsApp de una cuenta, comprobado una sola vez por código inverso. Es requisito para contactar a un anfitrión y para publicar, y un número solo puede pertenecer a una cuenta.
_Avoid_: Teléfono confirmado, número validado

**Número de verificación**:
El único número de WhatsApp de bnbtico, dedicado a recibir los mensajes del código inverso. Distinto de los dos números de soporte.
_Avoid_: Número de soporte, número intermedio

**Código inverso**:
Verificación en la que la persona envía a bnbtico, por WhatsApp, un código que le muestra la app; bnbtico lee el número del remitente. En un solo paso crea o reconoce la cuenta, inicia la sesión del dispositivo y verifica el número.
_Avoid_: OTP inverso, reverse OTP, código enviado (el código enviado por bnbtico es solo el respaldo)

**Reto de verificación**:
Una solicitud de código inverso en curso: un código de un solo uso, ligado al dispositivo que lo pidió, que vence a los 10 minutos.
_Avoid_: Sesión de verificación, intento

**Código de respaldo**:
Código que bnbtico envía por WhatsApp (Twilio Verify) cuando el código inverso no se pudo completar. Es la excepción, con topes.
_Avoid_: OTP, SMS

**Método añadido**:
Forma de entrar que una cuenta de anfitrión suma después de verificar su WhatsApp: código por correo, Google o Apple. Permite entrar sin repetir el código inverso y recuperar la cuenta. Obligatorio para anfitriones al publicar; a los invitados nunca se les ofrece.
_Avoid_: Segundo método, login alternativo, método de pago (otro concepto)

**Prueba de acceso reciente**:
Haber demostrado acceso a la cuenta en los últimos 10 minutos con un método añadido o con un código inverso nuevo. Se exige en SQL para acciones sensibles.
_Avoid_: Reautenticación, step-up, confirmación

**Acción sensible**:
Cambiar el WhatsApp de contacto, cambiar el correo, vincular o desvincular métodos de ingreso, borrar la cuenta, añadir o cambiar el método de pago. Pausar o cerrar una casa no lo es.
_Avoid_: Acción crítica, operación protegida

**Aviso de nuevo dispositivo**:
Correo que informa a un anfitrión de que se inició sesión en su cuenta desde un dispositivo que no conocía. No existe aviso por WhatsApp; los invitados no lo reciben.
_Avoid_: Alerta de seguridad, notificación de login

**Bloqueo biométrico**:
Ajuste local de las apps nativas que pide Face ID o huella para abrir la app. No sustituye ninguna verificación.
_Avoid_: Inicio de sesión biométrico, passkey (es otra cosa, prevista para v1.1)
