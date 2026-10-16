import { I } from "@/components/icons";
import { ScreenTitle } from "@/components/shell";
import { currentRole } from "@/lib/role";
import { supportFor, waLink } from "@/lib/support";

export const metadata = { title: "Escribile a bnbtico" };

export default async function Ayuda() {
  const role = await currentRole();
  const s = supportFor(role);
  const text = role === "owner" ? "Hola, soy propietario en bnbtico y necesito ayuda con: " : "Hola, estoy buscando casa en bnbtico y necesito ayuda con: ";
  return (
    <>
      <ScreenTitle title="Escribile a bnbtico" back="/cuenta" />
      <section className="card stack">
        <span className="eyebrow">{s.label}</span>
        <p>{s.intro}</p>
        {s.number ? (
          <>
            <p className="small muted">{s.number} · canal separado del de {role === "owner" ? "buscadores" : "propietarios"}.</p>
            <a className="btn btn-wa" href={waLink(s.number, text)} target="_blank" rel="noopener"><I.wa size={20} /> Abrir WhatsApp</a>
          </>
        ) : (
          <>
            <p className="small muted">Número pendiente de configurar. Canal separado del de {role === "owner" ? "buscadores" : "propietarios"}.</p>
            <button className="btn btn-wa" type="button" disabled><I.wa size={20} /> Abrir WhatsApp</button>
          </>
        )}
      </section>
    </>
  );
}
