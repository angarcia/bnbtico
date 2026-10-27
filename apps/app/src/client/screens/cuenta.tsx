// Cuenta en el navegador: Ingresar (pantalla 06), código (07), Mi cuenta (08) y Cuenta del propietario (20), cuenta lista,
// recuperar y ayuda. Todo contra AuthApi; supabase-js se carga al enviar el primer formulario o si ya hay sesión.
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, Navigate, getRouteApi, useNavigate, useRouter } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { RESEND_COOLDOWN_MS, resendWaitSeconds } from "../../domain/account";
import { listingInNext } from "../../domain/contact-return";
import type { Account } from "../../domain/api";
import { toDomainError } from "../../domain/errors";
import { composePhone, DEFAULT_COUNTRY, formatPhone, OTHER_COUNTRY, PHONE_COUNTRIES } from "../../domain/phone";
import { I } from "../../shared/icons";
import { FX_CRC_PER_USD } from "../../domain/money";
import { CurrencySwitch } from "../currency-switch";
import { listingQuery } from "../../shared/listing-query";
import { Picture } from "../../shared/picture";
import { accountQuery } from "../account";
import { FlowHeader, RootHeader, TabsFrame } from "../chrome";
import { setRole, useRole } from "../role";
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
  // Ingresar y Mi cuenta llevan la barra inferior (ticket 17); solo la pantalla del código va sin ella.
  if (status === "signed-out") {
    return (
      <TabsFrame>
        {/* Un enlace viejo con `?modo=entrar` abre el mismo flujo único. */}
        <EntryForm next={search.next} />
      </TabsFrame>
    );
  }
  return (
    <TabsFrame>
      <MyAccount editing={search.editar === "1"} />
    </TabsFrame>
  );
}

/**
 * Ingresar en un único flujo (ticket 18): primero el WhatsApp. Si el número tiene cuenta se envía el código; si no, se
 * pide el nombre y entonces se envía (un solo código por número; ver AuthApi.start).
 */
function EntryForm({ next }: { next?: string }) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  // Número sin cuenta: se pide el nombre para crearla.
  const [newPhone, setNewPhone] = useState<string | null>(null);
  const captcha = useTurnstile();
  const other = country === OTHER_COUNTRY;

  async function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const phone = newPhone ?? composePhone(country, field(fd, "phone"));
    if (!phone) return setError(other ? "Escriba el número completo con «+» y el código de su país." : "Ese número no parece válido para el país elegido.");
    setBusy(true);
    setError(null);
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
      setError(message(err));
      setBusy(false);
    }
  }

  function changeNumber() {
    setNewPhone(null);
    setError(null);
  }

  return (
    <>
      <FlowHeader title="Ingresar" back={backFrom(next)} />
      <div className="stack flow">
        <div className="stack gap-8">
          <h2 className="flow-title">{newPhone ? "Es su primera vez en bnbtico" : "Entre con su WhatsApp"}</h2>
          <p className="muted">
            {newPhone ? (
              <>
                Díganos su nombre para crear su cuenta. Le mandamos el código al <b className="ink num">{formatPhone(newPhone)}</b>.
              </>
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
              <input id="account-name" name="name" autoComplete="name" maxLength={80} placeholder="Su nombre" required autoFocus />
            </div>
          ) : (
            <>
              <div className="field">
                <label htmlFor="account-country">País de su WhatsApp</label>
                <select id="account-country" name="country" autoComplete="tel-country-code" value={country} onChange={(e) => setCountry(e.currentTarget.value)}>
                  {PHONE_COUNTRIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.name} (+{c.code})
                    </option>
                  ))}
                  <option value={OTHER_COUNTRY}>Otro país</option>
                </select>
              </div>
              <div className="field">
                <label htmlFor="account-phone">Número de WhatsApp</label>
                <div className="input-prefix">
                  {other ? null : (
                    <span className="prefix" aria-hidden="true">
                      +{country}
                    </span>
                  )}
                  <input
                    id="account-phone"
                    name="phone"
                    type="tel"
                    autoComplete={other ? "tel" : "tel-national"}
                    inputMode="tel"
                    placeholder={country === DEFAULT_COUNTRY ? "8000 0001" : other ? "+00 000 000 000" : "Sin el código de país"}
                    aria-describedby="account-phone-help"
                    required
                  />
                </div>
                <span id="account-phone-help" className="xs muted">
                  {other ? "Escriba el número completo con «+» y el código de su país." : country === DEFAULT_COUNTRY ? "¿Su número no es de Costa Rica? Elija su país arriba." : "Escriba su número sin el código de país."}
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
          <Link to="/cuenta/recuperar" className="link muted">
            No tengo acceso a mi WhatsApp
          </Link>
        </div>
        <div className="note">
          <I.shield size={22} />
          <span>Su número solo se comparte con el propietario cuando usted toca «Contactar por WhatsApp». Explorar y guardar favoritos no necesita cuenta.</span>
        </div>
        {listingInNext(next) ? <ReturnCard next={next} /> : null}
        <p className="xs muted center">Al continuar acepta los Términos. bnbtico nunca le pedirá pagos.</p>
      </div>
    </>
  );
}

// ---------- /cuenta/codigo ----------
const codigoRoute = getRouteApi("/_flow/cuenta/codigo");

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
      if (account.isOwner) setRole("owner");
      // La pantalla «¡Listo!» invita a añadir un correo: no tiene sentido si la cuenta ya tiene uno.
      if (mode === "register" && !account.email) await navigate({ to: "/cuenta/lista", search: next ? { next } : {}, replace: true });
      else await goTo(next ?? "/cuenta");
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
      <FlowHeader title="Ingresar" back="/cuenta" search={next ? { next } : {}} />
      <div className="stack flow">
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
        <ReturnCard next={next} />
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
  // `next` puede llevar su propia búsqueda (`/casa/CT-####?contacto=1`): se navega con `href`, no con `to`.
  const target = next ?? "/explorar";
  if (status === "signed-out") return <Navigate to="/cuenta" replace />;
  if (account.data?.email) return <Replace href={target} />;
  return (
    <>
      <FlowHeader title="Ingresar" back="/explorar" />
      <div className="stack flow">
        <div className="stack gap-8">
          <span className="avatar avatar-ok">
            <I.check size={26} />
          </span>
          <h2 className="flow-title">¡Listo! Su cuenta está creada</h2>
          <p className="muted">Su WhatsApp ya está verificado. Si quiere, añada un correo para recuperar la cuenta si pierde el acceso a ese número. Puede añadirlo después en Mi cuenta.</p>
        </div>
        <Link to="/cuenta" search={{ editar: "1" }} className="btn btn-primary btn-xl">
          Añadir correo a mi perfil
        </Link>
        <a
          href={target}
          className="btn btn-ghost btn-lg"
          onClick={(e) => {
            e.preventDefault();
            void router.navigate({ href: target });
          }}
        >
          Ahora no · continuar
        </a>
      </div>
    </>
  );
}

// ---------- Mi cuenta / Cuenta ----------
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? "")).toUpperCase() || "?";
}

function MyAccount({ editing }: { editing: boolean }) {
  const { session } = useSession();
  const role = useRole();
  const owner = role === "owner";
  const admin = role === "admin";
  const navigate = useNavigate();
  const account = useQuery({ ...accountQuery(session?.userId ?? ""), enabled: !!session });
  const [leaving, setLeaving] = useState(false);

  async function logout() {
    setLeaving(true);
    await (await authApi()).logout();
    setRole("guest");
    await navigate({ to: "/cuenta", replace: true });
  }

  async function switchRole(role: "guest" | "owner") {
    setRole(role);
    await navigate({ to: role === "owner" ? "/propietario" : "/explorar" });
  }

  const a = account.data;
  return (
    <>
      <RootHeader title={role === "guest" ? "Mi cuenta" : "Cuenta"} home={owner ? "/propietario" : admin ? "/admin" : "/explorar"} />
      {a ? (
        <section className="card row account-card">
          <span className="avatar" aria-hidden="true">
            {initials(a.name)}
          </span>
          <div className="stack gap-4 grow-col">
            <h3 className="account-name">{a.name}</h3>
            <span className="row small primary verified">
              <I.check size={16} /> WhatsApp verificado · <span className="num">{formatPhone(a.phone)}</span>
            </span>
          </div>
          {editing ? (
            <Link to="/cuenta" className="link small">
              Listo
            </Link>
          ) : (
            <Link to="/cuenta" search={{ editar: "1" }} className="link small">
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
          <span className="xs muted">₡9 900 al mes por casa activa, sin permanencia. Sin comisiones por alquiler, nunca.</span>
        </section>
      ) : null}

      <section className="list">
        {!owner ? (
          <Link to="/cuenta" search={{ editar: "1" }} className="list-item">
            <I.user />
            <span className="body">
              Mi perfil<small>Descripción y correo de recuperación (opcionales)</small>
            </span>
            <span className="chev">
              <I.chevron />
            </span>
          </Link>
        ) : null}
        {role === "guest" ? (
          <Link to="/favoritos" className="list-item">
            <I.heart />
            <span className="body">
              Favoritos<small>Las casas que guarde</small>
            </span>
            <span className="chev">
              <I.chevron />
            </span>
          </Link>
        ) : null}
        {a?.isAdmin ? (
          <Link to="/admin" className="list-item">
            <I.inbox />
            <span className="body">
              Revisión de anuncios · admin<small>Cola de casas por revisar (pide un segundo código)</small>
            </span>
            <span className="chev">
              <I.chevron />
            </span>
          </Link>
        ) : null}
        <div className="list-item">
          <span aria-hidden="true" className="muted-icon currency-icon">
            ₡
          </span>
          <span className="body" id="currency-label">
            Moneda<small>Dólares solo de referencia: ≈ ₡{FX_CRC_PER_USD} por US$1</small>
          </span>
          <CurrencySwitch />
        </div>
        <Link to="/ayuda" className="list-item">
          <I.help />
          <span className="body">
            Ayuda por WhatsApp<small>{owner ? "Línea de bnbtico para propietarios" : "Línea de bnbtico para clientes"}</small>
          </span>
          <span className="chev">
            <I.chevron />
          </span>
        </Link>
        {role !== "guest" ? (
          <button type="button" className="list-item" onClick={() => switchRole("guest")}>
            <I.search />
            <span className="body">
              Buscar una casa<small>Pasar al modo cliente</small>
            </span>
            <span className="chev">
              <I.chevron />
            </span>
          </button>
        ) : null}
      </section>

      {role === "guest" ? (
        <section className="card-arena stack">
          <b className="display">¿Tiene una casa en el Caribe?</b>
          <span className="small">Publíquela gratis durante 12 meses si está entre las primeras 50. Sin comisiones: los clientes le escriben por WhatsApp.</span>
          <button type="button" className="btn btn-ghost" onClick={() => switchRole("owner")}>
            Publicar mi casa
          </button>
        </section>
      ) : null}

      <div className="row between foot-row">
        <button type="button" className="btn-link muted" onClick={logout} disabled={leaving}>
          Cerrar sesión
        </button>
        <span className="xs muted">Términos y privacidad</span>
      </div>
    </>
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
      <FlowHeader title="Recuperar mi cuenta" back="/cuenta" />
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
  const s = SUPPORT[useRole() === "owner" ? "owner" : "guest"];
  return (
    <>
      <FlowHeader title="Ayuda por WhatsApp" back="/cuenta" />
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
