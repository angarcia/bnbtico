import { Link } from "@tanstack/react-router";
import { I } from "../../shared/icons";
import { FlowHeader } from "../chrome";
import { useListingsCount } from "../own-listings-query";
import { SUPPORT, waLink } from "../support";

// ---------- /cuenta/recuperar ----------
export function RecuperarScreen() {
  return (
    <>
      <FlowHeader title="Recuperar mi cuenta" back="/cuenta" historyBack />
      <section className="card stack gap-14">
        <p>Use el correo que añadió y confirmó en su perfil. Después podrá verificar su nuevo WhatsApp para recuperar el acceso.</p>
        <div className="field">
          <label htmlFor="recovery-email">Correo confirmado</label>
          <input id="recovery-email" type="email" placeholder="nombre@ejemplo.com" disabled />
        </div>
        <button className="btn btn-primary btn-lg" type="button" disabled>
          Recuperar con mi correo
        </button>
        <p className="xs muted">La recuperación por correo se activa cuando confirme uno en su perfil.</p>
      </section>
      <section className="card stack">
        <h3>¿No tiene un correo confirmado?</h3>
        <p className="small">Pida ayuda a bnbtico para revisar la recuperación. Indicar su nombre y otro número no basta para recuperar una cuenta. No mande documentos ni códigos por este formulario.</p>
        <Link to="/ayuda" className="btn btn-wa">
          <I.wa size={20} /> Escribir a bnbtico por WhatsApp
        </Link>
      </section>
    </>
  );
}

// ---------- /ayuda ----------
export function AyudaScreen() {
  const s = SUPPORT[(useListingsCount().count ?? 0) > 0 ? "owner" : "guest"];
  return (
    <>
      <FlowHeader title="Ayuda por WhatsApp" back="/cuenta" historyBack />
      <section className="card stack gap-14">
        <span className="eyebrow">{s.label}</span>
        <p>{s.intro}</p>
        {s.number ? (
          <>
            <p className="small muted">
              <span className="num">{s.number}</span> · canal separado del de {s.other}.
            </p>
            <a className="btn btn-wa" href={waLink(s.number, s.greeting)} target="_blank" rel="noopener">
              <I.wa size={20} /> Abrir WhatsApp
            </a>
          </>
        ) : (
          <>
            <p className="small muted">Número pendiente de configurar. Canal separado del de {s.other}.</p>
            <button className="btn btn-wa" type="button" disabled>
              <I.wa size={20} /> Abrir WhatsApp
            </button>
          </>
        )}
      </section>
    </>
  );
}
