import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { Suspense, lazy, useState, type FormEvent } from "react";
import { initials } from "../../domain/person";
import type { Account } from "../../domain/api";
import { toDomainError } from "../../domain/errors";
import { formatPhone } from "../../domain/phone";
import { I } from "../../shared/icons";
import { formatCRC } from "../../domain/money";
import { MONTHLY_FEE_CRC } from "../../domain/offer";
import { accountQuery } from "../account";
import { suscripcionScreen } from "../lazy-screens";
import { FlowHeader, RootHeader } from "../chrome";
import { isDesktop, useDesktop } from "../desktop";
import { PublishPromoRow } from "../publish-promo";
import { useFavorites } from "../../shared/favorites-store";
import { ConfirmSheet } from "../confirm-sheet";
import { useListingsCount } from "../own-listings-query";
import { authApi, useSession } from "../session";

const message = (e: unknown) => toDomainError(e).message;
const field = (fd: FormData, key: string) => String(fd.get(key) ?? "");

// ---------- Cuenta ----------
// La tarjeta «Suscripción» y la fila «Método de pago» del propietario viven en el trozo de «Promoción y suscripción»
// (precargado con las pantallas del propietario). Mientras llega, o si owner_billing falla, la tarjeta de siempre.
const CuentaSubscriptionCard = lazy(() => suscripcionScreen().then((m) => ({ default: m.CuentaSubscriptionCard })));
const CuentaPaymentRow = lazy(() => suscripcionScreen().then((m) => ({ default: m.CuentaPaymentRow })));
const AccountSubscriptionDetails = lazy(() => suscripcionScreen().then((m) => ({ default: m.AccountSubscriptionDetails })));
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

export function MyAccount({ editing, tab = false }: { editing: boolean; tab?: boolean }) {
  const { session } = useSession();
  const { count } = useListingsCount();
  const owner = (count ?? 0) > 0;
  const desktop = useDesktop();
  const splitAccount = tab && owner && desktop;
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
    await navigate({ to: isDesktop() ? "/explorar" : "/que-es-3bstays", replace: true });
  }

  // La flecha vuelve adonde estaba; abierta directamente, a Mis casas con casas o a Explorar.
  const back = () => (canGoBack ? router.history.back() : void navigate({ to: count ? "/propietario/casas" : "/explorar" }));

  const a = account.data;
  const subscription = owner && !splitAccount ? (
    <Suspense fallback={SUBSCRIPTION_PLACEHOLDER}>
      <CuentaSubscriptionCard fallback={SUBSCRIPTION_PLACEHOLDER} />
    </Suspense>
  ) : null;
  const payment = owner && !splitAccount ? (
    <Suspense fallback={null}>
      <CuentaPaymentRow />
    </Suspense>
  ) : null;
  const accountContent = (
    <>
      {/* Como pestaña (C4), sin flecha ni título visible; al editar o desde un flujo, con su cabecera. */}
      {tab ? (desktop ? null : <h1 className="sr-only">Cuenta</h1>) : <FlowHeader title="Cuenta" back="/explorar" onBack={back} />}
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
          {splitAccount ? null : editing ? (
            <Link to="/cuenta" replace className="link small account-edit">
              Listo
            </Link>
          ) : (
            <Link to="/cuenta" search={{ editar: "1" }} replace className="link small account-edit">
              Editar
            </Link>
          )}
        </section>
      ) : (
        <section className="card skeleton account-skeleton" aria-busy="true" aria-label="Cargando su cuenta">
          <span className="sk sk-line" />
        </section>
      )}

      {a && splitAccount ? <DesktopProfile key={a.id} account={a} /> : a && editing ? (
        <section className="card stack">
          <h3>Mi perfil</h3>
          <ProfileForm key={a.id} account={a} />
        </section>
      ) : null}

      {subscription}

      <section className="list account-actions">
        {payment}
        {/* En móvil, Favoritos está dentro de Cuenta para respetar el límite de cinco pestañas. */}
        {owner && !desktop ? <FavoritesRow /> : null}
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
        {!tab || !desktop ? <Link to="/ayuda" className="list-item">
          <I.help />
          <span className="body">
            Ayuda por WhatsApp<small>{owner ? "Línea de 3bstays para anfitriones" : "Línea de 3bstays para clientes"}</small>
          </span>
          <span className="chev">
            <I.chevron />
          </span>
        </Link> : null}
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
  // En escritorio, la pestaña lleva cabecera de página con el título visible (revisión 2026-11-13, A9).
  const pageHeader = tab && desktop ? <RootHeader title="Cuenta" /> : null;
  return splitAccount ? (
    <>
    {pageHeader}
    <div className="owner-account-layout">
      <div>{accountContent}</div>
      <div>
        <Suspense fallback={SUBSCRIPTION_PLACEHOLDER}>
          <AccountSubscriptionDetails />
        </Suspense>
      </div>
    </div>
    </>
  ) : (
    <>
      {pageHeader}
      {accountContent}
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

function DesktopProfile({ account }: { account: Account }) {
  const [editing, setEditing] = useState(false);
  const { name, description, email } = profileValues(account);
  return (
    <section className="card stack">
      <div className="row between">
        <h3>Mi perfil</h3>
        <button type="button" className="btn-link account-profile-toggle" aria-expanded={editing} onClick={() => setEditing(!editing)}>
          {editing ? "Listo" : "Editar"}
        </button>
      </div>
      {editing ? <ProfileForm account={account} /> : (
        <dl className="stack gap-14 account-profile-values">
          <div><dt className="small muted">Nombre</dt><dd>{name}</dd></div>
          <div><dt className="small muted">Descripción (opcional)</dt><dd>{description || "Sin descripción"}</dd></div>
          <div><dt className="small muted">Correo de recuperación (opcional)</dt><dd>{email || "Sin correo de recuperación"}</dd></div>
        </dl>
      )}
    </section>
  );
}

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
