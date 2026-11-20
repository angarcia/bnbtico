// Descripción de la ficha (como en Airbnb): en párrafos y, si es larga, recortada a 8 líneas con «Ver más», que abre la
// descripción entera a pantalla completa. Atrás (la flecha, Escape o el botón atrás del teléfono) la cierra y deja la ficha
// donde estaba. Antes de hidratar, «Ver más» es una caja del mismo tamaño que aún no responde.
import { lazy, Suspense, useEffect, useState } from "react";
import { descriptionParagraphs, isLongDescription } from "../domain/description";
import { Button, ButtonPlaceholder } from "./button";
import { whenIdle } from "./idle";

// La pantalla completa es un trozo aparte: se pide en reposo tras hidratar y al apuntar o tocar «Ver más».
const loadScreen = () => import("./description-screen");
const DescriptionScreen = lazy(() => loadScreen().then((m) => ({ default: m.DescriptionScreen })));

function Paragraphs({ paragraphs, className, testId }: { paragraphs: string[]; className: string; testId?: string }) {
  return (
    <div className={className} data-testid={testId}>
      {paragraphs.map((p, i) => (
        <p key={i}>{p}</p>
      ))}
    </div>
  );
}

export function ListingDescription({ text, hydrated }: { text: string; hydrated: boolean }) {
  const paragraphs = descriptionParagraphs(text);
  const long = isLongDescription(text);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (hydrated && long) whenIdle(() => void loadScreen().catch(() => {}));
  }, [hydrated, long]);
  if (!paragraphs.length) return null;
  return (
    <div className="stack description-block">
      <Paragraphs paragraphs={paragraphs} className={`listing-description${long ? " is-clamped" : ""}`} testId="listing-description" />
      {!long ? null : hydrated ? (
        <Button variant="primary" block aria-haspopup="dialog" aria-expanded={open} onPointerDown={() => void loadScreen().catch(() => {})} onClick={() => setOpen(true)}>
          Ver más
        </Button>
      ) : (
        <ButtonPlaceholder variant="primary" block aria-hidden="true">
          Ver más
        </ButtonPlaceholder>
      )}
      {open ? (
        <Suspense fallback={null}>
          <DescriptionScreen paragraphs={paragraphs} onClose={() => setOpen(false)} />
        </Suspense>
      ) : null}
    </div>
  );
}
