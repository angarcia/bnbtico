// La descripción entera a pantalla completa (`FullScreen`, shared/overlay.tsx), desde «Ver más» de la ficha. Trozo diferido
// (historia 07, paso 3): con él va la pila de superficies, que así no entra en el JS inicial; se pide en reposo tras hidratar
// la ficha y al apuntar o tocar «Ver más».
import { I } from "./icons";
import { FullScreen } from "./overlay";
import { IconButton } from "./button";

export function DescriptionScreen({ paragraphs, onClose }: { paragraphs: string[]; onClose: () => void }) {
  return (
    <FullScreen layout="description" onClose={onClose}>
      {({ titleId, close }) => (
        <>
          <div className="description-screen-head">
            <IconButton label="Cerrar" onClick={close}>
              <I.back />
            </IconButton>
          </div>
          <h2 id={titleId}>Descripción</h2>
          <div className="listing-description">
            {paragraphs.map((p, i) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        </>
      )}
    </FullScreen>
  );
}
