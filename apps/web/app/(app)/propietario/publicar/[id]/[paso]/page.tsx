import { notFound, redirect } from "next/navigation";
import { StepFields } from "@/components/publish/step-fields";
import { StepForm } from "@/components/publish/step-form";
import { ScreenTitle } from "@/components/shell";
import { getOwnListing } from "@/lib/listings/repo";
import { STEP_NAMES, type Step } from "@/lib/listings/schema";
import { requireOwnerSession } from "@/lib/listings/session";

export const metadata = { title: "Publicar alojamiento" };

export default async function PublicarPaso({ params }: { params: Promise<{ id: string; paso: string }> }) {
  const { id, paso } = await params;
  if (!/^[1-5]$/.test(paso)) notFound();
  const step = Number(paso) as Step;
  const { db } = await requireOwnerSession(`/propietario/publicar/${id}/${paso}`);
  const draft = await getOwnListing(db, id);
  if (!draft) notFound();
  if (draft.status !== "draft" && draft.status !== "changes") redirect(`/propietario/casas/${id}`);
  return (
    <>
      <ScreenTitle title="Publicar alojamiento" back="/propietario/casas" right={<span className="xs muted">Paso {step} de 5 · {STEP_NAMES[step - 1]}</span>} />
      <div className="steps" aria-hidden="true">
        {STEP_NAMES.map((name, i) => (
          <span key={name} className={i < step ? "on" : ""} />
        ))}
      </div>
      <StepForm listingId={draft.id} step={step}>
        <StepFields step={step} draft={draft} />
      </StepForm>
    </>
  );
}
