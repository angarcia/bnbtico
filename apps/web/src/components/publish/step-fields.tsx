import { formatPhone } from "@/lib/phone";
import { KINDS, KIND_LABELS, PROVINCES, type Listing, type Step } from "@/lib/listings/schema";
import { FeaturesField, MonthlyField } from "./fields-client";
import { LocationPicker } from "./location-picker";

const v = (n: number | null) => (n === null || Number.isNaN(n) ? "" : String(n));

/** Campos de cada paso, con el copy del prototipo (vista Móvil) y «mensual» en vez de «largo plazo». */
export function StepFields({ step, draft }: { step: Step; draft: Listing }) {
  switch (step) {
    case 1:
      return (
        <>
          <h3>Tu alojamiento vacacional</h3>
          <p className="small muted">Todos los anuncios son de alquiler vacacional. También podés aceptar alquiler mensual.</p>
          <div className="field">
            <label htmlFor="pub-kind">Tipo de alojamiento *</label>
            <select id="pub-kind" name="kind" defaultValue={draft.kind ?? ""}>
              <option value="">Seleccioná una opción</option>
              {KINDS.map((k) => (
                <option key={k} value={k}>{KIND_LABELS[k]}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pub-acceptsMonthly">¿Aceptás alquiler mensual? *</label>
            <select id="pub-acceptsMonthly" name="acceptsMonthly" defaultValue={draft.acceptsMonthly === null ? "" : draft.acceptsMonthly ? "yes" : "no"}>
              <option value="">Seleccioná una opción</option>
              <option value="yes">Sí</option>
              <option value="no">No</option>
            </select>
          </div>
          <p className="xs muted">Respondé Sí o No para continuar; no elegimos por vos.</p>
        </>
      );
    case 2:
      return (
        <>
          <h3>¿Dónde está?</h3>
          <div className="field">
            <label htmlFor="pub-province">Provincia *</label>
            <select id="pub-province" name="province" defaultValue={draft.province}>
              {PROVINCES.map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>
          <div className="field">
            <label htmlFor="pub-canton">Cantón *</label>
            <input id="pub-canton" name="canton" maxLength={80} defaultValue={draft.canton} autoComplete="off" />
          </div>
          <div className="field">
            <label htmlFor="pub-zone">Zona / playa / barrio *</label>
            <input id="pub-zone" name="zone" maxLength={120} defaultValue={draft.zone} autoComplete="off" />
          </div>
          <LocationPicker province={draft.province} lat={draft.lat} lng={draft.lng} />
          <p className="small muted">Solo ubicación aproximada. No incluyás la dirección exacta; la compartís directamente cuando lo decidás.</p>
        </>
      );
    case 3:
      return (
        <>
          <h3>Detalles del alojamiento</h3>
          <div className="field">
            <label htmlFor="pub-capacity">Máximo de personas *</label>
            <input id="pub-capacity" name="capacity" inputMode="numeric" defaultValue={v(draft.capacity)} />
          </div>
          <div className="field">
            <label htmlFor="pub-bedrooms">Número de habitaciones ofrecidas *</label>
            <input id="pub-bedrooms" name="bedrooms" inputMode="numeric" defaultValue={v(draft.bedrooms)} />
            <p className="xs muted">Contá solo las habitaciones que ofrecés. En apartamentos tipo estudio podés indicar 0.</p>
          </div>
          <div className="field">
            <label htmlFor="pub-bathrooms">Número de baños disponibles *</label>
            <input id="pub-bathrooms" name="bathrooms" inputMode="numeric" defaultValue={v(draft.bathrooms)} />
          </div>
          <FeaturesField selected={draft.features} parkingPaid={draft.parkingPaid} />
          <div className="field">
            <label htmlFor="pub-title">Título *</label>
            <input id="pub-title" name="title" maxLength={100} defaultValue={draft.title} />
          </div>
          <div className="field">
            <label htmlFor="pub-description">Descripción *</label>
            <textarea id="pub-description" name="description" rows={4} maxLength={3000} defaultValue={draft.description} />
          </div>
          <p className="xs muted">Sin enlaces, teléfonos ni publicidad de agencias. El contenido se revisa antes de publicar.</p>
        </>
      );
    case 4:
      return (
        <>
          <h3>Fotos del alojamiento</h3>
          <p className="small">Mínimo 5 fotos, con una portada. Sin teléfonos, enlaces ni publicidad de agencias.</p>
          <div className="note">Las fotos llegan en el siguiente paso del plan.</div>
          <input type="hidden" name="photoCount" value={draft.photoCount} />
        </>
      );
    case 5:
      return (
        <>
          <h3>Precio orientativo</h3>
          <div className="field">
            <label htmlFor="pub-nightlyPriceCrc">Precio por noche (₡) *</label>
            <input id="pub-nightlyPriceCrc" name="nightlyPriceCrc" inputMode="numeric" defaultValue={v(draft.nightlyPriceCrc)} />
          </div>
          <p className="small muted">Los precios se ingresan en colones (₡). Los clientes pueden verlos convertidos a dólares solo como referencia.</p>
          <div className="field">
            <label htmlFor="pub-minNights">Estancia mínima (noches) *</label>
            <input id="pub-minNights" name="minNights" inputMode="numeric" defaultValue={v(draft.minNights)} />
          </div>
          {draft.acceptsMonthly ? <MonthlyField mode={draft.monthlyMode} priceCrc={draft.monthlyPriceCrc} minMonths={draft.minMonths} /> : null}
          <p className="xs muted">Precios orientativos. bnbtico no gestiona reservas ni pagos entre las partes.</p>
          <div className="card stack" style={{ boxShadow: "none" }}>
            <b>WhatsApp de tu cuenta</b>
            <span>{formatPhone(draft.whatsappPhone)}</span>
            <p className="small muted">Un único número para todos tus anuncios. No se muestra en la ficha pública.</p>
          </div>
        </>
      );
  }
}
