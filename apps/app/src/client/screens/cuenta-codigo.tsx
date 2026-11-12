import { useQueryClient } from "@tanstack/react-query";
import { Navigate, getRouteApi, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { RESEND_COOLDOWN_MS, resendWaitSeconds } from "../../domain/account";
import { toDomainError } from "../../domain/errors";
import { formatPhone } from "../../domain/phone";
import { withTimeout } from "../../shared/timeout";
import { accountQuery } from "../account";
import { FlowHeader } from "../chrome";
import { ownListingsQuery } from "../own-listings-query";
import { authApi, pendingOtp } from "../session";
import { ContactCard, ReturnCard } from "../sign-in";
import { useTurnstile } from "../turnstile";
import { useContactMode, useGoTo } from "./cuenta-navigation";

const message = (e: unknown) => toDomainError(e).message;

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
