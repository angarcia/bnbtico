import { formatPhone } from "@/lib/phone";
import { KIND_HINTS, KIND_LABELS, PROVINCES, type Listing, type Step } from "@/lib/listings/schema";
import { BathroomChoice, ChoiceCards, Counter, DescriptionField, FeatureChips } from "./fields-client";
import { LocationPicker } from "./location-picker";
import { PhotoUploader } from "./photo-uploader";

/** Campos de cada paso (pantallas 11–15 del diseño v1). */
export function StepFields({ step, draft }: { step: Step; draft: Listing }) {
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
            <span className="small muted">Puede marcar las dos si acepta ambas.</span>
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
            <span className="small muted">Si es una habitación, en el siguiente paso le preguntamos si el baño es privado o compartido.</span>
          </section>
          <div className="note small">Guardamos el borrador en cada paso. Puede salir y seguir después desde Mis casas.</div>
        </>
      );
    case 2:
      return (
        <>
          <h2>¿Dónde está?</h2>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="pub-province">Provincia</label>
              <select id="pub-province" name="province" defaultValue={draft.province}>
                {PROVINCES.map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div className="field">
              <label htmlFor="pub-canton">Cantón</label>
              <input id="pub-canton" name="canton" maxLength={80} defaultValue={draft.canton} autoComplete="off" />
            </div>
          </div>
          <div className="field">
            <label htmlFor="pub-zone">Zona, playa o barrio</label>
            <input id="pub-zone" name="zone" maxLength={120} defaultValue={draft.zone} autoComplete="off" placeholder="Playa Negra, Puerto Viejo" />
          </div>
          <LocationPicker province={draft.province} lat={draft.lat} lng={draft.lng} />
        </>
      );
    case 3:
      return (
        <>
          <h2>Detalles del alojamiento</h2>
          <div className="card" style={{ padding: 0, borderRadius: 20 }}>
            <Counter name="capacity" label="Personas" value={draft.capacity} min={1} />
            <Counter name="bedrooms" label="Habitaciones" value={draft.bedrooms} min={draft.kind === "habitacion" ? 1 : 0} />
            <Counter name="bathrooms" label="Baños" value={draft.bathrooms} min={1} />
          </div>
          {draft.kind === "habitacion" ? <BathroomChoice shared={draft.bathroomShared} /> : null}
          <div className="stack" style={{ gap: 8 }}>
            <span className="eyebrow" style={{ textTransform: "none", letterSpacing: 0, fontSize: 12 }}>Características</span>
            <FeatureChips selected={draft.features} parkingPaid={draft.parkingPaid} />
          </div>
          <div className="field">
            <label htmlFor="pub-title">Nombre de la casa</label>
            <input id="pub-title" name="title" maxLength={100} defaultValue={draft.title} placeholder="Casa Manzanillo, a pie de playa" />
          </div>
          <DescriptionField value={draft.description} />
          <span className="xs muted">Sin enlaces, teléfonos ni publicidad de agencias. El contenido se revisa antes de publicar.</span>
        </>
      );
    case 4:
      return (
        <>
          <PhotoUploader listingId={draft.id} photos={draft.photos} />
          <div className="stack small muted" style={{ gap: 6 }}>
            <span>La primera foto es la portada; con «Hacer portada» puede cambiarla.</span>
            <span>Horizontales, sin marcas de agua ni teléfonos: las fotos con números o enlaces se rechazan en la revisión. Las reducimos a 1600 px al subirlas.</span>
          </div>
        </>
      );
    case 5:
      return (
        <>
          {draft.acceptsNightly ? (
            <section className="stack">
              <h2>Precio por noche</h2>
              <div className="field">
                <label htmlFor="pub-nightlyPriceCrc">Por noche</label>
                <div className="input-money">
                  <span className="cur">₡</span>
                  <input id="pub-nightlyPriceCrc" name="nightlyPriceCrc" inputMode="numeric" defaultValue={draft.nightlyPriceCrc ?? ""} placeholder="95 000" />
                </div>
              </div>
              <span className="small muted">En colones; el cliente puede verlo en dólares. El precio final lo acuerda por WhatsApp. Si alguna fecha vale distinto, la cambia después en el calendario.</span>
            </section>
          ) : null}
          {draft.acceptsMonthly ? (
            <section className="stack">
              <h2>Precio por mes</h2>
              <div className="field">
                <label htmlFor="pub-monthlyPriceCrc">Por mes</label>
                <div className="input-money">
                  <span className="cur">₡</span>
                  <input id="pub-monthlyPriceCrc" name="monthlyPriceCrc" inputMode="numeric" defaultValue={draft.monthlyPriceCrc ?? ""} placeholder="480 000" />
                </div>
              </div>
              <span className="small muted">En colones. El precio final y la duración los acuerda por WhatsApp.</span>
            </section>
          ) : null}
          <section className="stack">
            <h2 style={{ fontSize: 18 }}>WhatsApp de esta casa</h2>
            <div className="card row" style={{ gap: 12, padding: "12px 14px", borderRadius: 16 }}>
              <span className="avatar avatar-sm"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 5 5L20 7" /></svg></span>
              <span className="stack" style={{ gap: 0, flex: 1 }}>
                <b className="num">{formatPhone(draft.whatsappPhone)}</b>
                <span className="xs primary" style={{ fontWeight: 600 }}>Verificado · el de su cuenta</span>
              </span>
            </div>
            <span className="small muted">Los clientes verificados le escriben a este número desde la ficha. No se muestra públicamente.</span>
          </section>
          <section className="card-arena stack" style={{ gap: 8 }}>
            <div className="row between" style={{ alignItems: "baseline" }}>
              <b>{draft.title || "Su casa"}</b>
              <b className="num primary">₡0 · 12 meses</b>
            </div>
            <span className="small">Si está entre las primeras 50 casas, gratis 12 meses desde que se apruebe. Después, ₡9 900 al mes, sin permanencia. No pedimos tarjeta ahora.</span>
          </section>
        </>
      );
  }
}
