// Hoja de contacto (pantalla 04 del diseño v1). Trozo diferido: se descarga al tocar «Contactar por WhatsApp» (y en reposo
// tras hidratar la ficha). Funciona igual en la ficha del servidor (sin router) y en la ruta de la SPA.
// - Lo escrito se guarda en la pestaña 30 minutos (`bnbtico-contacto:<CT-####>`): cerrar, recargar o ir a Ingresar no lo pierde
//   (sin sesión, «Abrir WhatsApp» lleva a Ingresar y la ficha de la SPA reabre la hoja al volver: `contact-flow.ts`).
// - El mensaje se redacta solo con fechas y personas hasta que el cliente lo edita (reductor `redraft` del dominio).
// - Diálogo modal: el resto de la página queda `inert`, el foco no sale de la hoja, Escape / fondo / «Cerrar» la cierran y el
//   foco vuelve al botón. Sin scroll de fondo.
import { useEffect, useReducer, useRef, useState, type FocusEvent, type FormEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  contactDraftKey,
  costaRicaToday,
  firstName,
  INQUIRY_MAX_MESSAGE,
  INQUIRY_MAX_PEOPLE,
  parsePeople,
  redraft,
  restoreContactDraft,
  startDraft,
  storeContactDraft,
  validateInquiryDraft,
  type ContactDraftAction,
  type ContactDraftState,
  type InquiryField,
} from "../domain/inquiry";
import type { PublicListing } from "../domain/listing";
import { hasStoredSession, webStore } from "../data/storage";
import { proceedToWhatsApp } from "./contact-flow";
import { I } from "./icons";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
/** Campos que sacan el teclado (las fechas abren un selector). */
const withKeyboard = (el: EventTarget | null) => el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && el.type === "number");

const KB_RELEASE_MS = 400;

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "soon" } | { kind: "error"; message: string; field?: InquiryField };

/** Bloquea el scroll y deja inerte la página mientras la hoja está abierta. */
function useModal() {
  useEffect(() => {
    const root = document.getElementById("root");
    document.documentElement.classList.add("sheet-open");
    if (root) root.inert = true;
    return () => {
      document.documentElement.classList.remove("sheet-open");
      if (root) root.inert = false;
    };
  }, []);
}

export function ContactSheet({ listing, onClose, navigate }: { listing: PublicListing; onClose: () => void; navigate: (href: string) => void }) {
  const title = listing.title;
  const store = useRef(webStore("session")).current;
  const key = contactDraftKey(listing.publicId);
  const [draft, dispatch] = useReducer(
    (s: ContactDraftState, a: ContactDraftAction) => redraft(s, a, title),
    null,
    () => restoreContactDraft(store.getItem(key), title, Date.now())?.state ?? startDraft(title),
  );
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [kb, setKb] = useState(false);
  // Sin sesión guardada, «Abrir WhatsApp» lleva primero a verificar el número (y vuelve aquí con lo escrito).
  const [signedOut] = useState(() => !hasStoredSession());
  const sheet = useRef<HTMLElement>(null);
  const name = firstName(listing.ownerName);
  const today = costaRicaToday(Date.now());
  useModal();

  useEffect(() => {
    sheet.current?.focus();
  }, []);
  useEffect(() => {
    store.setItem(key, storeContactDraft(draft, true, Date.now()));
  }, [draft, key, store]);

  const close = () => {
    store.setItem(key, storeContactDraft(draft, false, Date.now()));
    onClose();
  };

  const change = (action: ContactDraftAction) => {
    dispatch(action);
    if (status.kind !== "sending") setStatus({ kind: "idle" });
  };

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== "Tab" || !sheet.current) return;
    const items = Array.from(sheet.current.querySelectorAll<HTMLElement>(FOCUSABLE));
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (e.shiftKey && (document.activeElement === first || document.activeElement === sheet.current)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }

  // Al salir del campo, el sitio extra se quita un poco después: si se quitara al instante, la hoja encogería entre el
  // toque y el clic y «Abrir WhatsApp» se movería bajo el dedo.
  const kbTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  useEffect(() => () => clearTimeout(kbTimer.current), []);
  function onFocus(e: FocusEvent<HTMLElement>) {
    if (!withKeyboard(e.target)) return;
    clearTimeout(kbTimer.current);
    setKb(true);
    const field = e.target;
    requestAnimationFrame(() => field.scrollIntoView({ block: "start" }));
  }
  function onBlur(e: FocusEvent<HTMLElement>) {
    if (!withKeyboard(e.target) || withKeyboard(e.relatedTarget)) return;
    clearTimeout(kbTimer.current);
    kbTimer.current = setTimeout(() => setKb(false), KB_RELEASE_MS);
  }

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (status.kind === "sending") return;
    const fields = { arrival: draft.arrival, departure: draft.departure, people: draft.people, message: draft.message };
    const problem = validateInquiryDraft(fields, today);
    if (problem) return setStatus({ kind: "error", message: problem.message, field: problem.field });
    store.setItem(key, storeContactDraft(draft, true, Date.now()));
    setStatus({ kind: "sending" });
    const outcome = await proceedToWhatsApp({ publicId: listing.publicId, draft: fields, navigate });
    if (outcome.kind === "soon") setStatus({ kind: "soon" });
    else if (outcome.kind === "error") setStatus({ kind: "error", message: outcome.message });
  }

  const invalid = (f: InquiryField) => (status.kind === "error" && status.field === f ? true : undefined);

  return createPortal(
    <>
      <div className="sheet-backdrop" onClick={close} data-testid="sheet-backdrop" />
      <section
        ref={sheet}
        className={`sheet${kb ? " kb" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="contact-title"
        tabIndex={-1}
        onKeyDown={onKeyDown}
        onFocus={onFocus}
        onBlur={onBlur}
      >
        <span className="grabber" aria-hidden="true" />
        <div className="sheet-head">
          <div>
            <h2 id="contact-title">Escríbale a {name}</h2>
            <span className="small muted">
              Propietario de {title}
              {listing.ownerWhatsappVerified ? " · WhatsApp verificado" : ""}
            </span>
          </div>
          <button type="button" className="icon-btn" aria-label="Cerrar" onClick={close}>
            <I.x size={22} />
          </button>
        </div>
        <form onSubmit={onSubmit} noValidate>
          <div className="dates">
            <label>
              Llegada (opcional)
              <input
                type="date"
                name="arrival"
                min={today}
                value={draft.arrival ?? ""}
                aria-invalid={invalid("arrival")}
                onChange={(e) => change({ type: "fields", patch: { arrival: e.target.value || null } })}
              />
            </label>
            <label>
              Salida (opcional)
              <input
                type="date"
                name="departure"
                min={draft.arrival ?? today}
                value={draft.departure ?? ""}
                aria-invalid={invalid("departure")}
                onChange={(e) => change({ type: "fields", patch: { departure: e.target.value || null } })}
              />
            </label>
          </div>
          <label>
            Personas (opcional)
            <input
              className="people"
              type="number"
              name="people"
              inputMode="numeric"
              min={1}
              max={INQUIRY_MAX_PEOPLE}
              step={1}
              placeholder="¿Cuántos son?"
              value={draft.people ?? ""}
              aria-invalid={invalid("people")}
              onChange={(e) => change({ type: "fields", patch: { people: parsePeople(e.target.value) } })}
            />
          </label>
          <label>
            Su mensaje
            <textarea
              name="message"
              rows={4}
              maxLength={INQUIRY_MAX_MESSAGE}
              value={draft.message}
              aria-invalid={invalid("message")}
              aria-describedby="contact-hint"
              onChange={(e) => change({ type: "message", text: e.target.value })}
            />
          </label>
          <span className="hint" id="contact-hint">
            Se redacta solo con sus fechas y personas. Puede editarlo aquí o en WhatsApp antes de enviar.
          </span>
          {status.kind === "error" ? (
            <p className="note" role="alert">
              {status.message}
            </p>
          ) : null}
          {status.kind === "soon" ? (
            <p className="note note-sun" role="status">
              Disponible muy pronto. Lo que escribió queda guardado.
            </p>
          ) : null}
          <button className="btn btn-wa" type="submit" aria-disabled={status.kind === "sending" || undefined}>
            <I.wa size={20} /> Abrir WhatsApp
          </button>
          {signedOut ? <span className="consent">Para escribirle necesita verificar su WhatsApp con un código. Lo que escribió se guarda.</span> : null}
          <span className="consent">{name} verá su nombre y su WhatsApp.</span>
          <span className="safety">Por su seguridad, nunca envíe dinero antes de confirmar la casa. bnbtico no procesa ni pide pagos.</span>
        </form>
      </section>
    </>,
    document.body,
  );
}
