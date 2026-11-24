import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link, useCanGoBack, useNavigate, useRouter } from "@tanstack/react-router";
import { Suspense, lazy, useState, type FormEvent } from "react";
import { initials } from "../../domain/person";
import type { Account } from "../../domain/api";
import { toDomainError } from "../../domain/errors";
import { formatPhone } from "../../domain/phone";
import { I } from "../../shared/ui/icons";
import { formatCRC } from "../../domain/money";
import { MONTHLY_FEE_CRC } from "../../domain/offer";
import { accountQuery } from "../comun/account";
import { suscripcionScreen } from "../app/lazy-screens";
import { ScreenHeader } from "../comun/screen-header";
import { isDesktop, useDesktop } from "../../shared/desktop";
import { PublishPromoRow } from "../comun/publish-promo";
import { useFavorites } from "../../shared/favorites-store";
import { ConfirmSheet } from "../comun/confirm-sheet";
import { useListingsCount } from "../comun/own-listings-query";
import { authApi, useSession } from "../comun/session";
import { Button, TextButton } from "../../shared/ui/button";
import { Field, TextArea, TextInput } from "../../shared/ui/field";
import { EMAIL_INVALID_ERROR } from "../../domain/account";
import { Notice, Skeleton } from "../../shared/ui/structure";
import { Card, List } from "../../shared/ui/card";
import { RouterListRow } from "../comun/router-rows";
import * as ACCOUNT_COPY from "./copy/account";

const message = (e: unknown) => toDomainError(e).message;
const field = (fd: FormData, key: string) => String(fd.get(key) ?? "");

// ---------- Cuenta ----------
// La tarjeta «Suscripción» y la fila «Método de pago» del propietario viven en el trozo de «Promoción y suscripción»
// (precargado con las pantallas del propietario). Mientras llega, o si owner_billing falla, la tarjeta de siempre.
const CuentaSubscriptionCard = lazy(() => suscripcionScreen().then((m) => ({ default: m.CuentaSubscriptionCard })));
const CuentaPaymentRow = lazy(() => suscripcionScreen().then((m) => ({ default: m.CuentaPaymentRow })));
const AccountSubscriptionDetails = lazy(() => suscripcionScreen().then((m) => ({ default: m.AccountSubscriptionDetails })));
const SUBSCRIPTION_PLACEHOLDER = (
  <Card layout="stack">
    <div className="row between">
      <b>{ACCOUNT_COPY.subscription}</b>
      <span className="xs muted">{ACCOUNT_COPY.launchOffer}</span>
    </div>
    <p className="small muted">{ACCOUNT_COPY.subscriptionText}</p>
    <hr className="divider" />
    <div className="row between baseline">
      <span className="small muted">{ACCOUNT_COPY.nextCharge}</span>
      <b className="num">{ACCOUNT_COPY.noCharge}</b>
    </div>
    <span className="xs muted">{ACCOUNT_COPY.feeNote({ fee: formatCRC(MONTHLY_FEE_CRC) })}</span>
  </Card>
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
      setLogoutError(err.kind === "unknown" ? ACCOUNT_COPY.logoutFailed : err.message);
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
      {tab ? (desktop ? null : <h1 className="sr-only">{ACCOUNT_COPY.title}</h1>) : <ScreenHeader kind="flow" title={ACCOUNT_COPY.title} back={{ to: "/explorar", onBack: back }} />}
      {a ? (
        <Card layout="row" placement="account-card">
          <span className="avatar" aria-hidden="true">
            {initials(a.name)}
          </span>
          <div className="stack gap-4 grow-col">
            <h3 className="account-name">{a.name}</h3>
            {/* El número en su línea y la verificación debajo: «WhatsApp verificado ·» se cortaba (C5). */}
            <span className="num account-phone">{formatPhone(a.phone)}</span>
            <span className="row small primary verified">
              <I.check size={16} /> {ACCOUNT_COPY.whatsappVerified}
            </span>
            <span className="xs muted" data-testid="identity-soon">
              {ACCOUNT_COPY.identitySoon}
            </span>
          </div>
          {/* Editar y Listo sustituyen la entrada del historial: la flecha de Cuenta sigue volviendo adonde se estaba. */}
          {splitAccount ? null : editing ? (
            <Link to="/cuenta" replace className="link small account-edit">
              {ACCOUNT_COPY.done}
            </Link>
          ) : (
            <Link to="/cuenta" search={{ editar: "1" }} replace className="link small account-edit">
              {ACCOUNT_COPY.edit}
            </Link>
          )}
        </Card>
      ) : (
        <Skeleton shape="account" label={ACCOUNT_COPY.loading} />
      )}

      {a && splitAccount ? <DesktopProfile key={a.id} account={a} /> : a && editing ? (
        <Card layout="stack">
          <h3>{ACCOUNT_COPY.profile}</h3>
          <ProfileForm key={a.id} account={a} />
        </Card>
      ) : null}

      {subscription}

      <List placement="account-actions">
        {payment}
        {/* En móvil, Favoritos está dentro de Cuenta para respetar el límite de cinco pestañas. */}
        {owner && !desktop ? <FavoritesRow /> : null}
        {count === 0 ? <PublishPromoRow /> : null}
        {a?.isAdmin ? (
          <RouterListRow to="/admin" replace>
            <I.inbox />
            <span className="body">
              {ACCOUNT_COPY.adminRow}<small>{ACCOUNT_COPY.adminRowHint}</small>
            </span>
            <span className="chev">
              <I.chevron />
            </span>
          </RouterListRow>
        ) : null}
        {!tab || !desktop ? <RouterListRow to="/ayuda">
          <I.help />
          <span className="body">
            {ACCOUNT_COPY.helpRow}<small>{ACCOUNT_COPY.helpLine({ owner: !!owner })}</small>
          </span>
          <span className="chev">
            <I.chevron />
          </span>
        </RouterListRow> : null}
      </List>

      {/* Lo último de la pantalla, pequeño y con confirmación: cerrar la sesión obliga a pedir un código nuevo. */}
      <div className="stack account-foot">
        <span className="xs muted">{ACCOUNT_COPY.terms}</span>
        {/* Atribución de la licencia ODbL de los límites administrativos (zonas); antes al pie de Ayuda (revisión UX 2026-10-29, N7). */}
        <span className="xs muted">
          {ACCOUNT_COPY.osm({ link: <a key="osm" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">{ACCOUNT_COPY.osmLink}</a> })}
        </span>
        <TextButton tone="quiet" placement="logout-link" onClick={() => setAsking(true)} disabled={leaving}>
          {ACCOUNT_COPY.signOut}
        </TextButton>
        {logoutError ? (
          <Notice tone="error" small>
            {logoutError}
          </Notice>
        ) : null}
      </div>
      {asking ? (
        <ConfirmSheet
          title={ACCOUNT_COPY.signOutTitle}
          body={ACCOUNT_COPY.signOutText}
          confirmLabel={ACCOUNT_COPY.signOut}
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
  const pageHeader = tab && desktop ? <ScreenHeader kind="root" title={ACCOUNT_COPY.title} /> : null;
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
    <RouterListRow to="/favoritos" data-testid="favorites-row">
      <I.heart />
      <span className="body">
        {ACCOUNT_COPY.favorites}<small className="num">{ACCOUNT_COPY.favoritesCount({ count: n })}</small>
      </span>
      <span className="chev">
        <I.chevron />
      </span>
    </RouterListRow>
  );
}

type ProfileValues = { name: string; description: string; email: string };
const profileValues = (a: Pick<Account, "name" | "description" | "email">): ProfileValues => ({ name: a.name, description: a.description ?? "", email: a.email ?? "" });

function DesktopProfile({ account }: { account: Account }) {
  const [editing, setEditing] = useState(false);
  const { name, description, email } = profileValues(account);
  return (
    <Card layout="stack">
      <div className="row between">
        <h3>{ACCOUNT_COPY.profile}</h3>
        <TextButton tone="link" placement="account-profile-toggle" aria-expanded={editing} onClick={() => setEditing(!editing)}>
          {editing ? ACCOUNT_COPY.done : ACCOUNT_COPY.edit}
        </TextButton>
      </div>
      {editing ? <ProfileForm account={account} /> : (
        <dl className="stack gap-14 account-profile-values">
          <div><dt className="small muted">{ACCOUNT_COPY.name}</dt><dd>{name}</dd></div>
          <div><dt className="small muted">{ACCOUNT_COPY.description}</dt><dd>{description || ACCOUNT_COPY.noDescription}</dd></div>
          <div><dt className="small muted">{ACCOUNT_COPY.email}</dt><dd>{email || ACCOUNT_COPY.noEmail}</dd></div>
        </dl>
      )}
    </Card>
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

  // «Ese correo no parece válido» va bajo el correo; lo demás (la red), en el aviso.
  const emailError = state.error === EMAIL_INVALID_ERROR ? state.error : null;
  return (
    <form onSubmit={save} onInput={onInput} className="stack gap-14" noValidate>
      <Field id="account-name" label={ACCOUNT_COPY.name}>
        {(control) => <TextInput {...control} name="name" defaultValue={account.name} maxLength={80} autoComplete="name" />}
      </Field>
      <Field id="account-description" label={ACCOUNT_COPY.description}>
        {(control) => <TextArea {...control} name="description" rows={3} maxLength={1000} defaultValue={account.description ?? ""} placeholder={ACCOUNT_COPY.descriptionPlaceholder} />}
      </Field>
      <Field id="account-email" label={ACCOUNT_COPY.email} error={emailError} hint={ACCOUNT_COPY.emailHint}>
        {(control) => <TextInput {...control} name="email" type="email" autoComplete="email" defaultValue={account.email ?? ""} placeholder={ACCOUNT_COPY.emailPlaceholder} />}
      </Field>
      {state.error && !emailError ? (
        <Notice tone="error">
          {state.error}
        </Notice>
      ) : null}
      {state.ok ? (
        <Notice announce>
          <I.check size={18} /> {ACCOUNT_COPY.saved}
        </Notice>
      ) : null}
      <Button variant="primary" size="lg" type="submit" disabled={!dirty} pending={state.busy}>
        {ACCOUNT_COPY.save({ busy: !!state.busy, ok: !!state.ok })}
      </Button>
    </form>
  );
}
