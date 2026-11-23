// La descripción entera a pantalla completa (`FullScreen`, shared/overlay.tsx), desde «Ver más» de la ficha. Trozo diferido
// (historia 07, paso 3): con él va la pila de superficies, que así no entra en el JS inicial; se pide en reposo tras hidratar
// la ficha y al apuntar o tocar «Ver más».
import { I } from "./ui/icons";
import { FullScreen } from "./ui/overlay";
import { IconButton } from "./ui/button";
import * as LISTING_PARTS_COPY from "./copy/listing-parts";

export function DescriptionScreen({ paragraphs, onClose }: { paragraphs: string[]; onClose: () => void }) {
  return (
    <FullScreen layout="description" onClose={onClose}>
      {({ titleId, close }) => (
        <>
          <div className="description-screen-head">
            <IconButton label={LISTING_PARTS_COPY.close} onClick={close}>
              <I.back />
            </IconButton>
          </div>
          <h2 id={titleId}>{LISTING_PARTS_COPY.description}</h2>
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
