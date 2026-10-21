import Link from "next/link";
import { notFound } from "next/navigation";
import { I } from "@/components/icons";
import { getOwnListing } from "@/lib/listings/repo";
import { requireOwnerSession } from "@/lib/listings/session";

export const metadata = { title: "Su casa está en revisión" };

/** Pantalla 16: confirmación tras «Enviar a revisión», con los tres pasos que siguen. */
export default async function Enviada({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { db } = await requireOwnerSession(`/propietario/casas/${id}/enviada`);
  const l = await getOwnListing(db, id);
  if (!l) notFound();
  const cover = l.photos[0];
  return (
    <div className="stack center" style={{ gap: 18, alignItems: "center", paddingTop: 48 }}>
      <div className="photo" style={{ width: 132, height: 132, borderRadius: 999, position: "relative", overflow: "visible" }}>
        <div style={{ position: "absolute", inset: 0, borderRadius: 999, overflow: "hidden", background: "var(--state-soft)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {cover ? <img src={cover.url} alt="" /> : null}
        </div>
        <span style={{ position: "absolute", right: -2, bottom: -2, width: 44, height: 44, borderRadius: 999, background: "var(--primary)", border: "4px solid var(--bg)", color: "var(--primary-on)", display: "inline-flex", alignItems: "center", justifyContent: "center" }}><I.check size={22} /></span>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        <h1 style={{ fontSize: 30 }}>¡Listo! Su casa está en revisión</h1>
        <p className="muted">Revisamos {l.title} a mano, normalmente en menos de 24 horas. Le avisamos por WhatsApp cuando esté publicada.</p>
      </div>
      <div className="steps-list" style={{ width: "100%" }}>
        <div><span className="n done">1</span><span><b>Enviada</b><span style={{ display: "block" }} className="muted">Hoy · referencia <span className="num">{l.publicId}</span></span></span></div>
        <div><span className="n">2</span><span><b>La revisamos</b><span style={{ display: "block" }} className="muted">Si falta algo se lo decimos por WhatsApp y lo corrige desde Mis casas</span></span></div>
        <div><span className="n">3</span><span><b>Publicada y gratis 12 meses</b><span style={{ display: "block" }} className="muted">Comparte el enlace y los clientes le escriben por WhatsApp</span></span></div>
      </div>
      <div className="stack" style={{ width: "100%", gap: 10, paddingTop: 8 }}>
        <Link href="/propietario/calendario" className="btn btn-primary btn-lg">Marcar las noches ocupadas</Link>
        <Link href="/propietario/casas" className="btn-link" style={{ justifyContent: "center", width: "100%" }}>Ir a Mis casas</Link>
      </div>
    </div>
  );
}
