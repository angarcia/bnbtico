"use client";
import Link from "next/link";
import { startTransition, useActionState, useEffect, useState, useTransition } from "react";
import { resendAction, saveProfileAction, startAction, verifyAction, type ActionState } from "@/actions/account";
import { I } from "@/components/icons";
import { RESEND_COOLDOWN_MS } from "@/lib/auth/cooldown";
import type { Account } from "@/lib/auth/types";

const RESEND_COOLDOWN_SECONDS = RESEND_COOLDOWN_MS / 1000;
const initial: ActionState = {};

export function DemoNote({ demo }: { demo: boolean }) {
  if (!demo) return null;
  return <p className="xs muted">Entorno de pruebas: no se envían WhatsApp reales. Use datos ficticios.</p>;
}

/** Ingresar (pantalla 06): nombre + WhatsApp con el prefijo +506 a la vista; un solo botón relleno. */
export function EntryForm({ demo, role, mode }: { demo: boolean; role: "guest" | "owner"; mode: "register" | "login" }) {
  const [state, action, pending] = useActionState(startAction, initial);
  const register = mode === "register";
  const submit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const data = new FormData(e.currentTarget);
    startTransition(() => action(data));
  };
  return (
    <div className="stack" style={{ gap: 22, padding: "8px 4px 0" }}>
      <div className="stack" style={{ gap: 8 }}>
        <h2 style={{ fontSize: 32, lineHeight: 1.05 }}>{register ? "Su nombre y su WhatsApp. Nada más." : "Entre con su WhatsApp"}</h2>
        <p className="muted">
          {register
            ? `Le mandamos un código por WhatsApp para confirmar que el número es suyo. Sin contraseña ni correo. Es lo único que necesita para ${role === "owner" ? "publicar su casa" : "escribirle a un propietario"}.`
            : "Le pedimos un código por WhatsApp para autorizar este navegador."}
        </p>
      </div>
      <form action={action} onSubmit={submit} className="stack" style={{ gap: 14 }}>
        <input type="hidden" name="mode" value={mode} />
        {register ? (
          <div className="field">
            <label htmlFor="account-name">Nombre</label>
            <input id="account-name" name="name" autoComplete="name" maxLength={80} placeholder="Su nombre" required />
          </div>
        ) : null}
        <div className="field">
          <label htmlFor="account-phone">WhatsApp con código de país</label>
          <div className="input-prefix">
            <span className="prefix" aria-hidden="true">+506</span>
            <input id="account-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="8000 0001" required />
          </div>
          <span className="xs muted">Si su número no es de Costa Rica, escríbalo completo con «+» y su código de país.</span>
        </div>
        {state.error ? <p className="field-error" role="alert">{state.error}</p> : null}
        <button className="btn btn-primary btn-xl btn-block" type="submit" disabled={pending}>
          <I.wa size={20} /> {pending ? "Un momento…" : "Recibir código por WhatsApp"}
        </button>
      </form>
      <div className="stack" style={{ gap: 10, fontSize: 14 }}>
        <Link href={register ? "/cuenta?modo=entrar" : "/cuenta"} className="link">
          {register ? "Ya tengo cuenta · entrar con mi WhatsApp" : "Crear una cuenta"}
        </Link>
        <Link href="/cuenta/recuperar" className="link muted">No tengo acceso a mi WhatsApp</Link>
      </div>
      <div className="note"><I.shield size={22} /><span>Su número solo se comparte con el propietario cuando usted toca «Contactar por WhatsApp». Explorar y guardar favoritos no necesita cuenta.</span></div>
      <DemoNote demo={demo} />
      <p className="xs muted center">Al continuar acepta los Términos. bnbtico nunca le pedirá pagos.</p>
    </div>
  );
}

/** Código (pantalla 07): seis casillas que reflejan un campo real encima, invisible pero enfocable. */
export function CodeForm({ phone, demo, next, waitSeconds }: { phone: string; demo: boolean; next?: string; waitSeconds: number }) {
  const [state, action, pending] = useActionState(verifyAction, initial);
  const [code, setCode] = useState("");
  const [resent, setResent] = useState<string | null>(null);
  const [wait, setWait] = useState(waitSeconds);
  const [resending, startResend] = useTransition();
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);
  const digits = code.replace(/\D/g, "").slice(0, 6);
  const mmss = `${Math.floor(wait / 60)}:${String(wait % 60).padStart(2, "0")}`;
  return (
    <div className="stack" style={{ gap: 22, padding: "8px 4px 0" }}>
      <div className="stack" style={{ gap: 8 }}>
        <h2 style={{ fontSize: 32, lineHeight: 1.05 }}>Introduzca el código</h2>
        <p className="muted">
          Se lo enviamos por WhatsApp al <b className="ink num">{phone}</b>.
        </p>
      </div>
      <form action={action} className="stack" style={{ gap: 18 }}>
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <div className="field" style={{ position: "relative" }}>
          <label htmlFor="account-code">Código de 6 dígitos</label>
          <div className="code-boxes" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <span key={i} className={i < digits.length ? "filled" : i === digits.length ? "active" : ""}>{digits[i] ?? ""}</span>
            ))}
          </div>
          <input
            id="account-code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            pattern="[0-9]*"
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.currentTarget.value.replace(/\D/g, "").slice(0, 6))}
            style={{ position: "absolute", left: 0, right: 0, top: 24, height: 60, opacity: 0.01, minHeight: 0, border: 0, background: "transparent", fontSize: 16 }}
          />
        </div>
        {demo ? (
          <p className="note note-arena small">Código de ejemplo: <b>123456</b>. No enviamos WhatsApp. Válido 5 minutos, máximo 5 intentos.</p>
        ) : null}
        {state.error ? <p className="field-error" role="alert">{state.error}</p> : null}
        <button className="btn btn-primary btn-xl btn-block" type="submit" disabled={pending}>{pending ? "Verificando…" : "Verificar y continuar"}</button>
      </form>
      <div className="stack" style={{ gap: 10, fontSize: 14 }}>
        {wait > 0 ? (
          <span className="muted">¿No llegó? Puede pedir otro en <b className="ink num">{mmss}</b>.</span>
        ) : (
          <button
            type="button"
            className="btn-link"
            disabled={resending}
            onClick={() =>
              startResend(async () => {
                const r = await resendAction();
                if (r.ok) setWait(RESEND_COOLDOWN_SECONDS);
                setResent(r.ok ? (demo ? "Listo: el código de ejemplo sigue siendo 123456." : "Le enviamos otro código por WhatsApp.") : (r.error ?? "No se pudo reenviar."));
              })
            }
          >
            {resending ? "Enviando…" : demo ? "Pedir otro código de ejemplo" : "Pedir otro código"}
          </button>
        )}
        {resent ? <p className="small" role="status">{resent}</p> : null}
        {!demo ? <a className="link" href="https://wa.me/" target="_blank" rel="noopener">Abrir WhatsApp para buscar el mensaje</a> : null}
      </div>
      {next ? (
        <div className="card row" style={{ gap: 12 }}>
          <span className="avatar avatar-sm"><I.chevron size={18} /></span>
          <span className="small muted">Después de verificar vuelve adonde estaba, con lo que había escrito.</span>
        </div>
      ) : null}
    </div>
  );
}

export function EditProfileForm({ account, demo }: { account: Account; demo: boolean }) {
  const [state, action, pending] = useActionState(saveProfileAction, initial);
  return (
    <form action={action} className="stack" style={{ gap: 14 }}>
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
      {state.error ? <p className="field-error" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="small primary" role="status">Guardado.</p> : null}
      <button className="btn btn-primary btn-lg" type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>
      <p className="small muted" role="status">WhatsApp verificado{demo ? " · simulación" : ""}.</p>
    </form>
  );
}
