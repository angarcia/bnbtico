// Hoja de contacto (trozo diferido). Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un módulo por pantalla o pieza, con un export
// por mensaje, que se importa como espacio de nombres (`import * as X_COPY`). Así el bundler acorta los nombres y deja
// fuera los mensajes que no se usan. Mensajes completos; los datos, como parámetros con nombre.

export const subtitle = ({ title, verified }: { title: string; verified: boolean }) => `Anfitrión de ${title}${verified ? " · WhatsApp verificado" : ""}`;
export const heading = ({ name }: { name: string }) => `Escríbale a ${name}`;
export const stayKind = "Cómo indicar la estancia";
export const arrival = "Llegada";
export const departure = "Salida";
export const people = "Personas (opcional)";
export const peoplePlaceholder = "Opcional";
export const message = "Su mensaje";
export const messageHint = "Podrá añadir lo que quiera en WhatsApp antes de enviarlo.";
export const sending = "Abriendo WhatsApp…";
export const writeTo = ({ name }: { name: string }) => `Escribir a ${name} por WhatsApp`;
export const continueLabel = "Continuar";
export const open = "Abrir WhatsApp";
export const needsCode = "Para escribirle necesita verificar su WhatsApp con un código. Lo que escribió se guarda.";
export const hostSees = ({ name }: { name: string }) => `${name} verá su nombre y su WhatsApp.`;
export const safety = "Por su seguridad, nunca envíe dinero antes de confirmar la casa. 3bstays no procesa ni pide pagos.";
