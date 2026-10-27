import { formatPhone } from "@/lib/phone";
import { KIND_HINTS, KIND_LABELS, type Listing, type Step } from "@/lib/listings/schema";
import { BathroomChoice, ChoiceCards, Counter, DescriptionField, FeatureChips } from "./fields-client";
import { LocationPicker } from "./location-picker";
import { PhotoUploader } from "./photo-uploader";
import { PlaceFields } from "./place-fields";

/** Campos de cada pantalla (diseño v1, punto 11, en 9 pantallas cortas sin scroll). */
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
          <PlaceFields province={draft.province} canton={draft.canton} zone={draft.zone} />
        </>
      );
    case 3:
      return (
        <>
          <h2>Ubicación en el mapa</h2>
          <LocationPicker province={draft.province} lat={draft.lat} lng={draft.lng} />
        </>
      );
    case 4:
      return (
        <>
          <h2>¿Cuántos caben?</h2>
          <div className="card" style={{ padding: 0, borderRadius: 20 }}>
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
          <div className="field">
            <label htmlFor="pub-title">Nombre de la casa</label>
            <input id="pub-title" name="title" maxLength={100} defaultValue={draft.title} placeholder="Casa Manzanillo, a pie de playa" />
          </div>
          <DescriptionField value={draft.description} />
          <span className="xs muted">Sin enlaces, teléfonos ni publicidad. Se revisa antes de publicar.</span>
        </>
      );
    case 7:
      return (
        <>
          <PhotoUploader listingId={draft.id} photos={draft.photos} />
          <span className="xs muted">La primera es la portada. Horizontales, sin teléfonos ni marcas de agua; las reducimos a 1600 px.</span>
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
                <input id="pub-nightlyPriceCrc" name="nightlyPriceCrc" inputMode="numeric" defaultValue={draft.nightlyPriceCrc ?? ""} placeholder="95 000" />
              </div>
            </div>
          ) : null}
          {draft.acceptsMonthly ? (
            <div className="field">
              <label htmlFor="pub-monthlyPriceCrc">Por mes</label>
              <div className="input-money">
                <span className="cur">₡</span>
                <input id="pub-monthlyPriceCrc" name="monthlyPriceCrc" inputMode="numeric" defaultValue={draft.monthlyPriceCrc ?? ""} placeholder="480 000" />
              </div>
            </div>
          ) : null}
          <span className="small muted">En colones, orientativo; el cliente puede verlo en dólares. El precio final lo acuerda por WhatsApp.</span>
        </>
      );
    case 9:
      return (
        <>
          <h2>Enviar a revisión</h2>
          <section className="stack" style={{ gap: 8 }}>
            <span className="eyebrow" style={{ textTransform: "none", letterSpacing: 0, fontSize: 12 }}>WhatsApp de esta casa</span>
            <div className="card row" style={{ gap: 12, padding: "12px 14px", borderRadius: 16 }}>
              <span className="avatar avatar-sm"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2"><path d="m5 12 5 5L20 7" /></svg></span>
              <span className="stack" style={{ gap: 0, flex: 1 }}>
                <b className="num">{formatPhone(draft.whatsappPhone)}</b>
                <span className="xs primary" style={{ fontWeight: 600 }}>Verificado · el de su cuenta</span>
              </span>
            </div>
            <span className="small muted">Los clientes verificados le escriben aquí desde la ficha. No se muestra públicamente.</span>
          </section>
          <section className="card-arena stack" style={{ gap: 8 }}>
            <div className="row between" style={{ alignItems: "baseline" }}>
              <b>{draft.title || "Su casa"}</b>
              <b className="num primary">₡0 · 12 meses</b>
            </div>
            <span className="small">Si está entre las primeras 50 casas, gratis 12 meses desde que se apruebe. Después, ₡2 900 al mes, sin permanencia. No pedimos tarjeta ahora.</span>
          </section>
          <span className="small muted">Revisamos el anuncio y le avisamos por WhatsApp.</span>
        </>
      );
  }
}
