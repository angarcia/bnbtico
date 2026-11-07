// Campos de cada pantalla del asistente (decisión 2026-10-21: pantallas cortas, sin scroll en 375×667; ocho desde que el
// mapa se unió al paso 2, el 2026-10-27). Casillas y contadores llevan su valor en el formulario (campos ocultos o
// casillas); el texto va sin controlar.
import { useQuery } from "@tanstack/react-query";
import { Component, lazy, Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { DESCRIPTION_MAX, DESCRIPTION_MIN, KIND_LABELS, TITLE_MAX, TITLE_MIN, isFreshDraft, locationLine, parseColones, type Feature, type Listing, type ListingDraft, type Step } from "../../domain/listing";
import { charCount, monthlyError } from "../../domain/listing-rules";
import { requiredProblems, warnings } from "../../domain/publish-rules";
import { previewListing } from "../../domain/preview";
import { ListingPage } from "../../shared/listing-page";
import { accountQuery } from "../account";
import { capacitySummary } from "../../domain/describe";
import { formatCRC } from "../../domain/money";
import { MONTHLY_FEE_CRC, launchOffer } from "../../domain/offer";
import { formatPhone } from "../../domain/phone";
import { reportError } from "../../shared/beacon";
import { CounterRow } from "../../shared/counter-row";
import { FeatureChoiceContent, FEATURE_CHOICE_NAME, FEATURE_CHOICE_ORDER } from "../../shared/feature-choices";
import { I } from "../../shared/icons";
import { isChunkLoadError } from "../chunk-error";
import { useEditor } from "../editor-port";
import { offerTakenQuery } from "../owner";
import { useFillHeight } from "./fill-height";
import { LocationStep } from "./location-step";
import { useStepReady } from "./step-form";
import { KindChoice, ReadyList } from "./wizard-parts";

/** Paso 7 en su propio trozo: la rejilla, la subida y el ordenado de fotos solo se piden al llegar a las fotos (el service
 * worker los precachea con el resto). Mientras carga, el encabezado ocupa su sitio y nada salta. Un solo componente para
 * todo el módulo: al volver al paso 7 ya está cargado y no hay espera. Si el trozo no llega (sin red, o un despliegue
 * nuevo cambió su nombre), se avisa de la conexión sin salir del asistente; si falla al pintarse, se manda a /errors y se
 * dice sin culpar a la red. «Reintentar» crea otro componente, que vuelve a pedir el trozo. */
const loadPhotos = () => lazy(() => import("./photos").then((m) => ({ default: m.PhotoUploader })));
let PhotoUploader = loadPhotos();
const photosFrame = (rest?: ReactNode) => (
  <div className="stack grow-col gap-12">
    <div className="row between baseline">
      <h2>Fotos</h2>
    </div>
    {rest}
  </div>
);

class PhotosStep extends Component<{ listing: Listing; userId: string }, { failed: "chunk" | "render" | null }> {
  override state = { failed: null as "chunk" | "render" | null };
  static getDerivedStateFromError(error: unknown) {
    return { failed: isChunkLoadError(error) ? "chunk" : "render" };
  }
  override componentDidCatch(error: unknown) {
    if (!isChunkLoadError(error)) reportError(error);
  }
  override render() {
    const { failed } = this.state;
    if (failed)
      return photosFrame(
        <div className="row gap-8 baseline">
          <p className="field-error" role="alert">
            {failed === "chunk" ? "No pudimos cargar las fotos. Revise su conexión." : "Algo falló al mostrar las fotos. Inténtelo de nuevo."}
          </p>
          <button
            type="button"
            className="btn btn-sm btn-ghost"
            onClick={() => {
              PhotoUploader = loadPhotos();
              this.setState({ failed: null });
            }}
          >
            Reintentar
          </button>
        </div>,
      );
    return (
      <Suspense fallback={photosFrame()}>
        <PhotoUploader listing={this.props.listing} userId={this.props.userId} />
      </Suspense>
    );
  }
}

/** Contador −/+ con el valor en un campo oculto. */
function Counter({ name, label, value, min, max = 30, icon }: { name: string; label: string; value: number | null; min: number; max?: number; icon?: ReactNode }) {
  const [n, setN] = useState<number | null>(value);
  const current = n ?? min;
  return (
    <>
      <input type="hidden" name={name} value={n === null ? "" : n} />
      <CounterRow
        label={label}
        icon={icon}
        value={n ?? "–"}
        decrease={current > min ? () => setN(current - 1) : undefined}
        increase={() => setN(n === null ? Math.max(min, 1) : Math.min(max, current + 1))}
      />
    </>
  );
}

/** Chips de características; al marcar Parqueo aparece «Tipo de parqueo». */
export function FeatureChips({ selected, parkingPaid }: { selected: Feature[]; parkingPaid: boolean | null }) {
  const [on, setOn] = useState<Feature[]>(selected);
  const toggle = (f: Feature) => setOn((c) => (c.includes(f) ? c.filter((x) => x !== f) : [...c, f]));
  return (
    <div className="stack gap-8">
      <div className="feature-choices">
        {FEATURE_CHOICE_ORDER.map((key) => (
          <label key={key} className="chip" aria-pressed={on.includes(key)}>
            <input type="checkbox" name="features" value={key} aria-label={FEATURE_CHOICE_NAME[key]} checked={on.includes(key)} onChange={() => toggle(key)} className="sr-input" />
            <FeatureChoiceContent feature={key} selected={on.includes(key)} />
          </label>
        ))}
      </div>
      <span className="xs muted">Las mismas que usan los clientes para filtrar.</span>
      {on.includes("parking") ? (
        <div className="field">
          <label htmlFor="pub-parkingPaid">Tipo de parqueo</label>
          <select id="pub-parkingPaid" name="parkingPaid" defaultValue={parkingPaid === null ? "" : parkingPaid ? "paid" : "free"}>
            <option value="">Seleccione una opción</option>
            <option value="free">Gratuito</option>
            <option value="paid">De pago</option>
          </select>
        </div>
      ) : null}
    </div>
  );
}

/** Baño privado o compartido (solo habitaciones). */
export function BathroomChoice({ shared }: { shared: boolean | null }) {
  const [v, setV] = useState<string>(shared === null ? "" : shared ? "shared" : "private");
  return (
    <div className="stack gap-8">
      <span className="label-plain">Baño de la habitación</span>
      <div className="row gap-8">
        {(
          [
            ["private", "Privado"],
            ["shared", "Compartido"],
          ] as const
        ).map(([val, label]) => (
          <label key={val} className="chip" aria-pressed={v === val}>
            <input type="radio" name="bathroomShared" value={val} checked={v === val} onChange={() => setV(val)} className="sr-input" />
            {label}
          </label>
        ))}
      </div>
    </div>
  );
}

/** Paso del precio: «¿Acepta alquiler por meses?» No (por defecto) / Sí; con Sí, «Precio al mes (opcional)». Volver a No
 *  vacía el campo. Un precio al mes mal escrito se guarda vacío («a negociar»): mientras se escribe, la ayuda lo avisa en
 *  ocre con el mensaje de la regla (ticket 12; al crear y al editar). */
export function MonthlyQuestion({ accepts, price }: { accepts: boolean; price: number | null }) {
  const [yes, setYes] = useState(accepts);
  const [text, setText] = useState(price === null ? "" : String(price));
  const bad = monthlyError({ acceptsMonthly: true, monthlyPriceCrc: parseColones(text) });
  return (
    <>
      <div className="stack gap-8" role="group" aria-labelledby="pub-acceptsMonthly">
        <span id="pub-acceptsMonthly" className="label-plain">
          ¿Acepta alquiler por meses?
        </span>
        <div className="row gap-8">
          {(
            [
              ["no", "No"],
              ["yes", "Sí"],
            ] as const
          ).map(([val, label]) => {
            const on = (val === "yes") === yes;
            return (
              <label key={val} className="chip" aria-pressed={on}>
                <input
                  type="radio"
                  name="acceptsMonthly"
                  value={val}
                  checked={on}
                  onChange={() => {
                    setYes(val === "yes");
                    if (val === "no") setText("");
                  }}
                  className="sr-input"
                />
                {label}
              </label>
            );
          })}
        </div>
      </div>
      {yes ? (
        <div className="field">
          <label htmlFor="pub-monthlyPriceCrc">Precio al mes (opcional)</label>
          <div className="input-money">
            <span className="cur">₡</span>
            <input id="pub-monthlyPriceCrc" name="monthlyPriceCrc" inputMode="numeric" autoComplete="off" value={text} onChange={(e) => setText(e.currentTarget.value)} placeholder="350 000" aria-describedby="pub-monthlyPriceCrc-help" />
          </div>
          <span id="pub-monthlyPriceCrc-help" className={`xs ${bad ? "sun-ink strong" : "muted"}`} aria-live="polite">
            {bad ?? "Si lo deja vacío, en su ficha dirá «Precio a negociar con el anfitrión»."}
          </span>
        </div>
      ) : null}
    </>
  );
}

/** Personas, habitaciones y baños: la pantalla 4 y la capacidad de una casa publicada. Una Habitación solo pregunta
 *  personas: es 1 habitación y 1 baño (`normalize`); el baño privado o compartido va aparte (`BathroomChoice`). */
export function CapacityCounters({ draft, icons = false }: { draft: ListingDraft; icons?: boolean }) {
  return (
    <div className="card counters">
      <Counter name="capacity" label="Personas" value={draft.capacity} min={1} icon={icons ? <I.users size={22} /> : undefined} />
      {draft.kind === "habitacion" ? null : (
        <>
          <Counter name="bedrooms" label="Habitaciones" value={draft.bedrooms} min={0} icon={icons ? <I.bed size={22} /> : undefined} />
          <Counter name="bathrooms" label="Baños" value={draft.bathrooms} min={1} icon={icons ? <I.bath size={22} /> : undefined} />
        </>
      )}
    </div>
  );
}

/** Precio por noche y alquiler mensual: la pantalla 8 y el precio de una casa publicada. */
export function PriceFields({ draft }: { draft: ListingDraft }) {
  return (
    <>
      <div className="field">
        <label htmlFor="pub-nightlyPriceCrc">Precio por noche</label>
        <div className="input-money">
          <span className="cur">₡</span>
          <input id="pub-nightlyPriceCrc" name="nightlyPriceCrc" inputMode="numeric" autoComplete="off" defaultValue={draft.nightlyPriceCrc ?? ""} placeholder="95 000" />
        </div>
      </div>
      <MonthlyQuestion accepts={draft.acceptsMonthly} price={draft.monthlyPriceCrc} />
      <span className="small muted">En colones; el cliente puede verlo en dólares. El precio final lo acuerda por WhatsApp.</span>
    </>
  );
}

/** Contador «n / máx» (ticket 19): en caracteres, como la regla del dominio; en rojo suave fuera del rango. */
function CharCount({ id, n, min, max, hint }: { id: string; n: number; min: number; max: number; hint?: string }) {
  const out = n > 0 && (n < min || n > max);
  return (
    <span id={id} className={`xs num${out ? " counter-out" : " muted"}`} aria-live="polite">
      {n} / {max}
      {hint ? ` · ${hint}` : ""}
    </span>
  );
}

/** Nombre de la casa (5 a 32 caracteres) con contador. */
export function TitleField({ value }: { value: string }) {
  const [n, setN] = useState(charCount(value));
  return (
    <div className="field">
      <div className="row between baseline">
        <label htmlFor="pub-title">Nombre de la casa</label>
        <CharCount id="pub-title-count" n={n} min={TITLE_MIN} max={TITLE_MAX} hint={`mínimo ${TITLE_MIN}`} />
      </div>
      <input id="pub-title" name="title" maxLength={TITLE_MAX} defaultValue={value} autoComplete="off" placeholder="Casa Manzanillo, a pie de playa" aria-describedby="pub-title-count" onChange={(e) => setN(charCount(e.currentTarget.value))} />
    </div>
  );
}

/** Descripción opcional (vacía, o de 80 a 2000 caracteres) con contador; el área llena lo que queda de pantalla, con y sin teclado. */
export function DescriptionField({ value }: { value: string }) {
  const [n, setN] = useState(charCount(value));
  const area = useRef<HTMLTextAreaElement>(null);
  useFillHeight(area);
  return (
    <div className="field grow-col">
      <div className="row between baseline">
        <label htmlFor="pub-description">Descripción (opcional)</label>
        {/* Vacía, que se puede añadir después; por debajo del mínimo, cuántos faltan en ocre (revisión UX N3); después, el
            contador normal. */}
        {n === 0 ? (
          <span id="pub-description-count" className="xs muted" aria-live="polite">
            Puede añadirla después
          </span>
        ) : n < DESCRIPTION_MIN ? (
          <span id="pub-description-count" className="xs num description-short" aria-live="polite">
            {DESCRIPTION_MIN - n === 1 ? "Falta 1 carácter" : `Faltan ${DESCRIPTION_MIN - n} caracteres`}
          </span>
        ) : (
          <CharCount id="pub-description-count" n={n} min={DESCRIPTION_MIN} max={DESCRIPTION_MAX} />
        )}
      </div>
      {/* Tres preguntas guía que se van al escribir; sin texto de ejemplo, que acabaría copiado en todas las fichas. */}
      <textarea
        ref={area}
        id="pub-description"
        name="description"
        rows={3}
        maxLength={DESCRIPTION_MAX}
        defaultValue={value}
        placeholder="¿Cómo es por dentro? ¿Qué hay cerca (playa, pulpería, parada de bus)? ¿Qué incluye o qué debe saber el cliente?"
        aria-describedby="pub-description-count"
        onChange={(e) => setN(charCount(e.currentTarget.value))}
      />
    </div>
  );
}

/** Lo obligatorio que falta (terracota) y lo no obligatorio que se puede mejorar (ocre), en corto, con la acción. */
const MISSING_ACTION: Partial<Record<Step, string>> = { 1: "Elegir el tipo", 2: "Añadir la ubicación", 6: "Añadir el nombre", 7: "Añadir una foto", 8: "Añadir precio" };
const WARN_ACTION: Partial<Record<Step, string>> = { 4: "Completar la capacidad", 5: "Indicar si se paga", 6: "Revisar la descripción", 8: "Revisar el precio mensual" };

/** Paso 9, «Revisar y enviar» (revisión UX C4, punto 5; publicar avanza siempre, 2026-10-30): lo escrito en filas que llevan
 *  a su pantalla, la vista previa de la ficha, el WhatsApp de la casa y la oferta. En terracota lo obligatorio que falta
 *  (tipo, ubicación, nombre, una foto, precio por noche): «Enviar a revisión» espera a que no quede ninguno. En ocre, los
 *  avisos (capacidad, descripción, parqueo, precio al mes): no bloquean. */
function SendSummary({ draft, listing, userId }: { draft: ListingDraft; listing: Listing; userId: string }) {
  const count = useQuery(offerTakenQuery);
  const port = useEditor();
  // La cuenta es la de quien edita: en las rutas del admin no es la del anfitrión, y la vista previa va sin nombre.
  const account = useQuery({ ...accountQuery(userId), enabled: !!userId && !port.admin });
  const [preview, setPreview] = useState(false);
  const offer = count.data === undefined ? undefined : launchOffer(count.data);
  const fee = formatCRC(MONTHLY_FEE_CRC);
  const d = { ...draft, photoCount: listing.photoCount };
  const prices = [
    d.nightlyPriceCrc ? `${formatCRC(d.nightlyPriceCrc)} / noche` : null,
    d.acceptsMonthly ? (d.monthlyPriceCrc ? `${formatCRC(d.monthlyPriceCrc)} / mes` : "mensual a negociar") : null,
  ].filter(Boolean);
  const title = d.title.trim();
  const photos = listing.photoCount;
  const required = requiredProblems(d);
  const warned = warnings(d);
  useStepReady(required.length === 0);
  const rows: { step: Step; label: string; value: string }[] = [
    { step: 1, label: "Alojamiento", value: d.kind ? KIND_LABELS[d.kind] : "Falta elegir" },
    { step: 2, label: "Dónde", value: (d.lat !== null && d.zoneSource ? locationLine(d) : "") || "Falta la ubicación" },
    // Una Habitación no cuenta habitaciones ni baños (son 1): «2 pers. · baño compartido».
    { step: 4, label: "Capacidad", value: d.capacity ? capacitySummary(d) : "Falta indicarla" },
    // El parqueo no tiene fila propia: solo aparece cuando hay que decir si se paga.
    ...(warned.some((w) => w.step === 5) ? [{ step: 5 as Step, label: "Parqueo", value: "Falta indicar si se paga" }] : []),
    { step: 6, label: "Nombre", value: title ? `«${title}»${d.description.trim() ? "" : " · sin descripción"}` : "Sin nombre" },
    { step: 7, label: "Fotos", value: photos ? `${photos} ${photos === 1 ? "foto" : "fotos"}` : "Ninguna todavía" },
    { step: 8, label: "Precio", value: prices.join(" · ") || "Falta el precio" },
  ];
  return (
    <>
      <nav className="card review-list" aria-label="Lo que va a enviar">
        {rows.map((r) => {
          const missing = required.some((p) => p.step === r.step);
          const warn = !missing && warned.some((w) => w.step === r.step);
          return (
            <Link
              key={r.label}
              to={port.step}
              params={{ id: listing.id, paso: String(r.step) }}
              search={{ volver: "revisar" }}
              className={`review-row${missing ? " is-missing" : warn ? " is-warn" : ""}`}
              data-missing={missing || undefined}
              data-warn={warn || undefined}
            >
              <span className="review-label">{r.label}</span>
              <span className="review-value">
                <span className="review-text">{missing ? MISSING_ACTION[r.step] : warn ? (r.step === 6 && !d.description.trim() ? "Añadir una descripción" : WARN_ACTION[r.step]) : r.value}</span>
              </span>
              <I.chevron size={16} />
            </Link>
          );
        })}
      </nav>
      <button type="button" className="btn btn-ghost btn-block" onClick={() => setPreview(true)}>
        Ver cómo queda su ficha
      </button>
      <span className="small muted">
        Los clientes le escriben al <b className="num ink">{formatPhone(listing.whatsappPhone)}</b> (verificado). No se muestra públicamente.
      </span>
      <section className="card-arena row between baseline gap-8 offer-line">
        <span className="small">
          {offer === null
            ? `${fee} al mes desde que se apruebe, sin permanencia.`
            : `Si está entre las próximas ${offer?.remaining ?? offer?.size ?? 50} casas. Después, ${fee} al mes. Sin tarjeta.`}
        </span>
        <b className="num primary">{offer === null ? `${fee} al mes` : `₡0 · ${offer?.months ?? 12} meses`}</b>
      </section>
      {preview ? <FichaPreview listing={listing} draft={d} ownerName={account.data?.name ?? ""} onClose={() => setPreview(false)} /> : null}
    </>
  );
}

/** La ficha tal como la verán los clientes, encima del asistente, con una banda «Vista previa» y «Cerrar». */
function FichaPreview({ listing, draft, ownerName, onClose }: { listing: Listing; draft: ListingDraft; ownerName: string; onClose: () => void }) {
  useEffect(() => {
    const esc = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", esc);
    document.documentElement.classList.add("sheet-open");
    return () => {
      document.removeEventListener("keydown", esc);
      document.documentElement.classList.remove("sheet-open");
    };
  }, [onClose]);
  return createPortal(
    <div className="ficha-preview" role="dialog" aria-modal="true" aria-label="Vista previa de su ficha">
      <div className="preview-bar">
        <span className="small strong">Vista previa · así la verán los clientes</span>
        <button type="button" className="btn btn-sm btn-primary" onClick={onClose} autoFocus>
          Cerrar
        </button>
      </div>
      <ListingPage listing={previewListing({ ...listing, ...draft }, ownerName)} base="" preview />
    </div>,
    document.body,
  );
}

/** Campos de cada pantalla. `draft` trae los valores a mostrar; `listing`, lo que solo da el servidor (fotos, WhatsApp). */
export function StepFields({ step, draft, listing, userId }: { step: Step; draft: ListingDraft; listing: Listing; userId: string }) {
  switch (step) {
    case 1:
      return (
        <>
          {/* Arriba del primer paso de un borrador recién creado, qué tener a mano (revisión UX C4). */}
          {isFreshDraft(listing) ? (
            <section className="stack gap-4" aria-label="Qué tener a mano">
              <span className="small strong">Tenga a mano:</span>
              <ReadyList />
            </section>
          ) : null}
          <KindChoice kind={draft.kind} />
        </>
      );
    case 2:
      return (
        <>
          <h2>¿Dónde está su casa?</h2>
          <LocationStep listing={listing} draft={draft} />
        </>
      );
    case 4:
      return (
        <>
          <h2>¿Cuántos caben?</h2>
          <CapacityCounters draft={draft} icons />
          {draft.kind === "habitacion" ? <BathroomChoice shared={draft.bathroomShared} /> : null}
        </>
      );
    case 5:
      return (
        <>
          <h2>Características</h2>
          <FeatureChips selected={draft.features} parkingPaid={draft.parkingPaid} />
        </>
      );
    case 6:
      return (
        <>
          <h2>Nombre y descripción</h2>
          <TitleField value={draft.title} />
          <DescriptionField value={draft.description} />
          <span className="xs muted">Sin enlaces, teléfonos ni publicidad. Se revisa antes de publicar.</span>
        </>
      );
    case 7:
      return (
        <>
          <PhotosStep listing={listing} userId={userId} />
          <span className="xs muted">Horizontales, sin teléfonos ni marcas de agua.</span>
        </>
      );
    case 8:
      return (
        <>
          <h2>Precio</h2>
          <PriceFields draft={draft} />
        </>
      );
    case 9:
      return <SendSummary draft={draft} listing={listing} userId={userId} />;
  }
}
