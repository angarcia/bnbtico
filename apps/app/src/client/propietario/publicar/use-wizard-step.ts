// Efectos de cada pantalla del asistente de publicar: con qué dirección entra, el evento de qué pantalla se abre y las
// fotos del servidor al llegar a su paso.
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import type { Step } from "../../../domain/listing";
import { track } from "../../../shared/beacon";
import { ownListingKey } from "../../comun/listing-keys";
import { stepEnter } from "../../comun/motion";

/**
 * Dirección del cambio de pantalla: la nueva entra desde la derecha al avanzar y desde la izquierda al volver. Al corregir
 * desde «Revisar y enviar», el resumen queda detrás: abrir el paso avanza y volver a él retrocede. `order`: el orden de las
 * pantallas cuando se agrupan (escritorio); sin él, el de los pasos.
 */
export function useStepEnter(step: Step | null, volver: boolean, order?: readonly Step[]) {
  const previous = useRef<{ step: Step | null; volver: boolean }>({ step: null, volver: false });
  const previousStep = previous.current.step;
  const returningFromReview = volver || previous.current.volver;
  const enter = order && step !== null && previousStep !== null && step !== previousStep && !returningFromReview
    ? (order.indexOf(step) > order.indexOf(previousStep) ? "forward" : "back")
    : stepEnter(previousStep, step, returningFromReview);
  useEffect(() => {
    previous.current = { step, volver };
  }, [step, volver]);
  return enter;
}

/** Qué pantalla se abre (revisión UX C4), para ver dónde se abandona; una vez por paso. Con la casa, cuando llega su
 *  publicId; sin cuenta (`"telefono"`, pasos 2–6 en el teléfono), al abrirlo y sin casa (ruta /publicar/nueva/:id/:paso). */
export function useTrackWizardStep(step: Step | null, publicId: string | undefined) {
  useEffect(() => {
    if (step && publicId) track("wizard_step", publicId === "telefono" ? undefined : publicId);
  }, [step, publicId]);
}

/** Fotos: siempre las del servidor al llegar a esa pantalla (la lectura espera a los guardados en curso). */
export function useFreshPhotosOnStep(step: Step | null, userId: string, id: string) {
  const client = useQueryClient();
  useEffect(() => {
    if (step === 7) void client.invalidateQueries({ queryKey: ownListingKey(userId, id) });
  }, [step, client, userId, id]);
}
