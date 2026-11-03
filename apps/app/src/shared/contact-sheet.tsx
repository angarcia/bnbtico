// Hoja de contacto (pantalla 04 del diseño v1). Trozo diferido: se descarga al tocar «Contactar por WhatsApp» (y en reposo
// tras hidratar la ficha). Funciona igual en la ficha del servidor (sin router) y en la ruta de la SPA.
// - Lo escrito se guarda en la pestaña 30 minutos (`bnbtico-contacto:<CT-####>`): cerrar, recargar o ir a Ingresar no lo pierde
//   (sin sesión, «Abrir WhatsApp» lleva a Ingresar y la ficha de la SPA reabre la hoja al volver: `contact-flow.ts`).
// - El mensaje se redacta solo con fechas y personas (reductor `redraft` del dominio) y se ve como vista previa, sin caja
//   de texto: lo que quiera añadir lo escribe en WhatsApp (revisión UX 2026-10-29, N2). Las fechas, con el mismo calendario
//   de rango que «¿Cuándo?» (o «Desde», con el mensual), no con el selector del sistema.
// - Diálogo modal: el resto de la página queda `inert`, el foco no sale de la hoja, Escape / fondo / «Cerrar» la cierran y el
//   foco vuelve al botón. Sin scroll de fondo.
import { useEffect, useLayoutEffect, useReducer, useRef, useState, type FocusEvent, type FormEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  contactDraftKey,
  costaRicaToday,
  firstName,
  INQUIRY_MAX_PEOPLE,
  parsePeople,
  redraft,
  restoreContactDraft,
  startDraft,
  storeContactDraft,
  tooManyPeople,
  validateInquiryDraft,
  type ContactDraftAction,
  type ContactDraftState,
  type InquiryField,
} from "../domain/inquiry";
import type { PublicListing } from "../domain/listing";
import { hasStoredSession, webStore } from "../data/storage";
import { DATES_FILTER_KEY, PEOPLE_FILTER_KEY, readSearchDates } from "../domain/contact-return";
import { shortDate } from "../domain/dates";
import { proceedToWhatsApp } from "./contact-flow";
import { I } from "./icons";
import { useModal } from "./modal";
import { RangeCalendar } from "./range-calendar";

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';
/** Campos que sacan el teclado (las fechas abren el calendario de la hoja). */
const withKeyboard = (el: EventTarget | null) => el instanceof HTMLInputElement && el.type === "number";

const KB_RELEASE_MS = 400;

type Status = { kind: "idle" } | { kind: "sending" } | { kind: "error"; message: string; field?: InquiryField };

/** Personas del filtro de Explorar (pestaña), si caben en la casa. */
function filteredPeople(max: number): number | null {
  const n = Number(webStore("session").getItem(PEOPLE_FILTER_KEY));
  return Number.isInteger(n) && n >= 1 && n <= max ? n : null;
}

/** `autoSend`: la hoja reabre al volver de verificar el WhatsApp y sigue sola hacia WhatsApp (revisión UX C2), solo si lo
 *  escrito sigue guardado: con el borrador caducado se queda abierta con el mensaje por defecto y espera el toque. */
export function ContactSheet({ listing, onClose, navigate, autoSend }: { listing: PublicListing; onClose: () => void; navigate: (href: string) => void; autoSend?: boolean }) {
  const title = listing.title;
  const store = useRef(webStore("session")).current;
  const key = contactDraftKey(listing.publicId);
  const [restored] = useState(() => restoreContactDraft(store.getItem(key), title, Date.now()));
  // Tope de personas: la capacidad de la casa (y nunca más que el máximo de una consulta).
  const maxPeople = Math.min(listing.capacity || INQUIRY_MAX_PEOPLE, INQUIRY_MAX_PEOPLE);
  const [draft, dispatch] = useReducer(
    (s: ContactDraftState, a: ContactDraftAction) => redraft(s, a, title),
    null,
    // Sin borrador, las personas (si caben en la casa) y las fechas de la búsqueda de Explorar (revisión UX A3).
    () => restored?.state ?? startDraft(title, { people: filteredPeople(maxPeople), ...readSearchDates(store.getItem(DATES_FILTER_KEY), costaRicaToday(Date.now())) }),
  );
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [kb, setKb] = useState(false);
  const [picking, setPicking] = useState(false);
  // Al abrir el calendario, el mes de la fecha elegida (o el de hoy) arriba, bajo la fila de los días.
  const calendarBox = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const box = calendarBox.current;
    if (!picking || !box) return;
    const day = box.querySelector(".range-day.range-end") ?? box.querySelector(".range-day:not(:disabled)");
    const month = day?.closest(".range-month");
    const head = box.querySelector(".range-weekdays");
    if (month) box.scrollTop += month.getBoundingClientRect().top - box.getBoundingClientRect().top - (head?.getBoundingClientRect().height ?? 0);
  }, [picking]);
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

  // Un solo vuelo: el estado de React llega en el siguiente render y un doble toque lo adelantaría.
  const inFlight = useRef(false);
  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    void send();
  }
  // Vuelta de la verificación con lo escrito intacto y ya con sesión: se envía sin pedir otro toque.
  useEffect(() => {
    if (autoSend && restored && !signedOut) void send();
    // Solo al montar la hoja.
  }, []);

  async function send() {
    if (inFlight.current) return;
    // Siempre el mensaje redactado (un borrador guardado antes de N2 podía traer uno editado a mano).
    const fields = { arrival: draft.arrival, departure: draft.departure, people: draft.people, message: draft.composed };
    const problem = validateInquiryDraft(fields, today);
    if (problem) return setStatus({ kind: "error", message: problem.message, field: problem.field });
    if (fields.people !== null && fields.people > maxPeople) return setStatus({ kind: "error", message: tooManyPeople(maxPeople), field: "people" });
    inFlight.current = true;
    store.setItem(key, storeContactDraft(draft, true, Date.now()));
    setStatus({ kind: "sending" });
    const outcome = await proceedToWhatsApp({ publicId: listing.publicId, draft: fields, navigate });
    inFlight.current = false;
    if (outcome.kind === "error") setStatus({ kind: "error", message: outcome.message });
    else if (outcome.kind === "sent") {
      // Consulta registrada y WhatsApp abriéndose: lo escrito ya no hace falta y, al volver (atrás o desde la app de
      // WhatsApp), la ficha se ve con la hoja cerrada.
      store.removeItem(key);
      onClose();
    }
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
          {/* Fechas con el calendario de «¿Cuándo?»: dos casillas que lo abren (con el mensual, una sola, «Desde»). */}
          <div className="dates">
            {draft.monthlyFrom ? (
              <DateBox label="Desde" value={draft.monthlyFrom} open={picking} onToggle={() => setPicking(!picking)} />
            ) : (
              <>
                <DateBox label="Llegada" value={draft.arrival} open={picking} invalid={invalid("arrival")} onToggle={() => setPicking(!picking)} />
                <DateBox label="Salida" value={draft.departure} open={picking} invalid={invalid("departure")} onToggle={() => setPicking(!picking)} />
              </>
            )}
          </div>
          {picking ? (
            <div className="contact-calendar">
              <div className="range-scroll" ref={calendarBox}>
                {draft.monthlyFrom ? (
                  <RangeCalendar
                    today={today}
                    mode="from"
                    value={draft.monthlyFrom}
                    onChange={(monthlyFrom) => (change({ type: "fields", patch: { monthlyFrom } }), setPicking(false))}
                  />
                ) : (
                  <RangeCalendar
                    today={today}
                    mode="range"
                    value={{ arrival: draft.arrival, departure: draft.departure }}
                    onChange={(r) => {
                      change({ type: "fields", patch: r });
                      if (r.arrival && r.departure) setPicking(false);
                    }}
                  />
                )}
              </div>
              <div className="row between">
                {draft.arrival && !draft.monthlyFrom ? (
                  <button type="button" className="btn-text" onClick={() => change({ type: "fields", patch: { arrival: null, departure: null } })}>
                    Quitar fechas
                  </button>
                ) : (
                  <span />
                )}
                <button type="button" className="btn-text" onClick={() => setPicking(false)}>
                  Listo
                </button>
              </div>
            </div>
          ) : null}
          {/* − / + como el paso 4 de publicar, con el campo editable en medio y tope en la capacidad (revisión UX A3). */}
          <div className="people-field">
            <label htmlFor="contact-people">Personas (opcional)</label>
            <div className="people-stepper">
              <button type="button" className="minus" aria-label="Una persona menos" disabled={!draft.people || draft.people <= 1} onClick={() => change({ type: "fields", patch: { people: draft.people && draft.people > 1 ? draft.people - 1 : null } })}>
                −
              </button>
              <input
                id="contact-people"
                className="people"
                type="number"
                name="people"
                inputMode="numeric"
                min={1}
                max={maxPeople}
                step={1}
                placeholder="–"
                value={draft.people ?? ""}
                aria-invalid={invalid("people")}
                onChange={(e) => change({ type: "fields", patch: { people: parsePeople(e.target.value) } })}
              />
              <button type="button" className="plus" aria-label="Una persona más" disabled={(draft.people ?? 0) >= maxPeople} onClick={() => change({ type: "fields", patch: { people: Math.min(maxPeople, (draft.people ?? 0) + 1) } })}>
                +
              </button>
            </div>
          </div>
          <div className="stack gap-4">
            <span className="field-label" id="contact-message-label">
              Su mensaje
            </span>
            <p className="message-preview" aria-labelledby="contact-message-label" data-testid="contact-message">
              {draft.composed}
            </p>
            <span className="hint">Podrá añadir lo que quiera en WhatsApp antes de enviarlo.</span>
          </div>
          {status.kind === "error" ? (
            <p className="note" role="alert">
              {status.message}
            </p>
          ) : null}
          <button
            className={`btn btn-wa${status.kind === "sending" ? " is-sending" : ""}`}
            type="submit"
            aria-disabled={status.kind === "sending" || undefined}
            aria-busy={status.kind === "sending" || undefined}
          >
            {/* Sin sesión el botón todavía no abre WhatsApp: lleva a verificar el número (revisión UX C2). */}
            <I.wa size={20} /> {status.kind === "sending" ? "Abriendo WhatsApp…" : signedOut ? "Continuar" : "Abrir WhatsApp"}
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

/** Una casilla de fecha de la hoja: «Elegir fecha» o la elegida («8 nov»); abre y cierra el calendario. */
function DateBox({ label, value, open, invalid, onToggle }: { label: string; value: string | null; open: boolean; invalid?: true; onToggle: () => void }) {
  return (
    <button type="button" className={`date-box${value ? "" : " is-empty"}`} aria-expanded={open} aria-invalid={invalid} onClick={onToggle}>
      <span className="date-box-label">{label}</span>
      <b className="num">{(value && shortDate(value)) || "Elegir fecha"}</b>
    </button>
  );
}
