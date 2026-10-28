// «Promoción y suscripción» (fase 5, ticket 05; diseño v1 punto 16 y pantalla o-sub del prototipo, en usted) y la parte de
// la suscripción en Cuenta (diseño 20). Trozo diferido propio: se precarga con las pantallas del propietario y Cuenta
// importa de aquí su tarjeta y su fila, para que las pestañas no crezcan. Todo sale de owner_billing (billing.ts); si esa
// lectura falla (base sin la migración), Cuenta sale como antes y esta pantalla solo explica la oferta.
// Parar y reactivar son optimistas con vuelta atrás; «Añadir método de pago» pide al worker la página de la pasarela.
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, getRouteApi, useLocation, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState, type KeyboardEvent, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { DomainError, toDomainError } from "../../domain/errors";
import { STATUS_LABELS, type Listing, type ListingStatus } from "../../domain/listing";
import { formatCRC } from "../../domain/money";
import { PAYMENT_MESSAGES } from "../../domain/payments";
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
import { offerTakenQuery, ownListingsQuery, patchCached, refresh } from "../owner";
import { setRole } from "../role";
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

// ---------- Confirmación de «Parar suscripción» (hoja modal como la de pausar el anuncio) ----------

function ConfirmSheet({ title, onConfirm, onClose }: { title: string; onConfirm: () => void; onClose: () => void }) {
  const sheet = useRef<HTMLElement>(null);
  useEffect(() => {
    const root = document.getElementById("root");
    document.documentElement.classList.add("sheet-open");
    if (root) root.inert = true;
    sheet.current?.focus();
    return () => {
      document.documentElement.classList.remove("sheet-open");
      if (root) root.inert = false;
    };
  }, []);
  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      return onClose();
    }
    if (e.key !== "Tab" || !sheet.current) return;
    const items = Array.from(sheet.current.querySelectorAll<HTMLElement>("button"));
    const [first, last] = [items[0], items[items.length - 1]];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet.current)) {
      e.preventDefault();
      last?.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first?.focus();
    }
  }
  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <section ref={sheet} className="sheet stack" role="dialog" aria-modal="true" aria-labelledby="stop-title" aria-describedby="stop-text" tabIndex={-1} onKeyDown={onKeyDown}>
        <span className="grabber" aria-hidden="true" />
        <h2 id="stop-title">Parar suscripción</h2>
        <p id="stop-text">¿Parar la suscripción de {title}? La casa deja de verse y no se cobra. Puede reactivarla cuando quiera.</p>
        <button type="button" className="btn btn-primary btn-lg" onClick={onConfirm}>
          Parar suscripción
        </button>
        <button type="button" className="btn btn-ghost btn-lg" onClick={onClose}>
          Cancelar
        </button>
      </section>
    </>,
    document.body,
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
  const label = STATUS_LABELS[sub.status];
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
      {pay ? <PayNotice hb={hb} today={today} /> : null}
      {pay ? <PayButton publicId={house.publicId} /> : null}
      {sub.status === "active" || sub.status === "payment_due" ? (
        <button type="button" className="btn btn-ghost btn-block" disabled={change.isPending} onClick={() => setConfirming(true)}>
          Parar suscripción
        </button>
      ) : null}
      {sub.status === "inactive" ? (
        <button type="button" className="btn btn-primary btn-block" disabled={change.isPending} onClick={() => {
            onAction();
            change.mutate("resume");
          }}>
          Reactivar
        </button>
      ) : null}
      {change.isError ? (
        <p className="note small" role="alert">
          {message(change.error)}
        </p>
      ) : null}
      {house.plan === "promo" && house.promoEndsOn ? (
        <span className="xs muted">
          Avisos por WhatsApp: 90, 30 y 7 días antes y el último día.
          {sent.map((r) => ` Aviso ${REMINDER_LABEL[r.daysBefore]} enviado el ${shortDate(r.sentAt!.slice(0, 10), today)}.`).join("")}
        </span>
      ) : null}
      {confirming ? (
        <ConfirmSheet
          title={house.title || "esta casa"}
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

// ---------- La pantalla ----------

type Saving = "saving" | "saved" | "late" | null;

/** Vuelta de la pasarela con `?pago=ok`: se quita de la URL y se vuelve a leer owner_billing hasta ~10 s. */
function useSavingMethod(userId: string): [Saving, () => void] {
  const search = route.useSearch();
  const hash = useLocation({ select: (l) => l.hash });
  const navigate = useNavigate();
  const client = useQueryClient();
  const [saving, setSaving] = useState<Saving>(() => (search.pago === "ok" ? "saving" : null));
  useEffect(() => {
    if (search.pago === "ok") void navigate({ to: "/propietario/suscripcion", search: {}, hash, replace: true });
  }, [search.pago]); // eslint-disable-line react-hooks/exhaustive-deps
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
  useEffect(() => setRole("owner"), []);
  const userId = useSession().session?.userId ?? "";
  const billing = useQuery({ ...billingQuery(userId), enabled: !!userId });
  const indexed = useBilling(userId);
  const hash = useLocation({ select: (l) => l.hash });
  const target = parsePayHash(hash ? `#${hash}` : "");
  const [saving, dismissSaving] = useSavingMethod(userId);
  const today = indexed?.today ?? "";
  const method = indexed?.method ?? null;
  const due = indexed?.all.some((x) => payButtonDue(x.sub, today)) ?? false;

  return (
    <>
      <FlowHeader title="Promoción y suscripción" back="/cuenta" />
      {saving ? (
        <p className={`note${saving === "late" ? " note-sun" : ""}`} role="status">
          {SAVING_TEXT[saving]}
        </p>
      ) : null}

      {indexed ? (
        <>
          <section className="card stack gap-12">
            <h2 className="card-title">Sus casas</h2>
            {indexed.all.length ? (
              indexed.all.map((hb) => <HouseCard key={hb.house.listingId} hb={hb} today={today} userId={userId} hasMethod={!!method} target={hb.house.publicId === target} onAction={dismissSaving} />)
            ) : (
              <p className="small muted">Cuando aprobemos su primera casa, aquí verá su oferta y su suscripción.</p>
            )}
          </section>

          <section className="card stack gap-8" data-testid="method-card">
            <h2 className="card-title">Método de pago</h2>
            {method ? (
              <div className="row between baseline gap-8">
                <span className="row gap-8 num">
                  <CardIcon /> {methodName(method)} · vence {expiry(method)}
                </span>
                <PayButton label="Cambiar" ghost />
              </div>
            ) : (
              <>
                <span className="row gap-8">
                  <CardIcon /> Ninguno todavía
                </span>
                {due ? <PayButton /> : <span className="small muted">Puede añadirlo cuando le avisemos.</span>}
              </>
            )}
            <span className="xs muted">Se guarda en la página segura de la pasarela de pago; en bnbtico nunca se escribe el número de la tarjeta. Ahora no se cobra nada.</span>
          </section>
        </>
      ) : billing.isPending && userId ? (
        <section className="card skeleton sub-skeleton" aria-busy="true" aria-label="Cargando su suscripción">
          <span className="sk sk-line" />
        </section>
      ) : null}

      <TiersCard />

      <section className="card-arena stack gap-4 small" data-testid="how-it-works">
        <b>Cómo funciona</b>
        <span>
          Cuando aprobamos su casa, empieza su oferta gratuita (si le tocó plaza). Le avisamos por WhatsApp y aquí a los 90, 30 y 7 días y el último día. Si al terminar tiene
          un método de pago, la casa sigue activa por {fee()} al mes; si no, queda pendiente de pago y deja de mostrarse hasta que lo añada. Puede parar la suscripción
          de una casa cuando quiera (queda inactiva y no se cobra) y reactivarla después con el mismo enlace. Sin permanencia y sin comisiones por alquiler.
        </span>
      </section>
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

const LINE_CLASS: Partial<Record<ListingStatus, string>> = { payment_due: "sun-ink strong", review: "muted" };

/** La tarjeta de Cuenta con una línea por casa y el próximo cobro; `fallback` (la de siempre) sin datos de facturación. */
export function CuentaSubscriptionCard({ fallback }: { fallback: ReactNode }) {
  const userId = useSession().session?.userId ?? "";
  const billing = useBilling(userId);
  const own = useQuery({ ...ownListingsQuery(userId), enabled: !!userId });
  if (!billing) return <>{fallback}</>;
  const { today } = billing;
  const rows = billing.all.map(({ house, sub }) => ({ id: house.listingId, title: house.title, status: sub.status, line: subscriptionLine(sub, today) ?? STATUS_LABELS[sub.status].label, promo: sub.status === "active" && sub.plan === "promo" }));
  // Las casas en revisión que aún no tienen suscripción (nunca aprobadas): «En revisión · ₡0».
  for (const l of (own.data ?? []) as Listing[]) {
    if (l.status === "review" && !billing.of(l.id)) rows.push({ id: l.id, title: l.title, status: "review", line: `En revisión · ${formatCRC(0)}`, promo: false });
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
          {rows.map((r) => (
            <div key={r.id} className={`row between gap-8 baseline${r.status === "review" ? " muted" : ""}`} data-testid="sub-row">
              <span>{r.title || "Casa sin título"}</span>
              <span className={`num align-end ${r.promo ? "primary strong" : (LINE_CLASS[r.status] ?? "")}`}>{r.line}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="small muted">Cuando aprobemos su primera casa, aquí verá su suscripción.</p>
      )}
      <hr className="divider" />
      <div className="row between baseline">
        <span className="small muted">Próximo cobro</span>
        <b className="num" data-testid="next-charge">
          {nextCharge(
            billing.all.map((x) => x.sub),
            billing.method,
            today,
          )}
        </b>
      </div>
      <span className="xs muted">{fee()} al mes por casa activa, sin permanencia. Sin comisiones por alquiler, nunca.</span>
    </section>
  );
}

/** La fila «Método de pago» de Cuenta; nada sin datos de facturación (Cuenta como antes). */
export function CuentaPaymentRow() {
  const userId = useSession().session?.userId ?? "";
  const billing = useBilling(userId);
  if (!billing) return null;
  return (
    <Link to="/propietario/suscripcion" className="list-item">
      <span className="primary">
        <CardIcon />
      </span>
      <span className="body">
        Método de pago<small className="num">{billing.method ? `${methodName(billing.method)} · vence ${expiry(billing.method)}` : "Ninguno todavía · tarjeta"}</small>
      </span>
      <span className="chev">
        <I.chevron />
      </span>
    </Link>
  );
}
