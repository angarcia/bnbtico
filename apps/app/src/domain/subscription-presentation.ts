import { payButtonDue, type HouseSubscription } from "./subscription";

/** Avisos de Cuenta: conserva los recordatorios existentes, además de pagos y reactivación. */
export function subscriptionNeedsAttention(sub: HouseSubscription, today: string): boolean {
  return sub.hold !== "blocked" && (sub.status === "inactive" || sub.status === "payment_due" || payButtonDue(sub, today));
}

/** Orden de presentación estable; nunca cambia el estado ni hace activable una casa bloqueada. */
export function orderSubscriptions<T extends { sub: HouseSubscription }>(rows: readonly T[], today: string): T[] {
  const priority = (sub: HouseSubscription) => sub.hold === "blocked" ? 4 : sub.status === "inactive" ? 0 : subscriptionNeedsAttention(sub, today) ? 1 : sub.status === "active" ? 2 : 3;
  return [...rows].sort((a,b)=>priority(a.sub)-priority(b.sub));
}

export function subscriptionSummary(rows: readonly HouseSubscription[]) {
  const count=(status:HouseSubscription["status"])=>rows.filter(s=>s.hold!=="blocked"&&s.status===status).length;
  return { total: rows.length, active: count("active"), inactive: count("inactive"), paymentDue: count("payment_due"), blocked: rows.filter(s=>s.hold==="blocked").length };
}
