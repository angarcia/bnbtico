import { Navigate, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import type { MfaFactor } from "../../domain/api";
import { I } from "../../shared/icons";
import { loadSecondFactor, verifySecondCode } from "../admin";
import { FlowHeader } from "../chrome";
import { useSession } from "../session";
import { NotAdmin, message, useIsAdmin } from "./admin-shared";

// ---------- Segundo código ----------
const codigoRoute = getRouteApi("/_flow/_privateFlow/admin/codigo");

export function SegundoCodigoScreen() {
  const { next } = codigoRoute.useSearch();
  const { session } = useSession();
  const isAdmin = useIsAdmin();
  const target = next ?? "/admin";
  if (session?.aal === "aal2") return <Navigate to={target as "/admin"} replace />;
  return (
    <>
      <FlowHeader title="Segundo código" back="/cuenta" historyBack />
      {isAdmin === false ? <NotAdmin /> : null}
      {isAdmin === null ? (
        <section className="card skeleton account-skeleton" aria-busy="true" aria-label="Cargando su cuenta">
          <span className="sk sk-line" />
        </section>
      ) : null}
      {isAdmin && session ? <SecondCodeForm userId={session.userId} next={target} /> : null}
    </>
  );
}

/** La clave en grupos de 4, para copiarla a mano en la app si no se puede escanear el QR. */
const groupSecret = (secret: string) => secret.replace(/(.{4})/g, "$1 ").trim();

function SecondCodeForm({ userId, next }: { userId: string; next: string }) {
  const navigate = useNavigate();
  const [factor, setFactor] = useState<MfaFactor | null>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let alive = true;
    loadSecondFactor(userId)
      .then((f) => alive && setFactor(f))
      .catch((e: unknown) => alive && setError(message(e)));
    return () => {
      alive = false;
    };
  }, [userId]);

  async function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (code.length !== 6) return setError("El código tiene 6 dígitos.");
    setBusy(true);
    setError(null);
    try {
      await verifySecondCode(userId, code);
      await navigate({ to: next as "/admin", replace: true });
    } catch (err) {
      setError(message(err));
      setBusy(false);
    }
  }

  const enrol = factor && !factor.verified ? factor : null;
  return (
    <div className="stack flow">
      <div className="stack gap-8">
        <span className="avatar avatar-ok" aria-hidden="true">
          <I.shield size={26} />
        </span>
        <h2 className="flow-title">{enrol ? "Vincule su app de autenticación" : "Confirme que es usted"}</h2>
        {enrol ? (
          <p className="muted">
            Para revisar anuncios le pedimos un segundo código. Escanee este código QR con su app de autenticación (Google Authenticator, 1Password u otra) y
            escriba abajo el código de 6 dígitos que le muestre.
          </p>
        ) : (
          <p className="muted">Abra su app de autenticación y escriba el código de 6 dígitos de bnbtico.</p>
        )}
      </div>
      {enrol ? (
        <div className="totp-enrol stack gap-8">
          <img className="totp-qr" src={enrol.qrCode} alt="Código QR para su app de autenticación" width={184} height={184} />
          <p className="small muted">¿No puede escanearlo? Escriba esta clave en la app:</p>
          <code className="totp-secret num" aria-label="Clave para la app de autenticación">
            {groupSecret(enrol.secret)}
          </code>
        </div>
      ) : null}
      <form onSubmit={verify} className="stack gap-18" noValidate>
        <div className="field code-field">
          <label htmlFor="admin-code">Código de 6 dígitos</label>
          <div className="code-boxes" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className={i < code.length ? "filled" : i === code.length ? "active" : ""}>
                {code[i] ?? ""}
              </span>
            ))}
          </div>
          <input
            id="admin-code"
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
        {error ? (
          <p className="field-error" role="alert">
            {error}
          </p>
        ) : null}
        <button className="btn btn-primary btn-xl btn-block" type="submit" disabled={busy || factor === null}>
          {busy ? "Verificando…" : factor === null && !error ? "Preparando…" : "Verificar y entrar"}
        </button>
      </form>
    </div>
  );
}
