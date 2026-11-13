import { useEffect, useRef, type FocusEvent, type MouseEvent, type PointerEvent, type RefObject } from "react";

export const KEYBOARD_ROOM = "320px";
/** Lo que tiene que encoger la vista para contar como teclado (un pellizco de zoom la encoge poco a poco). */
const KEYBOARD_MIN_PX = 100;
const NO_KEYBOARD = new Set(["checkbox", "radio", "file", "hidden", "submit", "button", "range", "color"]);
const isText = (el: EventTarget | null): el is HTMLInputElement | HTMLTextAreaElement =>
  el instanceof HTMLTextAreaElement || (el instanceof HTMLInputElement && !NO_KEYBOARD.has(el.type)); // chips y tarjetas son casillas: sin teclado
function setRoom(on: boolean): void {
  if (on) document.documentElement.style.setProperty("--kb", KEYBOARD_ROOM);
  else document.documentElement.style.removeProperty("--kb");
}
/** Sube el campo hasta debajo de la cabecera, ya y tras la animación del teclado (por si el navegador movió la vista). */
function lift(el: HTMLElement): void {
  const go = () => el.scrollIntoView({ block: "start", behavior: "smooth" });
  requestAnimationFrame(go);
  setTimeout(go, 350);
}

export function useFormKeyboard(ref: RefObject<HTMLFormElement | null>) {
  useEffect(() => () => setRoom(false), []);
  // El teclado que sale tarde (campo enfocado desde el código y tocado después) encoge la vista: el campo vuelve a subir.
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    let height = vv.height;
    const onResize = () => {
      const shrank = height - vv.height >= KEYBOARD_MIN_PX;
      height = vv.height;
      const el = document.activeElement;
      if (shrank && isText(el) && ref.current?.contains(el)) lift(el);
    };
    vv.addEventListener("resize", onResize);
    return () => vv.removeEventListener("resize", onResize);
  }, []);

  function onFocus(e: FocusEvent<HTMLFormElement>) {
    const el = e.target;
    if (!isText(el)) return;
    setRoom(true);
    lift(el);
  }

  // Tocar un campo que ya tenía el foco (en el iPhone, es cuando sale el teclado si se enfocó desde el código).
  const focusedBefore = useRef<Element | null>(null);
  function onPointerDown(e: PointerEvent<HTMLFormElement>) {
    focusedBefore.current = e.target === document.activeElement ? document.activeElement : null;
  }
  function onClick(e: MouseEvent<HTMLFormElement>) {
    const el = e.target;
    if (!isText(el) || focusedBefore.current !== el) return;
    setRoom(true);
    lift(el);
  }

  function onBlur(e: FocusEvent<HTMLFormElement>) {
    if (isText(e.relatedTarget) && e.currentTarget.contains(e.relatedTarget)) return; // de un campo a otro
    const left = e.target;
    // Después del toque: quitar el sitio ya movería la página entre el mousedown y el clic, y el toque sobre un chip
    // (p. ej. «¿Acepta alquiler por meses?» con el teclado abierto) se perdería. Si entretanto se enfocó otro campo de
    // texto (también el de la pantalla siguiente), el sitio se queda.
    setTimeout(() => {
      if (isText(document.activeElement)) return;
      setRoom(false);
      // Al cerrar el teclado la página encoge: el campo que se deja no se queda bajo la barra (scroll-margin-bottom en CSS).
      if (isText(left) && left.isConnected) requestAnimationFrame(() => left.scrollIntoView({ block: "nearest" }));
    }, 0);
  }

  return { onFocus, onBlur, onPointerDown, onClick };
}
