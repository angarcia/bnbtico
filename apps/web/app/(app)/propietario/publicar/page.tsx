import { createDraftAction, resumeDraftAction } from "@/actions/listings";
import { FlowHeader } from "@/components/shell";
import { findResumableDraft } from "@/lib/listings/repo";
import { requireOwnerSession } from "@/lib/listings/session";

export const metadata = { title: "Publicar casa" };

/** Entrada al formulario. Abrir esta página no crea nada: el borrador nace al pulsar un botón (POST). */
export default async function Publicar() {
  const { db } = await requireOwnerSession("/propietario/publicar");
  const draft = await findResumableDraft(db);
  return (
    <>
      <FlowHeader title="Publicar casa" back="/propietario" />
      {draft ? (
        <section className="card stack" style={{ gap: 12 }}>
          <h3>Tiene un borrador sin enviar</h3>
          <p className="small muted">{draft.title ? `«${draft.title}»` : "Sin nombre todavía"} · empezado el {new Date(draft.createdAt).toLocaleDateString("es-CR", { day: "numeric", month: "long" })}.</p>
          <form action={resumeDraftAction}>
            <button className="btn btn-primary btn-lg btn-block" type="submit">Seguir con el borrador</button>
          </form>
          <form action={createDraftAction}>
            <input type="hidden" name="force" value="1" />
            <button className="btn btn-ghost btn-block" type="submit">Empezar otro</button>
          </form>
        </section>
      ) : (
        <section className="card stack" style={{ gap: 12 }}>
          <h3>Publique su casa en cinco pasos</h3>
          <p className="small muted">Alojamiento, ubicación, detalles, fotos y precio. Guardamos el borrador en cada paso; puede salir y seguir después.</p>
          <form action={createDraftAction}>
            <button className="btn btn-primary btn-lg btn-block" type="submit">Empezar</button>
          </form>
        </section>
      )}
    </>
  );
}
