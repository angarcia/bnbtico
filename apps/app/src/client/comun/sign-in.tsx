import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { listingInNext } from "../../domain/contact-return";
import { toDomainError } from "../../domain/errors";
import { firstName } from "../../domain/person";
import { composePhone, DEFAULT_COUNTRY, formatPhone, OTHER_COUNTRY, PHONE_COUNTRIES } from "../../domain/phone";
import { I } from "../../shared/ui/icons";
import { listingQuery } from "../../shared/listing-query";
import { Picture } from "../../shared/picture";
import { PublishPromoRow } from "./publish-promo";
import { authApi } from "./session";
import { useTurnstile } from "./turnstile";
import { Button, TextButton } from "../../shared/ui/button";
import { Field, TextInput } from "../../shared/ui/field";
import { Notice } from "../../shared/ui/structure";
import { Card } from "../../shared/ui/card";
import * as SIGN_IN_COPY from "./copy/sign-in";

const message = (e: unknown) => toDomainError(e).message;
const field = (fd: FormData, key: string) => String(fd.get(key) ?? "");

/** La casa a la que se vuelve, si `next` es una ficha (la misma consulta que la tarjeta; Query la comparte). */
export function useReturnListing(next?: string) {
  const publicId = listingInNext(next);
  return useQuery({ ...listingQuery(publicId ?? ""), enabled: !!publicId }).data ?? undefined;
}

/** La casa a la que se escribe, arriba de la verificación: foto, nombre y quién la alquila. */
export function ContactCard({ next }: { next?: string }) {
  const l = useReturnListing(next);
  const photo = l?.photos[0];
  return (
    <Card as="div" layout="row" gap={12} placement="contact-card" data-testid="return-card">
      <span className="return-thumb">{photo ? <Picture photo={photo} alt="" sizes="56px" width={56} height={56} /> : null}</span>
      <span className="stack gap-0">
        <b className="ink">{l?.title ?? SIGN_IN_COPY.house}</b>
        {l ? (
          <span className="small muted">
            {SIGN_IN_COPY.verified({ name: firstName(l.ownerName), verified: l.ownerWhatsappVerified })}
          </span>
        ) : null}
      </span>
    </Card>
  );
}

/** Tarjeta «recordando a qué casa vuelve» (diseño 07) cuando `next` es una ficha: foto y nombre de la casa. */
export function ReturnCard({ next }: { next?: string }) {
  const publicId = listingInNext(next);
  const listing = useQuery({ ...listingQuery(publicId ?? ""), enabled: !!publicId });
  if (!next) return null;
  if (!publicId) {
    return (
      <Card as="div" layout="row" gap={12}>
        <span className="avatar avatar-sm">
          <I.chevron size={18} />
        </span>
        <span className="small muted">{SIGN_IN_COPY.returnHere}</span>
      </Card>
    );
  }
  const l = listing.data;
  const photo = l?.photos[0];
  return (
    <Card as="div" layout="row" gap={12} placement="return-card" data-testid="return-card">
      <span className="return-thumb">{photo ? <Picture photo={photo} alt="" sizes="56px" width={56} height={56} /> : null}</span>
      <span className="small muted">
        {SIGN_IN_COPY.returnTo({ title: <b key="title" className="ink">{l?.title ?? SIGN_IN_COPY.theHouse}</b> })}
      </span>
    </Card>
  );
}

/**
 * Cuerpo de Ingresar, sin cabecera, en un único flujo (ticket 18): primero el WhatsApp. Si el número tiene cuenta se envía
 * el código; si no, se pide el nombre y entonces se envía (un solo código por número; ver AuthApi.start).
 */
export function SignInForm({ next, mode, onCodeSent, nameStep }: {
  next?: string;
  mode: "account" | "contact" | "publish";
  onCodeSent?: () => void;
  nameStep?: { phone: string | null; setPhone: (phone: string | null) => void };
}) {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  // Error de un campo (revisión UX A6): debajo de ese campo y con el foco en él.
  const [fieldError, setFieldError] = useState<{ field: "phone" | "name"; message: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const [country, setCountry] = useState(DEFAULT_COUNTRY);
  // Número sin cuenta: se pide el nombre para crearla.
  const [localPhone, setLocalPhone] = useState<string | null>(null);
  const newPhone = nameStep ? nameStep.phone : localPhone;
  const setNewPhone = nameStep?.setPhone ?? setLocalPhone;
  useEffect(() => {
    setError(null);
    setFieldError(null);
  }, [newPhone]);
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
      if (onCodeSent) {
        setBusy(false);
        onCodeSent();
      } else {
        await navigate({ to: "/cuenta/codigo", search: next ? { next } : {} });
      }
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
          {newPhone ? SIGN_IN_COPY.titleNew : contact ? SIGN_IN_COPY.titleContact({ owner: owner ?? null }) : publish ? SIGN_IN_COPY.titlePublish : SIGN_IN_COPY.titleSignIn}
        </h2>
        <p className="muted">
          {newPhone ? (
            <>{SIGN_IN_COPY.textNew({ phone: <b key="phone" className="ink num">{formatPhone(newPhone)}</b> })}</>
          ) : publish ? (
            SIGN_IN_COPY.textPublish
          ) : (
            SIGN_IN_COPY.textSignIn
          )}
        </p>
      </div>
      {/* Sin `key`: el contenedor de Turnstile tiene que seguir montado entre los dos pasos (un token por envío). */}
      <form onSubmit={submit} className="stack gap-14" noValidate>
        {newPhone ? (
          <Field id="account-name" label={SIGN_IN_COPY.name} error={errorOf("name")}>
            {(control) => <TextInput {...control} name="name" autoComplete="name" maxLength={80} placeholder={SIGN_IN_COPY.namePlaceholder} required autoFocus />}
          </Field>
        ) : (
          <Field
            id="account-phone"
            label={SIGN_IN_COPY.phone}
            error={errorOf("phone")}
            hint={other ? SIGN_IN_COPY.phoneHintOther : country === DEFAULT_COUNTRY ? SIGN_IN_COPY.phoneHintCr : SIGN_IN_COPY.phoneHintNoCode}
          >
            {(control) => (
              <div className="input-prefix">
                {/* Un solo control de país (revisión UX A6): la caja del prefijo es el selector; al abrirlo se ven los
                    países con su código. El select invisible ocupa toda la caja, así que tocar «+506 ▾» lo abre. */}
                <span className="prefix prefix-select">
                  <span className="prefix-value" aria-hidden="true">
                    {other ? SIGN_IN_COPY.otherShort : `+${country}`}
                  </span>
                  <I.chevronDown size={16} />
                  <select
                    id="account-country"
                    name="country"
                    aria-label={SIGN_IN_COPY.country}
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
                    <option value={OTHER_COUNTRY}>{SIGN_IN_COPY.otherCountry}</option>
                  </select>
                </span>
                <TextInput
                  {...control}
                  name="phone"
                  type="tel"
                  autoComplete={other ? "tel" : "tel-national"}
                  inputMode="tel"
                  placeholder={country === DEFAULT_COUNTRY ? SIGN_IN_COPY.phoneLocal : other ? SIGN_IN_COPY.phoneIntl : SIGN_IN_COPY.phoneNoCode}
                  required
                />
              </div>
            )}
          </Field>
        )}
        <div ref={captcha.container} className="captcha" />
        {error ? <p className="field-error" role="alert">{error}</p> : null}
        <Button variant="primary" size="xl" block type="submit" icon={<I.wa size={20} />} disabled={busy}>
          {SIGN_IN_COPY.submit({ busy })}
        </Button>
      </form>
      <div className="stack small">
        {newPhone && !nameStep ? (
          <TextButton tone="link" onClick={changeNumber}>
            {SIGN_IN_COPY.changeNumber}
          </TextButton>
        ) : null}
        {contact ? null : (
          <Link to="/cuenta/recuperar" className="link muted">
            {SIGN_IN_COPY.noAccess}
          </Link>
        )}
      </div>
      {/* Puerta para publicar sin cuenta (A8): solo en el Ingresar de la pestaña, no desde un flujo. */}
      {mode === "account" && !newPhone ? <PublishPromoRow /> : null}
      {publish ? null : (
        <Notice as="div">
          <I.shield size={22} />
          <span>{SIGN_IN_COPY.privacy}</span>
        </Notice>
      )}
      {listingInNext(next) && mode === "account" ? <ReturnCard next={next} /> : null}
      <p className="xs muted center">{SIGN_IN_COPY.terms}</p>
    </div>
  );
}
