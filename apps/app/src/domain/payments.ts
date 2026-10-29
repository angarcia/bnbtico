// Pasarela de pago (fase 5, ticket 04): solo guarda un método de pago, nunca cobra. La implementan StripeProvider
// (src/server/stripe.ts) y FakeProvider (src/server/fake-payments.ts, solo en local). bnbtico no pinta ningún campo de
// tarjeta: la pasarela abre su propia página y avisa por un webhook firmado.
import type { PaymentEvent, PaymentProviderName } from "./subscription";

export interface SetupSessionRequest {
  owner: { id: string; fullName: string };
  /** El cliente que la cuenta ya tiene en esta pasarela (payment_customers), o null para crearlo. */
  customerRef: string | null;
  successUrl: string;
  cancelUrl: string;
}

export interface PaymentProvider {
  readonly name: PaymentProviderName;
  /** Página de la pasarela para guardar la tarjeta, y el cliente que usa (el que llegó o uno nuevo, que hay que guardar). */
  createSetupSession(req: SetupSessionRequest): Promise<{ url: string; customerRef: string }>;
  /** Evento ya verificado (firma y vigencia), traducido al tipo neutro; null si la firma no vale. Lanza si la pasarela no
   *  responde al completar los datos (el webhook contesta 500 y la pasarela reintenta). */
  verifyWebhook(request: Request): Promise<PaymentEvent | null>;
}

/** URLs de vuelta de la página de la pasarela: éxito con `?pago=ok`; con la casa conocida, las dos llevan `?casa=CT-####`
 *  (la suscripción vuelve acotada a esa casa) y `#pago=CT-####`; cancelar nunca lleva `pago=ok`. */
export function setupReturnUrls(base: string, publicId: string | null): { successUrl: string; cancelUrl: string } {
  const path = `${base.replace(/\/$/, "")}/propietario/suscripcion`;
  const hash = publicId ? `#pago=${publicId}` : "";
  const casa = publicId ? `casa=${publicId}` : "";
  return { successUrl: `${path}?pago=ok${casa && `&${casa}`}${hash}`, cancelUrl: `${path}${casa && `?${casa}`}${hash}` };
}

/** Mensajes de las rutas de pago del worker (usted). */
export const PAYMENT_MESSAGES = {
  off: "Los pagos no están disponibles en este momento.",
  noSession: "Ingrese de nuevo para añadir su método de pago.",
  badHouse: "Id de casa no válido.",
  gateway: "No pudimos abrir la página de pago. Intente de nuevo en un momento.",
} as const;
