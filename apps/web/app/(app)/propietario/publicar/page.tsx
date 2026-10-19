import { createDraftAction, resumeDraftAction } from "@/actions/listings";
import { ScreenTitle } from "@/components/shell";
import { findResumableDraft } from "@/lib/listings/repo";
import { requireOwnerSession } from "@/lib/listings/session";

export const metadata = { title: "Publicar alojamiento" };

/** Entrada al formulario. Abrir esta página no crea nada: el borrador nace al pulsar un botón (POST). */
export default async function Publicar() {
  const { db } = await requireOwnerSession("/propietario/publicar");
  const draft = await findResumableDraft(db);
  return (
    <>
      <ScreenTitle title="Publicar alojamiento" back="/propietario" />
      {draft ? (
        <section className="card stack">
          <h3>Tenés un borrador sin enviar</h3>
          <p className="small">{draft.title ? `«${draft.title}»` : "Sin título todavía"} · empezado el {new Date(draft.createdAt).toLocaleDateString("es-CR", { day: "numeric", month: "long" })}.</p>
          <form action={resumeDraftAction}>
            <button className="btn btn-primary" style={{ width: "100%" }} type="submit">Seguir con el borrador</button>
          </form>
          <form action={createDraftAction}>
            <input type="hidden" name="force" value="1" />
            <button className="btn btn-ghost" style={{ width: "100%" }} type="submit">Empezar otro</button>
          </form>
        </section>
      ) : (
        <section className="card stack">
          <h3>Publicá tu casa en cinco pasos</h3>
          <p className="small">Alojamiento, ubicación, detalles, fotos y precio. Lo guardamos paso a paso; podés seguir después.</p>
          <form action={createDraftAction}>
            <button className="btn btn-primary" style={{ width: "100%" }} type="submit">Empezar</button>
          </form>
        </section>
      )}
    </>
  );
}
