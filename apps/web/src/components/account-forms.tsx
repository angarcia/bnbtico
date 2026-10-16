"use client";
import Link from "next/link";
import { useActionState, useEffect, useState, useTransition } from "react";
import { resendAction, saveProfileAction, startAction, verifyAction, type ActionState } from "@/actions/account";
import { RESEND_COOLDOWN_MS } from "@/lib/auth/cooldown";
import type { Account } from "@/lib/auth/types";

const RESEND_COOLDOWN_SECONDS = RESEND_COOLDOWN_MS / 1000;

const initial: ActionState = {};

export function DemoNote({ demo }: { demo: boolean }) {
  if (!demo) return null;
  return <p className="xs muted">Entorno de pruebas: no se envían WhatsApp reales. Usá datos ficticios.</p>;
}

export function EntryForm({ demo, role, mode }: { demo: boolean; role: "guest" | "owner"; mode: "register" | "login" }) {
  const [state, action, pending] = useActionState(startAction, initial);
  const register = mode === "register";
  return (
    <>
      <div className="row between" style={{ flexWrap: "wrap" }}>
        <div className="row"><h2 style={{ fontSize: 22 }}>{register ? "Creá tu cuenta" : "Iniciá sesión"}</h2></div>
      </div>
      <section className="card stack">
        <h3>{register ? "Tu nombre y WhatsApp. Nada más." : "Entrá con tu WhatsApp"}</h3>
        <p className="small">
          {register
            ? `Verificá tu WhatsApp con un código para crear la cuenta. Es lo único que necesitás para ${role === "owner" ? "publicar tu casa" : "escribirle a un propietario"}.`
            : "Te pediremos un código para autorizar este navegador."}
        </p>
        <form action={action} className="stack">
          <input type="hidden" name="mode" value={mode} />
          {register ? (
            <>
              <label htmlFor="account-name">Nombre</label>
              <input id="account-name" name="name" autoComplete="name" maxLength={80} placeholder="Tu nombre" required />
            </>
          ) : null}
          <label htmlFor="account-phone">WhatsApp con código de país</label>
          <input id="account-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" placeholder="+506 8888 1234" required />
          {state.error ? <p className="field-error" role="alert">{state.error}</p> : null}
          <button className="btn btn-primary" type="submit" disabled={pending}>
            {pending ? "Un momento…" : register ? "Crear cuenta" : "Recibir código"}
          </button>
        </form>
        <Link href={register ? "/cuenta?modo=entrar" : "/cuenta"} className="btn-link">
          {register ? "Ya tengo cuenta · Iniciar sesión" : "Crear una cuenta"}
        </Link>
        <Link href="/cuenta/recuperar" className="btn-link">No tengo acceso a mi WhatsApp</Link>
        <DemoNote demo={demo} />
      </section>
    </>
  );
}

export function CodeForm({ phone, demo, next, waitSeconds }: { phone: string; demo: boolean; next?: string; waitSeconds: number }) {
  const [state, action, pending] = useActionState(verifyAction, initial);
  const [resent, setResent] = useState<string | null>(null);
  const [wait, setWait] = useState(waitSeconds);
  const [resending, startResend] = useTransition();
  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);
  const resendLabel = demo ? "Pedir otro código de ejemplo" : "Pedir otro código";
  return (
    <section className="card stack">
      <h3>Introducí el código</h3>
      <p>Para {phone}</p>
      <form action={action} className="stack">
        {next ? <input type="hidden" name="next" value={next} /> : null}
        <label htmlFor="account-code">Código de 6 dígitos</label>
        <input id="account-code" name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} pattern="[0-9]*" placeholder="123456" required autoFocus />
        {demo ? (
          <p className="note small">Código de ejemplo: <b>123456</b>. No enviamos WhatsApp. Válido 5 minutos, máximo 5 intentos.</p>
        ) : (
          <p className="small muted">Te lo enviamos por WhatsApp. Válido 5 minutos, máximo 5 intentos.</p>
        )}
        {state.error ? <p className="field-error" role="alert">{state.error}</p> : null}
        <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Verificando…" : "Verificar y continuar"}</button>
      </form>
      <button
        type="button"
        className="btn btn-ghost"
        disabled={wait > 0 || resending}
        onClick={() =>
          startResend(async () => {
            const r = await resendAction();
            if (r.ok) setWait(RESEND_COOLDOWN_SECONDS);
            setResent(r.ok ? (demo ? "Listo: el código de ejemplo sigue siendo 123456." : "Te enviamos otro código por WhatsApp.") : (r.error ?? "No se pudo reenviar."));
          })
        }
      >
        {wait > 0 ? `${resendLabel} (${wait} s)` : resending ? "Enviando…" : resendLabel}
      </button>
      {resent ? <p className="small" role="status">{resent}</p> : null}
    </section>
  );
}

export function EditProfileForm({ account, demo }: { account: Account; demo: boolean }) {
  const [state, action, pending] = useActionState(saveProfileAction, initial);
  return (
    <form action={action} className="stack">
      <label htmlFor="account-name">Nombre</label>
      <input id="account-name" name="name" defaultValue={account.name} maxLength={80} autoComplete="name" />
      <label htmlFor="account-description">Descripción (opcional)</label>
      <textarea id="account-description" name="description" rows={3} maxLength={1000} defaultValue={account.description ?? ""} placeholder="Contanos un poco sobre vos" />
      <label htmlFor="account-email">Correo de recuperación (opcional)</label>
      <input id="account-email" name="email" type="email" autoComplete="email" defaultValue={account.email ?? ""} placeholder="nombre@ejemplo.com" />
      <p className="xs muted">Sirve para recuperar la cuenta si perdés acceso a tu WhatsApp.</p>
      {state.error ? <p className="field-error" role="alert">{state.error}</p> : null}
      {state.ok ? <p className="small" role="status">Guardado.</p> : null}
      <button className="btn btn-primary" type="submit" disabled={pending}>{pending ? "Guardando…" : "Guardar"}</button>
      <p className="small" role="status">WhatsApp verificado{demo ? " · simulación" : ""}.</p>
    </form>
  );
}
