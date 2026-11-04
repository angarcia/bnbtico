// Puntitos de un carrusel de fotos (2026-11-03, en lugar del «1 / N»): la tarjeta de Explorar y la ficha. Solo React: la
// ficha se pinta en el servidor con la primera marcada y se hidrata igual.

const MAX_DOTS = 5;

/** Los puntitos de la tarjeta (2026-11-03, en lugar del «1 / N»): como mucho cinco, con la foto actual marcada (`on`). Con
 *  más fotos, la ventana sigue a la actual (la deja en el medio mientras puede) y el extremo que tiene más fotos detrás sale
 *  pequeño (`small`). Con una foto, ninguno. */
export function stripDots(index: number, count: number): { photo: number; on: boolean; small: boolean }[] {
  if (count < 2) return [];
  const size = Math.min(count, MAX_DOTS);
  const start = Math.min(Math.max(index - 2, 0), count - size);
  return Array.from({ length: size }, (_, i) => {
    const photo = start + i;
    const small = (i === 0 && start > 0) || (i === size - 1 && start + size < count);
    return { photo, on: photo === index, small };
  });
}

/** Los puntitos sobre la foto (decorativos: el que lee con lector de pantalla tiene su texto aparte). */
export function PhotoDots({ index, count }: { index: number; count: number }) {
  const dots = stripDots(index, count);
  if (!dots.length) return null;
  return (
    <span className="photo-dots" aria-hidden="true">
      {dots.map((d) => (
        <i key={d.photo} className={`${d.on ? "on" : ""}${d.small ? " small" : ""}`} />
      ))}
    </span>
  );
}
