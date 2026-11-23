import { Navigate, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import type { MfaFactor } from "../../domain/api";
import { I } from "../../shared/ui/icons";
import { loadSecondFactor, verifySecondCode } from "./admin-queries";
import { ScreenHeader } from "../comun/screen-header";
import { useSession } from "../comun/session";
import { NotAdmin, message, useIsAdmin } from "./admin-shared";
import { CodeInput } from "../comun/code-input";
import { Button } from "../../shared/ui/button";
import { Skeleton } from "../../shared/ui/structure";
import * as ADMIN_COPY from "./copy/admin";

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
      <ScreenHeader kind="flow" title={ADMIN_COPY.codeTitle} back={{ to: "/cuenta", historyBack: true }} />
      {isAdmin === false ? <NotAdmin /> : null}
      {isAdmin === null ? (
        <Skeleton shape="account" label={ADMIN_COPY.loadingAccount} />
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
        <h2 className="flow-title">{ADMIN_COPY.codeHeading({ enrol: !!enrol })}</h2>
        {enrol ? (
          <p className="muted">
            {ADMIN_COPY.enrolText}
          </p>
        ) : (
          <p className="muted">{ADMIN_COPY.codeText}</p>
        )}
      </div>
      {enrol ? (
        <div className="totp-enrol stack gap-8">
          <img className="totp-qr" src={enrol.qrCode} alt={ADMIN_COPY.qrAlt} width={184} height={184} />
          <p className="small muted">{ADMIN_COPY.cantScan}</p>
          <code className="totp-secret num" aria-label={ADMIN_COPY.secretLabel}>
            {groupSecret(enrol.secret)}
          </code>
        </div>
      ) : null}
      <form onSubmit={verify} className="stack gap-18" noValidate>
        <CodeInput id="admin-code" value={code} onChange={setCode} error={error} />
        <Button variant="primary" size="xl" block type="submit" disabled={busy || factor === null}>
          {ADMIN_COPY.verify({ busy, preparing: factor === null && !error })}
        </Button>
      </form>
    </div>
  );
}
