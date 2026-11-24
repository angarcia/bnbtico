// «Promoción y suscripción», la tarjeta «Suscripción» y la fila «Método de pago» de Cuenta (trozo diferido suscripcion-*).
// Catálogo de textos (estructura por áreas, paso 3, decisión del 2026-11-23): un export por mensaje, importado como espacio
// de nombres (`import * as X_COPY`). Mensajes completos; los datos, como parámetros con nombre.

import { plural } from "../../../../domain/plural";

export const addMethod = "Añadir método de pago";
export const opening = "Abriendo la página de pago…";
export const untitled = "Casa sin título";
export const perMonth = ({ inactive }: { inactive: boolean }) => (inactive ? "/ mes al activarla" : "/ mes");
export const afterOffer = ({ fee }: { fee: string }) => `Después de su oferta: ${fee} al mes.`;
export const noChargeNow = "Ahora no se cobra.";
export const activate = "Activar suscripción";
export const keepsPlace = ({ until }: { until: string }) => `Mantiene su plaza de la oferta: gratis hasta el ${until}.`;
export const reminders = "Avisos por WhatsApp: 90, 30 y 7 días antes y el último día.";
export const reminderSent = ({ label, date }: { label: string; date: string }) => ` Aviso ${label} enviado el ${date}.`;
export const stop = "Parar suscripción";
export const stopBody = ({ title }: { title: string }) =>
  `¿Parar la suscripción de ${title || "esta casa"}? La casa deja de verse y no se cobra. Puede reactivarla cuando quiera.`;
export const figures = ({ views, inquiries }: { views: number; inquiries: number }) =>
  `${plural(views, { one: `${views} visita`, other: `${views} visitas` })} · ${plural(inquiries, { one: `${inquiries} consulta`, other: `${inquiries} consultas` })} en 30 días`;
export const yourHouses = "Sus casas";
export const firstHouse = "Cuando aprobemos su primera casa, aquí verá su oferta y su suscripción.";
export const method = "Método de pago";
export const methodLine = ({ name, expiry }: { name: string; expiry: string }) => `${name} · vence ${expiry}`;
export const change = "Cambiar";
export const noMethod = "Ninguno todavía";
export const addLater = "Puede añadirlo cuando le avisemos.";
export const methodNote = "Se guarda en la página segura de la pasarela de pago; en 3bstays nunca se escribe el número de la tarjeta. Ahora no se cobra nada.";
export const howTitle = "¿Cómo funciona el cobro?";
export const howText = ({ fee }: { fee: string }) =>
  `Cuando aprobamos su casa, empieza su oferta gratuita (si le tocó plaza). Le avisamos por WhatsApp y aquí a los 90, 30 y 7 días y el último día. Si al terminar tiene un método de pago, la casa sigue activa por ${fee} al mes; si no, queda pendiente de pago y deja de mostrarse hasta que lo añada. Puede parar la suscripción de una casa cuando quiera (queda inactiva y no se cobra) y reactivarla después con el mismo enlace. Sin permanencia y sin comisiones por alquiler.`;
export const titleInAccount = "Promoción y suscripción";
export const title = ({ single }: { single: boolean }) => (single ? "Suscripción" : "Promoción y suscripción");
export const unavailable = "La suscripción de esta casa no está disponible.";
export const loading = "Cargando su suscripción";
export const allHouses = "Ver todas sus casas";
export const offerTitle = "Oferta de lanzamiento";
export const offerLeft = ({ remaining, size }: { remaining: number; size: number }) => `Quedan ${remaining} de ${size}`;
export const offerLoading = "Quedan …";
export const offerOver = "Terminada";
export const tiers = "Primeras 50 casas: 12 meses gratis. Siguientes 50: 6 meses. Siguientes 100: 3 meses.";
export const tiersNote = ({ fee }: { fee: string }) =>
  `Después, ${fee} al mes por casa, sin permanencia. Cada casa toma su plaza cuando la aprobamos y la conserva aunque la edite o la pare.`;
export const subscriptions = "Suscripciones";
export const firstHouseShort = "Cuando aprobemos su primera casa, aquí verá su suscripción.";
export const seeSubscriptions = "Ver suscripciones";
export const counts = ({ total, inactive, blocked }: { total: number; inactive: number; blocked: number }) =>
  plural(total, { one: `${total} casa`, other: `${total} casas` }) +
  (inactive ? ` · ${plural(inactive, { one: `${inactive} inactiva`, other: `${inactive} inactivas` })}` : "") +
  (blocked ? ` · ${plural(blocked, { one: `${blocked} bloqueada`, other: `${blocked} bloqueadas` })}` : "");
export const nextCharge = "Próximo cobro";
export const feeNote = ({ fee }: { fee: string }) => `${fee} al mes por casa activa, sin permanencia. Sin comisiones por alquiler, nunca.`;
export const methodRowHint = "Falta · añádalo antes de que termine su oferta";
export const reminder90 = "de los 90 días";
export const reminder30 = "de los 30 días";
export const reminder7 = "de los 7 días";
export const reminderLast = "del último día";
export const keepSubscription = "Mantener suscripción";
export const cancel = "Cancelar";
export const savingMethod = "Guardando su método de pago…";
export const savedMethod = "Método de pago guardado. No se cobra nada hasta que termine la oferta.";
export const lateMethod = "Lo estamos confirmando; aparecerá en unos minutos.";
export const inReview = "En revisión";
