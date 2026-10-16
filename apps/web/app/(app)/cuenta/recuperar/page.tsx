import Link from "next/link";
import { I } from "@/components/icons";
import { ScreenTitle } from "@/components/shell";

export const metadata = { title: "Recuperar mi cuenta" };

export default function Recuperar() {
  return (
    <>
      <ScreenTitle title="Recuperar mi cuenta" back="/cuenta" />
      <section className="card stack">
        <p>Usá el correo que añadiste y confirmaste en tu perfil. Después podrás verificar tu nuevo WhatsApp para recuperar el acceso.</p>
        <label htmlFor="recovery-email">Correo confirmado</label>
        <input id="recovery-email" type="email" placeholder="nombre@ejemplo.com" disabled />
        <button className="btn btn-primary" type="button" disabled>Recuperar con mi correo</button>
        <p className="xs muted">La recuperación por correo se activa cuando confirmes uno en tu perfil.</p>
      </section>
      <section className="card stack">
        <h3>¿No tenés un correo confirmado?</h3>
        <p className="small">Pedí ayuda a bnbtico para revisar la recuperación. Indicar tu nombre y otro número no basta para recuperar una cuenta. No mandés documentos ni códigos por este formulario.</p>
        <Link href="/ayuda" className="btn btn-wa"><I.wa size={20} /> Escribile a bnbtico por WhatsApp</Link>
      </section>
    </>
  );
}
