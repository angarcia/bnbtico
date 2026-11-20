// Campos de cada pantalla del asistente (decisión 2026-10-21: pantallas cortas, sin scroll en 375×667; ocho desde que el
// mapa se unió al paso 2, el 2026-10-27). Casillas y contadores llevan su valor en el formulario (campos ocultos o
// casillas); el texto va sin controlar.
import { useQuery } from "@tanstack/react-query";
import { Component, lazy, Suspense, useId, useRef, useState, type ReactNode } from "react";
import { FullScreen } from "../../shared/overlay";
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
import { CounterRow, type StepperUnit } from "../../shared/stepper";
import { ChoiceChips, Segmented } from "../../shared/choice";
import { AffixInput, Field, Select, TextArea, TextInput, type FieldCount } from "../../shared/field";
import { FeatureChoiceLabel, FEATURE_CHOICE_NAME, FEATURE_CHOICE_ORDER } from "../../shared/feature-choices";
import { useFieldError } from "./field-error";
import { I } from "../../shared/icons";
import { isChunkLoadError } from "../chunk-error";
import { useEditor } from "../editor-port";
import { offerTakenQuery } from "../owner";
import { useFillHeight } from "./fill-height";
import { LocationStep } from "./location-step";
import { useStepReady } from "./step-ready";
import { KindChoice, ReadyList } from "./wizard-parts";
import { Button } from "../../shared/button";
import { Card } from "../../shared/card";

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
          <Button
            variant="secondary"
            onClick={() => {
              PhotoUploader = loadPhotos();
              this.setState({ failed: null });
            }}
          >
            Reintentar
          </Button>
        </div>,
      );
    return (
      <Suspense fallback={photosFrame()}>
        <PhotoUploader listing={this.props.listing} userId={this.props.userId} />
      </Suspense>
    );
  }
}

/** Contador −/+ con el valor en un campo oculto; su error (de la base, p. ej.) va debajo. */
function Counter({ name, label, unit, value, min, max = 30, icon, iconByValue }: { name: "capacity" | "bedrooms" | "bathrooms"; label: string; unit: StepperUnit; value: number | null; min: number; max?: number; icon?: ReactNode; iconByValue?: boolean }) {
  const [n, setN] = useState<number | null>(value);
  const error = useFieldError(name);
  const errorId = useId();
  return (
    <>
      <input type="hidden" name={name} value={n === null ? "" : n} />
      <CounterRow
        label={label}
        icon={icon}
        iconByValue={iconByValue}
        unit={unit}
        value={n ?? min}
        min={min}
        max={max}
        empty={n === null}
        describedBy={error ? errorId : undefined}
        // Sin valor, «+» pone el primero que vale (1, o el mínimo).
        onChange={(next) => setN(n === null ? Math.max(min, 1) : next)}
      />
      {error ? (
        <p id={errorId} className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </>
  );
}

/** Chips de características; al marcar Parqueo aparece «Tipo de parqueo». */
export function FeatureChips({ selected, parkingPaid }: { selected: Feature[]; parkingPaid: boolean | null }) {
  const [on, setOn] = useState<Feature[]>(selected);
  const toggle = (f: Feature) => setOn((c) => (c.includes(f) ? c.filter((x) => x !== f) : [...c, f]));
  const parkingError = useFieldError("parkingPaid");
  return (
    <div className="stack gap-8">
      <ChoiceChips
        type="checkbox"
        name="features"
        options={FEATURE_CHOICE_ORDER.map((key) => ({ value: key, name: FEATURE_CHOICE_NAME[key], label: <FeatureChoiceLabel feature={key} /> }))}
        selected={on}
        onToggle={toggle}
      />
      <span className="field-hint">Las mismas que usan los clientes para filtrar.</span>
      {on.includes("parking") ? (
        <Field id="pub-parkingPaid" label="Tipo de parqueo" error={parkingError}>
          {(control) => (
            <Select {...control} name="parkingPaid" defaultValue={parkingPaid === null ? "" : parkingPaid ? "paid" : "free"}>
              <option value="">Seleccione una opción</option>
              <option value="free">Gratuito</option>
              <option value="paid">De pago</option>
            </Select>
          )}
        </Field>
      ) : null}
    </div>
  );
}

const BATHROOM_OPTIONS = [
  { value: "private", label: "Privado" },
  { value: "shared", label: "Compartido" },
] as const;

/** Baño privado o compartido (solo habitaciones), como segmento (D8). */
export function BathroomChoice({ shared, showIcon = false }: { shared: boolean | null; showIcon?: boolean }) {
  const [v, setV] = useState<"private" | "shared" | null>(shared === null ? null : shared ? "shared" : "private");
  const labelId = useId();
  const error = useFieldError("bathroomShared");
  return (
    <div className="stack gap-8">
      <span id={labelId} className="row label-plain">
        {showIcon ? <I.bath size={22} /> : null}Baño de la habitación
      </span>
      <Segmented name="bathroomShared" labelledBy={labelId} options={BATHROOM_OPTIONS} value={v} onChange={(val) => setV(val)} placement="bathroom-options" />
      {error ? (
        <p className="field-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

const MONTHLY_OPTIONS = [
  { value: "no", label: "No" },
  { value: "yes", label: "Sí" },
] as const;

/** Paso del precio: «¿Acepta alquiler por meses?» No (por defecto) / Sí, como segmento (D8); con Sí, «Precio al mes
 *  (opcional)». Volver a No vacía el campo. Un precio al mes mal escrito se guarda vacío («a negociar»): mientras se
 *  escribe, la ayuda lo avisa en ocre con el mensaje de la regla (ticket 12; al crear y al editar). */
export function MonthlyQuestion({ accepts, price }: { accepts: boolean; price: number | null }) {
  const [yes, setYes] = useState(accepts);
  const [text, setText] = useState(price === null ? "" : String(price));
  const bad = monthlyError({ acceptsMonthly: true, monthlyPriceCrc: parseColones(text) });
  const error = useFieldError("monthlyPriceCrc");
  return (
    <>
      <div className="stack gap-8">
        <span id="pub-acceptsMonthly" className="label-plain">
          ¿Acepta alquiler por meses?
        </span>
        <Segmented
          name="acceptsMonthly"
          labelledBy="pub-acceptsMonthly"
          options={MONTHLY_OPTIONS}
          value={yes ? "yes" : "no"}
          onChange={(val) => {
            setYes(val === "yes");
            if (val === "no") setText("");
          }}
        />
      </div>
      {yes ? (
        <Field
          id="pub-monthlyPriceCrc"
          label="Precio al mes (opcional)"
          error={error}
          hint={bad ?? "Si lo deja vacío, en su ficha dirá «Precio a negociar con el anfitrión»."}
          hintTone={bad ? "warn" : "muted"}
        >
          {(control) => <AffixInput {...control} size="lg" prefix="₡" name="monthlyPriceCrc" inputMode="numeric" autoComplete="off" value={text} onChange={(e) => setText(e.currentTarget.value)} placeholder="350 000" />}
        </Field>
      ) : null}
    </>
  );
}

/** Personas, habitaciones y baños: la pantalla 4 y la capacidad de una casa publicada. Una Habitación solo pregunta
 *  personas: es 1 habitación y 1 baño (`normalize`); el baño privado o compartido va aparte (`BathroomChoice`). */
export function CapacityCounters({ draft, icons = false, iconByValue }: { draft: ListingDraft; icons?: boolean; iconByValue?: boolean }) {
  return (
    <Card as="div" placement="counters">
      <Counter name="capacity" label="Personas" unit="Una persona" value={draft.capacity} min={1} icon={icons ? <I.users size={22} /> : undefined} iconByValue={iconByValue} />
      {draft.kind === "habitacion" ? null : (
        <>
          <Counter name="bedrooms" label="Dormitorios" unit="Un dormitorio" value={draft.bedrooms} min={0} icon={icons ? <I.bed size={22} /> : undefined} iconByValue={iconByValue} />
          <Counter name="bathrooms" label="Baños" unit="Un baño" value={draft.bathrooms} min={1} icon={icons ? <I.bath size={22} /> : undefined} iconByValue={iconByValue} />
        </>
      )}
    </Card>
  );
}

/** Precio por noche y alquiler mensual: la pantalla 8 y el precio de una casa publicada. */
export function PriceFields({ draft }: { draft: ListingDraft }) {
  const error = useFieldError("nightlyPriceCrc");
  return (
    <>
      <Field id="pub-nightlyPriceCrc" label="Precio por noche" error={error}>
        {(control) => <AffixInput {...control} size="lg" prefix="₡" name="nightlyPriceCrc" inputMode="numeric" autoComplete="off" defaultValue={draft.nightlyPriceCrc ?? ""} placeholder="95 000" />}
      </Field>
      <MonthlyQuestion accepts={draft.acceptsMonthly} price={draft.monthlyPriceCrc} />
      <span className="small muted">En colones; el cliente puede verlo en dólares. El precio final lo acuerda por WhatsApp.</span>
    </>
  );
}

/** Contador «n / máx» (ticket 19): en caracteres, como la regla del dominio; en rojo suave fuera del rango. */
const charCountOf = (n: number, min: number, max: number, hint?: string): FieldCount => ({
  text: `${n} / ${max}${hint ? ` · ${hint}` : ""}`,
  tone: n > 0 && (n < min || n > max) ? "bad" : "muted",
});

/** Nombre de la casa (5 a 32 caracteres) con contador. */
export function TitleField({ value }: { value: string }) {
  const [n, setN] = useState(charCount(value));
  const error = useFieldError("title");
  return (
    <Field id="pub-title" label="Nombre de la casa" error={error} count={charCountOf(n, TITLE_MIN, TITLE_MAX, `mínimo ${TITLE_MIN}`)}>
      {(control) => <TextInput {...control} name="title" maxLength={TITLE_MAX} defaultValue={value} autoComplete="off" placeholder="Casa Manzanillo, a pie de playa" onChange={(e) => setN(charCount(e.currentTarget.value))} />}
    </Field>
  );
}

/** Descripción opcional (vacía, o de 80 a 2000 caracteres) con contador; el área llena lo que queda de pantalla, con y sin teclado. */
export function DescriptionField({ value }: { value: string }) {
  const [n, setN] = useState(charCount(value));
  const area = useRef<HTMLTextAreaElement>(null);
  useFillHeight(area);
  const error = useFieldError("description");
  // Vacía, que se puede añadir después; por debajo del mínimo, cuántos faltan en ocre (revisión UX N3); después, el
  // contador normal.
  const count: FieldCount =
    n === 0
      ? { text: "Puede añadirla después" }
      : n < DESCRIPTION_MIN
        ? { text: DESCRIPTION_MIN - n === 1 ? "Falta 1 carácter" : `Faltan ${DESCRIPTION_MIN - n} caracteres`, tone: "warn" }
        : charCountOf(n, DESCRIPTION_MIN, DESCRIPTION_MAX);
  return (
    <Field id="pub-description" label="Descripción (opcional)" error={error} count={count} grow>
      {/* Tres preguntas guía que se van al escribir; sin texto de ejemplo, que acabaría copiado en todas las fichas. */}
      {(control) => (
        <TextArea
          {...control}
          ref={area}
          name="description"
          rows={3}
          maxLength={DESCRIPTION_MAX}
          defaultValue={value}
          placeholder="¿Cómo es por dentro? ¿Qué hay cerca (playa, pulpería, parada de bus)? ¿Qué incluye o qué debe saber el cliente?"
          onChange={(e) => setN(charCount(e.currentTarget.value))}
        />
      )}
    </Field>
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
      <Card as="nav" placement="review-list" aria-label="Lo que va a enviar">
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
      </Card>
      <Button variant="secondary" block onClick={() => setPreview(true)}>
        Ver cómo queda su ficha
      </Button>
      <span className="small muted">
        Los clientes le escriben al <b className="num ink">{formatPhone(listing.whatsappPhone)}</b> (verificado). No se muestra públicamente.
      </span>
      <Card tone="solid" layout="row" gap={8} placement="offer-line">
        <span className="small">
          {offer === null
            ? `${fee} al mes desde que se apruebe, sin permanencia.`
            : `Si está entre las próximas ${offer?.remaining ?? offer?.size ?? 50} casas. Después, ${fee} al mes. Sin tarjeta.`}
        </span>
        <b className="num primary">{offer === null ? `${fee} al mes` : `₡0 · ${offer?.months ?? 12} meses`}</b>
      </Card>
      {preview ? <FichaPreview listing={listing} draft={d} ownerName={account.data?.name ?? ""} onClose={() => setPreview(false)} /> : null}
    </>
  );
}

/** La ficha tal como la verán los clientes, encima del asistente, con una banda «Vista previa» y «Cerrar». Pantalla
 *  completa común: el asistente queda inerte, el foco no sale de ella, Escape y Atrás la cierran y el foco vuelve. */
function FichaPreview({ listing, draft, ownerName, onClose }: { listing: Listing; draft: ListingDraft; ownerName: string; onClose: () => void }) {
  const closeButton = useRef<HTMLButtonElement>(null);
  return (
    <FullScreen layout="preview" label="Vista previa de su ficha" initialFocus={closeButton} onClose={onClose}>
      {({ close }) => (
        <>
          <div className="preview-bar">
            <span className="small strong">Vista previa · así la verán los clientes</span>
            <Button ref={closeButton} variant="primary" onClick={close}>
              Cerrar
            </Button>
          </div>
          <ListingPage listing={previewListing({ ...listing, ...draft }, ownerName)} base="" preview />
        </>
      )}
    </FullScreen>
  );
}

function CapacityFields({ draft, iconByValue }: { draft: ListingDraft; iconByValue?: boolean }) {
  const controls = (
    <>
      <CapacityCounters draft={draft} icons iconByValue={iconByValue} />
      {draft.kind === "habitacion" ? <BathroomChoice shared={draft.bathroomShared} showIcon={iconByValue} /> : null}
    </>
  );
  return (
    <>
      <h2>¿Cuántos caben?</h2>
      {iconByValue ? (
        <div className={draft.kind === "habitacion" ? "publish-room-capacity" : undefined}>{controls}</div>
      ) : controls}
    </>
  );
}

/** Campos de cada pantalla. `draft` trae los valores a mostrar; `listing`, lo que solo da el servidor (fotos, WhatsApp). */
export function StepFields({ step, draft, listing, userId, withCapacity = false }: { step: Step; draft: ListingDraft; listing: Listing; userId: string; withCapacity?: boolean }) {
  const [kind, setKind] = useState(draft.kind);
  const kindError = useFieldError("kind");
  switch (step) {
    case 1:
      return (
        <>
          {/* Arriba del primer paso de un borrador recién creado, qué tener a mano (revisión UX C4). */}
          {!withCapacity && isFreshDraft(listing) ? (
            <section className="stack gap-4" aria-label="Qué tener a mano">
              <span className="small strong">Tenga a mano:</span>
              <ReadyList />
            </section>
          ) : null}
          <KindChoice kind={draft.kind} compact={withCapacity} onChange={withCapacity ? setKind : undefined} error={kindError} />
          {withCapacity ? <CapacityFields draft={{ ...draft, kind }} iconByValue /> : null}
        </>
      );
    case 2:
      return (
        <>
          <h2>¿Dónde está su casa?</h2>
          <LocationStep listing={listing} draft={draft} fullWidth />
        </>
      );
    case 4:
      return <CapacityFields draft={draft} />;
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
