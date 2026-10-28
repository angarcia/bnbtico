// Campos de cada pantalla del asistente (decisión 2026-10-21: pantallas cortas, sin scroll en 375×667; ocho desde que el
// mapa se unió al paso 2, el 2026-10-27). Casillas y contadores llevan su valor en el formulario (campos ocultos o
// casillas); el texto va sin controlar.
import { useQuery } from "@tanstack/react-query";
import { Component, lazy, Suspense, useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { charCount, DESCRIPTION_MAX, DESCRIPTION_MIN, FEATURES, KIND_HINTS, KIND_LABELS, MIN_PHOTOS, TITLE_MAX, TITLE_MIN, isFreshDraft, locationLine, missingPhotosLabel, type Feature, type Listing, type ListingDraft, type Step } from "../../domain/listing";
import { previewListing } from "../../domain/preview";
import { ListingPage } from "../../shared/listing-page";
import { accountQuery } from "../account";
import { formatCRC } from "../../domain/money";
import { MONTHLY_FEE_CRC, launchOffer } from "../../domain/offer";
import { formatPhone } from "../../domain/phone";
import { I } from "../../shared/icons";
import { offerTakenQuery } from "../owner";
import { LocationStep } from "./location-step";

/** Paso 7 en su propio trozo: la rejilla, la subida y el ordenado de fotos solo se piden al llegar a las fotos (el service
 * worker los precachea con el resto). Mientras carga, el encabezado ocupa su sitio y nada salta. Si el trozo no llega (sin
 * red, o un despliegue nuevo cambió su nombre), se avisa sin salir del asistente y «Reintentar» lo vuelve a pedir. */
const loadPhotos = () => lazy(() => import("./photos").then((m) => ({ default: m.PhotoUploader })));
const photosFrame = (rest?: ReactNode) => (
  <div className="stack grow-col gap-12">
    <div className="row between baseline">
      <h2>Fotos</h2>
    </div>
    {rest}
  </div>
);

class PhotosStep extends Component<{ listing: Listing; userId: string }, { Uploader: ReturnType<typeof loadPhotos>; failed: boolean }> {
  override state = { Uploader: loadPhotos(), failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override render() {
    const { Uploader, failed } = this.state;
    if (failed)
      return photosFrame(
        <div className="row gap-8 baseline">
          <p className="field-error" role="alert">
            No pudimos cargar las fotos. Revise su conexión.
          </p>
          <button type="button" className="btn btn-sm btn-ghost" onClick={() => this.setState({ Uploader: loadPhotos(), failed: false })}>
            Reintentar
          </button>
        </div>,
      );
    return (
      <Suspense fallback={photosFrame()}>
        <Uploader listing={this.props.listing} userId={this.props.userId} />
      </Suspense>
    );
  }
}

/** Tarjetas de elección: casillas o radios con aspecto de tarjeta y aria-pressed. */
function ChoiceCards({ name, type, options, selected }: { name: string; type: "checkbox" | "radio"; options: { value: string; label: string; hint: string }[]; selected: string[] }) {
  const [current, setCurrent] = useState<string[]>(selected);
  const toggle = (v: string) => setCurrent((c) => (type === "radio" ? [v] : c.includes(v) ? c.filter((x) => x !== v) : [...c, v]));
  return (
    <div className="grid-2">
      {options.map((o) => {
        const on = current.includes(o.value);
        return (
          <label key={o.value} className="choice" aria-pressed={on}>
            <input type={type} name={name} value={o.value} checked={on} onChange={() => toggle(o.value)} className="sr-input" />
            <b>{o.label}</b>
            <span>{o.hint}</span>
          </label>
        );
      })}
    </div>
  );
}

/** Contador −/+ con el valor en un campo oculto. */
function Counter({ name, label, value, min, max = 30 }: { name: string; label: string; value: number | null; min: number; max?: number }) {
  const [n, setN] = useState<number | null>(value);
  const current = n ?? min;
  return (
    <div className="counter">
      <span className="strong">{label}</span>
      <div className="ctl">
        <button type="button" className="minus" aria-label={`Menos ${label.toLowerCase()}`} onClick={() => setN(Math.max(min, current - 1))} disabled={current <= min}>
          −
        </button>
        <b aria-live="polite">{n === null ? "–" : n}</b>
        <button type="button" className="plus" aria-label={`Más ${label.toLowerCase()}`} onClick={() => setN(n === null ? Math.max(min, 1) : Math.min(max, current + 1))}>
          +
        </button>
      </div>
      <input type="hidden" name={name} value={n === null ? "" : n} />
    </div>
  );
}

/** Chips de características; al marcar Parqueo aparece «Tipo de parqueo». */
function FeatureChips({ selected, parkingPaid }: { selected: Feature[]; parkingPaid: boolean | null }) {
  const [on, setOn] = useState<Feature[]>(selected);
  const toggle = (f: Feature) => setOn((c) => (c.includes(f) ? c.filter((x) => x !== f) : [...c, f]));
  return (
    <div className="stack gap-8">
      <div className="row wrap gap-8">
        {FEATURES.map(([key, label]) => (
          <label key={key} className="chip" aria-pressed={on.includes(key)}>
            <input type="checkbox" name="features" value={key} checked={on.includes(key)} onChange={() => toggle(key)} className="sr-input" />
            {label}
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
function BathroomChoice({ shared }: { shared: boolean | null }) {
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

/** Paso del precio: «¿Acepta alquiler por meses?» No (por defecto) / Sí; con Sí, «Precio al mes (opcional)». Volver a No vacía el campo. */
function MonthlyQuestion({ accepts, price }: { accepts: boolean; price: number | null }) {
  const [yes, setYes] = useState(accepts);
  const [text, setText] = useState(price === null ? "" : String(price));
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
          <span id="pub-monthlyPriceCrc-help" className="xs muted">
            Si lo deja vacío, en su ficha dirá «Precio a negociar con el dueño».
          </span>
        </div>
      ) : null}
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

/** Nombre de la casa (5 a 60 caracteres) con contador. */
function TitleField({ value }: { value: string }) {
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

/** Descripción (80 a 2000 caracteres) con contador; el área crece hasta llenar lo que queda de pantalla. */
function DescriptionField({ value }: { value: string }) {
  const [n, setN] = useState(charCount(value));
  return (
    <div className="field grow-col">
      <div className="row between baseline">
        <label htmlFor="pub-description">Descripción</label>
        {/* Por debajo del mínimo, cuántos faltan en ocre (revisión UX N3); después, el contador normal. */}
        {n < DESCRIPTION_MIN ? (
          <span id="pub-description-count" className="xs num description-short" aria-live="polite">
            {DESCRIPTION_MIN - n === 1 ? "Falta 1 carácter" : `Faltan ${DESCRIPTION_MIN - n} caracteres`}
          </span>
        ) : (
          <CharCount id="pub-description-count" n={n} min={DESCRIPTION_MIN} max={DESCRIPTION_MAX} />
        )}
      </div>
      {/* Tres preguntas guía que se van al escribir; sin texto de ejemplo, que acabaría copiado en todas las fichas. */}
      <textarea
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

/** Paso 9, «Revisar y enviar» (revisión UX C4, punto 5): lo escrito en cinco filas que llevan a su pantalla, lo que falta
 *  (las fotos), la vista previa de la ficha, el WhatsApp de la casa y la oferta. Cabe sin scroll en un teléfono pequeño. */
function SendSummary({ draft, listing, userId }: { draft: ListingDraft; listing: Listing; userId: string }) {
  const count = useQuery(offerTakenQuery);
  const account = useQuery({ ...accountQuery(userId), enabled: !!userId });
  const [preview, setPreview] = useState(false);
  const offer = count.data === undefined ? undefined : launchOffer(count.data);
  const fee = formatCRC(MONTHLY_FEE_CRC);
  const d = { ...draft, photoCount: listing.photoCount };
  const missing = MIN_PHOTOS - listing.photoCount;
  const prices = [
    d.nightlyPriceCrc ? `${formatCRC(d.nightlyPriceCrc)} / noche` : null,
    d.acceptsMonthly ? (d.monthlyPriceCrc ? `${formatCRC(d.monthlyPriceCrc)} / mes` : "mensual a negociar") : null,
  ].filter(Boolean);
  const rows: { step: Step; label: string; value: string; warn?: string }[] = [
    { step: 1, label: "Alojamiento", value: d.kind ? KIND_LABELS[d.kind] : "Falta elegir" },
    { step: 2, label: "Dónde", value: (d.lat !== null && d.zoneSource ? locationLine(d) : "") || "Falta la ubicación" },
    { step: 4, label: "Capacidad", value: d.capacity ? `${d.capacity} pers. · ${d.bedrooms ?? 0} hab. · ${d.bathrooms ?? 0} ${d.bathrooms === 1 ? "baño" : "baños"}` : "Falta indicarla" },
    {
      step: missing > 0 ? 7 : 6,
      label: "Nombre y fotos",
      value: `${d.title.trim() || "Sin nombre"} · ${listing.photoCount} ${listing.photoCount === 1 ? "foto" : "fotos"}`,
      warn: missing > 0 ? missingPhotosLabel(missing) : undefined,
    },
    { step: 8, label: "Precio", value: prices.join(" · ") || "Falta el precio" },
  ];
  return (
    <>
      <h2>Revisar y enviar</h2>
      <nav className="card review-list" aria-label="Lo que va a enviar">
        {rows.map((r) => (
          <Link key={r.label} to="/propietario/publicar/$id/$paso" params={{ id: listing.id, paso: String(r.step) }} className="review-row">
            <span className="review-label">{r.label}</span>
            <span className="review-value">
              <span className="review-text">{r.value}</span>
              {r.warn ? <b className="review-warn">{r.warn}</b> : null}
            </span>
            <I.chevron size={16} />
          </Link>
        ))}
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

/** Lo que pide el asistente (revisión UX C4): las fotos son lo que más frena. */
export function ReadyList() {
  return (
    <ul className="ready-list small">
      <li>5 fotos horizontales o más</li>
      <li>El precio por noche</li>
      <li>Unos 10 minutos</li>
    </ul>
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
          <section className="stack">
            <h2>¿Qué es?</h2>
            <ChoiceCards
              name="kind"
              type="radio"
              selected={draft.kind === "habitacion" ? ["habitacion"] : draft.kind ? ["completo"] : []}
              options={[
                { value: "completo", label: KIND_LABELS.completo, hint: KIND_HINTS.completo },
                { value: "habitacion", label: KIND_LABELS.habitacion, hint: KIND_HINTS.habitacion },
              ]}
            />
          </section>
          <span className="small muted">Guardamos el borrador en cada paso; puede seguir después desde Mis casas.</span>
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
          <div className="card counters">
            <Counter name="capacity" label="Personas" value={draft.capacity} min={1} />
            <Counter name="bedrooms" label="Habitaciones" value={draft.bedrooms} min={draft.kind === "habitacion" ? 1 : 0} />
            <Counter name="bathrooms" label="Baños" value={draft.bathrooms} min={1} />
          </div>
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
    case 9:
      return <SendSummary draft={draft} listing={listing} userId={userId} />;
  }
}
