// Descripción de la ficha (como en Airbnb): en párrafos y, si es larga, recortada a 8 líneas con «Ver más», que abre la
// descripción entera a pantalla completa. Atrás (la flecha, Escape o el botón atrás del teléfono) la cierra y deja la ficha
// donde estaba. Antes de hidratar, «Ver más» es una caja del mismo tamaño que aún no responde.
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import { descriptionParagraphs, isLongDescription } from "../domain/description";
import { I } from "./icons";
import { useModal } from "./modal";

const STATE_KEY = "3bstaysDescripcion";

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
  const button = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef(false);
  useEffect(() => {
    if (open || !returnFocus.current) return;
    returnFocus.current = false;
    button.current?.focus();
  }, [open]);
  if (!paragraphs.length) return null;
  return (
    <div className="stack description-block">
      <Paragraphs paragraphs={paragraphs} className={`listing-description${long ? " is-clamped" : ""}`} testId="listing-description" />
      {!long ? null : hydrated ? (
        <button ref={button} type="button" className="btn btn-soft btn-more" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}>
          Ver más
        </button>
      ) : (
        <span className="btn btn-soft btn-more is-pending" aria-hidden="true">
          Ver más
        </span>
      )}
      {open ? (
        <DescriptionScreen
          paragraphs={paragraphs}
          onClose={() => {
            returnFocus.current = true;
            setOpen(false);
          }}
        />
      ) : null}
    </div>
  );
}

function DescriptionScreen({ paragraphs, onClose }: { paragraphs: string[]; onClose: () => void }) {
  const screen = useRef<HTMLElement>(null);
  const closeBtn = useRef<HTMLButtonElement>(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  useModal();
  // Una entrada en el historial: el botón atrás del teléfono cierra la descripción en vez de salir de la ficha.
  useEffect(() => {
    if (!(history.state as Record<string, unknown> | null)?.[STATE_KEY]) history.pushState({ ...(history.state ?? {}), [STATE_KEY]: true }, "");
    const onPop = () => onCloseRef.current();
    addEventListener("popstate", onPop);
    screen.current?.focus();
    return () => removeEventListener("popstate", onPop);
  }, []);
  const close = () => ((history.state as Record<string, unknown> | null)?.[STATE_KEY] ? history.back() : onCloseRef.current());

  function onKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "Escape") {
      e.preventDefault();
      close();
    } else if (e.key === "Tab") {
      // El único control es la flecha: el foco no sale de la pantalla.
      e.preventDefault();
      closeBtn.current?.focus();
    }
  }

  return createPortal(
    <section ref={screen} className="description-screen" role="dialog" aria-modal="true" aria-labelledby="description-title" tabIndex={-1} onKeyDown={onKeyDown}>
      <div className="description-screen-head">
        <button ref={closeBtn} type="button" className="icon-btn" aria-label="Cerrar" onClick={close}>
          <I.back />
        </button>
      </div>
      <h2 id="description-title">Descripción</h2>
      <Paragraphs paragraphs={paragraphs} className="listing-description" />
    </section>,
    document.body,
  );
}
