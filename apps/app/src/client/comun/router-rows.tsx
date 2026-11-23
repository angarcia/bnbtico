// Las tarjetas y filas comunes (shared/card.tsx) sobre `Link` de TanStack Router. Aparte de router-buttons.tsx, que va en el
// JS inicial: solo las leen trozos diferidos (la cola del admin, Cuenta, el detalle de casa, la suscripción…).
import { createLink } from "@tanstack/react-router";
import { CardLink, ListRowLink } from "../../shared/ui/card";

export const RouterCardLink = createLink(CardLink);
export const RouterListRow = createLink(ListRowLink);
