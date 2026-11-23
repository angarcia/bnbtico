// Cuenta: perfil, código, recuperar, ayuda y cuenta creada (todo en el trozo diferido cuenta-*, como sus pantallas).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre. Donde la frase lleva una
// pieza con marcado en medio, la función la recibe y devuelve la frase entera en trozos.

import { plural } from "../../../domain/plural";

// Recuperar la cuenta y ayuda
export const recoverTitle = "Recuperar mi cuenta";
export const recoverText = "Use el correo que añadió y confirmó en su perfil. Después podrá verificar su nuevo WhatsApp para recuperar el acceso.";
export const recoverEmail = "Correo confirmado";
export const emailPlaceholder = "nombre@ejemplo.com";
export const recoverButton = "Recuperar con mi correo";
export const recoverNote = "La recuperación por correo se activa cuando confirme uno en su perfil.";
export const noEmailTitle = "¿No tiene un correo confirmado?";
export const noEmailText = "Pida ayuda a 3bstays para revisar la recuperación. Indicar su nombre y otro número no basta para recuperar una cuenta. No mande documentos ni códigos por este formulario.";
export const writeTo3bstays = "Escribir a 3bstays por WhatsApp";
export const helpTitle = "Ayuda por WhatsApp";
export const channel = <T,>({ number, other }: { number: T; other: string }) => [number, ` · canal separado del de ${other}.`] as const;
export const noNumber = ({ other }: { other: string }) => `Número pendiente de configurar. Canal separado del de ${other}.`;
export const openWhatsapp = "Abrir WhatsApp";

// El código
export const codeTitle = "Introduzca el código";
export const sentTo = <T,>({ phone }: { phone: T }) => ["Se lo enviamos por WhatsApp al ", phone, "."] as const;
export const verify = ({ busy }: { busy: boolean }) => (busy ? "Verificando…" : "Verificar y continuar");
export const resendIn = <T,>({ time }: { time: T }) => ["¿No llegó? Puede pedir otro en ", time, "."] as const;
export const resend = "Pedir otro código";
export const findMessage = "Abrir WhatsApp para buscar el mensaje";
export const changeNumber = "Cambiar número";
export const thenHouse = "Después seguimos con su casa";
export const requestNew = "Solicite un código nuevo para continuar.";

// Cuenta creada
export const signIn = "Ingresar";
export const created = "¡Listo! Su cuenta está creada";
export const ownHouse = "¿Tiene una casa para alquilar?";
export const yesPublish = "Sí, quiero publicarla";
export const noSearching = "No, busco casa";
export const addRecovery = "Añadir un correo de recuperación";

// Perfil
export const subscription = "Suscripción";
export const launchOffer = "Oferta de lanzamiento";
export const subscriptionText = "Cuando publique una casa, aquí verá su suscripción. Las primeras 50 casas tienen 12 meses gratis.";
export const nextCharge = "Próximo cobro";
export const noCharge = "₡0 · sin método de pago";
export const feeNote = ({ fee }: { fee: string }) => `${fee} al mes por casa activa, sin permanencia. Sin comisiones por alquiler, nunca.`;
export const title = "Cuenta";
export const whatsappVerified = "WhatsApp verificado";
export const identitySoon = "Pronto podrá verificar también su identidad (opcional).";
export const done = "Listo";
export const edit = "Editar";
export const loading = "Cargando su cuenta";
export const profile = "Mi perfil";
export const adminRow = "Revisión de anuncios · admin";
export const adminRowHint = "Cola de casas por revisar (pide un segundo código)";
export const helpRow = "Ayuda por WhatsApp";
export const helpLine = ({ owner }: { owner: boolean }) => (owner ? "Línea de 3bstays para anfitriones" : "Línea de 3bstays para clientes");
export const terms = "Términos y privacidad";
export const osm = <T,>({ link }: { link: T }) => ["Límites administrativos © ", link, " (ODbL)."] as const;
export const osmLink = "colaboradores de OpenStreetMap";
export const signOut = "Cerrar sesión";
export const signOutTitle = "¿Cerrar sesión?";
export const signOutText = "Tendrá que recibir un código nuevo para volver a entrar.";
export const favorites = "Favoritos";
export const favoritesCount = ({ count }: { count: number }) =>
  count === 0 ? "Ninguna casa guardada" : plural(count, { one: `${count} casa guardada`, other: `${count} casas guardadas` });
export const name = "Nombre";
export const description = "Descripción (opcional)";
export const noDescription = "Sin descripción";
export const email = "Correo de recuperación (opcional)";
export const noEmail = "Sin correo de recuperación";
export const descriptionPlaceholder = "Cuéntenos un poco sobre usted";
export const emailHint = "Sirve para recuperar la cuenta si pierde el acceso a su WhatsApp.";
export const saved = "Cambios guardados.";
export const save = ({ busy, ok }: { busy: boolean; ok: boolean }) => (busy ? "Guardando…" : ok ? "Guardado" : "Guardar cambios");
