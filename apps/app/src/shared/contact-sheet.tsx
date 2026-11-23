// Hoja de contacto (pantalla 04 del diseño v1). Trozo diferido: se descarga al tocar «Contactar por WhatsApp» (y en reposo
// tras hidratar la ficha). Funciona igual en la ficha del servidor (sin router) y en la ruta de la SPA.
// - Lo escrito se guarda en la pestaña 30 minutos (`3bstays-contacto:<CT-####>`): cerrar, recargar o ir a Ingresar no lo pierde
//   (sin sesión, «Abrir WhatsApp» lleva a Ingresar y la ficha de la SPA reabre la hoja al volver: `contact-flow.ts`).
// - El mensaje se redacta solo con fechas y personas (reductor `redraft` del dominio) y se ve como vista previa, sin caja
//   de texto: lo que quiera añadir lo escribe en WhatsApp (revisión UX 2026-10-29, N2). Las fechas, con el mismo calendario
//   de rango que «¿Cuándo?», no con el selector del sistema.
// - Las fechas son las de la pestaña (`stay-dates.ts`), las mismas del calendario de la ficha: elegirlas aquí las cambia allí
//   y al revés. Los días de la casa llegan por props (`days`): no se llega en un ocupado, un rango con una noche ocupada no
//   vale y, con fechas, la hoja dice el total orientativo. Con noches ocupadas, o mientras se leen los días, no se envía
//   (ronda de Ana 2 nov, ticket 08).
// - Diálogo modal (`Sheet`, shared/overlay.tsx): el resto de la página queda `inert`, el foco no sale de la hoja, Escape /
//   fondo / «Cerrar» / Atrás en el teléfono la cierran y el foco vuelve al botón. Sin scroll de fondo. Lo escrito se guarda
//   al cerrar: no pregunta «¿Descartar los cambios?».
import { useEffect, useId, useLayoutEffect, useReducer, useRef, useState, type FocusEvent, type FormEvent } from "react";
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
import { effectiveDay, type CalendarDay } from "../domain/calendar";
import { NIGHTS_FILTER_KEY, PEOPLE_FILTER_KEY, readSearchNights } from "../domain/contact-return";
import { shortDate } from "../domain/dates";
import { RANGE_BUSY_MESSAGE, type RangeState } from "../domain/range";
import { hasBusyNight, listingStay, stayLine } from "../domain/stay-price";
import { proceedToWhatsApp } from "./contact-flow";
import { track } from "./beacon";
import { useCurrency } from "./currency";
import { useFx } from "./fx";
import { I } from "./ui/icons";
import { Sheet } from "./ui/overlay";
import { leavingPage } from "./ui/overlay-stack";
import { NightsPicker } from "./nights-picker";
import { RangeCalendar } from "./range-calendar";
import { stayDates } from "./stay-dates";
import { Button, TextButton } from "./ui/button";
import { Segmented } from "./ui/choice";
import { Field } from "./ui/field";
import { Stepper } from "./ui/stepper";
import { Notice } from "./ui/structure";
import { ClosedField } from "./ui/closed-field";

const STAY_OPTIONS = [
  { value: "dates", label: "Fechas" },
  { value: "nights", label: "Número de noches" },
] as const;

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
 *  escrito sigue guardado: con el borrador caducado se queda abierta con el mensaje por defecto y espera el toque.
 *  `days`: los días de la casa (la caché de la ficha); undefined mientras se leen, null si no se pudieron leer.
 *  `nightsChoice`: la flag del número de noches (`FLAGS.exploreNights`), que pasa quien abre la hoja: importar `shared/flags`
 *  aquí junta ese módulo con las reglas del rango y el trozo `range-*` pasa a llamarse `flags-*`, que la puerta de tamaño
 *  cuenta como JS inicial. Con ella, «Fechas | Número de noches». */
export function ContactSheet({ listing, days, onClose, navigate, autoSend, inline = false, nightsChoice }: { listing: PublicListing; days: readonly CalendarDay[] | null | undefined; onClose: () => void; navigate: (href: string) => void; autoSend?: boolean; inline?: boolean; nightsChoice: boolean }) {
  const title = listing.title;
  const store = useRef(webStore("session")).current;
  const key = contactDraftKey(listing.publicId);
  const [restored] = useState(() => restoreContactDraft(store.getItem(key), title, Date.now()));
  // Tope de personas: la capacidad de la casa (y nunca más que el máximo de una consulta).
  const maxPeople = Math.min(listing.capacity || INQUIRY_MAX_PEOPLE, INQUIRY_MAX_PEOPLE);
  const [draft, dispatch] = useReducer(
    (s: ContactDraftState, a: ContactDraftAction) => redraft(s, a, title),
    null,
    // Sin borrador, las personas del filtro de Explorar si caben en la casa (revisión UX A3); las fechas, las de la pestaña.
    () => {
      const start = restored?.state ?? startDraft(title, { people: filteredPeople(maxPeople), nights: readSearchNights(webStore("session").getItem(NIGHTS_FILTER_KEY)) });
      const dates = stayDates.read();
      return dates ? redraft(start, { type: "fields", patch: dates }, title) : start;
    },
  );
  // Fechas o número de noches, una cosa u otra (opción B de Ana, 2026-11-17), con el número de noches de Explorar encendido.
  // Abre en noches si llegan noches de la búsqueda y ninguna fecha.
  const [stayMode, setStayMode] = useState<"dates" | "nights">(() => (nightsChoice && !draft.arrival && draft.nights ? "nights" : "dates"));
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [kb, setKb] = useState(false);
  const [picking, setPicking] = useState(false);
  const toggleCalendar = () => setPicking(!picking);
  const [rejected, setRejected] = useState(false);
  const currency = useCurrency();
  const fx = useFx().crcPerUsd;
  const base = listing.acceptsNightly ? listing.nightlyPriceCrc : null;
  const busy = (day: string) => !!days && !effectiveDay(days, base, day).available;
  const dates = draft.arrival && draft.departure ? { arrival: draft.arrival, departure: draft.departure } : null;
  // Fechas con una noche ocupada (de Explorar o de un enlace): el aviso en vez del total y sin enviar hasta cambiarlas; con
  // fechas y los días aún sin leer, tampoco se envía.
  const busyDates = !!days && hasBusyNight(days, dates);
  const blocked = !!dates && (days === undefined || busyDates);
  const stay = days && dates ? listingStay(listing, days, dates) : null;
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
  const name = firstName(listing.ownerName);
  const today = costaRicaToday(Date.now());
  useEffect(() => {
    store.setItem(key, storeContactDraft(draft, !inline || autoSend === true, Date.now()));
  }, [draft, key, store, inline, autoSend]);

  const writingDates = useRef(false);
  useEffect(() => {
    if (!inline) return;
    return stayDates.subscribe(() => {
      if (writingDates.current) return;
      const dates = stayDates.read();
      // Fechas elegidas en el calendario de la ficha: la hoja pasa a fechas y deja las noches.
      dispatch({ type: "fields", patch: dates ? { ...dates, nights: null } : { arrival: null, departure: null } });
      if (dates) setStayMode("dates");
      setRejected(false);
    });
  }, [inline]);

  const close = () => {
    store.setItem(key, storeContactDraft(draft, false, Date.now()));
    onClose();
  };
  const titleId = useId();

  const change = (action: ContactDraftAction) => {
    dispatch(action);
    if (status.kind !== "sending") setStatus({ kind: "idle" });
  };
  const changePeople = (people: number | null) => change({ type: "fields", patch: { people } });
  const people = draft.people ?? 0;

  function changeDates(range: RangeState) {
    setRejected(false);
    change({ type: "fields", patch: range });
    // La ficha comparte las fechas de la pestaña. Una llegada sola espera aquí su salida.
    const { arrival, departure } = range;
    const complete = arrival && departure ? { arrival, departure } : null;
    writingDates.current = true;
    stayDates.write(complete);
    writingDates.current = false;
    if (complete) setPicking(false);
  }

  function chooseStay(mode: "dates" | "nights") {
    if (mode === stayMode) return;
    setStayMode(mode);
    // Una cosa u otra: con noches se quitan las fechas (también las de la ficha); con fechas, las noches.
    if (mode === "nights") {
      setPicking(false);
      changeDates({ arrival: null, departure: null });
    } else change({ type: "fields", patch: { nights: null } });
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
    void send(inline);
  }
  // Vuelta de la verificación con lo escrito intacto y ya con sesión: se envía sin pedir otro toque (una vez, cuando ya se
  // saben los días si hay fechas).
  const autoSent = useRef(false);
  const waitingDays = !!dates && days === undefined;
  useEffect(() => {
    if (autoSent.current || waitingDays) return;
    autoSent.current = true;
    if (autoSend && restored && !signedOut) void send();
    // Al montar la hoja o cuando llegan los días.
  }, [waitingDays]);

  async function send(trackTap = false) {
    if (inFlight.current || blocked) return;
    if (trackTap) track("whatsapp_tap", listing.publicId);
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
      if (inline) setStatus({ kind: "idle" });
      // La pestaña ya va a WhatsApp: la entrada de la hoja en el historial se queda (al volver, la ficha sin hoja).
      leavingPage();
      onClose();
    }
  }

  const error = status.kind === "error" ? status : null;
  // El error de las fechas va bajo las casillas y el de las personas bajo su contador; el resto, en el aviso.
  const dateError = error && (error.field === "arrival" || error.field === "departure") && stayMode !== "nights" ? error.message : null;
  const fieldError = !!dateError || error?.field === "people";
  const datesErrorId = `${titleId}-dates-error`;

  const subtitle = <>Anfitrión de {title}{listing.ownerWhatsappVerified ? " · WhatsApp verificado" : ""}</>;
  const heading = `Escríbale a ${name}`;
  const form = (
        <form onSubmit={onSubmit} noValidate>
          {nightsChoice ? (
            <Segmented
              fill
              placement="contact-stay"
              label="Cómo indicar la estancia"
              options={STAY_OPTIONS}
              value={stayMode}
              onChange={chooseStay}
            />
          ) : null}
          {stayMode === "nights" ? (
            <div className="stack gap-8 contact-nights">
              <NightsPicker nights={draft.nights ?? 0} onChange={(nights) => change({ type: "fields", patch: { nights } })} />
            </div>
          ) : <>
          {/* Fechas con el calendario de «¿Cuándo?»: dos casillas que lo abren. */}
          <div className="dates">
            {(["arrival", "departure"] as const).map((field) => (
              <DateBox key={field} label={field === "arrival" ? "Llegada" : "Salida"} value={draft[field]} open={picking} invalid={error?.field === field || undefined} describedBy={error?.field === field ? datesErrorId : undefined} onToggle={toggleCalendar} />
            ))}
          </div>
          {dateError ? (
            <p id={datesErrorId} className="field-error" role="alert">
              {dateError}
            </p>
          ) : null}
          {picking ? (
            <div className="contact-calendar">
              <div className="range-scroll" ref={calendarBox}>
                <RangeCalendar
                  today={today}
                  value={{ arrival: draft.arrival, departure: draft.departure }}
                  busy={busy}
                  onReject={() => setRejected(true)}
                  onChange={changeDates}
                />
              </div>
              {rejected ? (
                <Notice tone="error">
                  {RANGE_BUSY_MESSAGE}
                </Notice>
              ) : null}
              <div className="row between">
                {draft.arrival ? (
                  <TextButton tone="quiet" onClick={() => changeDates({ arrival: null, departure: null })}>
                    Quitar fechas
                  </TextButton>
                ) : (
                  <span />
                )}
                <TextButton tone="quiet" onClick={() => setPicking(false)}>
                  Listo
                </TextButton>
              </div>
            </div>
          ) : null}
          </>}
          {/* − / + como el paso 4 de publicar, con el campo editable en medio y tope en la capacidad (revisión UX A3). */}
          <Field id="contact-people" label="Personas (opcional)" size="compact" error={error?.field === "people" ? error.message : null}>
            {(control) => (
              <Stepper
                unit="Una persona"
                value={people}
                min={1}
                max={maxPeople}
                onChange={changePeople}
                // En escritorio, «Opcional» en vez del guion: «– − +» parecía un contador sin valor (revisión 2026-11-13, A2).
                input={{ ...control, name: "people", placeholder: inline ? "Opcional" : "–", value: draft.people, onInput: (text) => changePeople(parsePeople(text)) }}
              />
            )}
          </Field>
          {stay && dates ? (
            <p className="stay-line" data-testid="stay-total">
              {stayLine(stay, dates, currency, fx)}
            </p>
          ) : busyDates ? (
            <p className="stay-line is-busy" data-testid="stay-total" role="alert">
              {RANGE_BUSY_MESSAGE}
            </p>
          ) : null}
          <div className="stack gap-4">
            <span className="field-label" id="contact-message-label">
              Su mensaje
            </span>
            <p className="message-preview" aria-labelledby="contact-message-label" data-testid="contact-message">
              {draft.composed}
            </p>
            <span className="hint">Podrá añadir lo que quiera en WhatsApp antes de enviarlo.</span>
          </div>
          {error && !fieldError ? (
            <Notice tone="error">
              {error.message}
            </Notice>
          ) : null}
          {/* «Abriendo WhatsApp…»: `aria-disabled` y no `disabled` (el foco se queda en el botón mientras se registra la consulta). */}
          <Button
            variant="whatsapp"
            size="xl"
            block
            type="submit"
            icon={<I.wa size={20} />}
            disabled={blocked}
            aria-disabled={status.kind === "sending" || undefined}
            aria-busy={status.kind === "sending" || undefined}
          >
            {/* Sin sesión el botón todavía no abre WhatsApp: lleva a verificar el número (revisión UX C2). */}
            {status.kind === "sending" ? "Abriendo WhatsApp…" : inline ? `Escribir a ${name} por WhatsApp` : signedOut ? "Continuar" : "Abrir WhatsApp"}
          </Button>
          {/* En escritorio, el botón dice a quién y por dónde, y dos avisos en lugar de tres: sin sesión, el del código; con ella,
              qué verá el anfitrión (revisión 2026-11-13, A3). */}
          {signedOut ? <span className="consent">Para escribirle necesita verificar su WhatsApp con un código. Lo que escribió se guarda.</span> : null}
          {inline && signedOut ? null : <span className="consent">{name} verá su nombre y su WhatsApp.</span>}
          <span className="safety">Por su seguridad, nunca envíe dinero antes de confirmar la casa. 3bstays no procesa ni pide pagos.</span>
        </form>
  );
  if (inline) {
    return (
      <section className="sheet listing-contact-inline" aria-labelledby={titleId}>
        <div className="sheet-head">
          <div>
            <h2 id={titleId}>{heading}</h2>
            <span className="small muted">{subtitle}</span>
          </div>
        </div>
        {form}
      </section>
    );
  }
  return (
    <Sheet layout="contact" keyboardRoom={kb} title={heading} subtitle={subtitle} onClose={close} onFocus={onFocus} onBlur={onBlur}>
      {form}
    </Sheet>
  );
}

/** Una casilla de fecha de la hoja: «Elegir fecha» o la elegida («8 nov»); abre y cierra el calendario. */
function DateBox({ label, value, open, invalid, describedBy, onToggle }: { label: string; value: string | null; open: boolean; invalid?: true; describedBy?: string; onToggle: () => void }) {
  return (
    <ClosedField kind="date" label={label} value={(value && shortDate(value)) || "Elegir fecha"} empty={!value} aria-expanded={open} aria-invalid={invalid} aria-describedby={describedBy} onClick={onToggle} />
  );
}
