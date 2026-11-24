// Entrar con el WhatsApp (trozo diferido cuenta-*). Donde la frase lleva una pieza en negrita, la función la recibe y
// devuelve la frase entera en trozos.
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre.

export const house = "La casa";
export const verified = ({ name, verified }: { name: string; verified: boolean }) => `${name}${verified ? " · WhatsApp verificado" : ""}`;
export const returnHere = "Después de verificar vuelve adonde estaba.";
export const returnTo = <T,>({ title }: { title: T }) => ["Después de verificar vuelve a ", title, " con su consulta tal como la dejó."] as const;
export const theHouse = "la casa";
export const titleNew = "Es su primera vez en 3bstays";
export const titleContact = ({ owner }: { owner: string | null }) => `Un paso y le escribe a ${owner ?? "el anfitrión"}`;
export const titlePublish = "Para subir las fotos, verifique su WhatsApp";
export const titleSignIn = "Entre con su WhatsApp";
export const textNew = <T,>({ phone }: { phone: T }) => ["Díganos su nombre para crear su cuenta. Le mandamos el código al ", phone, "."] as const;
export const textPublish = "Lo que ya escribió se guarda. Le enviamos un código por WhatsApp: así nadie más puede publicar en su nombre.";
export const textSignIn = "Le mandamos un código por WhatsApp para confirmar que el número es suyo. Si es su primera vez, le pedimos también su nombre. Sin contraseña ni correo.";
export const name = "Nombre";
export const namePlaceholder = "Su nombre";
export const phone = "Número de WhatsApp";
export const otherShort = "Otro";
export const country = "País de su WhatsApp";
export const otherCountry = "Otro país";
export const phoneLocal = "8000 0001";
export const phoneIntl = "+00 000 000 000";
export const phoneNoCode = "Sin el código de país";
export const submit = ({ busy }: { busy: boolean }) => (busy ? "Un momento…" : "Recibir código por WhatsApp");
export const changeNumber = "Cambiar número";
export const noAccess = "No tengo acceso a mi WhatsApp";
export const privacy = "Su número solo se comparte con el anfitrión cuando usted toca «Contactar por WhatsApp». Explorar y guardar favoritos no necesita cuenta.";
export const terms = "Al continuar acepta los Términos. 3bstays nunca le pedirá pagos.";
export const phoneHintOther = "Escriba el número completo con «+» y el código de su país.";
export const phoneHintCr = "¿Su número no es de Costa Rica? Toque +506 para elegir su país.";
export const phoneHintNoCode = "Escriba su número sin el código de país.";
export const nameMissing = "Escriba su nombre.";
export const phoneMissing = "Escriba su número de WhatsApp.";
export const phoneIntlInvalid = "Escriba el número completo con «+» y el código de su país.";
export const phoneInvalid = "Ese número no parece válido para el país elegido.";
