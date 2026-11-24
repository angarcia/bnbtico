// «Promoción y suscripción» (fase 5, ticket 05; diseño v1 punto 16 y pantalla o-sub del prototipo, en usted) y la parte de
// la suscripción en Cuenta (diseño 20). Trozo diferido propio: se precarga con las pantallas del propietario y Cuenta
// importa de aquí su tarjeta y su fila, para que las pestañas no crezcan. Todo sale de owner_billing (billing.ts); si esa
// lectura falla (base sin la migración), Cuenta sale como antes y esta pantalla solo explica la oferta.
// Parar y reactivar son optimistas con vuelta atrás; «Añadir método de pago» pide al worker la página de la pasarela.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, getRouteApi } from "@tanstack/react-router";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { DomainError, toDomainError } from "../../../domain/errors";
import { type Listing, type ListingStatus } from "../../../domain/listing";
import { holdLabel, statusLabel } from "../../../domain/status-label";
import { formatCRC } from "../../../domain/money";
import { PAYMENT_MESSAGES } from "../../../domain/payments";
import { orderSubscriptions, subscriptionNeedsAttention, subscriptionSummary } from "../../../domain/subscription-presentation";
import { type SuscripcionSearch } from "../../../domain/subscription-scope";
import {
  MONTHLY_FEE_CRC,
  launchOffer,
  nextCharge,
  nextStatus,
  parsePayHash,
  payButtonDue,
  paymentDueCard,
  promoRunning,
  reminderCard,
  reminderDaysLeft,
  shortDate,
  subscriptionLine,
  type BillingHouse,
  type BillingOverview,
  type PaymentMethodSummary,
} from "../../../domain/subscription";
import { I } from "../../../shared/ui/icons";
import { billingQuery, useBilling, type HouseBilling } from "./billing";
import { ScreenHeader } from "../../comun/screen-header";
import { ConfirmSheet } from "../../comun/confirm-sheet";
import { useDesktop } from "../../../shared/desktop";
import { activityQuery, offerTakenQuery, ownListingsQuery, patchCached, refresh } from "../owner";
import { useSession } from "../../comun/session";
import { Button, TextButton } from "../../../shared/ui/button";
import { LoadError, Notice, Skeleton, StatusTag } from "../../../shared/ui/structure";
import { Card } from "../../../shared/ui/card";
import { RouterListRow } from "../../comun/router-rows";
import * as SUB_COPY from "./copy/subscription";
import { useSavingMethod, useSubscriptionScope, type Saving } from "./use-subscription";

const route = getRouteApi("/_flow/_privateFlow/propietario/suscripcion");
const message = (e: unknown) => toDomainError(e).message;
const fee = () => formatCRC(MONTHLY_FEE_CRC);

const CardIcon = () => (
  <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="3" y="6" width="18" height="13" rx="3" />
    <path d="M3 10h18M7 15h4" />
  </svg>
);

/** «Visa ···· 4242». */
const methodName = (m: PaymentMethodSummary) => `${m.brand.charAt(0).toUpperCase()}${m.brand.slice(1)} ···· ${m.last4}`;
const expiry = (m: PaymentMethodSummary) => `${String(m.expMonth).padStart(2, "0")}/${String(m.expYear).slice(-2)}`;

/** POST /api/pago/sesion con el JWT de la sesión → la página de la pasarela (Stripe; en local, la falsa del worker). */
async function openPaymentPage(publicId?: string): Promise<void> {
  if (typeof navigator !== "undefined" && navigator.onLine === false) throw toDomainError(new TypeError("Failed to fetch"));
  const token = await (await import("../../../shared/supabase-data")).accessToken();
  if (!token) throw new DomainError(PAYMENT_MESSAGES.noSession, "session");
  let res: Response;
  try {
    res = await fetch("/api/pago/sesion", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(publicId ? { publicId } : {}),
    });
  } catch (e) {
    throw toDomainError(e);
  }
  const body = (await res.json().catch(() => ({}))) as { url?: unknown; error?: unknown };
  if (!res.ok || typeof body.url !== "string") throw new DomainError(typeof body.error === "string" ? body.error : PAYMENT_MESSAGES.gateway, "unknown");
  location.assign(body.url);
}

function usePaymentPage() {
  return useMutation({ mutationFn: (publicId?: string) => openPaymentPage(publicId) });
}

function PayButton({ publicId, label = SUB_COPY.addMethod, ghost }: { publicId?: string; label?: string; ghost?: boolean }) {
  const pay = usePaymentPage();
  return (
    <>
      <Button variant={ghost ? "secondary" : "pay"} block={!ghost} disabled={pay.isPending} onClick={() => pay.mutate(publicId)}>
        {pay.isPending ? SUB_COPY.opening : label}
      </Button>
      {pay.isError ? (
        <Notice tone="error" small>
          {message(pay.error)}
        </Notice>
      ) : null}
    </>
  );
}

// ---------- Parar y reactivar (optimistas) ----------

function useStopResume(userId: string, house: BillingHouse, hasMethod: boolean) {
  const client = useQueryClient();
  const key = billingQuery(userId).queryKey;
  return useMutation({
    mutationFn: async (event: "stop" | "resume"): Promise<ListingStatus> => {
      const billing = (await import("../../../shared/supabase-data")).ownerBilling();
      return event === "stop" ? billing.stop(house.listingId) : billing.resume(house.listingId);
    },
    onMutate: async (event) => {
      await client.cancelQueries({ queryKey: key });
      const before = client.getQueryData<BillingOverview>(key);
      const today = before?.today ?? "";
      const next = nextStatus(house.status, event, { promoRunning: promoRunning(house, today), hasMethod });
      const status = next.ok ? next.status : house.status;
      client.setQueryData<BillingOverview>(key, (o) =>
        o && { ...o, houses: o.houses.map((x) => (x.listingId === house.listingId ? { ...x, status, stoppedOn: event === "stop" ? today : null } : x)) },
      );
      patchCached(client, userId, house.listingId, { status });
      return { before, status: house.status };
    },
    onError: (_e, _event, context) => {
      if (!context) return;
      client.setQueryData(key, context.before);
      patchCached(client, userId, house.listingId, { status: context.status });
    },
    onSettled: () => refresh(client, userId, { id: house.listingId, publicId: house.publicId }),
  });
}

// ---------- Una casa ----------

const REMINDER_LABEL: Record<number, string> = { 90: SUB_COPY.reminder90, 30: SUB_COPY.reminder30, 7: SUB_COPY.reminder7, 0: SUB_COPY.reminderLast };

function PayNotice({ hb, today }: { hb: HouseBilling; today: string }) {
  const { sub } = hb;
  const card =
    sub.status === "payment_due"
      ? paymentDueCard(sub.promoEndsOn ? shortDate(sub.promoEndsOn, today) : null, sub.monthlyPriceCrc)
      : reminderCard(reminderDaysLeft(sub, today) ?? -1);
  if (!card) return null;
  return (
    <Card as="div" tone="sun" layout="stack" gap={4} data-testid="pay-notice">
      <b>{card.title}</b>
      <span className="small ink">{card.body}</span>
    </Card>
  );
}

function HouseCard({ hb, today, userId, hasMethod, target, onAction }: { hb: HouseBilling; today: string; userId: string; hasMethod: boolean; target: boolean; onAction(): void }) {
  const desktop = useDesktop();
  const { house, sub } = hb;
  const [confirming, setConfirming] = useState(false);
  const change = useStopResume(userId, house, hasMethod);
  const ref = useFocusWhenTarget(target);
  // Bloqueada por 3bstays: la suscripción está parada; no hay nada que pagar, parar ni reactivar.
  const blocked = sub.hold === "blocked";
  const label = blocked ? holdLabel("blocked", "row") : statusLabel(sub.status);
  // «Pendiente de pago» ya lo dice la etiqueta: la línea solo sale cuando añade algo.
  const line = subscriptionLine(sub, today);
  const pay = payButtonDue(sub, today);
  const free = !blocked && promoRunning(sub, today);
  const sent = house.reminders.filter((r) => r.status === "sent" && r.sentAt);
  return (
    <Card as="article" ref={ref} tabIndex={-1} layout="stack" gap={8} placement={sub.status === "inactive" && !blocked ? "sub-house-inactive" : "sub-house"} mark={target ? "target" : undefined} data-house={house.publicId}>
      <div className="row between baseline gap-8">
        <h3 className="sub-house-title">{house.title || SUB_COPY.untitled}</h3>
        <StatusTag label={label} />
      </div>
      {line && line !== label.text ? (
        <span className="small muted num" data-testid="sub-line">
          {line}
        </span>
      ) : null}
      <p className="sub-price num" data-testid="sub-price"><b>{formatCRC(free ? 0 : sub.monthlyPriceCrc)}</b><span>{SUB_COPY.perMonth({ inactive: sub.status === "inactive" && !blocked })}</span></p>
      {free ? <span className="small muted num">{SUB_COPY.afterOffer({ fee: formatCRC(sub.monthlyPriceCrc) })}</span> : null}
      {sub.status === "inactive" && !blocked ? <span className="small muted">{SUB_COPY.noChargeNow}</span> : null}
      {/* Lo que la casa le ha dado (visitas y consultas): lo que retiene, no el botón para irse (revisión UX 2026-10-29, A2). */}
      {sub.status === "active" ? <HouseFigures userId={userId} listingId={house.listingId} /> : null}
      {pay ? <PayNotice hb={hb} today={today} /> : null}
      {pay ? <PayButton publicId={house.publicId} /> : null}
      {sub.status === "inactive" && !blocked ? (
        <>
          <Button variant="pay" block disabled={change.isPending} onClick={() => {
              onAction();
              change.mutate("resume");
            }}>
            {SUB_COPY.activate}
          </Button>
          {sub.plan === "promo" && sub.promoEndsOn && today <= sub.promoEndsOn ? (
            <span className="xs muted num">{SUB_COPY.keepsPlace({ until: shortDate(sub.promoEndsOn, today) })}</span>
          ) : null}
        </>
      ) : null}
      {change.isError ? (
        <Notice tone="error" small>
          {message(change.error)}
        </Notice>
      ) : null}
      {house.plan === "promo" && house.promoEndsOn && !blocked ? (
        <span className="xs muted">
          {SUB_COPY.reminders}
          {sent.map((r) => SUB_COPY.reminderSent({ label: REMINDER_LABEL[r.daysBefore] ?? "", date: shortDate(r.sentAt!.slice(0, 10), today) })).join("")}
        </span>
      ) : null}
      {/* «Parar suscripción» como texto, centrado y al final; la confirmación sigue igual (A2). */}
      {!blocked && (sub.status === "active" || sub.status === "payment_due") ? (
        <TextButton tone="quiet" placement="sub-stop" disabled={change.isPending} onClick={() => setConfirming(true)}>
          {SUB_COPY.stop}
        </TextButton>
      ) : null}
      {confirming ? (
        <ConfirmSheet
          title={SUB_COPY.stop}
          body={SUB_COPY.stopBody({ title: house.title })}
          confirmLabel={SUB_COPY.stop}
          tone={desktop ? "keep" : "destructive"}
          cancelLabel={desktop ? SUB_COPY.keepSubscription : SUB_COPY.cancel}
          cancelFirst={desktop}
          returnFocus={ref}
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onAction();
            change.mutate("stop");
          }}
        />
      ) : null}
    </Card>
  );
}

/** «44 visitas · 1 consulta en 30 días» de una casa activa (A2). */
function HouseFigures({ userId, listingId }: { userId: string; listingId: string }) {
  const { data } = useQuery({ ...activityQuery(userId), enabled: !!userId });
  const a = data?.find((x) => x.listingId === listingId);
  if (!data) return null;
  const views = a?.views ?? 0;
  const inquiries = a?.inquiries ?? 0;
  return (
    <span className="small strong num" data-testid="sub-figures">
      {SUB_COPY.figures({ views, inquiries })}
    </span>
  );
}

// ---------- La pantalla ----------

const SAVING_TEXT: Record<Exclude<Saving, null>, string> = {
  saving: SUB_COPY.savingMethod,
  saved: SUB_COPY.savedMethod,
  late: SUB_COPY.lateMethod,
};

/** El método de pago guardado (o «Añadir método de pago» si toca pagar). `publicId`: la casa a la que vuelve la pasarela. */
function MethodCard({ method, due, publicId }: { method: PaymentMethodSummary | null; due: boolean; publicId: string | undefined }) {
  return (
    <Card layout="stack" gap={8} data-testid="method-card">
      <h2 className="card-title">{SUB_COPY.method}</h2>
      {method ? (
        <div className="row between baseline gap-8">
          <span className="row gap-8 num">
            <CardIcon /> {SUB_COPY.methodLine({ name: methodName(method), expiry: expiry(method) })}
          </span>
          <PayButton label={SUB_COPY.change} ghost publicId={publicId} />
        </div>
      ) : (
        <>
          <span className="row gap-8">
            <CardIcon /> {SUB_COPY.noMethod}
          </span>
          {due ? <PayButton publicId={publicId} /> : <span className="small muted">{SUB_COPY.addLater}</span>}
        </>
      )}
      <span className="xs muted">{SUB_COPY.methodNote}</span>
    </Card>
  );
}

/** «Cómo funciona», plegado y en blanco (revisión UX A2, A6). */
function HowItWorks() {
  return (
    <Card as="details" placement="how-it-works" data-testid="how-it-works">
      <summary className="strong">{SUB_COPY.howTitle}</summary>
      <span>
        {SUB_COPY.howText({ fee: fee() })}
      </span>
    </Card>
  );
}

/** Al abrir desde un aviso (`#pago=CT-…`), la tarjeta de esa casa se centra y recibe el foco. */
function useFocusWhenTarget(target: boolean) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!target || !ref.current) return;
    ref.current.scrollIntoView({ block: "center" });
    ref.current.focus({ preventScroll: true });
  }, [target]);
  return ref;
}

export function SuscripcionScreen() {
  return <SubscriptionContent search={route.useSearch()} />;
}

export function HouseSubscriptionPanel({ listing }: { listing: Listing }) {
  return <SubscriptionContent search={{ casa: listing.publicId }} panelBack={`/propietario/casas/${listing.id}`} />;
}

export function AccountSubscriptionDetails() {
  return <SubscriptionContent search={{}} inAccount />;
}

function SubscriptionContent({ search, panelBack, inAccount = false }: { search: SuscripcionSearch; panelBack?: string; inAccount?: boolean }) {
  const userId = useSession().session?.userId ?? "";
  const [saving, dismissSaving] = useSavingMethod(userId, search.pago);
  const { billing, indexed, scoped, settled, single, hash } = useSubscriptionScope(userId, search, panelBack);
  const target = parsePayHash(hash ? `#${hash}` : "");
  const today = indexed?.today ?? "";
  const method = indexed?.method ?? null;
  const due = scoped ? payButtonDue(scoped.sub, today) : (indexed?.all.some((x) => payButtonDue(x.sub, today)) ?? false);
  const card = (hb: HouseBilling) => (
    <HouseCard key={hb.house.listingId} hb={hb} today={today} userId={userId} hasMethod={!!method} target={hb.house.publicId === target} onAction={dismissSaving} />
  );
  // Revisión UX 2026-10-29 (A2, Ana): si alguna casa necesita algo (parada o pendiente de pago), «Sus casas» va arriba, con
  // esas primero; si todas están al día, abajo del todo.
  const needsSomething = (hb: HouseBilling) => subscriptionNeedsAttention(hb.sub, today);
  const needs = scoped ? needsSomething(scoped) : (indexed?.all.some(needsSomething) ?? false);
  const ordered = indexed ? orderSubscriptions(indexed.all, today) : [];
  const houses = scoped ? (
    <section className="stack gap-12 subscription-list">{card(scoped)}</section>
  ) : indexed ? (
    <section className="stack gap-12 subscription-list">
      <h2 className="card-title">{SUB_COPY.yourHouses}</h2>
      {ordered.length ? ordered.map(card) : <p className="small muted">{SUB_COPY.firstHouse}</p>}
    </section>
  ) : null;
  const methodCard = <MethodCard method={method} due={due} publicId={scoped?.house.publicId} />;
  const howItWorks = <HowItWorks />;

  return (
    <>
      {inAccount ? <h2>{SUB_COPY.titleInAccount}</h2> : (
        <ScreenHeader kind="flow" title={SUB_COPY.title({ single: !!single })} back={{ to: panelBack ?? "/cuenta", historyBack: !panelBack }} />
      )}
      {scoped ? (
        <p className="small muted sub-scope" data-testid="sub-scope">
          {scoped.house.title || SUB_COPY.untitled}
        </p>
      ) : null}
      {saving ? (
        <Notice tone={saving === "late" ? "sun" : "info"} announce>
          {SAVING_TEXT[saving]}
        </Notice>
      ) : null}

      {/* La oferta, arriba del todo mientras queden plazas (A2). */}
      {single ? null : <TiersCard />}

      {indexed && (!single || scoped) ? (
        // Con claves, React mueve las tarjetas en vez de montarlas otra vez: al parar una casa el foco sigue en ella.
        (needs ? [houses, methodCard, howItWorks] : [methodCard, howItWorks, houses]).map((el) => <Fragment key={el === houses ? "houses" : el === methodCard ? "method" : "how"}>{el}</Fragment>)
      ) : (single || inAccount) && billing.isError && !billing.isFetching ? (
        <LoadError onRetry={() => void billing.refetch()}>
          {message(billing.error)}
        </LoadError>
      ) : panelBack && settled ? (
        <Notice>{SUB_COPY.unavailable}</Notice>
      ) : userId && (billing.isPending || single) ? (
        <Skeleton shape="subscription" label={SUB_COPY.loading} />
      ) : (
        howItWorks
      )}
      {!panelBack && scoped && indexed && indexed.all.length >= 2 ? (
        <Link to="/propietario/suscripcion" className="link small center">
          {SUB_COPY.allHouses}
        </Link>
      ) : null}
    </>
  );
}

function TiersCard() {
  const taken = useQuery(offerTakenQuery);
  const offer = taken.data === undefined ? undefined : launchOffer(taken.data);
  return (
    <Card layout="stack" gap={8} placement="subscription-offer" data-testid="tiers-card">
      <div className="row between baseline">
        <b className="display offer-title">{SUB_COPY.offerTitle}</b>
        <span className={`xs num offer-left${offer === undefined ? " is-hidden" : ""}`}>{offer ? SUB_COPY.offerLeft({ remaining: offer.remaining, size: offer.size }) : offer === null ? SUB_COPY.offerOver : SUB_COPY.offerLoading}</span>
      </div>
      <span className="small ink">{SUB_COPY.tiers}</span>
      <span className="xs">
        {SUB_COPY.tiersNote({ fee: fee() })}
      </span>
    </Card>
  );
}

// ---------- Cuenta (diseño 20): la tarjeta «Suscripción» y la fila «Método de pago» ----------

const LINE_CLASS: Partial<Record<ListingStatus, string>> = { review: "muted" };

/** La tarjeta de Cuenta con una línea por casa y el próximo cobro; `fallback` (la de siempre) sin datos de facturación. */
export function CuentaSubscriptionCard({ fallback }: { fallback: ReactNode }) {
  const userId = useSession().session?.userId ?? "";
  const billing = useBilling(userId);
  const own = useQuery({ ...ownListingsQuery(userId), enabled: !!userId });
  if (!billing) return <>{fallback}</>;
  const { today } = billing;
  const rows: { id: string; publicId?: string; title: string; status: ListingStatus; line: string; promo: boolean; blocked: boolean; attention: boolean }[] = billing.all.map(({ house, sub }) => ({ id: house.listingId, publicId: house.publicId, title: house.title, status: sub.status, line: subscriptionLine(sub, today) ?? statusLabel(sub.status).text, promo: sub.status === "active" && sub.plan === "promo", blocked: sub.hold === "blocked", attention: subscriptionNeedsAttention(sub, today) }));
  // Las casas en revisión que aún no tienen suscripción (nunca aprobadas): «En revisión», sin enlace.
  for (const l of (own.data ?? []) as Listing[]) {
    if (l.status === "review" && !billing.of(l.id)) rows.push({ id: l.id, title: l.title, status: "review", line: SUB_COPY.inReview, promo: false, blocked: false, attention: false });
  }
  const visible = rows.filter((r) => r.attention || r.blocked || r.status === "review");
  const summary = subscriptionSummary(billing.all.map((x) => x.sub));
  return (
    <Card layout="stack" gap={10} data-testid="subscription-card">
      <div className="row between baseline">
        <b>{SUB_COPY.subscriptions}</b>
      </div>
      {visible.length ? (
        <div className="stack gap-8 small">
          {visible.map((r) => {
            // Pendiente de pago o parada: el título en ocre y la etiqueta del estado (dinero que falta).
            const ocre = !r.blocked && (r.status === "payment_due" || r.status === "inactive");
            const inner = (
              <>
                <span className={ocre ? "sun-ink strong" : undefined}>{r.title || SUB_COPY.untitled}</span>
                {r.blocked ? <StatusTag label={holdLabel("blocked", "row")} /> : ocre ? <StatusTag label={{ text: statusLabel(r.status).text, tone: "pay" }} /> : <span className={`num align-end ${r.promo ? "primary strong" : (LINE_CLASS[r.status] ?? "")}`}>{r.line}</span>}
                {r.blocked || (ocre && r.status === "inactive") ? <span className="sub-row-detail xs muted num">{r.line}</span> : null}
              </>
            );
            return r.publicId ? (
              <Link key={r.id} to="/propietario/suscripcion" search={{ casa: r.publicId }} className="row between gap-8 baseline sub-row-link" data-testid="sub-row" data-ocre={ocre ? "1" : undefined}>
                {inner}
              </Link>
            ) : (
              <div key={r.id} className={`row between gap-8 baseline${r.status === "review" ? " muted" : ""}`} data-testid="sub-row">
                {inner}
              </div>
            );
          })}
        </div>
      ) : summary.total === 0 ? (
        <p className="small muted">{SUB_COPY.firstHouseShort}</p>
      ) : null}
      <Link to="/propietario/suscripcion" className="sub-summary-link" data-testid="subscriptions-link">
        <CardIcon />
        <span className="stack gap-4"><span>{SUB_COPY.seeSubscriptions}</span><span className="small muted num" data-testid="subscription-counts">{SUB_COPY.counts({ total: summary.total, inactive: summary.inactive, blocked: summary.blocked })}</span></span>
        <I.chevron />
      </Link>
      <hr className="divider" />
      <div className="row between baseline">
        <span className="small muted">{SUB_COPY.nextCharge}</span>
        {/* «Nada hasta el …» sin negrita: en plena oferta no hay nada que pagar (C5). */}
        {(() => {
          const line = nextCharge(
            billing.all.map((x) => x.sub),
            billing.method,
            today,
          );
          return (
            <span className={line.startsWith("Nada") ? "num" : "num strong"} data-testid="next-charge">
              {line}
            </span>
          );
        })()}
      </div>
      <span className="xs muted">{SUB_COPY.feeNote({ fee: fee() })}</span>
    </Card>
  );
}

/** La fila «Añadir método de pago» de Cuenta, en ocre, solo cuando falta y alguna casa ya lo necesita (la misma regla que
 *  «Añadir método de pago» de Suscripción). Si no falta o aún no toca, no sale: el método se ve en «Ver detalle» (revisión
 *  UX 2026-10-29, C5, Ana). */
export function CuentaPaymentRow() {
  const userId = useSession().session?.userId ?? "";
  const billing = useBilling(userId);
  if (!billing) return null;
  const due = !billing.method && billing.all.some((x) => payButtonDue(x.sub, billing.today));
  if (!due) return null;
  return (
    <RouterListRow tone="sun" to="/propietario/suscripcion" data-testid="payment-row">
      <span className="primary">
        <CardIcon />
      </span>
      <span className="body">
        {SUB_COPY.addMethod}<small className="num">{SUB_COPY.methodRowHint}</small>
      </span>
      <span className="chev">
        <I.chevron />
      </span>
    </RouterListRow>
  );
}
