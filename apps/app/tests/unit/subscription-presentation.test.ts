import { describe, expect, it } from "vitest";
import { orderSubscriptions, subscriptionNeedsAttention, subscriptionSummary } from "../../src/domain/subscription-presentation";
import type { HouseSubscription } from "../../src/domain/subscription";
const today="2026-11-06";
const sub=(status:HouseSubscription["status"],extra:Partial<HouseSubscription>={}):HouseSubscription=>({status,plan:"promo",promoEndsOn:"2027-11-06",paidSince:null,stoppedOn:null,monthlyPriceCrc:2900,hasMethod:false,...extra});
describe("presentación de suscripciones",()=>{
 it("prioriza activación y pagos sin hacer activable una bloqueada ni mutar la lista",()=>{
  const rows=[{id:"active",sub:sub("active")},{id:"blocked",sub:sub("inactive",{hold:"blocked"})},{id:"due",sub:sub("payment_due")},{id:"inactive",sub:sub("inactive")},{id:"active2",sub:sub("active")}];
  expect(orderSubscriptions(rows,today).map(x=>x.id)).toEqual(["inactive","due","active","active2","blocked"]);
  expect(rows.map(x=>x.id)).toEqual(["active","blocked","due","inactive","active2"]);
 });
 it("incluye avisos antes del fin de oferta pero excluye bloqueos y casas al día",()=>{
  expect(subscriptionNeedsAttention(sub("active"),today)).toBe(false);
  expect(subscriptionNeedsAttention(sub("active",{promoEndsOn:"2026-11-13"}),today)).toBe(true);
  expect(subscriptionNeedsAttention(sub("active",{promoEndsOn:"2026-11-13",hasMethod:true}),today)).toBe(false);
  expect(subscriptionNeedsAttention(sub("payment_due",{hold:"blocked"}),today)).toBe(false);
 });
 it("resume todas las casas reales, sin límites de tres ni contar una bloqueada como inactiva activable",()=>{
  const rows=[sub("inactive"),sub("inactive",{hold:"blocked"}),sub("payment_due"),...Array.from({length:9},()=>sub("active"))];
  expect(subscriptionSummary(rows)).toEqual({total:12,active:9,inactive:1,paymentDue:1,blocked:1});
  expect(subscriptionSummary([])).toEqual({total:0,active:0,inactive:0,paymentDue:0,blocked:0});
 });
});
