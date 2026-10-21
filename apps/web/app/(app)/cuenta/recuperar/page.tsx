import Link from "next/link";
import { I } from "@/components/icons";
import { FlowHeader } from "@/components/shell";

export const metadata = { title: "Recuperar mi cuenta" };

export default function Recuperar() {
  return (
    <>
      <FlowHeader title="Recuperar mi cuenta" back="/cuenta" />
      <section className="card stack" style={{ gap: 14 }}>
        <p>Use el correo que añadió y confirmó en su perfil. Después podrá verificar su nuevo WhatsApp para recuperar el acceso.</p>
        <div className="field">
          <label htmlFor="recovery-email">Correo confirmado</label>
          <input id="recovery-email" type="email" placeholder="nombre@ejemplo.com" disabled />
        </div>
        <button className="btn btn-primary btn-lg" type="button" disabled>Recuperar con mi correo</button>
        <p className="xs muted">La recuperación por correo se activa cuando confirme uno en su perfil.</p>
      </section>
      <section className="card stack">
        <h3>¿No tiene un correo confirmado?</h3>
        <p className="small">Pida ayuda a bnbtico para revisar la recuperación. Indicar su nombre y otro número no basta para recuperar una cuenta. No mande documentos ni códigos por este formulario.</p>
        <Link href="/ayuda" className="btn btn-wa"><I.wa size={20} /> Escribir a bnbtico por WhatsApp</Link>
      </section>
    </>
  );
}
