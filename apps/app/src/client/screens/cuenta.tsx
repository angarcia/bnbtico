// Cuenta en el navegador: Ingresar (pantalla 06), código (07), Cuenta (08 y 20, a pantalla completa desde arriba; lo del
// propietario aparece con al menos una casa), cuenta lista, recuperar y ayuda. Todo contra AuthApi; supabase-js se carga
// al enviar el primer formulario o si ya hay sesión.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, getRouteApi, useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { Suspense, lazy, useEffect, useState, type FormEvent } from "react";
import { RESEND_COOLDOWN_MS, resendWaitSeconds } from "../../domain/account";
import { isContactNext, isPublishNext, listingInNext } from "../../domain/contact-return";
import { firstName, initials } from "../../domain/person";
import type { Account } from "../../domain/api";
import { toDomainError } from "../../domain/errors";
import { composePhone, DEFAULT_COUNTRY, formatPhone, OTHER_COUNTRY, PHONE_COUNTRIES } from "../../domain/phone";
import { I } from "../../shared/icons";
import { formatCRC } from "../../domain/money";
import { MONTHLY_FEE_CRC } from "../../domain/offer";
import { listingQuery } from "../../shared/listing-query";
import { Picture } from "../../shared/picture";
import { withTimeout } from "../../shared/timeout";
import { accountQuery } from "../account";
import { suscripcionScreen } from "../lazy-screens";
import { FlowFrame, FlowHeader, TabsFrame } from "../chrome";
import { PublishPromoRow } from "../publish-promo";
import { useFavorites } from "../../shared/favorites-store";
import { ConfirmSheet } from "../confirm-sheet";
import { ownListingsQuery, useListingsCount } from "../own-listings-query";
import { authApi, pendingOtp, useSession } from "../session";
import { SUPPORT, waLink } from "../support";
import { useTurnstile } from "../turnstile";

const message = (e: unknown) => toDomainError(e).message;
const field = (fd: FormData, key: string) => String(fd.get(key) ?? "");

function useGoTo() {
  const router = useRouter();
  return (href: string) => router.navigate({ href, replace: true });
}

/** Como `<Navigate replace>`, pero con una ruta que ya trae su búsqueda. */
function Replace({ href }: { href: string }) {
  const goTo = useGoTo();
  useEffect(() => void goTo(href), [href]); // eslint-disable-line react-hooks/exhaustive-deps
  return null;
}

/** Adónde lleva «Volver» desde Ingresar: a la ficha si se venía de escribirle al propietario (sin reabrir la hoja). */
const backFrom = (next?: string) => {
  const publicId = listingInNext(next);
  return publicId ? `/casa/${publicId}` : "/explorar";
};

/** La casa a la que se vuelve, si `next` es una ficha (la misma consulta que la tarjeta; Query la comparte). */
function useReturnListing(next?: string) {
  const publicId = listingInNext(next);
  return useQuery({ ...listingQuery(publicId ?? ""), enabled: !!publicId }).data ?? undefined;
}

/**
 * Verificar el WhatsApp para escribirle a un propietario (revisión UX C2) o para guardar la casa que se publica (§E): la
 * pantalla habla de eso, no de ingresar.
 */
function useContactMode(next?: string) {
  const contact = isContactNext(next);
  const publish = isPublishNext(next);
  const listing = useReturnListing(contact ? next : undefined);
  const owner = listing ? firstName(listing.ownerName) : null;
  const header = contact ? `Escribirle a ${owner ?? "el anfitrión"}` : publish ? "Publicar casa" : "Ingresar";
  return { contact, publish, listing, header, owner };
}

/** La casa a la que se escribe, arriba de la verificación: foto, nombre y quién la alquila. */
function ContactCard({ next }: { next?: string }) {
  const l = useReturnListing(next);
  const photo = l?.photos[0];
  return (
    <div className="card row gap-12 return-card contact-card" data-testid="return-card">
      <span className="return-thumb">{photo ? <Picture photo={photo} alt="" sizes="56px" width={56} height={56} /> : null}</span>
      <span className="stack gap-0">
        <b className="ink">{l?.title ?? "La casa"}</b>
        {l ? (
          <span className="small muted">
            {firstName(l.ownerName)}
            {l.ownerWhatsappVerified ? " · WhatsApp verificado" : ""}
          </span>
        ) : null}
      </span>
    </div>
  );
}

/** Tarjeta «recordando a qué casa vuelve» (diseño 07) cuando `next` es una ficha: foto y nombre de la casa. */
function ReturnCard({ next }: { next?: string }) {
  const publicId = listingInNext(next);
  const listing = useQuery({ ...listingQuery(publicId ?? ""), enabled: !!publicId });
  if (!next) return null;
  if (!publicId) {
    return (
      <div className="card row gap-12">
        <span className="avatar avatar-sm">
          <I.chevron size={18} />
        </span>
        <span className="small muted">Después de verificar vuelve adonde estaba.</span>
      </div>
    );
  }
  const l = listing.data;
  const photo = l?.photos[0];
  return (
    <div className="card row gap-12 return-card" data-testid="return-card">
      <span className="return-thumb">{photo ? <Picture photo={photo} alt="" sizes="56px" width={56} height={56} /> : null}</span>
      <span className="small muted">
        Después de verificar vuelve a <b className="ink">{l?.title ?? "la casa"}</b> con su consulta tal como la dejó.
      </span>
    </div>
  );
}

// ---------- /cuenta ----------
const cuentaRoute = getRouteApi("/cuenta");

export function CuentaScreen() {
  const { status } = useSession();
  const search = cuentaRoute.useSearch();
  // Revisión UX 2026-10-29 (C4, C5): Ingresar y Cuenta son la pestaña de la derecha. A pantalla completa, con su cabecera,
  // solo cuando se llega desde un flujo (escribir al propietario, publicar…) o al editar los datos.
  const fromFlow = !!search.next && search.next !== "/favoritos";
  if (status === "signed-out") {
    if (fromFlow)
      return (
        <FlowFrame>
          {/* Un enlace viejo con `?modo=entrar` abre el mismo flujo único. */}
          <EntryForm next={search.next} />
        </FlowFrame>
      );
    return (
      <TabsFrame>
        <h1 className="sr-only">Ingresar</h1>
        <SignInForm next={search.next} mode="account" />
      </TabsFrame>
    );
  }
  const editing = search.editar === "1";
  if (editing || fromFlow)
    return (
      <FlowFrame>
        <MyAccount editing={editing} />
      </FlowFrame>
    );
  return (
    <TabsFrame>
      <MyAccount editing={false} tab />
    </TabsFrame>
  );
}

/** Ingresar a pantalla completa: la cabecera del modo y el formulario. */
function EntryForm({ next }: { next?: string }) {
  const { contact, publish, header } = useContactMode(next);
  return (
    <>
      <FlowHeader title={header} back={backFrom(next)} />
      <SignInForm next={next} mode={contact ? "contact" : publish ? "publish" : "account"} />
    </>
  );
}

/**
 * Cuerpo de Ingresar, sin cabecera, en un único flujo (ticket 18): primero el WhatsApp. Si el número tiene cuenta se envía
 * el código; si no, se pide el nombre y entonces se envía (un solo código por número; ver AuthApi.start).
 */
export function SignInForm({ next, mode }: { next?: string; mode: "account" | "contact" | "publish" }) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // Error de un campo (revisión UX A6): debajo de ese campo y con el foco en él.
  const [fieldError, setFieldError] = useState<{ field: "phone" | "name"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  // Número sin cuenta: se pide el nombre para crearla.
  const [newPhone, setNewPhone] = useState<string | null>(null);
  const captcha = useTurnstile();
  const other = country === OTHER_COUNTRY;
  const contact = mode === "contact";
  const publish = mode === "publish";
  const listing = useReturnListing(contact ? next : undefined);
  const owner = listing ? firstName(listing.ownerName) : null;

  function invalid(fieldName: "phone" | "name", text: string) {
    setError(null);
    setFieldError({ field: fieldName, message: text });
    document.getElementById(fieldName === "phone" ? "account-phone" : "account-name")?.focus();
  }

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (newPhone && !field(fd, "name").trim()) return invalid("name", "Escriba su nombre.");
    const typed = field(fd, "phone").trim();
    if (!newPhone && !typed) return invalid("phone", "Escriba su número de WhatsApp.");
    const phone = newPhone ?? composePhone(country, typed);
    if (!phone) return invalid("phone", other ? "Escriba el número completo con «+» y el código de su país." : "Ese número no parece válido para el país elegido.");
    setBusy(true);
    setError(null);
    setFieldError(null);
    try {
      const [api, token] = await Promise.all([authApi(), captcha.token()]);
      const result = await api.start(newPhone ? { phone, name: field(fd, "name") } : { phone }, token);
      if (result === "needs-name") {
        setNewPhone(phone);
        setBusy(false);
        return;
      }
      await navigate({ to: "/cuenta/codigo", search: next ? { next } : {} });
    } catch (err) {
      // Lo que la base dice de un campo (nombre corto, número que no vale) va junto a ese campo.
      const e = toDomainError(err);
      if (e.kind === "validation") invalid(newPhone ? "name" : "phone", e.message);
      else setError(message(err));
      setBusy(false);
    }
  }

  function changeNumber() {
    setNewPhone(null);
    setError(null);
    setFieldError(null);
  }
  const errorOf = (f: "phone" | "name") => (fieldError?.field === f ? fieldError.message : null);

  return (
    <div className="stack flow">
      {contact ? <ContactCard next={next} /> : null}
      <div className="stack gap-8">
        <h2 className="flow-title">
          {newPhone ? "Es su primera vez en bnbtico" : contact ? `Un paso y le escribe a ${owner ?? "el anfitrión"}` : publish ? "Para guardar su casa, verifique su WhatsApp" : "Entre con su WhatsApp"}
        </h2>
        <p className="muted">
          {newPhone ? (
            <>
              Díganos su nombre para crear su cuenta. Le mandamos el código al <b className="ink num">{formatPhone(newPhone)}</b>.
            </>
          ) : publish ? (
            "Le enviamos un código por WhatsApp. Así nadie más puede publicar en su nombre."
          ) : (
            "Le mandamos un código por WhatsApp para confirmar que el número es suyo. Si es su primera vez, le pedimos también su nombre. Sin contraseña ni correo."
          )}
        </p>
      </div>
      {/* Sin `key`: el contenedor de Turnstile tiene que seguir montado entre los dos pasos (un token por envío). */}
      <form onSubmit={submit} className="stack gap-14" noValidate>
        {newPhone ? (
          <div className="field">
            <label htmlFor="account-name">Nombre</label>
            <input
              id="account-name"
              name="name"
              autoComplete="name"
              maxLength={80}
              placeholder="Su nombre"
              required
              autoFocus
              aria-invalid={errorOf("name") ? true : undefined}
              aria-describedby={errorOf("name") ? "account-name-error" : undefined}
            />
            {errorOf("name") ? (
              <p className="field-error" id="account-name-error" role="alert">
                {errorOf("name")}
              </p>
            ) : null}
          </div>
        ) : (
          <>
            <div className="field">
              <label htmlFor="account-phone">Número de WhatsApp</label>
              <div className="input-prefix">
                {/* Un solo control de país (revisión UX A6): la caja del prefijo es el selector; al abrirlo se ven los
                    países con su código. El select invisible ocupa toda la caja, así que tocar «+506 ▾» lo abre. */}
                <span className="prefix prefix-select">
                  <span className="prefix-value" aria-hidden="true">
                    {other ? "Otro" : `+${country}`}
                  </span>
                  <I.chevronDown size={16} />
                  <select
                    id="account-country"
                    name="country"
                    aria-label="País de su WhatsApp"
                    autoComplete="tel-country-code"
                    value={country}
                    onChange={(e) => {
                      setCountry(e.currentTarget.value);
                      setFieldError(null);
                    }}
                  >
                    {PHONE_COUNTRIES.map((c) => (
                      <option key={c.code} value={c.code}>
                        {c.name} (+{c.code})
                      </option>
                    ))}
                    <option value={OTHER_COUNTRY}>Otro país</option>
                  </select>
                </span>
                <input
                  id="account-phone"
                  name="phone"
                  type="tel"
                  autoComplete={other ? "tel" : "tel-national"}
                  inputMode="tel"
                  placeholder={country === DEFAULT_COUNTRY ? "8000 0001" : other ? "+00 000 000 000" : "Sin el código de país"}
                  aria-describedby={errorOf("phone") ? "account-phone-error account-phone-help" : "account-phone-help"}
                  aria-invalid={errorOf("phone") ? true : undefined}
                  required
                />
              </div>
              {errorOf("phone") ? (
                <p className="field-error" id="account-phone-error" role="alert">
                  {errorOf("phone")}
                </p>
              ) : null}
              <span id="account-phone-help" className="xs muted">
                {other ? "Escriba el número completo con «+» y el código de su país." : country === DEFAULT_COUNTRY ? "¿Su número no es de Costa Rica? Toque +506 para elegir su país." : "Escriba su número sin el código de país."}
              </span>
            </div>
          </>
        )}
        <div ref={captcha.container} className="captcha" />
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <button className="btn btn-primary btn-xl btn-block" type="submit" disabled={busy}>
          <I.wa size={20} /> {busy ? "Un momento…" : "Recibir código por WhatsApp"}
        </button>
      </form>
      <div className="stack small">
        {newPhone ? (
          <button type="button" className="btn-link" onClick={changeNumber}>
            Cambiar número
          </button>
        ) : null}
        {contact ? null : (
          <Link to="/cuenta/recuperar" className="link muted">
            No tengo acceso a mi WhatsApp
          </Link>
        )}
      </div>
      {/* Puerta para publicar sin cuenta (A8): solo en el Ingresar de la pestaña, no desde un flujo. */}
      {mode === "account" && !newPhone ? <PublishPromoRow /> : null}
      {publish ? null : (
        <div className="note">
          <I.shield size={22} />
          <span>Su número solo se comparte con el anfitrión cuando usted toca «Contactar por WhatsApp». Explorar y guardar favoritos no necesita cuenta.</span>
        </div>
      )}
      {listingInNext(next) && mode === "account" ? <ReturnCard next={next} /> : null}
      <p className="xs muted center">Al continuar acepta los Términos. bnbtico nunca le pedirá pagos.</p>
    </div>
  );
}

// ---------- /cuenta/codigo ----------
const codigoRoute = getRouteApi("/_flow/cuenta/codigo");
/** Lo que se espera a la lista de casas al ingresar antes de seguir a Explorar. */
const LIST_WAIT_MS = 5000;

export function CodigoScreen() {
  const { next } = codigoRoute.useSearch();
  const pending = pendingOtp();
  if (!pending) return <Navigate to="/cuenta" search={next ? { next } : {}} replace />;
  return <CodeForm phone={pending.phone} mode={pending.mode} sentAt={pending.sentAt} next={next} />;
}

function CodeForm({ phone, mode, sentAt, next }: { phone: string; mode: "register" | "login"; sentAt: number; next?: string }) {
  const navigate = useNavigate();
  const goTo = useGoTo();
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resent, setResent] = useState<string | null>(null);
  const [wait, setWait] = useState(() => resendWaitSeconds(sentAt, Date.now()));
  const captcha = useTurnstile();
  const { contact, publish, header } = useContactMode(next);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (code.length !== 6) return setError("El código tiene 6 dígitos.");
    setBusy(true);
    setError(null);
    try {
      const account = await (await authApi()).verify(code);
      queryClient.setQueryData(accountQuery(account.id).queryKey, account);
      // La lista de casas antes de navegar: la barra se pinta ya con sus pestañas (no salta de dos a cinco) y se llega a
      // Mis casas con casas o a Explorar sin ellas. Si la lectura falla o tarda más de 5 s, Explorar (la barra crece cuando
      // llegue la lista, que sigue leyéndose).
      const list = await withTimeout(queryClient.fetchQuery(ownListingsQuery(account.id)), LIST_WAIT_MS, []).catch(() => []);
      // Una cuenta nueva pasa por «¡Listo!», que pregunta si tiene una casa para alquilar (§E), salvo si se venía a
      // escribirle a un propietario (revisión UX C2) o a guardar la casa que se publica: ahí se sigue sin interponerse.
      if (mode === "register" && !contact && !publish) await navigate({ to: "/cuenta/lista", search: next ? { next } : {}, replace: true });
      else await goTo(next ?? (list.length ? "/propietario/casas" : "/explorar"));
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  }

  async function resend() {
    setResent(null);
    try {
      const [api, token] = await Promise.all([authApi(), captcha.token()]);
      await api.resend(token);
      setWait(RESEND_COOLDOWN_MS / 1000);
      setResent("Le enviamos otro código por WhatsApp.");
    } catch (err) {
      setResent(message(err));
    }
  }

  async function changeNumber() {
    (await authApi()).cancel();
    await navigate({ to: "/cuenta", search: next ? { next } : {}, replace: true });
  }

  const mmss = `${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, "0")}`;
  return (
    <>
      <FlowHeader title={header} back="/cuenta" search={next ? { next } : {}} />
      <div className="stack flow">
        {contact ? <ContactCard next={next} /> : null}
        <div className="stack gap-8">
          <h2 className="flow-title">Introduzca el código</h2>
          <p className="muted">
            Se lo enviamos por WhatsApp al <b className="ink num">{formatPhone(phone)}</b>.
          </p>
        </div>
        <form onSubmit={verify} className="stack gap-18" noValidate>
          <div className="field code-field">
            <label htmlFor="account-code">Código de 6 dígitos</label>
            <div className="code-boxes" aria-hidden="true">
              {Array.from({ length: 6 }, (_, i) => (
                <span key={i} className={i < code.length ? "filled" : i === code.length ? "active" : ""}>
                  {code[i] ?? ""}
                </span>
              ))}
            </div>
            <input
              id="account-code"
              className="code-input"
              name="code"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              pattern="[0-9]*"
              autoFocus
              value={code}
              onChange={(e) => setCode(e.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
            />
          </div>
          {error ? <p className="field-error" role="alert">{error}</p> : null}
          <button className="btn btn-primary btn-xl btn-block" type="submit" disabled={busy}>
            {busy ? "Verificando…" : "Verificar y continuar"}
          </button>
        </form>
        <div className="stack small">
          {wait > 0 ? (
            <span className="muted">
              ¿No llegó? Puede pedir otro en <b className="ink num">{mmss}</b>.
            </span>
          ) : (
            <button type="button" className="btn-link" onClick={resend}>
              Pedir otro código
            </button>
          )}
          <div ref={captcha.container} className="captcha" />
          {resent ? (
            <p className="small" role="status">
              {resent}
            </p>
          ) : null}
          <a className="link" href="https://wa.me/" target="_blank" rel="noopener">
            Abrir WhatsApp para buscar el mensaje
          </a>
          <button type="button" className="btn-link" onClick={changeNumber}>
            Cambiar número
          </button>
        </div>
        {contact ? null : publish ? <p className="note small">Después seguimos con su casa</p> : <ReturnCard next={next} />}
      </div>
    </>
  );
}

// ---------- /cuenta/lista ----------
const listaRoute = getRouteApi("/_flow/cuenta/lista");

export function ListaScreen() {
  const { next } = listaRoute.useSearch();
  const { status, session } = useSession();
  const account = useQuery({ ...accountQuery(session?.userId ?? ""), enabled: !!session });
  const router = useRouter();
  if (status === "signed-out") return <Navigate to="/cuenta" replace />;
  // Enlaces viejos: la vuelta a la hoja de contacto o al asistente de publicar no se detiene en «¡Listo!».
  if (next && (isContactNext(next) || isPublishNext(next))) return <Replace href={next} />;
  // `next` puede llevar su propia búsqueda: se navega con `href`, no con `to`.
  const target = next ?? "/explorar";
  return (
    <>
      <FlowHeader title="Ingresar" back="/explorar" />
      <div className="stack flow">
        <div className="stack gap-8">
          <span className="avatar avatar-ok">
            <I.check size={26} />
          </span>
          <h2 className="flow-title">¡Listo! Su cuenta está creada</h2>
        </div>
        <h3>¿Tiene una casa para alquilar?</h3>
        <Link to="/propietario/publicar" className="btn btn-primary btn-xl">
          Sí, quiero publicarla
        </Link>
        <a
          href={target}
          className="btn btn-ghost btn-lg"
          onClick={(e) => {
            e.preventDefault();
            void router.navigate({ href: target });
          }}
        >
          No, busco casa
        </a>
        {account.data && !account.data.email ? (
          <Link to="/cuenta" search={{ editar: "1" }} className="link small">
            Añadir un correo de recuperación
          </Link>
        ) : null}
      </div>
    </>
  );
}

// ---------- Cuenta ----------
// La tarjeta «Suscripción» y la fila «Método de pago» del propietario viven en el trozo de «Promoción y suscripción»
// (precargado con las pantallas del propietario). Mientras llega, o si owner_billing falla, la tarjeta de siempre.
const CuentaSubscriptionCard = lazy(() => suscripcionScreen().then((m) => ({ default: m.CuentaSubscriptionCard })));
const CuentaPaymentRow = lazy(() => suscripcionScreen().then((m) => ({ default: m.CuentaPaymentRow })));
const SUBSCRIPTION_PLACEHOLDER = (
  <section className="card stack">
    <div className="row between">
      <b>Suscripción</b>
      <span className="xs muted">Oferta de lanzamiento</span>
    </div>
    <p className="small muted">Cuando publique una casa, aquí verá su suscripción. Las primeras 50 casas tienen 12 meses gratis.</p>
    <hr className="divider" />
    <div className="row between baseline">
      <span className="small muted">Próximo cobro</span>
      <b className="num">₡0 · sin método de pago</b>
    </div>
    <span className="xs muted">{formatCRC(MONTHLY_FEE_CRC)} al mes por casa activa, sin permanencia. Sin comisiones por alquiler, nunca.</span>
  </section>
);

function MyAccount({ editing, tab = false }: { editing: boolean; tab?: boolean }) {
  const { session } = useSession();
  const { count } = useListingsCount();
  const owner = (count ?? 0) > 0;
  const navigate = useNavigate();
  const router = useRouter();
  const canGoBack = useCanGoBack();
  const account = useQuery({ ...accountQuery(session?.userId ?? ""), enabled: !!session });
  const [leaving, setLeaving] = useState(false);
  const [asking, setAsking] = useState(false);
  const [logoutError, setLogoutError] = useState<string | null>(null);

  async function logout() {
    setLeaving(true);
    setLogoutError(null);
    try {
      await (await authApi()).logout();
    } catch (e) {
      const err = toDomainError(e);
      setLogoutError(err.kind === "unknown" ? "No pudimos cerrar la sesión. Intente de nuevo." : err.message);
      return setLeaving(false);
    }
    await navigate({ to: "/cuenta", replace: true });
  }

  // La flecha vuelve adonde estaba; abierta directamente, a Mis casas con casas o a Explorar.
  const back = () => (canGoBack ? router.history.back() : void navigate({ to: count ? "/propietario/casas" : "/explorar" }));

  const a = account.data;
  return (
    <>
      {/* Como pestaña (C4), sin flecha ni título visible; al editar o desde un flujo, con su cabecera. */}
      {tab ? <h1 className="sr-only">Cuenta</h1> : <FlowHeader title="Cuenta" back="/explorar" onBack={back} />}
      {a ? (
        <section className="card row account-card">
          <span className="avatar" aria-hidden="true">
            {initials(a.name)}
          </span>
          <div className="stack gap-4 grow-col">
            <h3 className="account-name">{a.name}</h3>
            {/* El número en su línea y la verificación debajo: «WhatsApp verificado ·» se cortaba (C5). */}
            <span className="num account-phone">{formatPhone(a.phone)}</span>
            <span className="row small primary verified">
              <I.check size={16} /> WhatsApp verificado
            </span>
            <span className="xs muted" data-testid="identity-soon">
              Pronto podrá verificar también su identidad (opcional).
            </span>
          </div>
          {/* Editar y Listo sustituyen la entrada del historial: la flecha de Cuenta sigue volviendo adonde se estaba. */}
          {editing ? (
            <Link to="/cuenta" replace className="link small">
              Listo
            </Link>
          ) : (
            <Link to="/cuenta" search={{ editar: "1" }} replace className="link small">
              Editar
            </Link>
          )}
        </section>
      ) : (
        <section className="card skeleton account-skeleton" aria-busy="true" aria-label="Cargando su cuenta">
          <span className="sk sk-line" />
        </section>
      )}

      {a && editing ? (
        <section className="card stack">
          <h3>Mi perfil</h3>
          <ProfileForm account={a} />
        </section>
      ) : null}

      {owner ? (
        <Suspense fallback={SUBSCRIPTION_PLACEHOLDER}>
          <CuentaSubscriptionCard fallback={SUBSCRIPTION_PLACEHOLDER} />
        </Suspense>
      ) : null}

      <section className="list">
        {owner ? (
          <Suspense fallback={null}>
            <CuentaPaymentRow />
          </Suspense>
        ) : null}
        {!owner ? (
          <Link to="/cuenta" search={{ editar: "1" }} replace className="list-item">
            <I.user />
            <span className="body">
              Mi perfil<small>Descripción y correo de recuperación (opcionales)</small>
            </span>
            <span className="chev">
              <I.chevron />
            </span>
          </Link>
        ) : null}
        {/* Favoritos sale de la barra del propietario y pasa aquí (C4). */}
        {owner ? <FavoritesRow /> : null}
        {count === 0 ? <PublishPromoRow /> : null}
        {a?.isAdmin ? (
          <Link to="/admin" replace className="list-item">
            <I.inbox />
            <span className="body">
              Revisión de anuncios · admin<small>Cola de casas por revisar (pide un segundo código)</small>
            </span>
            <span className="chev">
              <I.chevron />
            </span>
          </Link>
        ) : null}
        <Link to="/ayuda" className="list-item">
          <I.help />
          <span className="body">
            Ayuda por WhatsApp<small>{owner ? "Línea de bnbtico para anfitriones" : "Línea de bnbtico para clientes"}</small>
          </span>
          <span className="chev">
            <I.chevron />
          </span>
        </Link>
      </section>

      {/* Lo último de la pantalla, pequeño y con confirmación: cerrar la sesión obliga a pedir un código nuevo. */}
      <div className="stack account-foot">
        <span className="xs muted">Términos y privacidad</span>
        {/* Atribución de la licencia ODbL de los límites administrativos (zonas); antes al pie de Ayuda (revisión UX 2026-10-29, N7). */}
        <span className="xs muted">
          Límites administrativos © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">colaboradores de OpenStreetMap</a> (ODbL).
        </span>
        <button type="button" className="btn-link muted logout-link" onClick={() => setAsking(true)} disabled={leaving}>
          Cerrar sesión
        </button>
        {logoutError ? (
          <p className="note small" role="alert">
            {logoutError}
          </p>
        ) : null}
      </div>
      {asking ? (
        <ConfirmSheet
          title="¿Cerrar sesión?"
          body="Tendrá que recibir un código nuevo para volver a entrar."
          confirmLabel="Cerrar sesión"
          confirmClassName="btn btn-ghost btn-lg"
          cancelClassName="btn-link muted logout-cancel"
          onClose={() => setAsking(false)}
          onConfirm={() => {
            setAsking(false);
            void logout();
          }}
        />
      ) : null}
    </>
  );
}

/** Favoritos dentro de Cuenta para el propietario (su barra ya tiene cinco pestañas). */
function FavoritesRow() {
  const n = useFavorites().length;
  return (
    <Link to="/favoritos" className="list-item" data-testid="favorites-row">
      <I.heart />
      <span className="body">
        Favoritos<small className="num">{n === 0 ? "Ninguna casa guardada" : n === 1 ? "1 casa guardada" : `${n} casas guardadas`}</small>
      </span>
      <span className="chev">
        <I.chevron />
      </span>
    </Link>
  );
}

type ProfileValues = { name: string; description: string; email: string };
const profileValues = (a: Pick<Account, "name" | "description" | "email">): ProfileValues => ({ name: a.name, description: a.description ?? "", email: a.email ?? "" });
const formValues = (form: HTMLFormElement): ProfileValues => {
  const fd = new FormData(form);
  return { name: field(fd, "name").trim(), description: field(fd, "description").trim(), email: field(fd, "email").trim() };
};
const sameValues = (a: ProfileValues, b: ProfileValues) => a.name === b.name && a.description === b.description && a.email === b.email;

/** «Guardar» solo se activa con cambios; al guardar, el botón se desactiva y un aviso confirma o explica el fallo. */
function ProfileForm({ account }: { account: Account }) {
  const queryClient = useQueryClient();
  const [saved, setSaved] = useState<ProfileValues>(() => profileValues(account));
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState<{ error?: string; ok?: boolean; busy?: boolean }>({});

  function onInput(e: FormEvent<HTMLFormElement>) {
    setDirty(!sameValues(formValues(e.currentTarget), saved));
    if (state.ok || state.error) setState({});
  }

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!dirty || state.busy) return;
    const fd = new FormData(e.currentTarget);
    setState({ busy: true });
    try {
      const updated = await (await authApi()).updateProfile({ name: field(fd, "name"), email: field(fd, "email"), description: field(fd, "description") });
      queryClient.setQueryData(accountQuery(updated.id).queryKey, updated);
      setSaved(profileValues(updated));
      setDirty(false);
      setState({ ok: true });
    } catch (err) {
      setState({ error: message(err) });
    }
  }

  return (
    <form onSubmit={save} onInput={onInput} className="stack gap-14" noValidate>
      <div className="field">
        <label htmlFor="account-name">Nombre</label>
        <input id="account-name" name="name" defaultValue={account.name} maxLength={80} autoComplete="name" />
      </div>
      <div className="field">
        <label htmlFor="account-description">Descripción (opcional)</label>
        <textarea id="account-description" name="description" rows={3} maxLength={1000} defaultValue={account.description ?? ""} placeholder="Cuéntenos un poco sobre usted" />
      </div>
      <div className="field">
        <label htmlFor="account-email">Correo de recuperación (opcional)</label>
        <input id="account-email" name="email" type="email" autoComplete="email" defaultValue={account.email ?? ""} placeholder="nombre@ejemplo.com" />
        <span className="xs muted">Sirve para recuperar la cuenta si pierde el acceso a su WhatsApp.</span>
      </div>
      {state.error ? (
        <p className="note" role="alert">
          {state.error}
        </p>
      ) : null}
      {state.ok ? (
        <p className="note" role="status">
          <I.check size={18} /> Cambios guardados.
        </p>
      ) : null}
      <button className="btn btn-primary btn-lg" type="submit" disabled={!dirty || state.busy}>
        {state.busy ? "Guardando…" : state.ok ? "Guardado" : "Guardar cambios"}
      </button>
    </form>
  );
}

// ---------- /cuenta/recuperar ----------
export function RecuperarScreen() {
  return (
    <>
      <FlowHeader title="Recuperar mi cuenta" back="/cuenta" historyBack />
      <section className="card stack gap-14">
        <p>Use el correo que añadió y confirmó en su perfil. Después podrá verificar su nuevo WhatsApp para recuperar el acceso.</p>
        <div className="field">
          <label htmlFor="recovery-email">Correo confirmado</label>
          <input id="recovery-email" type="email" placeholder="nombre@ejemplo.com" disabled />
        </div>
        <button className="btn btn-primary btn-lg" type="button" disabled>
          Recuperar con mi correo
        </button>
        <p className="xs muted">La recuperación por correo se activa cuando confirme uno en su perfil.</p>
      </section>
      <section className="card stack">
        <h3>¿No tiene un correo confirmado?</h3>
        <p className="small">Pida ayuda a bnbtico para revisar la recuperación. Indicar su nombre y otro número no basta para recuperar una cuenta. No mande documentos ni códigos por este formulario.</p>
        <Link to="/ayuda" className="btn btn-wa">
          <I.wa size={20} /> Escribir a bnbtico por WhatsApp
        </Link>
      </section>
    </>
  );
}

// ---------- /ayuda ----------
export function AyudaScreen() {
  const s = SUPPORT[(useListingsCount().count ?? 0) > 0 ? "owner" : "guest"];
  return (
    <>
      <FlowHeader title="Ayuda por WhatsApp" back="/cuenta" historyBack />
      <section className="card stack gap-14">
        <span className="eyebrow">{s.label}</span>
        <p>{s.intro}</p>
        {s.number ? (
          <>
            <p className="small muted">
              <span className="num">{s.number}</span> · canal separado del de {s.other}.
            </p>
            <a className="btn btn-wa" href={waLink(s.number, s.greeting)} target="_blank" rel="noopener">
              <I.wa size={20} /> Abrir WhatsApp
            </a>
          </>
        ) : (
          <>
            <p className="small muted">Número pendiente de configurar. Canal separado del de {s.other}.</p>
            <button className="btn btn-wa" type="button" disabled>
              <I.wa size={20} /> Abrir WhatsApp
            </button>
          </>
        )}
      </section>
    </>
  );
}
