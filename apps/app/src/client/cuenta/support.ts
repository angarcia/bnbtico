// Contacto con 3bstays: solo WhatsApp, un número por rol (variables VITE_WA_OWNERS y VITE_WA_GUESTS del build).
import { waUrl } from "../../domain/whatsapp";
import { SUPPORT_NUMBERS } from "../comun/support-numbers";
import * as ACCOUNT_COPY from "./copy/account";

export const SUPPORT = {
  owner: {
    label: ACCOUNT_COPY.supportOwnerLabel,
    number: SUPPORT_NUMBERS.owner,
    intro: ACCOUNT_COPY.supportOwnerIntro,
    greeting: ACCOUNT_COPY.supportOwnerGreeting,
    other: ACCOUNT_COPY.supportOwnerOther,
  },
  guest: {
    label: ACCOUNT_COPY.supportGuestLabel,
    number: SUPPORT_NUMBERS.guest,
    intro: ACCOUNT_COPY.supportGuestIntro,
    greeting: ACCOUNT_COPY.supportGuestGreeting,
    other: ACCOUNT_COPY.supportGuestOther,
  },
} as const;

export function waLink(number: string, text: string): string {
  return waUrl(number, text);
}
