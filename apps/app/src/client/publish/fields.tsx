// Campos de cada pantalla del asistente (decisión 2026-10-21: nueve pantallas cortas, sin scroll en 375×667).
// Casillas y contadores llevan su valor en el formulario (campos ocultos o casillas); el texto va sin controlar.
import { zoneCenter } from "../../domain/zones";
import { ZoneField } from "./zone-field";
import { rememberedZone } from "./zone-center";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Link } from "@tanstack/react-router";
import { cantonesDe } from "../../domain/cantones";
import { charCount, DESCRIPTION_MAX, DESCRIPTION_MIN, FEATURES, KIND_HINTS, KIND_LABELS, MIN_PHOTOS, PROVINCES, TITLE_MAX, TITLE_MIN, missingPhotosLabel, modesLabel, type Feature, type Listing, type ListingDraft, type Step } from "../../domain/listing";
import { previewListing } from "../../domain/preview";
import { ListingPage } from "../../shared/listing-page";
import { accountQuery } from "../account";
import { formatCRC } from "../../domain/money";
import { MONTHLY_FEE_CRC, launchOffer } from "../../domain/offer";
import { formatPhone } from "../../domain/phone";
import { I } from "../../shared/icons";
import { activeCountQuery } from "../owner";
import { LocationPicker } from "./location-picker";
import { PhotoUploader } from "./photos";

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
        <CharCount id="pub-description-count" n={n} min={DESCRIPTION_MIN} max={DESCRIPTION_MAX} hint={`mínimo ${DESCRIPTION_MIN}`} />
      </div>
      <textarea id="pub-description" name="description" rows={3} maxLength={DESCRIPTION_MAX} defaultValue={value} aria-describedby="pub-description-count" onChange={(e) => setN(charCount(e.currentTarget.value))} />
    </div>
  );
}

/** Provincia y cantón de lista (cambiar la provincia vacía el cantón) y la zona con sugerencias (ticket 22). */
function PlaceFields({ listingId, province: initialProvince, canton: initialCanton, zone }: { listingId: string; province: string; canton: string; zone: string }) {
  const [province, setProvince] = useState(initialProvince);
  const [canton, setCanton] = useState(cantonesDe(initialProvince).includes(initialCanton) ? initialCanton : "");
  return (
    <>
      <div className="field">
        <label htmlFor="pub-province">Provincia</label>
        <select
          id="pub-province"
          name="province"
          value={province}
          onChange={(e) => {
            setProvince(e.currentTarget.value);
            setCanton("");
          }}
        >
          {PROVINCES.map((p) => (
            <option key={p} value={p}>
              {p}
            </option>
          ))}
        </select>
      </div>
      <div className="field">
        <label htmlFor="pub-canton">Cantón</label>
        <select id="pub-canton" name="canton" value={canton} onChange={(e) => setCanton(e.currentTarget.value)}>
          <option value="">Seleccione el cantón</option>
          {cantonesDe(province).map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <ZoneField listingId={listingId} province={province} canton={canton} initial={zone} />
    </>
  );
}

/** Paso 9, «Revisar y enviar» (revisión UX C4, punto 5): lo escrito en cinco filas que llevan a su pantalla, lo que falta
 *  (las fotos), la vista previa de la ficha, el WhatsApp de la casa y la oferta. Cabe sin scroll en un teléfono pequeño. */
function SendSummary({ draft, listing, userId }: { draft: ListingDraft; listing: Listing; userId: string }) {
  const count = useQuery(activeCountQuery);
  const account = useQuery({ ...accountQuery(userId), enabled: !!userId });
  const [preview, setPreview] = useState(false);
  const offer = count.data === undefined ? undefined : launchOffer(count.data);
  const fee = formatCRC(MONTHLY_FEE_CRC);
  const d = { ...draft, photoCount: listing.photoCount };
  const missing = MIN_PHOTOS - listing.photoCount;
  const prices = [
    d.acceptsNightly && d.nightlyPriceCrc ? `${formatCRC(d.nightlyPriceCrc)} / noche` : null,
    d.acceptsMonthly && d.monthlyPriceCrc ? `${formatCRC(d.monthlyPriceCrc)} / mes` : null,
  ].filter(Boolean);
  const rows: { step: Step; label: string; value: string; warn?: string }[] = [
    { step: 1, label: "Alojamiento", value: [d.kind ? KIND_LABELS[d.kind] : null, modesLabel({ acceptsNightly: d.acceptsNightly, acceptsMonthly: d.acceptsMonthly })].filter(Boolean).join(" · ") || "Falta elegir" },
    { step: 2, label: "Dónde", value: [d.zone, d.canton].filter(Boolean).join(", ") || "Falta la zona" },
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

/** Campos de cada pantalla. `draft` trae los valores a mostrar; `listing`, lo que solo da el servidor (fotos, WhatsApp). */
export function StepFields({ step, draft, listing, userId }: { step: Step; draft: ListingDraft; listing: Listing; userId: string }) {
  switch (step) {
    case 1:
      return (
        <>
          <section className="stack">
            <h2>¿Cómo alquila?</h2>
            <ChoiceCards
              name="modes"
              type="checkbox"
              selected={[draft.acceptsNightly ? "nightly" : "", draft.acceptsMonthly ? "monthly" : ""].filter(Boolean)}
              options={[
                { value: "nightly", label: "Vacacional", hint: "Por noche. Fines de semana, temporada." },
                { value: "monthly", label: "Mensual", hint: "Por mes. Para vivir una temporada." },
              ]}
            />
            <span className="small muted">Puede marcar las dos.</span>
          </section>
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
          <h2>¿Dónde está?</h2>
          <PlaceFields listingId={listing.id} province={draft.province} canton={draft.canton} zone={draft.zone} />
        </>
      );
    case 3:
      return (
        <>
          <h2>Ubicación en el mapa</h2>
          <LocationPicker province={draft.province} lat={draft.lat} lng={draft.lng} zone={zoneCenter(draft.zone, rememberedZone(listing.id))} />
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
          <PhotoUploader listing={listing} userId={userId} />
          <span className="xs muted">Toque una foto para moverla o hacerla portada; la primera es la portada. Horizontales, sin teléfonos ni marcas de agua.</span>
        </>
      );
    case 8:
      return (
        <>
          <h2>Precio</h2>
          {draft.acceptsNightly ? (
            <div className="field">
              <label htmlFor="pub-nightlyPriceCrc">Por noche</label>
              <div className="input-money">
                <span className="cur">₡</span>
                <input id="pub-nightlyPriceCrc" name="nightlyPriceCrc" inputMode="numeric" autoComplete="off" defaultValue={draft.nightlyPriceCrc ?? ""} placeholder="95 000" />
              </div>
            </div>
          ) : null}
          {draft.acceptsMonthly ? (
            <div className="field">
              <label htmlFor="pub-monthlyPriceCrc">Por mes</label>
              <div className="input-money">
                <span className="cur">₡</span>
                <input id="pub-monthlyPriceCrc" name="monthlyPriceCrc" inputMode="numeric" autoComplete="off" defaultValue={draft.monthlyPriceCrc ?? ""} placeholder="480 000" />
              </div>
            </div>
          ) : null}
          <span className="small muted">En colones; el cliente puede verlo en dólares. El precio final lo acuerda por WhatsApp.</span>
        </>
      );
    case 9:
      return <SendSummary draft={draft} listing={listing} userId={userId} />;
  }
}
