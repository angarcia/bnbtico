// «Promoción y suscripción» (fase 5, ticket 05; diseño v1 punto 16 y pantalla o-sub del prototipo, en usted) y la parte de
// la suscripción en Cuenta (diseño 20). Trozo diferido propio: se precarga con las pantallas del propietario y Cuenta
// importa de aquí su tarjeta y su fila, para que las pestañas no crezcan. Todo sale de owner_billing (billing.ts); si esa
// lectura falla (base sin la migración), Cuenta sale como antes y esta pantalla solo explica la oferta.
// Parar y reactivar son optimistas con vuelta atrás; «Añadir método de pago» pide al worker la página de la pasarela.
import { useIsRestoring, useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, getRouteApi, useLocation, useNavigate } from "@tanstack/react-router";
import { Fragment, useEffect, useRef, useState, type ReactNode } from "react";
import { DomainError, toDomainError } from "../../domain/errors";
import { STATUS_LABELS, type Listing, type ListingStatus } from "../../domain/listing";
import { formatCRC } from "../../domain/money";
import { PAYMENT_MESSAGES } from "../../domain/payments";
import { scopeBilling, scopeFix } from "../../domain/subscription-scope";
import {
  MONTHLY_FEE_CRC,
  launchOffer,
  nextCharge,
  nextStatus,
  parsePayHash,
  payButtonDue,
  promoRunning,
  reminderCard,
  reminderDaysLeft,
  shortDate,
  subscriptionLine,
  type BillingHouse,
  type BillingOverview,
  type PaymentMethodSummary,
} from "../../domain/subscription";
import { I } from "../../shared/icons";
import { billingQuery, useBilling, type HouseBilling } from "../billing";
import { FlowHeader } from "../chrome";
import { ConfirmSheet } from "../confirm-sheet";
import { activityQuery, offerTakenQuery, ownListingsQuery, patchCached, refresh } from "../owner";
import { useSession } from "../session";

const route = getRouteApi("/_flow/_privateFlow/propietario/suscripcion");
const message = (e: unknown) => toDomainError(e).message;
const fee = () => formatCRC(MONTHLY_FEE_CRC);
const SAVE_WAIT_MS = 10_000;

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
  const token = await (await import("../supabase-data")).accessToken();
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

function PayButton({ publicId, label = "Añadir método de pago", ghost }: { publicId?: string; label?: string; ghost?: boolean }) {
  const pay = usePaymentPage();
  return (
    <>
      <button type="button" className={`btn ${ghost ? "btn-ghost btn-sm" : "btn-sun btn-block"}`} disabled={pay.isPending} onClick={() => pay.mutate(publicId)}>
        {pay.isPending ? "Abriendo la página de pago…" : label}
      </button>
      {pay.isError ? (
        <p className="note small" role="alert">
          {message(pay.error)}
        </p>
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
      const billing = (await import("../supabase-data")).ownerBilling();
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

const REMINDER_LABEL: Record<number, string> = { 90: "de los 90 días", 30: "de los 30 días", 7: "de los 7 días", 0: "del último día" };

function PayNotice({ hb, today }: { hb: HouseBilling; today: string }) {
  const { sub } = hb;
  const card =
    sub.status === "payment_due"
      ? {
          title: sub.promoEndsOn ? `Su oferta gratuita terminó el ${shortDate(sub.promoEndsOn, today)}` : "Falta el método de pago",
          body: `La ficha está oculta y el enlace no funciona hasta que añada un método de pago. ${formatCRC(sub.monthlyPriceCrc)} al mes, sin permanencia; puede parar cuando quiera.`,
        }
      : reminderCard(reminderDaysLeft(sub, today) ?? -1);
  if (!card) return null;
  return (
    <div className="card-sun stack gap-4" data-testid="pay-notice">
      <b>{card.title}</b>
      <span className="small ink">{card.body}</span>
    </div>
  );
}

function HouseCard({ hb, today, userId, hasMethod, target, onAction }: { hb: HouseBilling; today: string; userId: string; hasMethod: boolean; target: boolean; onAction(): void }) {
  const { house, sub } = hb;
  const [confirming, setConfirming] = useState(false);
  const change = useStopResume(userId, house, hasMethod);
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    if (!target || !ref.current) return;
    ref.current.scrollIntoView({ block: "center" });
    ref.current.focus({ preventScroll: true });
  }, [target]);
  // Bloqueada por bnbtico: la suscripción está parada; no hay nada que pagar, parar ni reactivar.
  const blocked = sub.hold === "blocked";
  const label = blocked ? { label: "Bloqueada", badge: "badge-bad" } : STATUS_LABELS[sub.status];
  // «Pendiente de pago» ya lo dice la etiqueta: la línea solo sale cuando añade algo.
  const line = subscriptionLine(sub, today);
  const pay = payButtonDue(sub, today);
  const sent = house.reminders.filter((r) => r.status === "sent" && r.sentAt);
  return (
    <article ref={ref} tabIndex={-1} className={`stack gap-8 sub-house${target ? " is-target" : ""}`} data-house={house.publicId}>
      <div className="row between baseline gap-8">
        <h3 className="sub-house-title">{house.title || "Casa sin título"}</h3>
        <span className={`badge ${label.badge}`}>{label.label}</span>
      </div>
      {line && line !== label.label ? (
        <span className="small muted num" data-testid="sub-line">
          {line}
        </span>
      ) : null}
      {/* Lo que la casa le ha dado (visitas y consultas): lo que retiene, no el botón para irse (revisión UX 2026-10-29, A2). */}
      {sub.status === "active" ? <HouseFigures userId={userId} listingId={house.listingId} /> : null}
      {pay ? <PayNotice hb={hb} today={today} /> : null}
      {pay ? <PayButton publicId={house.publicId} /> : null}
      {sub.status === "inactive" && !blocked ? (
        <>
          <button type="button" className="btn btn-sun btn-block" disabled={change.isPending} onClick={() => {
              onAction();
              change.mutate("resume");
            }}>
            Activar suscripción
          </button>
          {sub.plan === "promo" && sub.promoEndsOn && today <= sub.promoEndsOn ? (
            <span className="xs muted num">Mantiene su plaza de la oferta: gratis hasta el {shortDate(sub.promoEndsOn, today)}.</span>
          ) : null}
        </>
      ) : null}
      {change.isError ? (
        <p className="note small" role="alert">
          {message(change.error)}
        </p>
      ) : null}
      {house.plan === "promo" && house.promoEndsOn && !blocked ? (
        <span className="xs muted">
          Avisos por WhatsApp: 90, 30 y 7 días antes y el último día.
          {sent.map((r) => ` Aviso ${REMINDER_LABEL[r.daysBefore]} enviado el ${shortDate(r.sentAt!.slice(0, 10), today)}.`).join("")}
        </span>
      ) : null}
      {/* «Parar suscripción» como texto, centrado y al final; la confirmación sigue igual (A2). */}
      {!blocked && (sub.status === "active" || sub.status === "payment_due") ? (
        <button type="button" className="btn-text sub-stop" disabled={change.isPending} onClick={() => setConfirming(true)}>
          Parar suscripción
        </button>
      ) : null}
      {confirming ? (
        <ConfirmSheet
          title="Parar suscripción"
          body={`¿Parar la suscripción de ${house.title || "esta casa"}? La casa deja de verse y no se cobra. Puede reactivarla cuando quiera.`}
          confirmLabel="Parar suscripción"
          confirmClassName="btn btn-outline-bad btn-lg"
          cancelClassName="btn btn-ghost btn-lg"
          returnFocus={ref}
          onClose={() => setConfirming(false)}
          onConfirm={() => {
            setConfirming(false);
            onAction();
            change.mutate("stop");
          }}
        />
      ) : null}
    </article>
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
      {views} {views === 1 ? "visita" : "visitas"} · {inquiries} {inquiries === 1 ? "consulta" : "consultas"} en 30 días
    </span>
  );
}

// ---------- La pantalla ----------

type Saving = "saving" | "saved" | "late" | null;

/** Vuelta de la pasarela con `?pago=ok` (la pantalla lo quita de la URL): se vuelve a leer owner_billing hasta ~10 s. */
function useSavingMethod(userId: string, pago: "ok" | undefined): [Saving, () => void] {
  const client = useQueryClient();
  const [saving, setSaving] = useState<Saving>(() => (pago === "ok" ? "saving" : null));
  useEffect(() => {
    if (saving !== "saving" || !userId) return;
    let stopped = false;
    const started = Date.now();
    void (async () => {
      while (!stopped) {
        const o = await client.fetchQuery({ ...billingQuery(userId), staleTime: 0 }).catch(() => null);
        if (stopped) return;
        if (o?.method) {
          setSaving("saved");
          void client.invalidateQueries({ queryKey: ["own-listings", userId] });
          void client.invalidateQueries({ queryKey: ["listings"] });
          return;
        }
        if (Date.now() - started >= SAVE_WAIT_MS) return setSaving("late");
        await new Promise((r) => setTimeout(r, 1000));
      }
    })();
    return () => {
      stopped = true;
    };
  }, [saving, userId, client]);
  // El aviso de la vuelta se retira en cuanto el propietario hace otra cosa (parar o reactivar una casa).
  const dismiss = () => setSaving((s) => (s === "saving" ? s : null));
  return [saving, dismiss];
}

const SAVING_TEXT: Record<Exclude<Saving, null>, string> = {
  saving: "Guardando su método de pago…",
  saved: "Método de pago guardado. No se cobra nada hasta que termine la oferta.",
  late: "Lo estamos confirmando; aparecerá en unos minutos.",
};

export function SuscripcionScreen() {
  const userId = useSession().session?.userId ?? "";
  const search = route.useSearch();
  // Con `?casa=` se vuelve a leer siempre al abrir: una casa aprobada hace un momento aún no está en la caché.
  const billing = useQuery({ ...billingQuery(userId), enabled: !!userId, refetchOnMount: search.casa ? "always" : true });
  const restoring = useIsRestoring();
  const indexed = useBilling(userId);
  const hash = useLocation({ select: (l) => l.hash });
  const navigate = useNavigate();
  const target = parsePayHash(hash ? `#${hash}` : "");
  const [saving, dismissSaving] = useSavingMethod(userId, search.pago);
  const scope = indexed ? scopeBilling(indexed.all, search.casa) : null;
  // Asentado = leído de la base tras abrir la pantalla y sin error: sin red (o si falló), `casa` se queda y no se ven las demás.
  const settled = !!indexed && billing.isFetchedAfterMount && billing.isSuccess && !billing.isFetching && !restoring;
  // Una sola corrección de la URL: fuera `pago=ok` siempre y `casa` si no es suya (con los datos ya leídos); el hash se queda.
  useEffect(() => {
    const fix = scopeFix(search, { unknown: !!scope?.unknown, settled });
    if (fix) void navigate({ to: "/propietario/suscripcion", search: fix, hash, replace: true });
  }, [search, scope?.unknown, settled]); // eslint-disable-line react-hooks/exhaustive-deps
  const today = indexed?.today ?? "";
  const method = indexed?.method ?? null;
  const scoped = scope?.scoped ?? null;
  // Con casa: «Suscripción» desde el primer pintado (y mientras se confirma una casa que aún no está en la caché).
  const single = !!search.casa && (scoped !== null || (indexed ? !settled : billing.isPending));
  const due = scoped ? payButtonDue(scoped.sub, today) : (indexed?.all.some((x) => payButtonDue(x.sub, today)) ?? false);
  const card = (hb: HouseBilling) => (
    <HouseCard key={hb.house.listingId} hb={hb} today={today} userId={userId} hasMethod={!!method} target={hb.house.publicId === target} onAction={dismissSaving} />
  );
  // Revisión UX 2026-10-29 (A2, Ana): si alguna casa necesita algo (parada o pendiente de pago), «Sus casas» va arriba, con
  // esas primero; si todas están al día, abajo del todo.
  const needsSomething = (hb: HouseBilling) => hb.sub.status === "inactive" || hb.sub.status === "payment_due";
  const needs = scoped ? needsSomething(scoped) : (indexed?.all.some(needsSomething) ?? false);
  const ordered = indexed ? [...indexed.all.filter(needsSomething), ...indexed.all.filter((x) => !needsSomething(x))] : [];
  const houses = scoped ? (
    <section className="card stack gap-12">{card(scoped)}</section>
  ) : indexed ? (
    <section className="card stack gap-12">
      <h2 className="card-title">Sus casas</h2>
      {ordered.length ? ordered.map(card) : <p className="small muted">Cuando aprobemos su primera casa, aquí verá su oferta y su suscripción.</p>}
    </section>
  ) : null;
  const methodCard = (
    <section className="card stack gap-8" data-testid="method-card">
      <h2 className="card-title">Método de pago</h2>
      {method ? (
        <div className="row between baseline gap-8">
          <span className="row gap-8 num">
            <CardIcon /> {methodName(method)} · vence {expiry(method)}
          </span>
          <PayButton label="Cambiar" ghost publicId={scoped?.house.publicId} />
        </div>
      ) : (
        <>
          <span className="row gap-8">
            <CardIcon /> Ninguno todavía
          </span>
          {due ? <PayButton publicId={scoped?.house.publicId} /> : <span className="small muted">Puede añadirlo cuando le avisemos.</span>}
        </>
      )}
      <span className="xs muted">Se guarda en la página segura de la pasarela de pago; en bnbtico nunca se escribe el número de la tarjeta. Ahora no se cobra nada.</span>
    </section>
  );
  // «Cómo funciona», plegado y en blanco (A2, A6).
  const howItWorks = (
    <details className="card small how-it-works" data-testid="how-it-works">
      <summary className="strong">¿Cómo funciona el cobro?</summary>
      <span>
        Cuando aprobamos su casa, empieza su oferta gratuita (si le tocó plaza). Le avisamos por WhatsApp y aquí a los 90, 30 y 7 días y el último día. Si al terminar tiene
        un método de pago, la casa sigue activa por {fee()} al mes; si no, queda pendiente de pago y deja de mostrarse hasta que lo añada. Puede parar la suscripción
        de una casa cuando quiera (queda inactiva y no se cobra) y reactivarla después con el mismo enlace. Sin permanencia y sin comisiones por alquiler.
      </span>
    </details>
  );

  return (
    <>
      <FlowHeader title={single ? "Suscripción" : "Promoción y suscripción"} back="/cuenta" historyBack />
      {scoped ? (
        <p className="small muted sub-scope" data-testid="sub-scope">
          {scoped.house.title || "Casa sin título"}
        </p>
      ) : null}
      {saving ? (
        <p className={`note${saving === "late" ? " note-sun" : ""}`} role="status">
          {SAVING_TEXT[saving]}
        </p>
      ) : null}

      {/* La oferta, arriba del todo mientras queden plazas (A2). */}
      {single ? null : <TiersCard />}

      {indexed && (!single || scoped) ? (
        // Con claves, React mueve las tarjetas en vez de montarlas otra vez: al parar una casa el foco sigue en ella.
        (needs ? [houses, methodCard, howItWorks] : [methodCard, howItWorks, houses]).map((el) => <Fragment key={el === houses ? "houses" : el === methodCard ? "method" : "how"}>{el}</Fragment>)
      ) : single && billing.isError && !billing.isFetching ? (
        <p className="note" role="alert">
          {message(billing.error)}
        </p>
      ) : userId && (billing.isPending || single) ? (
        <section className="card skeleton sub-skeleton" aria-busy="true" aria-label="Cargando su suscripción">
          <span className="sk sk-line" />
        </section>
      ) : (
        howItWorks
      )}
      {scoped && indexed && indexed.all.length >= 2 ? (
        <Link to="/propietario/suscripcion" className="link small center">
          Ver todas sus casas
        </Link>
      ) : null}
    </>
  );
}

function TiersCard() {
  const taken = useQuery(offerTakenQuery);
  const offer = taken.data === undefined ? undefined : launchOffer(taken.data);
  return (
    <section className="card stack gap-8 offer-card" data-testid="tiers-card">
      <div className="row between baseline">
        <b className="display offer-title">Oferta de lanzamiento</b>
        <span className={`xs num offer-left${offer === undefined ? " is-hidden" : ""}`}>{offer ? `Quedan ${offer.remaining} de ${offer.size}` : offer === null ? "Terminada" : "Quedan …"}</span>
      </div>
      <span className="small ink">Primeras 50 casas: 12 meses gratis. Siguientes 50: 6 meses. Siguientes 100: 3 meses.</span>
      <span className="xs">
        Después, {fee()} al mes por casa, sin permanencia. Cada casa toma su plaza cuando la aprobamos y la conserva aunque la edite o la pare.
      </span>
    </section>
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
  const rows: { id: string; publicId?: string; title: string; status: ListingStatus; line: string; promo: boolean }[] = billing.all.map(({ house, sub }) => ({ id: house.listingId, publicId: house.publicId, title: house.title, status: sub.status, line: subscriptionLine(sub, today) ?? STATUS_LABELS[sub.status].label, promo: sub.status === "active" && sub.plan === "promo" }));
  // Las casas en revisión que aún no tienen suscripción (nunca aprobadas): «En revisión», sin enlace.
  for (const l of (own.data ?? []) as Listing[]) {
    if (l.status === "review" && !billing.of(l.id)) rows.push({ id: l.id, title: l.title, status: "review", line: "En revisión", promo: false });
  }
  return (
    <section className="card stack gap-10" data-testid="subscription-card">
      <div className="row between baseline">
        <b>Suscripción</b>
        <Link to="/propietario/suscripcion" className="link small">
          Ver detalle
        </Link>
      </div>
      {rows.length ? (
        <div className="stack gap-8 small">
          {rows.map((r) => {
            // Pendiente de pago o parada: el título en ocre y la etiqueta del estado (dinero que falta).
            const ocre = r.status === "payment_due" || r.status === "inactive";
            const inner = (
              <>
                <span className={ocre ? "sun-ink strong" : undefined}>{r.title || "Casa sin título"}</span>
                {ocre ? <span className="badge badge-sun">{STATUS_LABELS[r.status].label}</span> : <span className={`num align-end ${r.promo ? "primary strong" : (LINE_CLASS[r.status] ?? "")}`}>{r.line}</span>}
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
      ) : (
        <p className="small muted">Cuando aprobemos su primera casa, aquí verá su suscripción.</p>
      )}
      <hr className="divider" />
      <div className="row between baseline">
        <span className="small muted">Próximo cobro</span>
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
      <span className="xs muted">{fee()} al mes por casa activa, sin permanencia. Sin comisiones por alquiler, nunca.</span>
    </section>
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
    <Link to="/propietario/suscripcion" className="list-item list-item-sun" data-testid="payment-row">
      <span className="primary">
        <CardIcon />
      </span>
      <span className="body">
        Añadir método de pago<small className="num">Falta · añádalo antes de que termine su oferta</small>
      </span>
      <span className="chev">
        <I.chevron />
      </span>
    </Link>
  );
}
