import { useQuery } from "@tanstack/react-query";
import { Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { listingInNext } from "../domain/contact-return";
import { toDomainError } from "../domain/errors";
import { firstName } from "../domain/person";
import { composePhone, DEFAULT_COUNTRY, formatPhone, OTHER_COUNTRY, PHONE_COUNTRIES } from "../domain/phone";
import { I } from "../shared/icons";
import { listingQuery } from "../shared/listing-query";
import { Picture } from "../shared/picture";
import { PublishPromoRow } from "./publish-promo";
import { authApi } from "./session";
import { useTurnstile } from "./turnstile";

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
export function ReturnCard({ next }: { next?: string }) {
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
          {newPhone ? "Es su primera vez en 3bstays" : contact ? `Un paso y le escribe a ${owner ?? "el anfitrión"}` : publish ? "Para subir las fotos, verifique su WhatsApp" : "Entre con su WhatsApp"}
        </h2>
        <p className="muted">
          {newPhone ? (
            <>
              Díganos su nombre para crear su cuenta. Le mandamos el código al <b className="ink num">{formatPhone(newPhone)}</b>.
            </>
          ) : publish ? (
            "Lo que ya escribió se guarda. Le enviamos un código por WhatsApp: así nadie más puede publicar en su nombre."
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
        {newPhone && !nameStep ? (
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
      <p className="xs muted center">Al continuar acepta los Términos. 3bstays nunca le pedirá pagos.</p>
    </div>
  );
}
